import { $, el, ic } from '../../core/dom';
import { fmt, fmt0, money } from '../../core/format';
import { thumbs } from '../../core/thumbs';
import type { Item } from '../../core/items';
import type { Ctx, Plugin } from '../../core/plugin';
import { promoCache } from './cache';
import { parsePromos } from './parse';
import s from './promos.module.css';

// Each cached promo applies at its best tier: count promos by quantity, spend promos by dollars, bundles when the partner is in the cart.
function promoLines(items: Item[]) {
  const groups = new Map<string, { p: ReturnType<typeof parsePromos>['promos'][number]; items: Item[] }>();
  for (const it of items) for (const p of promoCache.get(it.itemNo)?.promos ?? []) {
    const g = groups.get(p.key) ?? { p, items: [] };
    g.items.push(it);
    groups.set(p.key, g);
  }
  const lines: { name: string; amount: number; items: Item[] }[] = [];
  for (const { p, items: its } of groups.values()) {
    let amount = 0;
    if (p.type === 'bundle') amount = items.some((i) => !its.includes(i) && i.name.toLowerCase().includes(p.partner)) ? p.amount : 0;
    else {
      const have = p.type === 'spend' ? its.reduce((n, i) => n + i.price * i.qty, 0) : its.reduce((n, i) => n + i.qty, 0);
      amount = p.tiers.filter(([need]) => have >= need).reduce((best, [, save]) => Math.max(best, save), 0);
    }
    if (amount) lines.push({ name: p.name, amount, items: its });
  }
  return lines.sort((a, b) => b.amount - a.amount);
}

let fetching = false;
let last: Ctx | null = null;

// Same-origin fetch of each product page, one at a time; results stay in this browser.
async function fetchPromos(itemNos: string[]) {
  fetching = true;
  if (last) render(last);
  for (const n of itemNos) {
    try {
      const r = await fetch(`${location.origin}/p/-/${n}`, { credentials: 'same-origin' });
      if (r.ok) promoCache.set(n, parsePromos(await r.text()).promos);
    } catch {}
  }
  fetching = false;
  last?.render();
}

// Explains Costco's "Discount on Order" line, and checks the sum against Costco's own total.
function render(ctx: Ctx) {
  last = ctx;
  $(`.${s.box}`)?.remove();
  const anchor = $('#totalDiscountOutput');
  const discount = Math.abs(money(anchor && (anchor.getAttribute('discount') || anchor.textContent)));
  if (!anchor || !discount) return;
  const missing = ctx.items.filter((i) => i.itemNo && !promoCache.get(i.itemNo)).map((i) => i.itemNo);
  const lines = promoLines(ctx.items);
  const gap = Math.round((discount - lines.reduce((n, l) => n + l.amount, 0)) * 100) / 100;
  const fetchBtn = el('button', { type: 'button', class: `cm-link ${s.fetch}` }, fetching ? 'Fetching…' : 'Fetch now');
  fetchBtn.toggleAttribute('disabled', fetching);
  fetchBtn.addEventListener('click', () => fetchPromos(missing));
  anchor.after(el('div', { class: s.box },
    ...lines.map((l) => el('div', { class: s.line },
      el('span', { class: s.name }, l.name, thumbs(l.items)),
      el('span', {}, '-' + fmt0(l.amount)))),
    missing.length
      ? el('div', { class: s.note }, ic('info'),
        el('span', { title: 'Visiting each product page also fills these in. Everything stays in this browser.' },
          `Promo details missing for ${missing.length} item${missing.length > 1 ? 's' : ''}.`), fetchBtn)
      : gap === 0
        ? el('div', { class: s.note }, ic('check-circle'), "Matches Costco's discount")
        : el('div', { class: `${s.note} ${s.gap}` }, ic('warning'), `${gap > 0 ? 'Unexplained' : 'Over-counted'} ${fmt(Math.abs(gap))}`)));
}

export const promos: Plugin = {
  id: 'promos',
  name: 'Order discount breakdown',
  // Product pages: save this item's promos so the cart can explain its discount without fetching.
  product: () => {
    const r = parsePromos(document.documentElement.outerHTML);
    if (r.itemNo) promoCache.set(r.itemNo, r.promos);
  },
  render,
};
