import { $, $$, el, ic } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './header.css';
import './flyouts.css';
import './mui.css';
import './search.css';
import s from './header.module.css';

// Site header: the blue category row moves above the logo row, warehouse and ZIP ride on its right end,
// and Lists / Buy Again join the account links. Switching the view off puts every node back.
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

function place(on: boolean) {
  const hdr = $('#header-widget'), nav = $('#navigation-widget'), menu = $('#navigation-widget nav.menu');
  const loc = $('#deliveryLocation'), lists = $('#banner-list-actions'), acct = $('#header-widget .account-cart ul.t5-header-font');
  if (!hdr || !nav || !menu) return;
  if (on) {
    hdr.before(nav);
    menu.append(navEnd);
    if (loc) navEnd.append(loc);
    if (lists && acct) acct.before(lists);
    // Costco's cart glyph turns blank on hover; a Phosphor cart stands in.
    const cart = $('#cart-d');
    if (cart && !$(':scope > .cm-ic', cart)) cart.prepend(ic('shopping-cart-simple'));
    fitNav();
  } else {
    hdr.after(nav);
    if (loc) $('#left-bar')?.append(loc);
    if (lists) $('#order-nav')?.append(lists);
    navEnd.remove();
    $('#cart-d > .cm-ic')?.remove();
  }
}

export const header: Plugin = {
  id: 'header',
  name: 'Compact site header',
  setup: () => {
    new ResizeObserver(refit).observe(navEnd);
    addEventListener('resize', refit);
  },
  toggle: place,
};
