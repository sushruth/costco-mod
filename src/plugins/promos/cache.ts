import { DAY, toDate } from '../../core/format';
import { kv } from '../../core/store';
import type { Promo } from './parse';

type Entry = { at: number; expires: number; promos: Promo[] };

// An entry expires a day after capture, or when its earliest promo ends, whichever comes first.
export const promoCache = {
  get(itemNo: string) {
    const e = kv.get<Entry>('cm-promo:' + itemNo);
    return e && Date.now() < e.expires ? e : null;
  },
  set(itemNo: string, promos: Promo[]) {
    const ends = promos.map((p) => (p.until ? toDate(p.until).getTime() : 0)).filter(Boolean);
    kv.set('cm-promo:' + itemNo, { at: Date.now(), expires: Math.min(Date.now() + DAY, ...ends), promos });
  },
};
