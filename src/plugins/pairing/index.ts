import { $, el, ic } from '../../core/dom';
import type { Item } from '../../core/items';
import type { Plugin } from '../../core/plugin';
import './pairing.css';

// An "autoadd" item's companion (e.g. the TV's Allstate plan) is the first email-delivered item created after it;
// other items added in between (a microwave) are not its companion.
// ponytail: order heuristic; the product page's ACCESSORY association is exact but costs a fetch per load.
function link(items: Item[]) {
  const out: Item[] = [];
  for (const it of items) if (!it.parent) {
    out.push(it);
    const kid = it.autoadd && items.find((k) => k.email && !k.parent && +k.orderItemId > +it.orderItemId);
    if (kid) { kid.parent = it; out.push(kid); }
  }
  out.forEach((it, i) => {
    it.card.style.order = String(i);
    it.card.classList.toggle('cm-child', !!it.parent);
    it.card.classList.toggle('cm-parent', out[i + 1]?.parent === it);
    if (it.parent) $('.item-thumbnail + .col-xs-9', it.card)?.prepend(
      el('div', { class: 'cm-child-tag cm-extra' }, ic('link-simple'), 'Added with the item above'));
  });
  return out;
}

export const pairing: Plugin = {
  id: 'pairing',
  name: 'Protection plan under its item',
  render: (ctx) => { ctx.items = link(ctx.items); },
};
