import { $$ } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './orders.css';

// Costco's account pages are React with hashed MUI classes, so the parts get data-cm-o marks from Costco's own ids
// (orderDate_<n>, Showing) and the page's shape, and the CSS keys on the marks.
const set = (n: Element | null | undefined, v: string) => { if (n instanceof HTMLElement && n.dataset.cmO !== v) n.dataset.cmO = v; };

function mark() {
  for (const d of $$('[id^=orderDate_]')) {
    const meta = d.parentElement, head = meta?.parentElement, card = head?.parentElement;
    if (!meta || !head || !card) continue;
    set(card, 'card'); set(head, 'head'); set(meta, 'meta'); set(head.children[1], 'actions');
    const st = head.nextElementSibling;
    set(st, 'status');
    // the status bar is the first block with text but no photo, sitting beside the item photos
    const bar = st && [...st.querySelectorAll('div')].find((x) => x.textContent?.trim() && !x.querySelector('img') && x.parentElement?.querySelector('img'));
    if (bar) {
      set(bar, 'statusbar');
      const s = (bar.firstElementChild?.textContent ?? '').toLowerCase();
      const state = /cancel/.test(s) ? 'cancelled' : /deliver|complete|picked/.test(s) ? 'done' : 'active';
      if (bar.dataset.cmState !== state) bar.dataset.cmState = state;
    }
    for (const img of card.querySelectorAll('img')) {
      const row = img.closest('a')?.parentElement?.parentElement;
      set(row, 'item'); set(row?.parentElement, 'itemwrap');
    }
    for (const a of card.querySelectorAll<HTMLAnchorElement>('a')) {
      if (a.textContent?.trim() === '+ More') set(a.parentElement, 'more');
      if (a.getAttribute('href')?.includes('/buyagain/') && !a.title) { a.title = a.textContent!.trim(); a.setAttribute('aria-label', a.title); }
    }
  }
  const sel = document.getElementById('Showing');
  const note = $$('div').find((e) => !e.children.length && /new orders will appear/i.test(e.textContent ?? ''));
  let bar: Element | null | undefined = note;
  while (bar && sel && !bar.contains(sel)) bar = bar.parentElement;
  set(bar, 'toolbar');
  const top = $$('button').find((b) => /back to top/i.test(b.textContent ?? ''))?.parentElement?.parentElement;
  set(top, 'backtop'); set(top?.previousElementSibling, 'upsnote');
}

export const orders: Plugin = {
  id: 'orders',
  name: 'Compact orders list',
  setup: () => {
    // throttled: the account app mutates continuously, so a debounce would never fire
    let t = 0;
    new MutationObserver(() => { t ||= window.setTimeout(() => { t = 0; mark(); }, 150); }).observe(document.body, { childList: true, subtree: true });
    mark();
  },
};
