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
    // A $0 wallet reads as disabled: Costco still lets it be switched on, but it pays nothing.
    const sync = () => {
      const bal = (b.textContent ?? '').trim().split(/\s+/)[0];
      b.dataset.cmBal = bal;
      b.closest('#payment-method-shop-card')?.toggleAttribute('data-cm-empty', !/[1-9]/.test(bal));
    };
    sync();
    new MutationObserver(sync).observe(b, { childList: true, characterData: true, subtree: true });
  },
};
