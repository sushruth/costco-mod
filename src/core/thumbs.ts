import { $, el } from './dom';
import type { Item } from './items';
import s from './thumbs.module.css';

// Scrolls to an item's card and flashes it.
export function jumpTo(card: HTMLElement) {
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('cm-flash');
  setTimeout(() => card.classList.remove('cm-flash'), 1200);
}

// Each item as its own cart image: hover shows the full name, click goes to its card.
export function thumbs(items: Item[]) {
  return el('span', { class: s.row }, items.map((i) => {
    const src = $<HTMLImageElement>('.item-thumbnail img', i.card)?.src;
    const b = el('button', { type: 'button', class: s.thumb, title: i.name, 'aria-label': i.name },
      src ? el('img', { src, alt: '' }) : i.name.slice(0, 1));
    b.addEventListener('click', (e) => { e.stopPropagation(); jumpTo(i.card); });
    return b;
  }));
}
