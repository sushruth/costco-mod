import { $, $$, el, ic, text } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './header.css';
import './flyouts.css';
import './mui.css';
import './search.css';
import s from './header.module.css';

// Site header: the blue category row moves above the logo row, warehouse and ZIP ride on its right end,
// and Lists / Buy Again follow them, as in Costco's newer header. Switching the view off puts every node back.
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

// Categories in the newer header's order. The old header has no Savings link, so ours points at the same page.
const savings = el('div', { class: 'nav-item' }, el('a', { href: '/s?keyword=OFF&dept=All', class: 'nav-flyout' }, 'Savings'));
function order(on: boolean) {
  const items = $$('#navigation-widget nav.menu > .nav-item:not(#navigation-dropdown)');
  const by = (t: string) => items.find((n) => text(n).startsWith(t));
  const deals = by('Black Friday'), grocery = by('Grocery'), sameDay = by('Same-Day');
  if (on) {
    if (deals && grocery) grocery.before(deals);
    if (sameDay) sameDay.after(savings);
  } else {
    savings.remove();
    if (deals && sameDay) sameDay.after(deals);
  }
}

function place(on: boolean) {
  const hdr = $('#header-widget'), nav = $('#navigation-widget'), menu = $('#navigation-widget nav.menu');
  const loc = $('#deliveryLocation'), lists = $('#banner-list-actions');
  if (!hdr || !nav || !menu) return;
  if (on) {
    hdr.before(nav);
    menu.append(navEnd);
    if (loc) navEnd.append(loc);
    if (lists) navEnd.append(lists);
    // Costco's cart glyph turns blank on hover; a Phosphor cart stands in.
    const cart = $('#cart-d');
    if (cart && !$(':scope > .cm-ic', cart)) cart.prepend(ic('shopping-cart-simple'));
    order(true);
    fitNav();
  } else {
    hdr.after(nav);
    if (loc) $('#left-bar')?.append(loc);
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
  },
  toggle: place,
};
