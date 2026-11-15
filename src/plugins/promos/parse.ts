export type Promo =
  | { key: string; name: string; type: 'count' | 'spend'; tiers: [number, number][]; until: string | null }
  | { key: string; name: string; type: 'bundle'; amount: number; partner: string; until: string | null };

const num = (x: string) => +x.replace(/,/g, '');
const through = (s: string) => s.match(/through (\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1] ?? null;

// Reads multi-buy, spend-tier and bundle promos from a product page's visible text.
// ponytail: wording-based; Costco writes these by hand, so the cart cross-checks the sum against its own discount.
export function parsePromos(html: string): { itemNo: string | null; promos: Promo[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
  const t = (doc.body?.textContent ?? '').replace(/\s+/g, ' ');
  type Run = { type: 'count' | 'spend'; start: number; end: number; tiers: [number, number][] };
  const runs: Run[] = [];
  // Tier lines that sit within a few characters of each other belong to one promo.
  const collect = (re: RegExp, type: Run['type']) => {
    let run: Run | null = null;
    for (const m of t.matchAll(re)) {
      const i = m.index!;
      if (run && i - run.end < 12) { run.tiers.push([num(m[1]), num(m[2])]); run.end = i + m[0].length; continue; }
      if (run) runs.push(run);
      run = { type, start: i, end: i + m[0].length, tiers: [[num(m[1]), num(m[2])]] };
    }
    if (run) runs.push(run);
  };
  collect(/(?:Buy|Purchase) (\d+)(?:\+| or more)? (?:qualifying [A-Za-z&' ]+?|Items?),? save \$([\d,]+)/gi, 'count');
  collect(/Spend \$([\d,]+) Save \$([\d,]+)/g, 'spend');

  const out: Promo[] = [];
  for (const r of runs.filter((x) => x.tiers.length > 1)) {
    const before = t.slice(Math.max(0, r.start - 220), r.start);
    const brand = before.match(/qualifying ([A-Z][A-Za-z]+) (?:Home )?(?:Appliances|Products)/);
    const name = r.type === 'spend' ? 'Appliance Spend & Save' : brand ? `${brand[1]} buy 2+` : /Costco Direct/.test(before) ? 'Costco Direct buy 2+' : 'Multi-buy';
    const key = name + ':' + r.tiers.map((x) => x.join('-')).join(',');
    if (!out.some((o) => o.key === key)) out.push({ key, name, type: r.type, tiers: r.tiers, until: through(t.slice(r.end, r.end + 300)) });
  }
  const b = t.match(/\$([\d,]+) BUNDLE SAVINGS WITH PURCHASE OF (.+?) AND (\w+)/i);
  if (b) {
    const partner = b[3].toLowerCase();
    out.push({ key: 'bundle:' + partner, name: `Bundle with ${partner[0].toUpperCase() + partner.slice(1)} plan`, type: 'bundle',
      amount: num(b[1]), partner, until: through(t.slice(b.index!, b.index! + 600)) });
  }
  return { itemNo: t.match(/Item (\d{5,8})\b/)?.[1] ?? null, promos: out };
}
