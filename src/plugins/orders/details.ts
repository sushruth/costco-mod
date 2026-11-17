import { $$ } from '../../core/dom';
import './details.css';

// Order Details: one shipment is a flat run of siblings (date row, mode row, Shipping Terms, item block, divider).
// The hidden screen-reader ids od_buyagain_btn_<item> anchor each item block; the parts get data-cm-od marks.
const set = (n: Element | null | undefined, v: string) => { if (n instanceof HTMLElement && n.dataset.cmOd !== v) n.dataset.cmOd = v; };
const txt = (n: Element) => (n.textContent ?? '').trim();

function item(block: HTMLElement) {
  const info = block.firstElementChild;
  set(info, 'info');
  for (const k of info?.children ?? []) {
    if (!/^Services/.test(txt(k))) continue;
    set(k, 'services');
    // the yellow "secondary appointment" notice is the one bordered box inside
    set([...k.querySelectorAll('div')].find((d) => getComputedStyle(d).borderTopWidth !== '0px' && txt(d)), 'svcalert');
  }
  const no = [...block.querySelectorAll('div')].find((d) => /^Item \d+$/.test(txt(d)));
  const col = no?.parentElement;
  if (!col) return;
  set(col, 'col');
  set(col.firstElementChild, 'title');
  const img = block.querySelector('img')?.closest('div');
  set(img, 'img');
  // Costco's wrappers between the block and its parts flatten (display:contents) so the parts sit on one grid
  for (const start of [col, img, block.querySelector('[data-cm-od=services]')]) {
    for (let x = start?.parentElement; x && x !== block; x = x.parentElement) if ((x as HTMLElement).dataset.cmWrap !== '1') (x as HTMLElement).dataset.cmWrap = '1';
  }
  for (const k of col.children) {
    const t = txt(k);
    if (k === no) set(k, 'itemno');
    else if (/^Quantity/.test(t)) { set(k, 'qty'); (k as HTMLElement).dataset.cmQ = t.match(/Quantity\s*(\d+)/)?.[1] ?? ''; }
    else if (/^\$[\d,.]+$/.test(t)) set(k, (k.previousElementSibling as HTMLElement | null)?.dataset.cmOd === 'qty' ? 'total' : 'price');
    else if (/Quantity/.test(t)) set(k, 'fees');
  }
  // at quantity 1 the line total repeats the price
  col.dataset.cmQ1 = (col.querySelector('[data-cm-od=qty]') as HTMLElement | null)?.dataset.cmQ === '1' ? '1' : '0';
}

export function markDetails() {
  for (const sr of $$('[id^=od_buyagain_btn_]')) {
    const actions = sr.parentElement?.parentElement, block = actions?.parentElement;
    if (!actions || !block) continue;
    set(actions, 'actions'); set(block, 'item');
    item(block);
    let p = block.previousElementSibling, i = 0;
    const ship: Element[] = [];
    while (p && p.tagName !== 'HR' && !(p as HTMLElement).dataset.cmOd) { ship.unshift(p); p = p.previousElementSibling; if (++i > 5) break; }
    ship.forEach((n, j) => set(n, j ? 'shipx' : 'ship0'));
    for (const b of actions.querySelectorAll('button')) {
      const t = txt(b);
      if (/buy again/i.test(t)) { set(b, 'buyagain'); b.title = t; b.setAttribute('aria-label', t); }
      else if (/reschedule/i.test(t)) set(b, 'resched');
      else if (/cancel/i.test(t)) set(b, 'cancel');
    }
  }
  const all = $$('a').find((a) => txt(a) === 'Buy Items Again' && !a.closest('[data-cm-o]'))?.parentElement;
  if (!all || !document.querySelector('[id^=od_buyagain_btn_]')) return;
  set(all, 'buyall');
  const card = all.nextElementSibling?.firstElementChild;
  set(card, 'card');
  const st = card && [...card.querySelectorAll('*')].find((d) => !d.children.length && /^(Order Placed|Cancelled|Delivered|Shipped|Processing|Picked Up|Order Complete|Returned)$/i.test(txt(d)));
  if (st instanceof HTMLElement) { set(st, 'status'); set(st.parentElement, 'statuswrap'); st.dataset.cmSt = /cancel/i.test(txt(st)) ? 'cancelled' : 'active'; }
  const sum = $$('[class*=MuiPaper-outline]').find((p) => /Order Summary/.test(txt(p)));
  set(sum, 'summary');
  const tog = sum?.querySelector('[role=button]');
  if (tog instanceof HTMLElement && !tog.title) { set(tog, 'sumtoggle'); tog.title = 'Order Summary'; tog.setAttribute('aria-label', 'Order Summary'); }
  const pi = document.getElementById('odprintInvoice');
  if (pi && !pi.title) { pi.title = txt(pi); pi.setAttribute('aria-label', pi.title); set(pi.parentElement, 'titlerow'); }
  let main: Element | null = all;
  while (main && pi && !main.contains(pi)) main = main.parentElement;
  set(main, 'odmain');
  const ba = all.querySelector('a');
  if (ba && !ba.title) { ba.title = txt(ba); ba.setAttribute('aria-label', ba.title); }
}
