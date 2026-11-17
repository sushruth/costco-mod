import type { Plugin } from '../../core/plugin';
import './checkout.css';
import './steps.css';
import './billing.css';

// Checkout restyled like the cart, with CSS only.
export const checkout: Plugin = {
  id: 'checkout',
  name: 'Compact checkout',
  live: true,
};
