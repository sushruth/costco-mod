import { $, $$, ic } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './footer.css';
import './mui.css';

// Costco's images in the tools strip become Phosphor icons, matched by their alt text or role.
const ICONS: [string, string][] = [['facebook', 'facebook-logo'], ['pinterest', 'pinterest-logo'], ['instagram', 'instagram-logo'], ['app', 'device-mobile']];

function icons() {
  const tools = $('#footer-widget .footer-input-boxes');
  if (!tools) return;
  const swap = (host: HTMLElement | null, name: string) => { if (host && !$(':scope > .cm-ic', host)) { host.classList.add('cm-swapped'); host.prepend(ic(name)); } };
  // Costco draws "?" as a stretched pseudo-element (hidden in CSS); the link text stays.
  const help = $('.get-help a', tools);
  if (help && !$(':scope > .cm-ic', help)) help.prepend(ic('question'));
  swap($('#footer-find-warehouse-block .input-group-btn :is(button, .btn)', tools), 'magnifying-glass');
  for (const img of $$<HTMLImageElement>('.social-icons img', tools)) {
    const name = ICONS.find(([k]) => img.alt.toLowerCase().includes(k))?.[1];
    if (name) swap(img.closest('a'), name);
    if (name && !img.closest('a')?.getAttribute('aria-label')) img.closest('a')?.setAttribute('aria-label', img.alt);
  }
}

// Costco's footer, every link kept: one tools strip, five link groups side by side, legal links and copyright on one line.
export const footer: Plugin = {
  id: 'footer',
  name: 'Compact footer',
  setup: icons,
};
