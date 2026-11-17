import { $ } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './checkout.css';
import './steps.css';
import './billing.css';

// The wallet chip shows "$0.00" alone; Costco writes "$0.00 available".
// A $0 wallet reads as disabled: Costco still lets it be switched on, but it pays nothing.
function syncWallet() {
  const b = $('#balance-label');
  if (!b) return;
  const bal = (b.textContent ?? '').trim().split(/\s+/)[0];
  if (b.dataset.cmBal !== bal) b.dataset.cmBal = bal;
  const w = b.closest('#payment-method-shop-card');
  if (w && w.hasAttribute('data-cm-empty') === /[1-9]/.test(bal)) w.toggleAttribute('data-cm-empty');
}

// Checkout restyled like the cart, mostly with CSS.
export const checkout: Plugin = {
  id: 'checkout',
  name: 'Compact checkout',
  live: true,
  // Costco re-renders the payment step (and the balance node) whenever the wallet switch or a card changes,
  // so watch the whole page and re-mark the current node; syncWallet only writes when something differs.
  setup: () => {
    syncWallet();
    new MutationObserver(syncWallet).observe(document.body, { childList: true, characterData: true, subtree: true });
  },
};
