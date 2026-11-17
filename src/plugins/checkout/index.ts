import { $ } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './checkout.css';
import './steps.css';
import './billing.css';

// Checkout restyled like the cart, mostly with CSS.
export const checkout: Plugin = {
  id: 'checkout',
  name: 'Compact checkout',
  live: true,
  // The wallet chip shows "$0.00" alone; Costco writes "$0.00 available" and rewrites it when a card is added.
  setup: () => {
    const b = $('#balance-label');
    if (!b) return;
    const sync = () => { b.dataset.cmBal = (b.textContent ?? '').trim().split(/\s+/)[0]; };
    sync();
    new MutationObserver(sync).observe(b, { childList: true, characterData: true, subtree: true });
  },
};
