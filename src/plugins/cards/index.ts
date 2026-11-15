import { $, $$, addIcon, el, ic } from '../../core/dom';
import { fmt0, shortDate, urgency } from '../../core/format';
import { SAME_DAY, type Item } from '../../core/items';
import type { Plugin } from '../../core/plugin';
import './cards.css';
import './grid.css';
import './grocery.css';

// Price line: Costco's two green lines become "Save $X" plus an end date beside the price.
function priceLine(it: Item) {
  const c = it.card;
  const promoEl = $('.h8-style-guide-green', c);
  if (promoEl && (it.save || it.end)) promoEl.classList.add('cm-hide');
  const u = urgency(it.days);
  const extras: HTMLElement[] = [];
  if (it.save) extras.push(el('span', { class: 'cm-save cm-extra' }, 'Save ', el('b', {}, fmt0(it.save))));
  if (it.end && u?.cls === 'cm-urgent') extras.push(el('span', { class: 'cm-badge cm-extra' }, `${u.label} · ${shortDate(it.end)}`));
  else if (it.end) extras.push(el('span', { class: `cm-when cm-extra ${u ? u.cls : ''}` }, ic('timer'), u ? `${u.label} · ${shortDate(it.end)}` : `Ends ${shortDate(it.end)}`));
  if (it.email) extras.push(el('span', { class: 'cm-when cm-extra' }, ic('envelope-simple'), 'Delivered by email'));
  const priceRow = $('.item-description-prices > .price', c);
  if (priceRow) priceRow.append(...extras);
  else $('.product-title', c)?.after(el('div', { class: 'cm-extra' }, ...extras));
}

// Actions: stepper, then remove / add to list / save for later as icon buttons on one row.
function actions(c: HTMLElement) {
  const rm = $('.remove-link button, button[id^="removeItemLink-btn"]', c);
  addIcon(rm, 'trash');
  const wl = $$('.wish-list button', c);
  addIcon(wl[0], 'list-plus');
  addIcon(wl[1], 'bookmark-simple');
  if (wl[1] && !wl[1].getAttribute('aria-label')) wl[1].setAttribute('aria-label', 'Save for Later');
  const stepRow = $('.quantity-selector-v2', c)?.parentElement, wlBox = $('.wish-list', c);
  if (stepRow && wlBox && wlBox.parentElement !== stepRow) { wlBox.parentElement?.classList.add('cm-hide'); stepRow.append(wlBox); }
  // 2-Day Delivery items keep Remove on its own row, outside .remove-link; it joins the icons after the stepper.
  if (rm && stepRow && !rm.closest('.remove-link') && rm.parentElement !== stepRow) {
    rm.parentElement?.classList.add('cm-hide');
    rm.classList.add('cm-rm');
    if (!rm.getAttribute('aria-label')) rm.setAttribute('aria-label', 'Remove');
    wlBox?.parentElement === stepRow ? wlBox.before(rm) : stepRow.append(rm);
  }
  addIcon($('.quantity-selector-v2 button[id^="sub-"]', c), 'minus');
  addIcon($('.quantity-selector-v2 button[id^="add-"]', c), 'plus');
  $$('.a11y-tooltip', c).forEach((b) => addIcon(b, 'info'));
}

function decorate(it: Item) {
  const c = it.card;
  const row = $(':scope > .row', c), priceBox = $('.item-description-prices', c)?.parentElement;
  if (row && priceBox && priceBox.parentElement !== row) { priceBox.classList.add('cm-price-slot'); row.append(priceBox); }
  c.classList.toggle('cm-qty1', it.qty === 1);
  c.classList.toggle('cm-email', it.email);
  $$('.ltl-container, [id^="item_level_message_"]', c).forEach((n) => { if (SAME_DAY.test(n.textContent ?? '')) n.classList.add('cm-hide'); });
  // "Shipping & Handling Included" repeats on every item.
  $$('.shipping-cost', c).forEach((s) => s.classList.toggle('cm-hide', /included/i.test(s.textContent ?? '')));
  priceLine(it);
  actions(c);
}

export const cards: Plugin = {
  id: 'cards',
  name: 'Compact item cards',
  render: (ctx) => ctx.items.forEach(decorate),
};
