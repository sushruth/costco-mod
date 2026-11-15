// Unit price from a product title, e.g. "2-Ply, 380 Sheets, 30 Rolls" at $24.99 → 22¢ / 100 sheets.
// ponytail: regexes over Costco's title wording; titles without a recognised unit get no line.
const num = (s: string) => +s.replace(/,/g, '');
const money = (v: number) => (v < 1 ? `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}¢` : `$${v.toFixed(2)}`);

export function unitPrice(title: string, price: number): [string, string] | null {
  if (!(price > 0)) return null;
  const g = (re: RegExp) => { const m = title.match(re); return m ? num(m[1]) : 0; };
  const sheets = g(/([\d,]+)\s*Sheets/i);
  const rolls = g(/([\d,]+)\s*(?:Rolls|-count|Count)\b/i);
  const boxes = g(/\b(\d+)\/\d+\s*ct\b/i); // "36/95ct": 36 boxes of 95
  const lb = g(/([\d.]+)\s*lbs?\b/i);
  const oz = g(/([\d.]+)\s*(?:fl\.?\s*)?oz\b/i);
  const ct = g(/([\d,]+)[\s-]*(?:count|ct|pack|pk|pods)\b/i);
  if (sheets && rolls) return [money((price / (sheets * rolls)) * 100), '100 sheets'];
  if (boxes) return [money(price / boxes), 'box'];
  if (lb) return [money(price / lb), 'lb'];
  if (oz) return [money(price / oz), 'oz'];
  if (ct || rolls) return [money(price / (ct || rolls)), 'each'];
  return null;
}
