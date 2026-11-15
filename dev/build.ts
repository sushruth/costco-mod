// Bundles src/ into a userscript: header + one IIFE with the CSS inlined.
//   bun dev/build.ts          → costco-cart.user.js, the published build (committed; the install URL points at it)
//   bun dev/build.ts --watch  → dev/costco-cart.dev.user.js, the local dev build with dev-only plugins (git-ignored)
import { watch } from 'node:fs';
import { banner } from '../src/meta';

const root = new URL('..', import.meta.url).pathname;
const dev = process.argv.includes('--watch');
const out = dev ? `${root}dev/costco-cart.dev.user.js` : `${root}costco-cart.user.js`;

async function build() {
  const r = await Bun.build({ entrypoints: [`${root}src/main.ts`], target: 'browser', format: 'iife', define: { __DEV__: String(dev) } });
  if (!r.success) { console.error(...r.logs); return; }
  const js = await r.outputs.find((o) => o.kind === 'entry-point')!.text();
  const css = await r.outputs.find((o) => o.path.endsWith('.css'))?.text() ?? '';
  if (!js.includes('__CM_CSS__')) throw new Error('main.ts no longer references __CM_CSS__');
  await Bun.write(out, `${banner(dev)}\n\n${js.replace('__CM_CSS__', () => JSON.stringify(css))}`);
  console.log(`${new Date().toLocaleTimeString()} built ${out} (${Math.round((js.length + css.length) / 1024)} KB)`);
}

await build();
if (dev) {
  let t: Timer;
  // A broken intermediate edit logs its error and waits for the next save.
  watch(`${root}src`, { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => build().catch((e) => console.error(String(e))), 50); });
  console.log('watching src/ — install from http://127.0.0.1:8723/dev/costco-cart.dev.user.js');
}
