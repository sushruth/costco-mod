import { $$, el, ic } from '../../core/dom';
import { DAY, longDate } from '../../core/format';
import type { Plugin } from '../../core/plugin';
import './deals.css';

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const now = () => new Date(new Date().toDateString());

// "10/23/26" or "Oct. 30" → that day; a year-less date lands within half a year of today.
function day(s: string) {
  const n = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (n) return new Date(+n[3] < 100 ? 2000 + +n[3] : +n[3], +n[1] - 1, +n[2]);
  const m = s.match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2})/);
  const mi = m ? MON.indexOf(m[1].toLowerCase()) : -1;
  if (mi < 0) return null;
  const t = now(), d = new Date(t.getFullYear(), mi, +m![2]);
  if (d.getTime() - t.getTime() > 183 * DAY) d.setFullYear(d.getFullYear() - 1);
  if (t.getTime() - d.getTime() > 183 * DAY) d.setFullYear(d.getFullYear() + 1);
  return d;
}

// Each deal's "Valid A - B" line gets its status: starts later, ends soon, or ended.
function mark() {
  for (const leaf of $$('[data-testid=Text]:not([data-cm-deal])')) {
    // Costco draws the line twice: a hidden aria-hidden spacer, and the visible copy laid over it.
    if (leaf.children.length || leaf.ariaHidden === 'true' || !/^Valid /.test(leaf.textContent ?? '')) continue;
    leaf.dataset.cmDeal = '';
    const [a, b] = (leaf.textContent ?? '').slice(6).split(/\s+-\s+/).map(day);
    const start = b ? a : null, end = b ?? a;
    if (!end) continue;
    const t = now().getTime(), left = Math.round((end.getTime() - t) / DAY);
    const card = leaf.closest<HTMLElement>('[data-testid=Grid]');
    if (!card) continue; // section headings and banners keep Costco's own line
    let tag: HTMLElement | null = null;
    if (start && start.getTime() > t) tag = el('span', { class: 'cm-when cm-deal-tag' }, ic('calendar-blank'), `Starts ${longDate(start)}`);
    else if (left < 0) tag = el('span', { class: 'cm-when cm-urgent cm-deal-tag' }, 'Ended');
    else if (left === 0) tag = el('span', { class: 'cm-pill cm-deal-tag' }, 'Ends today');
    else if (left <= 7) tag = el('span', { class: 'cm-when cm-warn cm-deal-tag' }, ic('timer'), left === 1 ? 'Ends tomorrow' : `${left} days left`);
    card.dataset.cmDeal = start && start.getTime() > t ? 'later' : left < 0 ? 'ended' : 'live';
    // The visible line is absolutely placed and full width, so the status gets its own row above it.
    if (tag) leaf.parentElement?.before(el('div', { class: 'cm-deal-row' }, tag));
  }
}

export const deals: Plugin = {
  id: 'deals',
  name: 'Deal status on savings pages',
  setup: () => {
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(mark, 150); }).observe(document.body, { childList: true, subtree: true });
    mark();
  },
};
