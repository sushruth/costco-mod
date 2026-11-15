import { $, el, ic } from '../../core/dom';
import type { Item } from '../../core/items';
import s from './panel.module.css';

// Phones and tablets: a fixed bar with the total, promos ending soon, and Costco's Checkout button.
export function renderBar(items: Item[], total: string, review: HTMLElement) {
  const real = $<HTMLButtonElement>('#shopCartCheckoutSubmitButton');
  if (!real) return; // checkout has its own Place Order
  let bar = $(`.${s.bar}`);
  if (!bar) { bar = el('div', { class: s.bar, role: 'region', 'aria-label': 'Checkout bar' }); document.body.append(bar); }
  const go = el('button', { type: 'button', class: s.barGo }, 'Checkout');
  go.disabled = !real || real.disabled;
  go.addEventListener('click', () => real?.click());
  const urgent = items.filter((i) => i.days != null && i.days <= 1).length;
  const alert = urgent ? el('button', { type: 'button', class: s.barAlert }, ic('timer'), ` ${urgent} promo${urgent > 1 ? 's' : ''} ending`) : null;
  alert?.addEventListener('click', () => review.scrollIntoView({ behavior: 'smooth' }));
  bar.replaceChildren(el('div', {}, el('div', { class: s.barLabel }, 'Est. total'), el('div', { class: s.barTotal }, total), alert), go);
}
