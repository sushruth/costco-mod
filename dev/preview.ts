// Builds cart.preview.html: the saved cart with Costco's scripts stripped and the userscript injected,
// so it renders like the live page with Violentmonkey on. Usage: bun dev/preview.ts [saved.html]
const root = new URL('..', import.meta.url).pathname;
const src = process.argv[2] ?? `${root}cart.html`;
const html = await Bun.file(src).text();
const out = html
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<\/body>/i, `<script src="costco-cart.user.js?${Date.now()}"></script></body>`);
await Bun.write(`${root}cart.preview.html`, out);
console.log(`${root}cart.preview.html`);
