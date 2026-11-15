import { $, el } from '../../core/dom';
import s from './filters.module.css';

// Price filter as a two-handle slider. Costco's URL takes any range (refinement=price=(18,40)), so the handles
// move over these stops and releasing one loads the page for that range. The bucket checkboxes hide behind it.
const STOPS = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];
const fmt = (v: number) => `$${v.toLocaleString()}`;

// "price=(25,50),(50,100)" → [25, 100]
export function readPrice(refinement: string): [number, number] | null {
  const seg = refinement.split('||').find((p) => p.startsWith('price='));
  const nums = [...(seg ?? '').matchAll(/\(([\d.]+),([\d.]+)\)/g)].map((m) => [+m[1], +m[2]]);
  return nums.length ? [Math.min(...nums.map((n) => n[0])), Math.max(...nums.map((n) => n[1]))] : null;
}

// Sets or clears one facet's range in the refinement param, keeping the others: "price=(18,40)||rating=(4,5)".
export function withRange(refinement: string, key: string, range: [number, number] | null) {
  const rest = refinement.split('||').filter((p) => p && !p.startsWith(`${key}=`));
  return [...rest, ...(range ? [`${key}=(${range[0]},${range[1]})`] : [])].join('||');
}

const nearest = (v: number) => STOPS.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(STOPS[b] - v) ? i : b), 0);

export function priceSlider() {
  const acc = $('[data-testid=left-column] [data-testid^=Accordion_][data-testid*="price)"]');
  const details = acc && $('.MuiAccordionDetails-root', acc);
  if (!details || $(`.${s.price}`, details)) return;
  // the top of Costco's last bucket ("$500 to $1,000") caps the slider
  const ids = [...details.querySelectorAll('input')].map((i) => i.id);
  const top = Math.max(100, ...ids.map((id) => +(id.match(/\$([\d,]+)$/)?.[1] ?? '0').replace(/,/g, '')));
  const max = Math.max(1, STOPS.findIndex((x) => x >= top));
  const params = new URLSearchParams(location.search);
  const cur = readPrice(params.get('refinement') ?? '');
  const lo = el('input', { type: 'range', min: '0', max: String(max), step: '1', 'aria-label': 'Lowest price' });
  const hi = el('input', { type: 'range', min: '0', max: String(max), step: '1', 'aria-label': 'Highest price' });
  lo.value = String(cur ? nearest(cur[0]) : 0);
  hi.value = String(cur ? Math.min(max, nearest(cur[1])) : max);
  const label = el('div', { class: s.priceLabel });
  const show = () => {
    const a = +lo.value, b = +hi.value;
    label.textContent = a === 0 && b === max ? 'Any price' : `${fmt(STOPS[a])} – ${b === max ? `${fmt(STOPS[b])}+` : fmt(STOPS[b])}`;
  };
  const clamp = (moved: HTMLInputElement) => {
    if (+lo.value >= +hi.value) moved === lo ? (lo.value = String(+hi.value - 1)) : (hi.value = String(+lo.value + 1));
    show();
  };
  const apply = () => {
    const a = +lo.value, b = +hi.value;
    const range: [number, number] | null = a === 0 && b === max ? null : [STOPS[a], b === max ? 1e6 : STOPS[b]];
    const next = withRange(params.get('refinement') ?? '', 'price', range);
    next ? params.set('refinement', next) : params.delete('refinement');
    location.search = params.toString();
  };
  for (const r of [lo, hi]) {
    r.addEventListener('input', () => clamp(r));
    r.addEventListener('change', apply);
  }
  show();
  details.prepend(el('div', { class: s.price }, label, el('div', { class: s.track }, lo, hi)));
  acc.classList.add(s.hasSlider);
}
