import { $, $$, addIcon, el, ic } from '../../core/dom';
import type { Plugin } from '../../core/plugin';
import './services.css';
import s from './services.module.css';

// Each item's Services box becomes a footer split: "Services  3 included · 2 notes  Details ⌄", collapsed by default.
function decorate(svc: HTMLElement) {
  addIcon($('.delivery-services-notification .add-cart-list-row', svc), 'info');
  $$<HTMLImageElement>('ul.edd-delivery-services img.parts-services-tick', svc)
    .forEach((img) => addIcon(img.parentElement, img.alt === 'included' ? 'check' : 'info'));
  const h3 = $('.delivery-services-main h3', svc);
  if (!h3 || $(`.${s.toggle}`, h3)) return;
  addIcon($('label', h3), 'wrench');
  const lists = $$('ul.edd-delivery-services', svc);
  const included = lists[0] ? $$('li', lists[0]).length : 0;
  const notes = lists[1] ? $$('li', lists[1]).length : 0;
  svc.classList.add('cm-collapsed');
  const btn = el('button', { type: 'button', class: s.toggle, 'aria-expanded': 'false' }, 'Details', ic('caret-down'));
  btn.addEventListener('click', () => {
    const open = !svc.classList.toggle('cm-collapsed');
    btn.replaceChildren(open ? 'Hide' : 'Details', ic(open ? 'caret-up' : 'caret-down'));
    btn.setAttribute('aria-expanded', String(open));
  });
  h3.append(el('span', { class: s.count }, `${included} included · ${notes} notes`), btn);
}

export const services: Plugin = {
  id: 'services',
  name: 'Services as a collapsible footer',
  render: () => $$('.cart-part-services:not(.hidden)').forEach(decorate),
};
