import type { Plugin } from '../../core/plugin';
import './checkout.css';
import './steps.css';

// Checkout restyled like the cart, with CSS only.
export const checkout: Plugin = {
  id: 'checkout',
  name: 'Compact checkout',
  live: true,
};
