import { $, text } from '../../core/dom';
import { fmt, fmt0, shortDate } from '../../core/format';
import type { Item } from '../../core/items';

export type Totals = { subtotal: string; discount: string; shipping: string; total: string };

export const readTotals = (): Totals => ({
  // cart ids first, then checkout's
  subtotal: text($('#orderSubtotal')) || text($('#subtotal-value')),
  discount: text($('#totalDiscountOutput')),
  shipping: text($('[automation-id="orderEstimatedShipping"]')) || text($('#order-estimated-shipping')) || text($('#order-summary-total-section .summary-right')),
  total: text($('#order-estimated-total')) || text($('#orderTotalOutput')),
});

// Plain-text cart summary for pasting into a note or a message.
export function summaryText(items: Item[], t: Totals) {
  return [
    ...items.map((i) => [
      i.name, fmt(i.price * i.qty) + (i.qty > 1 ? ` (x${i.qty})` : ''),
      i.save && `saves ${fmt0(i.save)}`, i.end && `promo ends ${shortDate(i.end)}`,
      i.deliv && `delivery ${shortDate(i.deliv)}`, i.href,
    ].filter(Boolean).join(' | ')),
    '',
    `Subtotal: ${t.subtotal}`,
    t.discount && `Discount: ${t.discount}`,
    `Shipping: ${t.shipping}`,
    `Estimated total (pre-tax): ${t.total}`,
  ].join('\n');
}
