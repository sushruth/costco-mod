// Builds docs/hero.png, the README's top image: crops of the parts the script improves, cut from the "after" shots
// in docs/compare and layered loosely with overlap. Run with `bun run hero`; the pre-commit hook runs it when docs/compare changes.
import { $ } from 'bun';

const root = new URL('..', import.meta.url).pathname;
const W = 1240, H = 700;

// [shot, crop x, y, w, h in the 1440px shot, scale, left, top, tilt°] — listed back to front.
// ponytail: hand-placed; if a shot's layout moves, its crop rectangle needs a new look.
const pieces: [string, number, number, number, number, number, number, number, number][] = [
  ['search', 270, 200, 700, 370, 0.78, 30, 64, -1.5], // result tiles: badges, price per unit, cart icon
  ['deals', 20, 350, 700, 400, 0.62, 560, 18, 1.2], // savings cards in the same tile style
  ['cart', 964, 144, 440, 400, 0.7, 930, 250, -0.8], // order review panel
  ['locator', 14, 352, 470, 156, 0.8, 18, 360, 1], // warehouse hours, Executive hour and gas on one line
  ['cart', 24, 236, 910, 260, 0.62, 330, 300, 0.6], // compact cart cards
  ['product', 844, 406, 572, 236, 0.68, 760, 120, -1.2], // promo end date under the price
  ['checkout', 6, 318, 1030, 252, 0.6, 80, 500, -0.6], // wallet chip, Affirm pill and card box
  ['search', 0, 0, 1440, 88, 0.62, 300, 610, 0.4], // two-row header
];

const piece = ([shot, x, y, w, h, s, left, top, tilt]: (typeof pieces)[number]) =>
  `<div class="p" style="left:${left}px; top:${top}px; width:${w * s}px; height:${h * s}px; transform:rotate(${tilt}deg)">` +
  `<img src="/docs/compare/${shot}-after.png" style="width:${1440 * s}px; margin:${-y * s}px 0 0 ${-x * s}px"></div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
  html, body { margin:0; background:transparent; }
  .c { position:relative; width:${W}px; height:${H}px; }
  .p { position:absolute; overflow:hidden; border-radius:8px; background:#fff;
    box-shadow:0 0 0 1px rgb(51 65 85 / .08), 0 2px 6px rgb(51 65 85 / .14), 0 12px 32px rgb(51 65 85 / .18); }
  .p img { display:block; }
</style><div class="c">${pieces.map(piece).join('')}</div>`;

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
