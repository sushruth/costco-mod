import { $, $$, el, ic } from '../../core/dom';
import { DAY, longDate } from '../../core/format';
import type { Plugin } from '../../core/plugin';
import './deals.css';
import { finePrint } from './fineprint';

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

type State = 'later' | 'ended' | 'live';
// A deal's status line: starts later, ended, ends today, or ends within a week (or any time, with `always`).
function status(start: Date | null, end: Date, always = false): [State, HTMLElement | null] {
  const t = now().getTime(), left = Math.round((end.getTime() - t) / DAY);
  const tag = (cls: string, ...kids: (Node | string)[]) => el('div', { class: 'cm-deal-row' }, el('span', { class: `${cls} cm-deal-tag` }, ...kids));
  if (start && start.getTime() > t) return ['later', tag('cm-when', ic('calendar-blank'), `Starts ${longDate(start)}`)];
  if (left < 0) return ['ended', tag('cm-when cm-urgent', 'Ended')];
  if (left === 0) return ['live', tag('cm-pill', 'Ends today')];
  if (left <= 7) return ['live', tag('cm-when cm-warn', ic('timer'), left === 1 ? 'Ends tomorrow' : `${left} days left`)];
  return ['live', always ? tag('cm-when', ic('timer'), `Ends ${longDate(end)}`) : null];
}

// Savings pages: each deal's "Valid A - B" line gets its status; deals that haven't started fade back.
function grid() {
  for (const leaf of $$('[data-testid=Text]:not([data-cm-deal])')) {
    // Costco draws the line twice: a hidden aria-hidden spacer, and the visible copy laid over it.
    if (leaf.children.length || leaf.ariaHidden === 'true' || !/^Valid /.test(leaf.textContent ?? '')) continue;
    leaf.dataset.cmDeal = '';
    const card = leaf.closest<HTMLElement>('[data-testid=Grid]');
    if (!card) continue; // section headings and banners keep Costco's own line
    const [a, b] = (leaf.textContent ?? '').slice(6).split(/\s+-\s+/).map(day);
    if (!(b ?? a)) continue;
    const [state, tag] = status(b ? a : null, (b ?? a)!);
    card.dataset.cmDeal = state;
    // The visible line is absolutely placed and full width, so the status gets its own row above it.
    if (tag) leaf.parentElement?.before(tag);
  }
}

// Product pages: the promo's end date sits in fine print; show it under "$8 OFF was $41.99", and drop the second "$8 OFF".
function product() {
  const promo = $('[data-testid=pricing-card] [data-testid=promo-price]:not([data-cm-deal])');
  const fine = $('[data-testid=pricing-card] [data-testid^="Text_longText-"]');
  const end = fine?.textContent?.match(/through (\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1];
  if (!promo || !end) return;
  promo.dataset.cmDeal = '';
  const tag = status(null, day(end)!, true)[1];
  if (tag) promo.append(tag);
  const short = $('[data-testid^="Text_shortText-"]', fine!.parentElement!), off = $('[data-testid=Text_promo-amount-off]', promo)?.textContent;
  if (short && off && short.textContent?.trim() === `${off} OFF`) short.dataset.cmDup = '';
}

export const deals: Plugin = {
  id: 'deals',
  name: 'Deal dates and product fine print',
  setup: () => {
    const run = () => { grid(); product(); finePrint(); };
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(run, 150); }).observe(document.body, { childList: true, subtree: true });
    run();
  },
};
