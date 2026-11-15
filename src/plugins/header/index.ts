import { $, $$, el, ic, text } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import { kv } from '../../core/store';
import './header.css';
import './flyouts.css';
import './mui.css';
import './search.css';
import './mobile.css';
import s from './header.module.css';

// Site header: the blue category row moves above the logo row. Warehouse and ZIP sit on the cart's title row
// (or the blue row's right end without one), and Lists / Buy Again become icons at the blue row's right end. Switching the view off puts every node back.
const navEnd = el('div', { class: s.navEnd });

// Categories that don't fit beside the warehouse and ZIP hide from the right; all stay in the Shop menu.
function fitNav() {
  const items = $$('#navigation-widget nav.menu > .nav-item');
  items.forEach((n) => delete n.dataset.cmOverflow);
  const menu = navEnd.parentElement;
  for (let i = items.length - 1; i >= 0 && menu && menu.scrollWidth > menu.clientWidth; i--) items[i].dataset.cmOverflow = '';
}
let t = 0;
const refit = () => { clearTimeout(t); t = window.setTimeout(fitNav, 50); };

// Category order comes from Costco's newer header: pages that have it save its list (label and link), and the
// old header follows that list, adding any category it lacks. Without a saved list, Costco's own order stays.
type NavItem = { label: string; href: string };
const NAV = 'cm-nav';
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function learnNav() {
  const ul = $('header nav[data-testid=LinkList] > ul:has([data-testid=ShopMenu])');
  if (!ul) return false;
  const list = $$(':scope > li', ul).filter((li) => !$('[data-testid=ShopMenu]', li)).map((li) => {
    const a = $<HTMLElement>(':scope > :is(a, button), :scope > div > :is(a, button)', li);
    return { label: text(a), href: (a as HTMLAnchorElement | null)?.href ?? '' };
  }).filter((n) => n.label);
  if (list.length) kv.set(NAV, list);
  return list.length > 0;
}

let original: Element[] = [];
const added: Element[] = [];
function order(on: boolean) {
  const shop = $('#navigation-dropdown');
  if (!on) {
    added.splice(0).forEach((n) => n.remove());
    original.reduce<Element | null>((prev, n) => (prev?.after(n), n), shop);
    return;
  }
  const saved = kv.get<NavItem[]>(NAV);
  if (!shop || !saved?.length) return;
  original = $$('#navigation-widget nav.menu > .nav-item:not(#navigation-dropdown)');
  const byKey = new Map(original.map((n) => [key(text($('a', n))), n]));
  let prev: Element = shop;
  for (const s of saved) {
    let n = byKey.get(key(s.label));
    if (!n) { n = el('div', { class: 'nav-item' }, el('a', { href: s.href, class: 'nav-flyout' }, s.label)); added.push(n); }
    prev.after(n);
    prev = n;
  }
}

function place(on: boolean) {
  const hdr = $('#header-widget'), nav = $('#navigation-widget'), menu = $('#navigation-widget nav.menu');
  const loc = $('#deliveryLocation'), lists = $('#banner-list-actions');
  if (!hdr || !nav || !menu) return;
  if (on) {
    hdr.before(nav);
    menu.append(navEnd);
    // The warehouse rides on the cart's title row when there is one, else at the blue row's right end.
    if (loc) { loc.classList.add(s.loc); ($('#cart-title') ?? navEnd).append(loc); }
    if (lists) {
      navEnd.append(lists);
      $$('a', lists).forEach((a) => { a.title ||= text(a); });
    }
    // Costco's cart glyph turns blank on hover; a Phosphor cart stands in.
    const cart = $('#cart-d');
    if (cart && !$(':scope > .cm-ic', cart)) cart.prepend(ic('shopping-cart-simple'));
    order(true);
    fitNav();
  } else {
    hdr.after(nav);
    if (loc) { loc.classList.remove(s.loc); $('#left-bar')?.append(loc); }
    if (lists) $('#order-nav')?.append(lists);
    navEnd.remove();
    $('#cart-d > .cm-ic')?.remove();
    order(false);
  }
}

// The newer header closes its Shop menu when the pointer leaves it. Pointer moves across the open menu's edge
// stop here, before the page's script sees them, so the sidebar stays until Shop is clicked again.
// Moves inside the menu and every click still reach the page.
function holdShopMenu() {
  const wide = matchMedia('(width > 1024px)'); // the sidebar layout in mui.css
  for (const type of ['mouseover', 'mouseout', 'pointerover', 'pointerout']) {
    addEventListener(type, (e) => {
      if (!wide.matches) return;
      const menu = $('header [data-testid=ShopMenu]:has(> button[aria-expanded=true])');
      if (!menu) return;
      const to = (e as MouseEvent).relatedTarget as Node | null;
      if (menu.contains(e.target as Node) !== (!!to && menu.contains(to))) e.stopPropagation();
    }, true);
  }
}

// Store hours: hovering the warehouse shows Costco's hours lines in one popup, each shortened from
// "Executive Member hours start at 9AM" to "Executive Member · 9AM". Read on hover, so re-renders don't matter.
function hoursPopup() {
  addEventListener('pointerover', (e) => {
    // Lists / Buy Again show as icons; their names become tooltips.
    const link = (e.target as Element).closest?.('[data-testid=Link_wishlist], [data-testid="Buy Again"]');
    if (link instanceof HTMLElement && !link.title) link.title = text(link);
    const box = (e.target as Element).closest?.('[data-testid=WarehouseSelectorUI], #deliveryLocation [class*="MuiBox-root"]:has(> .MuiTypography-t7)');
    if (!(box instanceof HTMLElement)) return;
    const lines = $$('*', box).filter((n) => !n.children.length && /hours start/i.test(n.textContent ?? ''));
    if (lines.length) box.dataset.cmHours = lines.map((n) => text(n).replace(/\s*hours start at\s*/i, ' · ')).join('\n');
  }, true);
}

export const header: Plugin = {
  id: 'header',
  name: 'Compact site header',
  setup: () => {
    new ResizeObserver(refit).observe(navEnd);
    addEventListener('resize', refit);
    holdShopMenu();
    hoursPopup();
    // React fills the newer header after the script starts, so learn on the first pointer move if not yet.
    if (!$('#header-widget') && !learnNav()) addEventListener('pointerover', learnNav, { once: true });
  },
  toggle: place,
};
