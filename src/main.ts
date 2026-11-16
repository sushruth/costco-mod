import { $, $$, addStyle, el, loadIcons } from './core/dom';
import { readItems } from './core/items';
import type { Ctx, Plugin } from './core/plugin';
import { flag, kv } from './core/store';
import './core/base.css';
import { cards } from './plugins/cards';
import { checkout } from './plugins/checkout';
import { deals } from './plugins/deals';
import { delivery } from './plugins/delivery';
import { footer } from './plugins/footer';
import { header } from './plugins/header';
import { pairing } from './plugins/pairing';
import { panel } from './plugins/panel';
import { promos } from './plugins/promos';
import { redlines } from './plugins/redlines';
import { search } from './plugins/search';
import { services } from './plugins/services';
import { settings } from './plugins/settings';

// Order matters: pairing reorders items before the plugins that draw them.
const PLUGINS: Plugin[] = [pairing, cards, delivery, services, panel, promos, header, search, deals, checkout, footer, settings, redlines];

declare const __CM_CSS__: string; // the bundled CSS, inlined by dev/build.ts

declare const __DEV__: boolean; // true only in the local dev build (bun run dev)

// Saved plugin switches; a plugin without an entry is on, except dev plugins, which start off.
const KEY = 'cm-plugins';
const saved = kv.get<Record<string, boolean>>(KEY) ?? {};
const listed = PLUGINS.filter((p) => !p.dev || __DEV__);
const wanted = (p: Plugin) => p.locked || (saved[p.id] ?? !p.dev);
const active = listed.filter(wanted);
const isProduct = /^\/p\/|\.product\.\d+\.html/.test(location.pathname);
// Checkout reuses the cart's ids, so its address is the tell.
const hasItems = !!$('#order-items') && !!$('#order-summary-column');
const isCheckout = hasItems && /SinglePageCheckout/i.test(location.pathname);
const isCart = hasItems && !isCheckout;
// Off the cart, only the site header, search results, deal status, checkout, footer and settings gear run, plus Redlines in the dev build.
// Checkout also gets the order review panel.
const here = isCart ? active : active.filter((p) => [header, search, deals, checkout, footer, settings, redlines, ...(isCheckout ? [panel] : [])].includes(p));

function setOn(on: boolean) {
  document.documentElement.classList.toggle('cm-on', on);
  flag.set('cm-off', !on);
  for (const p of here) p.toggle?.(on);
}

let observer: MutationObserver | undefined;
let timer = 0;
function render() {
  observer?.disconnect();
  $$('.cm-extra').forEach((n) => n.remove());
  const ctx: Ctx = { ...base, items: readItems() };
  for (const p of here) p.render?.(ctx);
  observer ??= new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(render, 150); });
  for (const s of ['#order-items', '#order-summary-column']) { const n = $(s); if (n) observer.observe(n, { childList: true, subtree: true, characterData: true }); }
}

const base: Omit<Ctx, 'items'> = {
  render, setOn,
  plugins: listed,
  isEnabled: (p) => (p.live ? document.documentElement.classList.contains(`cm-p-${p.id}`) : active.includes(p)),
  // ponytail: most switches reload the page; live unmounting would need every plugin to undo its DOM moves.
  // CSS-only plugins (live) switch in place by toggling their root class.
  setEnabled: (p, on) => {
    kv.set(KEY, { ...saved, [p.id]: on });
    saved[p.id] = on;
    if (p.live) document.documentElement.classList.toggle(`cm-p-${p.id}`, on);
    else location.reload();
  },
};

if (isProduct) for (const p of active) p.product?.();
if (here.length) {
  loadIcons();
  addStyle('cm-style', __CM_CSS__);
  document.documentElement.classList.add(...here.map((p) => `cm-p-${p.id}`));
  if (isCart) {
    const restore = el('button', { type: 'button', id: 'cm-restore' }, 'Cleaned-up view');
    restore.addEventListener('click', () => setOn(true));
    document.body.append(restore);
  }
  const ctx: Ctx = { ...base, items: [] };
  for (const p of here) p.setup?.(ctx);
  setOn(!flag.get('cm-off'));
  // React pages can rewrite <html class> while hydrating, wiping all our classes at once; put them back.
  // Our own switches remove one class at a time, so they're left alone.
  new MutationObserver((recs) => {
    const html = document.documentElement;
    if ([...html.classList].some((c) => c.startsWith('cm-'))) return;
    const old = recs.map((r) => r.oldValue ?? '').join(' ').split(/\s+/).filter((c) => c.startsWith('cm-'));
    if (old.length) html.classList.add(...new Set(old));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  if (hasItems) render();
}
