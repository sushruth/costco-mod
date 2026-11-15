import { $, $$, text } from './dom';
import { DAY, money } from './format';

export interface Item {
  card: HTMLElement;
  orderItemId: string;
  itemNo: string;
  name: string;
  href: string;
  price: number;
  qty: number;
  save: number;
  end: Date | null;
  days: number | null;
  deliv: Date | null;
  shipsTogether: boolean;
  email: boolean;
  autoadd: boolean;
  parent?: Item;
}

export const SAME_DAY = /required to ship on the same day/i;

// Reads every cart item from Costco's DOM. Selected delivery dates come from a hidden input.
export function readItems(): Item[] {
  const dateMap: Record<string, { mode: string; date: string }> = {};
  const raw = $<HTMLInputElement>('[name="calendarItemSelectedDate"]')?.value ?? '';
  for (const m of raw.matchAll(/scheduler_picker_(\d+)_\d+_(\w+)\|(\d{4}-\d{2}-\d{2})/g)) {
    // ponytail: pickup (LPU) entries can come first; any delivery mode replaces them.
    if (!dateMap[m[1]] || dateMap[m[1]].mode === 'LPU') dateMap[m[1]] = { mode: m[2], date: m[3] };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return $$('#order-items .order-item').map((card) => {
    const orderItemId = $('[data-orderitemid]', card)?.dataset.orderitemid ?? '';
    const itemNo = $('[data-orderitemnumber]', card)?.dataset.orderitemnumber ?? '';
    const link = $<HTMLAnchorElement>('.product-title a', card);
    const priceEl = $('.product-price .price', card);
    const promo = text($('.h8-style-guide-green', card));
    const save = money(promo.match(/\$([\d,.]+) savings/i)?.[1] ?? 0);
    const endM = promo.match(/through (\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
    let end: Date | null = null, days: number | null = null;
    if (endM) {
      end = new Date(+endM[3] < 100 ? 2000 + +endM[3] : +endM[3], +endM[1] - 1, +endM[2]);
      days = Math.round((end.getTime() - today.getTime()) / DAY);
    }
    const dateInput = $<HTMLInputElement>('input.date-input', card);
    let deliv: Date | null = null;
    if (dateMap[orderItemId]) deliv = new Date(dateMap[orderItemId].date + 'T00:00:00');
    else if (dateInput?.value && !isNaN(Date.parse(dateInput.value))) deliv = new Date(dateInput.value);
    const qtyEl = $<HTMLInputElement>('input[id^="quantity_"]', card);
    return {
      card, orderItemId, itemNo,
      name: text(link) || text($('.product-title', card)),
      href: link?.href ?? '',
      price: priceEl ? money(priceEl.firstChild?.textContent ?? priceEl.textContent) : 0,
      qty: qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1,
      save, end, days, deliv,
      shipsTogether: $$('.ltl-warning-text, .cart-informational.warning', card).some((n) => SAME_DAY.test(n.textContent ?? '')),
      email: /delivery via email/i.test(text($('.ship-type-and-cost', card))),
      autoadd: /autoadd/i.test($<HTMLInputElement>('[name="controllingAttributes"]', card)?.value ?? ''),
    };
  });
}
