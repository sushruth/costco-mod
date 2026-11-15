import { $, el, ic } from '../../core/dom';
import type { Ctx, Plugin } from '../../core/plugin';
import s from './settings.module.css';

const on = () => document.documentElement.classList.contains('cm-on');

// The gear in the header opens "Costco Mod": the view switch, then one switch per plugin.
function menu(ctx: Ctx) {
  const box = el('div', { class: s.menu, hidden: '', role: 'dialog', 'aria-label': 'Costco Mod settings' }, el('h3', {}, 'Costco Mod'));
  const row = (label: string, checked: boolean, set: (v: boolean) => void, sub = false) => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = checked;
    cb.addEventListener('change', () => set(cb.checked));
    box.append(el('label', { class: sub ? s.sub : '' }, cb, label));
    return cb;
  };
  const view = row('Cleaned-up view', on(), ctx.setOn);
  ctx.plugins.filter((p) => !p.locked).forEach((p) => row(p.name, ctx.isEnabled(p), (v) => ctx.setEnabled(p, v), true));
  const gear = el('button', { type: 'button', class: `${s.gear} cm-gear`, title: 'Costco Mod settings', 'aria-label': 'Costco Mod settings', 'aria-expanded': 'false' }, ic('gear-six'));
  const show = (v: boolean) => { view.checked = on(); box.hidden = !v; gear.setAttribute('aria-expanded', String(v)); };
  gear.addEventListener('click', () => show(!!box.hidden));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target as Node)) show(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') show(false); });
  const wrap = el('li', { class: `list-group-item ${s.wrap}` }, gear, box);
  return wrap;
}

export const settings: Plugin = {
  id: 'settings',
  name: 'Settings',
  locked: true,
  setup: (ctx) => {
    const wrap = menu(ctx);
    const acct = $('#header-widget .account-cart ul.t5-header-font');
    if (acct) acct.append(wrap);
    else document.body.append(el('ul', { class: s.floating }, wrap));
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Toggle cleaned-up view', () => ctx.setOn(!on()));
  },
};
