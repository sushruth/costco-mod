import { el, ic } from '../../core/dom';
import { longDate } from '../../core/format';
import type { Item } from '../../core/items';
import { thumbs } from '../../core/thumbs';
import s from './panel.module.css';

export type Group = { date: Date; items: Item[] };

// Items grouped by delivery day, biggest group first.
export function dateGroups(items: Item[]): Group[] {
  const groups = new Map<string, Group>();
  for (const i of items) if (i.deliv) {
    const k = i.deliv.toDateString();
    if (!groups.has(k)) groups.set(k, { date: i.deliv, items: [] });
    groups.get(k)!.items.push(i);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}

// One day: a single line. Two or more: each date with that day's items as thumbnails, earliest first.
export function deliveryStrip(groups: Group[]) {
  if (!groups.length) return null;
  if (groups.length === 1) return el('div', { class: `${s.strip} ${s.ok}` }, ic('truck'), `All deliveries arrive ${longDate(groups[0].date)}`);
  return el('div', { class: `${s.strip} ${s.warn}` }, ic('warning'),
    el('div', {}, el('div', {}, `${groups.length} separate delivery days`),
      ...[...groups].sort((x, y) => x.date.getTime() - y.date.getTime())
        .map((g) => el('div', { class: s.stripRow }, el('b', {}, longDate(g.date)), thumbs(g.items)))));
}
