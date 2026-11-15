import { $, el } from '../../core/dom';
import s from './filters.module.css';
import { withRange } from './price';

// Member Reviews as four stars: clicking the 4th loads "4 & up" (refinement=rating=(4,5)), clicking it again clears it.
// Hovering previews the pick. Costco's checkboxes stay in the page, out of sight, and lend their star icon.
export function ratingStars() {
  const acc = $('[data-testid=left-column] [data-testid=Accordion_rating]');
  const details = acc && $('.MuiAccordionDetails-root', acc);
  const star = acc && $('[data-testid=Rating] [role=img] > svg', acc);
  if (!details || !star || $(`.${s.rating}`, details)) return;
  const params = new URLSearchParams(location.search);
  const ref = params.get('refinement') ?? '';
  const cur = +(ref.match(/(?:^|\|\|)rating=\((\d)/)?.[1] ?? 0);
  const caption = el('div', { class: s.caption });
  // four stars: Costco's highest choice is 4 & up, and it rounds anything finer down to whole stars
  const stars = [1, 2, 3, 4].map((n) => {
    const b = el('button', { type: 'button', class: s.star, 'aria-label': `${n} stars & up`, title: `${n} & up` });
    const svg = star.cloneNode(true) as SVGElement;
    svg.removeAttribute('class');
    svg.removeAttribute('style');
    b.append(svg);
    return b;
  });
  const paint = (n: number, hover = false) => {
    stars.forEach((b, i) => b.classList.toggle(s.on, i < n));
    caption.textContent = n ? `${n} & up` : 'Any rating';
    caption.classList.toggle(s.preview, hover);
  };
  stars.forEach((b, i) => {
    const n = i + 1;
    b.addEventListener('mouseenter', () => paint(n, true));
    b.addEventListener('focus', () => paint(n, true));
    b.addEventListener('click', () => {
      const next = withRange(ref, 'rating', n === cur ? null : [n, 5]);
      next ? params.set('refinement', next) : params.delete('refinement');
      location.search = params.toString();
    });
  });
  const row = el('div', { class: s.starRow }, ...stars);
  row.addEventListener('mouseleave', () => paint(cur));
  paint(cur);
  details.prepend(el('div', { class: s.rating }, row, caption));
  acc.classList.add(s.hasStars);
}
