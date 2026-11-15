import type { Plugin } from '../../core/plugin';
import './redlines.css';

// Dev build only: outlines every node in the cart, colored by nesting depth. Switched from the gear menu.
export const redlines: Plugin = {
  id: 'redlines',
  name: 'Redlines (dev)',
  dev: true,
  live: true,
};
