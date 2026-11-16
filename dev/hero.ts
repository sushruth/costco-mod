// Builds docs/hero.png, the README's top image, from the "after" shots in docs/compare.
// Run with `bun run hero`; the pre-commit hook in .githooks runs it when docs/compare changes.
import { $ } from 'bun';

const root = new URL('..', import.meta.url).pathname;
// Back to front; the phone sits in front at the right.
const desk = ['home', 'search', 'deals', 'product', 'cart'];
const W = 1240, H = 700, w = 700, step = 92, drop = 34;

const layer = (name: string, i: number) =>
  `<img src="/docs/compare/${name}-after.png" style="left:${i * step}px; top:${i * drop}px; width:${w}px; height:${(w * 1000) / 1440}px">`;
const html = `<!doctype html><meta charset="utf-8"><style>
  html, body { margin:0; background:transparent; }
  .c { position:relative; width:${W}px; height:${H}px; }
  img { position:absolute; display:block; object-fit:cover; object-position:top; border-radius:8px;
    box-shadow:0 2px 6px rgb(51 65 85 / .14), 0 12px 32px rgb(51 65 85 / .16); }
</style><div class="c">${desk.map(layer).join('')}
  <img src="/docs/compare/phone-after.png" style="right:8px; top:60px; width:290px; height:628px; border-radius:22px">
</div>`;

const server = Bun.serve({
  port: 0,
  fetch: (req) => {
    const path = new URL(req.url).pathname;
    if (path === '/') return new Response(html, { headers: { 'content-type': 'text/html' } });
    const f = Bun.file(root + path);
    return f.exists().then((ok) => new Response(ok ? f : null, { status: ok ? 200 : 404 }));
  },
});
try {
  await $`shot ${server.url.href} -o ${root}docs/hero.png --width ${W} --height ${H} --dsf 2 --bg transparent --pad 0 --shadow 0 --radius 0 --no-rays --chrome none --wait 800`.quiet();
  console.log('wrote docs/hero.png');
} finally {
  server.stop();
}
