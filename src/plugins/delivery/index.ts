import { $, $$, addIcon, el, ic, text } from '../../core/dom';
import type { Item } from '../../core/items';
import type { Ctx, Plugin } from '../../core/plugin';
import './delivery.css';
import s from './delivery.module.css';

const label = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Any card with 2+ ship modes gets a segmented toggle, one segment per Costco radio; a segment clicks its radio.
function modeToggle(opts: HTMLElement, ctx: Ctx) {
  const radios = $$<HTMLInputElement>('input.shipModeId[type="radio"]', opts);
  if (radios.length < 2) return;
  const block = (r: HTMLInputElement) => r.closest<HTMLElement>('.individualShipBlock, .warehouse_pickup') ?? r.parentElement!;
  const name = (r: HTMLInputElement) => {
    const l = opts.querySelector<HTMLElement>(`label[for="${r.id}"]`) ?? block(r);
    return (text($('.ship-type-and-cost', l)) || text(l)).split(/[:(]/)[0].trim() || 'Option';
  };
  const icon = (r: HTMLInputElement, n: string) => (/pick-?up|warehouse/i.test(r.id + n) ? 'storefront' : /mail/i.test(n) ? 'envelope-simple' : 'truck');
  let tog = $(`:scope > .${s.mode}`, opts);
  if (!tog || tog.children.length !== radios.length) {
    tog?.remove();
    tog = el('div', { class: s.mode, role: 'group', 'aria-label': 'Delivery options' }, ...radios.map((r) => {
      const n = name(r);
      const b = el('button', { type: 'button', class: s.modeBtn, title: n }, ic(icon(r, n)), n);
      b.addEventListener('click', () => { if (!r.checked) r.click(); ctx.render(); });
      return b;
    }));
    opts.prepend(tog);
  }
  opts.classList.add('cm-has-mode');
  radios.forEach((r, i) => {
    block(r).classList.add('cm-opt');
    block(r).classList.toggle('cm-opt-on', r.checked);
    tog!.children[i].setAttribute('aria-pressed', String(r.checked));
  });
}

// The date becomes a chip; Costco's input stays on top of it, invisible, so a click still opens Costco's picker.
function dateChips(c: HTMLElement, ctx: Ctx) {
  $$<HTMLInputElement>('.cart-calendar-box input.date-input', c).forEach((inp) => {
    const d = new Date(inp.value);
    const txt = isNaN(d.getTime()) ? inp.value : label(d);
    const chip = $(`:scope > .${s.chip}`, inp.parentElement!);
    if (chip) chip.lastChild!.textContent = txt;
    else {
      inp.after(el('span', { class: s.chip, 'aria-hidden': 'true' }, ic('calendar-blank'), el('span', {}, txt)));
      inp.addEventListener('change', () => ctx.render());
    }
  });
}

function decorate(it: Item, ctx: Ctx) {
  const c = it.card;
  $$('.ship-type-and-cost', c).forEach((t) => addIcon(t, /room of choice|set up|delivery and/i.test(t.textContent ?? '') ? 'truck' : /email/i.test(t.textContent ?? '') ? 'envelope-simple' : 'package'));
  $$('.cart-delivery-details-link > a, .cart-delivery-details-link > button', c).forEach((b) => {
    if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', text(b));
    addIcon(b, 'info');
  });
  // The mode name moves into the tooltip; the details link sits beside the chip.
  const infoLink = $('.cart-delivery-details-link', c), shipType = $('.delivery-options .ship-type-and-cost', c);
  if (shipType && !shipType.dataset.cmMode) {
    shipType.dataset.cmMode = shipType.title = text(shipType).replace(/:.*$/, '').trim();
    shipType.setAttribute('aria-label', shipType.title);
  }
  const home = shipType && (shipType.closest<HTMLElement>('label.selection-item:has(.cart-calendar-box)') ?? shipType);
  if (infoLink && home && infoLink.parentElement !== home) home.append(infoLink);
  // Costco's "Earliest Delivery" note only shows when it differs from the chosen date.
  const edd = $('.estimated-delivery-date-div', c);
  if (edd && it.deliv) {
    const shown = Date.parse(text(edd).replace(/^Earliest Delivery\s*/i, ''));
    edd.classList.toggle('cm-hide', !isNaN(shown) && new Date(shown).toDateString() === it.deliv.toDateString());
  }
  const opts = $('.delivery-options', c);
  if (opts) modeToggle(opts, ctx);
  dateChips(c, ctx);
}

export const delivery: Plugin = {
  id: 'delivery',
  name: 'Delivery date chips and mode toggle',
  render: (ctx) => ctx.items.forEach((it) => decorate(it, ctx)),
};
