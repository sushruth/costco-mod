import { $, copy, el, ic } from '../../core/dom';
import { fmt, fmt0, shortDate, urgency } from '../../core/format';
import type { Item } from '../../core/items';
import type { Ctx, Plugin } from '../../core/plugin';
import { renderBar } from './bar';
import { dateGroups, deliveryStrip } from './strip';
import { readTotals, summaryText } from './summary';
import './panel.css';
import s from './panel.module.css';

// One row per item: name and line price, then promo end, an off-day delivery, quantity and savings.
function row(i: Item, offDay: boolean) {
  const u = urgency(i.days);
  const meta: HTMLElement[] = [];
  if (i.end) meta.push(el('span', { class: u ? u.cls : '', 'aria-label': `Promo ends ${shortDate(i.end)}` }, ic('timer'),
    shortDate(i.end) + (u?.cls === 'cm-urgent' ? (i.days! < 0 ? ' (ended)' : i.days === 0 ? ' (today)' : ' (tomorrow)') : '')));
  if (i.deliv && offDay) meta.push(el('span', { class: 'cm-warn', 'aria-label': `Delivery ${shortDate(i.deliv)}` }, ic('truck'), shortDate(i.deliv)));
  if (i.qty > 1) meta.push(el('span', {}, `Qty ${i.qty}`));
  const li = el('li', { class: s.row, tabindex: '0' },
    el('div', { class: s.name }, i.href ? el('a', { href: i.href, title: i.name }, i.name) : i.name),
    el('div', { class: s.price }, fmt(i.price * i.qty)),
    el('div', { class: s.meta }, meta),
    i.save ? el('div', { class: `cm-save ${s.rowSave}` }, el('b', {}, '-' + fmt0(i.save * i.qty))) : el('div'));
  // Clicking a row scrolls to its card and flashes it.
  const jump = (e: Event) => {
    if ((e.target as Element).closest('a') || (e instanceof KeyboardEvent && e.key !== 'Enter')) return;
    i.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    i.card.classList.add('cm-flash');
    setTimeout(() => i.card.classList.remove('cm-flash'), 1200);
  };
  li.addEventListener('click', jump);
  li.addEventListener('keydown', jump);
  return li;
}

function footer(items: Item[], ctx: Ctx) {
  const totals = readTotals();
  const pre = el('pre', { class: s.pre }, summaryText(items, totals));
  const copyBtn = el('button', { type: 'button', class: 'cm-btn' }, ic('copy'), 'Copy summary');
  copyBtn.addEventListener('click', async () => {
    const ok = await copy(summaryText(items, totals));
    copyBtn.replaceChildren(ic(ok ? 'check' : 'warning'), ok ? 'Copied' : 'Copy failed');
    setTimeout(() => copyBtn.replaceChildren(ic('copy'), 'Copy summary'), 2000);
  });
  const showBtn = el('button', { type: 'button', class: 'cm-btn cm-icon-btn', 'aria-label': 'Preview summary text', title: 'Preview summary text' }, ic('eye'));
  showBtn.addEventListener('click', () => pre.classList.toggle(s.open));
  const offBtn = el('button', { type: 'button', class: 'cm-link' }, 'Original view');
  offBtn.addEventListener('click', () => ctx.setOn(false));
  return [el('div', { class: s.foot }, copyBtn, showBtn, offBtn), pre];
}

function render(ctx: Ctx) {
  const { items } = ctx;
  const count = items.reduce((n, i) => n + i.qty, 0);
  const itemSavings = items.reduce((n, i) => n + i.save * i.qty, 0);
  const groups = dateGroups(items);
  const mainDate = groups[0]?.date.toDateString();
  const review = el('section', { id: 'cm-review', class: s.review, 'aria-label': 'Order review' },
    el('div', { class: s.head }, 'Order review ', el('span', {}, `· ${count} item${count === 1 ? '' : 's'}`)),
    deliveryStrip(groups),
    el('ul', { class: s.rows }, items.map((i) => row(i, groups.length > 1 && i.deliv?.toDateString() !== mainDate))),
    ...footer(items, ctx),
    itemSavings ? el('div', { class: s.savings }, el('span', {}, 'Instant savings (in prices)'), el('span', {}, '-' + fmt(itemSavings))) : null);
  const old = $('#cm-review');
  old ? old.replaceWith(review) : $('#order-summary-column')?.before(review);
  renderBar(items, readTotals().total, review);
}

export const panel: Plugin = {
  id: 'panel',
  name: 'Order review panel',
  render,
};
