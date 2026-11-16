import { $, el } from '../../core/dom';

// Product pages: the 2-Day delivery fine print runs 6 lines to say one useful thing, the free-delivery threshold.
// The threshold goes next to the fee; the paragraph shrinks to one line with a More toggle (a tap, so it works on phones).
export function finePrint() {
  const box = $('[data-testid=fulfillment-deliveryInfo-secondary-info]:not([data-cm-fine])');
  if (!box) return;
  box.dataset.cmFine = '';
  const txt = box.textContent ?? '';
  const free = txt.match(/(\$\d[\d,]*) or more/)?.[1];
  if (free) $('[data-testid=fulfillment-deliveryInfo-primary-info]')?.append(el('span', { class: 'cm-when cm-free' }, `Free at ${free}+`));
  const more = el('button', { type: 'button', class: 'cm-link cm-fine-more', 'aria-expanded': 'false' }, 'More');
  more.addEventListener('click', () => {
    const open = box.classList.toggle('cm-fine-open');
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Less' : 'More';
  });
  box.after(more);
}
