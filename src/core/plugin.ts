import type { Item } from './items';

// Shared state handed to every plugin on each render.
export interface Ctx {
  items: Item[];
  render: () => void;
  setOn: (on: boolean) => void;
  plugins: Plugin[];
  isEnabled: (p: Plugin) => boolean;
  setEnabled: (p: Plugin, on: boolean) => void;
}

// A feature of the cleaned-up cart. Plugins run in list order; each can be switched off in the settings menu.
// A plugin's CSS is imported by its module and nested under :root.cm-on.cm-p-<id>, so switching it off unmatches it.
export interface Plugin {
  id: string;
  name: string;
  locked?: boolean; // always on, not listed in settings
  dev?: boolean; // only in the local dev build; starts switched off
  live?: boolean; // CSS only: its switch takes effect without a reload
  product?: () => void; // runs on product pages instead of the cart
  setup?: (ctx: Ctx) => void; // once, after CSS is in
  render?: (ctx: Ctx) => void; // after every cart change
  toggle?: (on: boolean) => void; // cleaned-up view switched on or off
}
