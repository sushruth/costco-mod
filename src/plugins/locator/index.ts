import { $, $$, el, text } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './locator.css';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "Mon-Fri: 10:00 AM - 8:30 PM" lines → today's hours, or null.
function today(lines: string[]) {
  const d = new Date().getDay();
  for (const l of lines) {
    const m = l.match(/^([A-Za-z]{3})[a-z]*(?:\s*-\s*([A-Za-z]{3})[a-z]*)?:\s*(.+)$/);
    if (!m) continue;
    const a = DAYS.indexOf(m[1].toLowerCase()), b = m[2] ? DAYS.indexOf(m[2].toLowerCase()) : a;
    if (a < 0 || b < 0) continue;
    if (a <= b ? d >= a && d <= b : d >= a || d <= b) return m[3].trim();
  }
  return null;
}

// Warehouse tiles: the two "hours start at" lines become one line with today's hours, the Executive start and regular gas,
// read from the collapsed details.
function tiles() {
  for (const hrs of $$('[data-testid=Text_warehouse-openinghours]:not([data-cm-loc])')) {
    hrs.dataset.cmLoc = '';
    const tile = hrs.parentElement?.parentElement;
    const details = tile && $('[data-testid=warehousetile-seewarehousedetails-details]', tile);
    if (!details) continue;
    const hours = today($$('li [data-testid=Text]', details).map((n) => text(n)));
    const exec = text(hrs).match(/start at (\S+)/)?.[1];
    const gas = $$('dl > div', details).find((d) => /regular/i.test(text($('dt', d))));
    const gasPrice = gas && text($('dd span', gas));
    const parts = [hours && `Today ${hours}`, exec && `Executive from ${exec}`, gasPrice && `Gas ${gasPrice}`].filter(Boolean) as string[];
    if (!parts.length) continue;
    hrs.parentElement!.classList.add('cm-loc-hours');
    hrs.parentElement!.after(el('div', { class: 'cm-loc-line', title: text(hrs.parentElement) }, parts.join(' | ')));
  }
}

export const locator: Plugin = {
  id: 'locator',
  name: 'Compact warehouse locator',
  setup: () => {
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(tiles, 150); }).observe(document.body, { childList: true, subtree: true });
    tiles();
  },
};
