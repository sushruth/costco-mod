export const DAY = 864e5;
export const money = (s: unknown) => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
export const fmt = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
export const shortDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
export const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// "m/d/yy" or "m/d/yyyy" → end of that day.
export function toDate(s: string) {
  const [m, d, y] = s.split('/').map(Number);
  return new Date(y < 100 ? 2000 + y : y, m - 1, d, 23, 59, 59);
}

export type Urgency = { cls: 'cm-urgent' | 'cm-warn'; label: string } | null;
export function urgency(days: number | null): Urgency {
  if (days == null || days > 7) return null;
  if (days < 0) return { cls: 'cm-urgent', label: 'Promo ended' };
  if (days <= 1) return { cls: 'cm-urgent', label: days === 0 ? 'Ends today' : 'Ends tomorrow' };
  return { cls: 'cm-warn', label: `Ends in ${days} days` };
}
