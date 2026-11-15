import { $, $$, el, text } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './search.css';
import './sidebar.css';
import s from './search.module.css';
import { priceSlider } from './price';
import { ratingStars } from './rating';
import { unitPrice } from './unit';

// Text that became an icon in search.css keeps its words as a hover title.
const TITLES: [string, (n: HTMLElement) => string][] = [
  ['[data-testid^=Link_ProductDeliveryBadge_]', text],
  ['[data-testid^=AddToListButtonAddToList_]', () => 'Add to List'],
  ['[data-testid^=DeliveryChannelBadge_]', (n) => $$('[data-testid=Text]', n).map(text).join(' ')],
  ['[data-testid^=WarehouseChannelBadge_]', (n) => { const [a, b, c] = $$('[data-testid=Text]', n).map(text); return `${a}: ${b}${c ? ` ${c}` : ''}`; }],
  ['[data-testid^=Checkbox]', () => 'Compare'],
  ['[data-testid^=addToCartBtn-]', () => 'Add to Cart'],
  ['[data-testid^=Button_ProductDetailsButton]', () => 'Select Options'],
];

// Add to Cart icon: Phosphor has no cart-plus, so this one is drawn on Phosphor's grid (256 units, 16-unit round
// strokes) with the plus inside the basket, the way calendar-plus and file-plus carry theirs.
const CART_PLUS = '<svg data-cm viewBox="0 0 256 256" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M16,32H40L76,176H200L224,72H50"/><path d="M114,124h48M138,100v48"/>'
  + '<circle cx="84" cy="216" r="14" fill="currentColor" stroke="none"/><circle cx="192" cy="216" r="14" fill="currentColor" stroke="none"/></svg>';

// Size chips show only their label; the count moves to the hover title.
function filters() {
  for (const l of $$('[data-testid=left-column] [data-testid*=size] label')) l.title ||= text(l);
  priceSlider();
  ratingStars();
}

function tiles() {
  for (const t of $$('[data-testid=main-column] [data-testid^=ProductTile_]')) {
    for (const [sel, f] of TITLES) for (const n of $$(sel, t)) n.title ||= f(n);
    const price = $('[data-testid^=Text_Price_]', t);
    const u = unitPrice(text($('h3', t)), +text(price).replace(/[^\d.]/g, ''));
    if (price && u && !$(`.${s.unit}`, t)) price.after(el('span', { class: s.unit }, el('b', {}, u[0]), ` / ${u[1]}`));
    const cart = $('[data-testid^=addToCartBtn-]', t);
    if (cart && !$(':scope > svg[data-cm]', cart)) cart.insertAdjacentHTML('beforeend', CART_PLUS);
    // Red and black pills (Costco Direct, Black Friday Deal) go before the blue ones. Their colors come from hashed
    // class names, so the pill's painted color decides.
    for (const p of $$('[data-testid^=PillBadge_]', t)) {
      const bg = getComputedStyle($('a > div', p) ?? p).backgroundColor.match(/\d+/g)?.map(Number) ?? [];
      p.dataset.cmLoud = bg.length >= 3 && bg[2] < bg[0] + 40 ? '1' : '0';
    }
  }
}

// Result tiles: compact, iconised, with a unit price under each price. React adds tiles as results load and
// filters change, so new tiles are picked up as they appear.
export const search: Plugin = {
  id: 'search',
  name: 'Compact search results',
  setup: () => {
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(() => { tiles(); filters(); }, 100); }).observe(document.body, { childList: true, subtree: true });
    tiles();
    filters();
  },
};
