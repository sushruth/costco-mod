// ==UserScript==
// @name         Costco Cart, Cleaned Up
// @namespace    https://github.com/sushruth/costco-mod
// @version      0.3.0
// @description  Restyles the costco.com cart in place: compact item cards, an order review panel with promo end dates, delivery-day checks and a breakdown of order discounts. Everything stays in your browser.
// @match        https://www.costco.com/CheckoutCartDisplayView*
// @match        https://www.costco.com/CheckoutCartView*
// @match        https://www.costco.com/p/*
// @match        https://www.costco.com/*.product.*.html
// @run-at       document-idle
// @resource     phCss  https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css
// @resource     phFont https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/Phosphor.woff2
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// @homepageURL  https://github.com/sushruth/costco-mod
// @supportURL   https://github.com/sushruth/costco-mod/issues
// @updateURL    https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js
// @downloadURL  https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js
// ==/UserScript==

(() => {
  'use strict';

  // ---- promo cache: everything stays in this browser (Violentmonkey storage, or localStorage in the preview) ----
  const DAY = 864e5;
  const kv = typeof GM_getValue === 'function'
    ? { get: (k) => GM_getValue(k, null), set: (k, v) => GM_setValue(k, v) }
    : { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const toDate = (s) => { const [m, d, y] = s.split('/').map(Number); return new Date(y < 100 ? 2000 + y : y, m - 1, d, 23, 59, 59); };
  // An entry expires a day after capture, or when its earliest promo ends, whichever comes first.
  const promoCache = {
    get(itemNo) {
      const e = kv.get('cm-promo:' + itemNo);
      return e && Date.now() < e.expires ? e : null;
    },
    set(itemNo, promos) {
      const ends = promos.map((p) => p.until && toDate(p.until).getTime()).filter(Boolean);
      kv.set('cm-promo:' + itemNo, { at: Date.now(), expires: Math.min(Date.now() + DAY, ...ends), promos });
    },
  };

  // Reads multi-buy, spend-tier and bundle promos from a product page's visible text.
  // ponytail: wording-based; Costco writes these by hand, so the cart cross-checks the sum against its own discount.
  function parsePromos(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,template').forEach((n) => n.remove());
    const t = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ');
    const num = (x) => +x.replace(/,/g, '');
    const runs = [];
    const collect = (re, type) => {
      let run = null;
      for (const m of t.matchAll(re)) {
        if (run && m.index - run.end < 12) { run.tiers.push([num(m[1]), num(m[2])]); run.end = m.index + m[0].length; continue; }
        if (run) runs.push(run);
        run = { type, start: m.index, end: m.index + m[0].length, tiers: [[num(m[1]), num(m[2])]] };
      }
      if (run) runs.push(run);
    };
    collect(/(?:Buy|Purchase) (\d+)(?:\+| or more)? (?:qualifying [A-Za-z&' ]+?|Items?),? save \$([\d,]+)/gi, 'count');
    collect(/Spend \$([\d,]+) Save \$([\d,]+)/g, 'spend');
    const out = [];
    for (const r of runs.filter((x) => x.tiers.length > 1)) {
      const before = t.slice(Math.max(0, r.start - 220), r.start);
      const brand = before.match(/qualifying ([A-Z][A-Za-z]+) (?:Home )?(?:Appliances|Products)/);
      const name = r.type === 'spend' ? 'Appliance Spend & Save' : brand ? `${brand[1]} buy 2+` : /Costco Direct/.test(before) ? 'Costco Direct buy 2+' : 'Multi-buy';
      const until = (t.slice(r.end, r.end + 300).match(/through (\d{1,2}\/\d{1,2}\/\d{2,4})/) || [])[1] || null;
      const key = name + ':' + r.tiers.map((x) => x.join('-')).join(',');
      if (!out.some((o) => o.key === key)) out.push({ key, name, type: r.type, tiers: r.tiers, until });
    }
    const b = t.match(/\$([\d,]+) BUNDLE SAVINGS WITH PURCHASE OF (.+?) AND (\w+)/i);
    if (b) {
      const partner = b[3].toLowerCase();
      const until = (t.slice(b.index, b.index + 600).match(/through (\d{1,2}\/\d{1,2}\/\d{2,4})/) || [])[1] || null;
      out.push({ key: 'bundle:' + partner, name: `Bundle with ${partner[0].toUpperCase() + partner.slice(1)} plan`, type: 'bundle', amount: num(b[1]), partner, until });
    }
    return { itemNo: (t.match(/Item (\d{5,8})\b/) || [])[1] || null, promos: out };
  }

  // Product pages: save this item's promos so the cart can explain its discount without fetching.
  if (/^\/p\/|\.product\.\d+\.html/.test(location.pathname)) {
    const r = parsePromos(document.documentElement.outerHTML);
    if (r.itemNo) promoCache.set(r.itemNo, r.promos);
    return;
  }

  if (!document.querySelector('#order-items') || !document.querySelector('#order-summary-column')) return;

  const STORE_KEY = 'cm-off';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
  const money = (s) => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
  const fmt = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const shortDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const longDate = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const store = {
    get: () => { try { return localStorage.getItem(STORE_KEY) === '1'; } catch { return false; } },
    set: (v) => { try { v ? localStorage.setItem(STORE_KEY, '1') : localStorage.removeItem(STORE_KEY); } catch {} },
  };

  // Phosphor icons. Costco's CSP blocks CDN stylesheets but allows inline styles and data: fonts,
  // so Violentmonkey fetches both @resources at install time and the font is inlined as a data URL.
  function loadIcons() {
    if (typeof GM_getResourceText === 'function') {
      const css = GM_getResourceText('phCss').replace(/src:[\s\S]*?;/, `src: url("${GM_getResourceURL('phFont', false)}") format("woff2");`);
      document.head.append(el('style', { id: 'cm-ph' }, css));
    } else {
      // Local preview: no GM API and no CSP, so the CDN stylesheet loads directly.
      document.head.append(el('link', { rel: 'stylesheet', href: 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css' }));
    }
  }
  const ic = (name, extra = '') => el('i', { class: `ph ph-${name} cm-ic ${extra}`, 'aria-hidden': 'true' });

  const CSS = `
html.cm-on {
  --cm-blue:#005DAB; --cm-blue-dark:#004B87; --cm-blue-tint:#EFF7FB;
  --cm-red:#E31837; --cm-green:#008000; --cm-amber:#8A6D3B; --cm-amber-tint:#FFF8E1;
  --cm-ink:#333; --cm-ink-2:#5F5F5F; --cm-ink-3:#707070;
  --cm-line:#E5E5E5; --cm-line-strong:#CCC; --cm-group:var(--cm-blue); --cm-surface-2:#FAFAFA; --cm-page:#F5F5F5;
  --cm-card:0 0 5px rgba(0,0,0,.3);
}
html.cm-on #cart-body { background:var(--cm-page); padding-bottom:32px; }
html.cm-on #cart-title { margin:16px 0 12px; }
html.cm-on #cart-title-label { font-size:24px; line-height:30px; font-weight:400; color:var(--cm-ink); }
html.cm-on #items-quantity-title { font-size:15px; color:var(--cm-ink-3); }
html.cm-on .cm-hide, html.cm-on #cart-body .cm-hide { display:none !important; }
html:not(.cm-on) #cart-body :is(.cm-ic, .cm-extra, .cm-svc-count, .cm-svc-toggle, .cm-date-chip, .cm-mode, #cm-promos) { display:none !important; }
.cm-ic { font-size:18px; line-height:1; vertical-align:-3px; }

/* ---- item list: each item is its own light card, 12px apart ---- */
html.cm-on #order-items-regular { background:none; box-shadow:none; }
html.cm-on #order-items .order-item { background:#fff; border:1px solid var(--cm-line); border-radius:4px; box-shadow:none;
  padding:16px 20px !important; margin:0; font-size:13px; line-height:18px; color:var(--cm-ink); transition:background .3s; }
html.cm-on #order-items-regular { display:flex; flex-direction:column; gap:12px; }
/* an auto-added companion (the TV's Allstate plan) reads as a split of its parent card, like Services */
html.cm-on #order-items .order-item.cm-child { background:var(--cm-surface-2); padding:10px 20px !important; margin-top:-12px; }
/* one outline around the parent and its companion: they share a border and sit flush */
html.cm-on #order-items .order-item.cm-parent { border-color:var(--cm-group); border-bottom:0; border-radius:4px 4px 0 0; box-shadow:0 0 0 1px var(--cm-group); }
html.cm-on #order-items .order-item.cm-child { border-color:var(--cm-group); border-top-color:var(--cm-line); border-radius:0 0 4px 4px; box-shadow:0 0 0 1px var(--cm-group); clip-path:inset(0 -2px -2px -2px); }
html.cm-on #order-items .order-item.cm-child .product-title a { font-size:14px; line-height:20px; }
.cm-child-tag { display:flex; align-items:center; gap:6px; font-size:12px; line-height:16px; font-weight:600; color:var(--cm-ink); margin-bottom:2px; }
html.cm-on #order-items .order-item.cm-flash { background:var(--cm-blue-tint); }
html.cm-on #order-items hr, html.cm-on #order-items .divider-line, html.cm-on #order-items .member-only-msg { display:none; }

/* details column: title, 4, meta, 8, price line, 12, actions */
html.cm-on #order-items .order-item .item-thumbnail img { width:80px; height:80px; object-fit:contain; }
html.cm-on #order-items .order-item .product-title[id^="product-name_"],
html.cm-on #order-items .order-item .product-title a { font-size:16px; line-height:22px; font-weight:400; color:var(--cm-ink); }
html.cm-on #order-items .order-item .product-title a { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
html.cm-on #order-items .order-item .product-title a:hover { color:var(--cm-blue); text-decoration:underline; }
html.cm-on #order-items .order-item .product-warranty { font-size:12px; line-height:16px; color:var(--cm-ink-3); margin-top:0 !important;
  display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
html.cm-on #order-items .order-item .number-status { display:inline; font-size:12px; color:var(--cm-ink-3); margin:0 !important; }
html.cm-on #order-items .order-item .number-status .number { margin:0 !important; }
html.cm-on #order-items .order-item .col-xs-9 { line-height:16px; }
html.cm-on #order-items .order-item .col-xs-9 > .product-title { display:block; }
html.cm-on #order-items .order-item .number-status .number { font-size:12px; color:var(--cm-ink-3); }
html.cm-on #order-items .order-item .defining-attributes { display:inline; font-size:12px; color:var(--cm-ink-3); }
html.cm-on #order-items .order-item .defining-attributes div { display:inline; }
html.cm-on #order-items .order-item .defining-attributes div::before { content:"|"; margin:0 6px; color:var(--cm-line-strong); }
html.cm-on #order-items .order-item .item-fsa:not(:has(*)) { display:none; }
html.cm-on #order-items .order-item .item-description-prices { margin-top:8px; }
html.cm-on #order-items .order-item .item-description-prices > .price { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 12px; margin:0 !important; }
html.cm-on #order-items .order-item .product-price .price { font-size:18px; line-height:24px; font-weight:700; color:var(--cm-ink); }
html.cm-on #order-items .order-item .col-xs-8 > .product-title { font-size:12px; color:var(--cm-ink-3); }
html.cm-on #order-items .order-item.cm-qty1 .total-price,
html.cm-on #order-items .order-item.cm-qty1 [automation-id^="totalPriceOutput_"] { display:none; }

/* price line extras */
.cm-save { color:var(--cm-green); font-weight:700; white-space:nowrap; }
.cm-when { display:inline-flex; align-items:center; gap:4px; font-size:12px; color:var(--cm-ink-3); white-space:nowrap; }
.cm-when.cm-warn { color:var(--cm-amber); font-weight:600; }
/* Costco's slanted badge, kept for the one thing that needs shouting */
.cm-badge { display:inline-block; background:var(--cm-red); color:#fff; font-size:12px; line-height:16px; font-weight:600;
  padding:2px 16px 2px 6px; border-radius:3px 3px 0 0; clip-path:polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%); white-space:nowrap; }

/* actions: stepper, then icon buttons, one row */
html.cm-on #order-items .order-item .azure-entries { display:flex; flex-direction:column; }
html.cm-on #order-items .order-item .azure-entries > .row:has(.quantity-selector-v2) { order:9; }
html.cm-on #order-items .order-item .row > div:has(> .quantity-selector-v2) { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; margin-top:12px; }
html.cm-on #order-items .order-item .item-quantity-validation-error { flex-basis:100%; order:3; }
html.cm-on #order-items .order-item .item-quantity-validation-error:not(:has(.error:not(:empty))) { display:none; }
html.cm-on #order-items .order-item .quantity-selector-v2 { height:28px; width:92px; border:1px solid var(--cm-line-strong); border-radius:4px; display:inline-flex; overflow:hidden; margin:0; }
html.cm-on #order-items .order-item .quantity-selector-v2 button { width:28px; height:26px; min-height:0; border:0; background:#fff; color:var(--cm-blue); padding:0; }
html.cm-on #order-items .order-item .quantity-selector-v2 button img { display:none; }
html.cm-on #order-items .order-item .quantity-selector-v2 button .cm-ic { font-size:14px; vertical-align:0; }
html.cm-on #order-items .order-item .quantity-selector-v2 input { width:34px; height:26px; border:0; font-size:13px; text-align:center; padding:0; }
html.cm-on #order-items .order-item .remove-link { margin:0 !important; }
html.cm-on #order-items .order-item .remove-link button,
html.cm-on #order-items .order-item .wish-list button { font-size:0 !important; width:28px; height:28px; padding:0; border:0; background:none; color:var(--cm-ink-3); border-radius:4px; display:inline-flex; align-items:center; justify-content:center; }
html.cm-on #order-items .order-item .remove-link button .cm-ic,
html.cm-on #order-items .order-item .wish-list button .cm-ic { font-size:18px; vertical-align:-4px; vertical-align:0; }
html.cm-on #order-items .order-item .remove-link button:hover { color:var(--cm-red); background:var(--cm-surface-2); }
html.cm-on #order-items .order-item .wish-list button:hover { color:var(--cm-blue); background:var(--cm-surface-2); }
html.cm-on #order-items .order-item .wish-list > span { display:none; }
html.cm-on #order-items .order-item .wish-list { display:flex; gap:4px; margin:0; text-align:left; }

/* ---- desktop item grid: [80 thumb | details] beside [delivery over price], services as a footer split ---- */
@media (min-width:1025px) {
  html.cm-on #order-items .order-item > .row { display:grid; grid-template-columns:minmax(0,1fr) 320px; grid-template-rows:auto 1fr auto; grid-template-areas:"main deliv" "main price" "svc svc"; column-gap:24px; margin:0; }
  html.cm-on #order-items .order-item > .row::before, html.cm-on #order-items .order-item > .row::after { display:none; }
  html.cm-on #order-items .order-item > .row > div { float:none; width:auto; margin-left:0; padding:0; min-width:0; }
  html.cm-on #order-items .order-item > .row > [class*="col-xl-7"] { grid-area:main; position:relative; }
  html.cm-on #order-items .order-item > .row > [class*="col-xl-5"]:not([class*="offset"]) { grid-area:deliv; position:relative; }
  html.cm-on #order-items .order-item > .row > .col-xs-12:not([class*="col-xl"]):not(.cart-part-services):not(:has(.cart-part-services)) { grid-area:svc; }
  html.cm-on #order-items .order-item > .row > div:has(.cart-part-services), html.cm-on #order-items .order-item > .row > .cart-part-services { grid-area:svc; }
  html.cm-on #order-items .order-item.cm-email > .row { grid-template-areas:"main price" "main price" "svc svc"; }
  html.cm-on #order-items .order-item.cm-email > .row > [class*="col-xl-5"]:not([class*="offset"]) { display:none; }
  html.cm-on #order-items .order-item .azure-entries > .row { margin-left:0; margin-right:0; }
  /* thumbnail floats out of flow so its 80px height doesn't push the actions row down */
  html.cm-on #order-items .order-item .azure-entries { position:static; min-height:80px; }
  html.cm-on #order-items .order-item .azure-entries [class*="col-"] { min-height:0; }
  html.cm-on #order-items .order-item .azure-entries > .row > .item-thumbnail { width:80px; padding:0; position:absolute; top:0; left:0; }
  html.cm-on #order-items .order-item .linked-item { margin-bottom:0; }
  html.cm-on #order-items .order-item .azure-entries > .row > .item-thumbnail + .col-xs-9 { width:calc(100% - 96px); margin-left:96px; padding:0; position:static; }
  /* price is moved into its own grid cell under delivery, bottom-right, level with the actions row */
  /* price is anchored to the bottom-right of the item column, level with the actions row */
  html.cm-on #order-items .order-item > .row > .cm-price-slot { grid-area:price; align-self:end; justify-self:end; margin-top:4px; }
  html.cm-on #order-items .order-item .cm-price-slot .item-description-prices { margin:0; }
  html.cm-on #order-items .order-item .cm-price-slot .item-description-prices > .price { flex-direction:row; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:0 10px; text-align:right; }
  html.cm-on #order-items .order-item .cm-price-slot .product-price { flex-basis:100%; text-align:right; }
  html.cm-on #order-items .order-item .azure-entries > .row > [class*="col-xl-offset-3"] { margin-left:96px; padding:0; width:calc(100% - 96px); }
  html.cm-on #order-items .order-item > .row > [class*="col-xl-5"] .row { margin:0; }
  html.cm-on #order-items .order-item > .row > [class*="col-xl-5"] [class*="col-"] { padding:0; margin-left:0; }
}

/* ---- delivery column: icon + mode, one outlined date field, no boxes ---- */
html.cm-on .delivery-options .selection-item:not(.cart-calendar-box) { border:0 !important; border-radius:0 !important; box-shadow:none !important;
  background:none !important; padding:0 !important; margin:0 !important; min-height:0 !important; }
html.cm-on .delivery-options, html.cm-on .delivery-options .selection-box-v3 { margin-bottom:0 !important; }
html.cm-on .delivery-options .selection-box-v3 { padding:0 !important; border:0 !important; background:none !important; }
html.cm-on .delivery-options .ship-type-and-cost { display:flex; align-items:center; gap:6px; font-size:13px; line-height:18px; font-weight:600; color:var(--cm-ink); }
html.cm-on .estimated-delivery-date-div, html.cm-on .estimated-delivery-date-div * { font-size:12px !important; line-height:16px; margin:2px 0 0; }
/* the date is a chip on the label's line; Costco's input stays on top of it, invisible, so a click still opens Costco's picker */
html.cm-on .delivery-options label.selection-item:has(.cart-calendar-box) { display:flex !important; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:4px 0; }
/* split chip: [mode | date] as one pill */
html.cm-on .delivery-options label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost { height:28px; box-sizing:border-box; padding:0 8px 0 10px;
  background:var(--cm-surface-2); border:1px solid var(--cm-line-strong); border-right:0; border-radius:14px 0 0 14px; font-size:0 !important; gap:0; }
html.cm-on .delivery-options label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost > :not(.cm-ic) { display:none !important; }
html.cm-on .delivery-options label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost > .cm-ic { font-size:18px; }
/* a later-than-earliest pick shows Costco's "Earliest Delivery" note as one small line under the chip */
html.cm-on #order-items .delivery-options label.selection-item:has(.cart-calendar-box) > .estimated-delivery-date-div { order:9; flex-basis:100%; text-align:right; margin:0 !important; }
html.cm-on #order-items .delivery-options label.selection-item:has(.cart-calendar-box) > .estimated-delivery-date-div * { display:inline !important; font-size:12px !important; line-height:16px !important; font-weight:400 !important; color:var(--cm-ink-3) !important; margin:0 !important; }
html.cm-on #order-items .delivery-options label.selection-item:has(.cart-calendar-box) > .estimated-delivery-date-div > :first-child::after { content:": "; }
html.cm-on .delivery-options label.selection-item:has(.cart-calendar-box) > .cart-delivery-details-link { order:-1; margin-right:6px !important; flex:none; }
/* delivery options hug the right edge, so the chip lines up with the price under it */
html.cm-on #order-items .delivery-options label.selection-item { width:fit-content !important; margin-left:auto !important; }
/* with a pickup choice the options move as one block, so both radio dots share a left edge */
html.cm-on #order-items .delivery-options:has(.warehouse_pickup) { width:fit-content; margin-left:auto !important; }
html.cm-on #order-items .delivery-options:has(.warehouse_pickup) label.selection-item { width:auto !important; margin-left:0 !important; }
html.cm-on #order-items .delivery-options:has(.warehouse_pickup) label.selection-item:has(.cart-calendar-box)::before { top:50% !important; transform:translateY(-50%); }
/* delivery vs pick-up: a two-part toggle stands in for Costco's radios; only the chosen option shows */
html.cm-on #order-items .delivery-options.cm-has-mode { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
html.cm-on #order-items .delivery-options.cm-has-mode label.selection-item { padding-left:0 !important; }
html.cm-on #order-items .delivery-options.cm-has-mode label.selection-item::before { content:none !important; }
html.cm-on #order-items .delivery-options.cm-has-mode .cm-opt:not(.cm-opt-on) { display:none !important; }
html.cm-on #order-items .delivery-options.cm-has-mode label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost { display:none !important; }
html.cm-on #order-items .delivery-options.cm-has-mode .cm-date-chip { border-radius:14px; }
.cm-mode { display:inline-flex; flex-wrap:wrap; max-width:100%; min-height:28px; border:1px solid var(--cm-line-strong); border-radius:14px; overflow:hidden; }
.cm-mode-btn { display:inline-flex; align-items:center; gap:5px; height:28px; padding:0 10px; white-space:nowrap; border:0; background:#fff; color:var(--cm-ink-3); font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
.cm-mode-btn + .cm-mode-btn { border-left:1px solid var(--cm-line-strong); }
.cm-mode-btn .cm-ic { font-size:16px; }
.cm-mode-btn[aria-pressed="true"] { background:var(--cm-blue); color:#fff; }
.cm-mode-btn:focus-visible { outline:2px solid var(--cm-blue); outline-offset:-2px; }
html.cm-on .cart-calendar-box { border:0 !important; background:none !important; box-shadow:none !important; padding:0 !important; margin:0 !important; display:block; }
html.cm-on .cart-calendar-box [id^="calendarWrap"] { position:relative; display:inline-flex; }
html.cm-on .cart-calendar-box input.date-input { position:absolute !important; inset:0; width:100% !important; height:100% !important; opacity:0; cursor:pointer; padding:0; border:0; z-index:1; }
.cm-date-chip { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px 0 8px; border:1px solid var(--cm-line-strong); border-radius:0 14px 14px 0; background:#fff;
  font-size:13px; line-height:18px; font-weight:600; color:var(--cm-blue); white-space:nowrap; }
.cm-date-chip .cm-ic { font-size:15px; margin-right:2px; }
html.cm-on #order-items .cm-date-chip > span { display:inline !important; line-height:26px !important; }
html.cm-on #order-items .cart-delivery-details-link span:not(.cm-ic) { display:none !important; }
html.cm-on .cart-calendar-box [id^="calendarWrap"]:hover .cm-date-chip { background:var(--cm-blue-tint); border-color:var(--cm-blue); }
html.cm-on .cart-calendar-box input.date-input:focus-visible + .cm-date-chip { outline:2px solid var(--cm-blue); outline-offset:2px; }
html.cm-on .cart-calendar-box .cart-calendar-text { position:absolute !important; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
html.cm-on .cart-calendar-box .co-calendar { display:none; }
html.cm-on .cart-calendar-box .cm-cal { display:none; }
html.cm-on .cart-calendar-box label { position:relative; display:block; margin:0; }
/* the details link becomes an info icon at the top-right of the column */
html.cm-on .cart-delivery-details-link { display:inline-flex; margin:0 !important; }
html.cm-on .cart-delivery-details-link > a, html.cm-on .cart-delivery-details-link > button { font-size:0 !important; display:inline-block; text-align:center;
  width:24px; height:24px; padding:0 !important; margin:0 !important; color:var(--cm-blue); background:none; border:0; }
html.cm-on .cart-delivery-details-link .cm-ic { font-size:18px; line-height:24px; }
/* several ship options: a radio dot shows the chosen one, since the boxes are gone */
html.cm-on .delivery-options:has(.warehouse_pickup) label.selection-item:not(.cart-calendar-box) { position:relative; padding-left:20px !important; cursor:pointer; }
html.cm-on .delivery-options:has(.warehouse_pickup) label.selection-item:not(.cart-calendar-box)::before { content:""; position:absolute; left:0; top:3px;
  width:12px; height:12px; border-radius:50%; border:1.5px solid var(--cm-line-strong); background:#fff; box-sizing:border-box; }
html.cm-on .delivery-options:has(.warehouse_pickup) input:checked + label.selection-item::before { border:4px solid var(--cm-blue); }
html.cm-on .warehouse_pickup { margin-top:10px; }
html.cm-on .warehouse_pickup .selection-item, html.cm-on .warehouse_pickup .selection-item * { font-size:12px !important; line-height:16px !important; margin:0 !important; color:var(--cm-ink-2); }
html.cm-on .warehouse_pickup .warehouse_pickup_address_lines { display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
html.cm-on .warehouse_pickup input:not(:checked) + label .warehouse-pickup-address-v2 > div:not(.warehouse_pickup_address_lines) { display:none !important; }
html.cm-on .warehouse_pickup .cart-delivery-details-button { color:var(--cm-blue) !important; padding:0; background:none; border:0; }
html.cm-on .a11y-tooltip .co-help { display:none; }
html.cm-on .a11y-tooltip .cm-ic { font-size:15px; color:var(--cm-blue); vertical-align:-2px; }

/* ---- services: a footer split under the item ---- */
html.cm-on #order-items .order-item .cart-part-services:not(.hidden) { display:block; border-radius:0 0 3px 3px; background:var(--cm-surface-2); border-top:1px solid var(--cm-line);
  margin:8px -20px -16px !important; padding:10px 20px !important; width:auto !important; float:none; }
html.cm-on #order-items .order-item .cart-part-services .row, html.cm-on #order-items .order-item .cart-part-services [class*="col-"],
html.cm-on #order-items .order-item .cart-part-services .container-fluid { margin:0 !important; padding:0 !important; float:none; width:auto; }
html.cm-on .cart-part-services .delivery-services-main { background:none !important; border:0 !important; font-size:12px; line-height:16px; }
html.cm-on .cart-part-services h3 { margin:0 !important; display:flex; align-items:center; gap:8px; font-size:13px; line-height:18px; }
html.cm-on .cart-part-services [id^="edd-delivery-services-container"] { margin-top:0 !important; padding-top:0 !important; }
html.cm-on .cart-part-services [id^="edd-delivery-services-container"] > :first-child { margin-top:0 !important; }
html.cm-on .cart-part-services h3 label.parts-bold { margin:0; font-size:13px !important; line-height:18px !important; font-weight:600; display:inline-flex; align-items:center; gap:6px; }
html.cm-on .cart-part-services .delivery-services-notification { background:none; border:0; padding:0; margin:4px 0 0; color:var(--cm-amber); }
html.cm-on .cart-part-services .delivery-services-notification * { font-size:12px !important; line-height:16px !important; padding:0 !important; }
html.cm-on .cart-part-services .delivery-services-notification img { display:none; }
html.cm-on .cart-part-services .delivery-services-notification .cm-ic { font-size:14px; margin-right:6px; vertical-align:-2px; }
html.cm-on #order-items .cart-part-services.cm-collapsed ul.edd-delivery-services, html.cm-on #order-items .cart-part-services.cm-collapsed .parts-types-bold { display:none !important; }
html.cm-on .cart-part-services:not(.cm-collapsed) ul.edd-delivery-services { margin:2px 0 6px; padding:0; list-style:none; max-width:72ch; }
html.cm-on #order-items .cart-part-services .parts-types-bold { display:block; margin:8px 0 0 !important; font-size:12px !important; line-height:16px !important; font-weight:600; color:var(--cm-ink-3); }
html.cm-on .cart-part-services ul.edd-delivery-services li { display:flex; gap:6px; margin:2px 0; font-size:13px; line-height:18px; color:var(--cm-ink); }
html.cm-on #order-items .cart-part-services ul.edd-delivery-services li .add-cart-list-detail { font-size:13px !important; line-height:18px !important; margin:0 !important; padding:0 !important; }
html.cm-on .cart-part-services ul.edd-delivery-services li > .add-cart-list-cell:first-child { flex:none; display:flex; padding-top:2px; }
html.cm-on .cart-part-services img.parts-services-tick { display:none; }
html.cm-on .cart-part-services .add-cart-list-cell > .ph-check { color:var(--cm-green); font-size:14px; }
html.cm-on .cart-part-services .add-cart-list-cell > .ph-info { color:var(--cm-ink-3); font-size:14px; }
.cm-svc-count { font-weight:400; color:var(--cm-ink-3); }
.cm-svc-toggle { font:inherit; font-size:13px; color:var(--cm-blue); background:none; border:0; padding:0; cursor:pointer; display:inline-flex; align-items:center; gap:2px; }
.cm-svc-toggle .cm-ic { font-size:14px; vertical-align:0; }

/* ---- side panel: our review rows, then Costco's totals and Checkout, one card ---- */
html.cm-on #order-summary-column { transform:none !important; }
html.cm-on #order-summary-column .e-spot-cart-body { display:none; }
@media (min-width:1025px) { html.cm-on [role="region"][aria-label="Checkout"] { position:sticky; top:16px; } }
#cm-review { display:none; }
html.cm-on #cm-review { display:block; background:#fff; border-radius:4px 4px 0 0; box-shadow:var(--cm-card); clip-path:inset(-6px -6px 0 -6px);
  color:var(--cm-ink); font-size:13px; line-height:18px; }
html.cm-on #order-summary-body { border:0 !important; border-radius:0 0 4px 4px; background:#fff !important; box-shadow:var(--cm-card); clip-path:inset(0 -6px -6px -6px);
  margin-top:0 !important; padding:4px 20px 16px !important; }
.cm-head { padding:14px 20px 10px; font-size:13px; line-height:18px; font-weight:600; }
.cm-head span { font-weight:400; color:var(--cm-ink-3); }
.cm-strip { margin:0 20px 6px; padding:6px 10px; border-radius:4px; font-size:12px; line-height:16px; display:flex; gap:6px; align-items:flex-start; }
.cm-strip .cm-ic { font-size:14px; vertical-align:0; margin-top:1px; }
.cm-strip.cm-warn { background:var(--cm-amber-tint); color:var(--cm-amber); }
.cm-strip.cm-ok { background:var(--cm-blue-tint); color:var(--cm-blue-dark); }
.cm-rows { list-style:none; margin:0; padding:0; }
.cm-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 12px; padding:8px 20px; cursor:pointer; border-top:1px solid var(--cm-line); }
.cm-row:first-child { border-top:0; }
.cm-row:hover { background:var(--cm-surface-2); }
.cm-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cm-name a { color:var(--cm-ink); text-decoration:none; }
.cm-name a:hover { color:var(--cm-blue); text-decoration:underline; }
.cm-price { font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }
.cm-meta { font-size:12px; line-height:16px; color:var(--cm-ink-3); display:flex; gap:10px; flex-wrap:wrap; }
.cm-meta > span { display:inline-flex; align-items:center; gap:3px; }
.cm-meta .cm-ic { font-size:13px; vertical-align:0; }
.cm-meta .cm-urgent { color:var(--cm-red); font-weight:700; }
.cm-meta .cm-warn { color:var(--cm-amber); font-weight:600; }
.cm-row .cm-save { font-size:12px; text-align:right; font-weight:400; }
.cm-foot { display:flex; padding:10px 20px; gap:8px; align-items:center; white-space:nowrap; border-top:1px solid var(--cm-line); }
.cm-btn { font:inherit; font-size:13px; font-weight:600; height:30px; padding:0 10px; border-radius:4px; border:1px solid var(--cm-blue); background:#fff; color:var(--cm-blue);
  cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.cm-btn:hover { background:var(--cm-blue-tint); }
.cm-btn .cm-ic { font-size:16px; vertical-align:0; }
.cm-icon-btn { width:30px; padding:0; justify-content:center; border-color:var(--cm-line-strong); color:var(--cm-ink-2); }
.cm-link { font:inherit; font-size:12px; background:none; border:0; padding:0; color:var(--cm-ink-3); cursor:pointer; text-decoration:underline; margin-left:auto; }
.cm-pre { display:none; margin:0 20px 12px; padding:10px; background:var(--cm-surface-2); border-radius:4px; font-size:11px; line-height:15px; white-space:pre-wrap; max-height:220px; overflow:auto; }
.cm-pre.cm-open { display:block; }
#cm-promos { clear:both; margin:2px 0 8px; padding-left:12px; border-left:2px solid var(--cm-line); font-size:12px; line-height:18px; color:var(--cm-ink-3); }
.cm-promo { display:flex; justify-content:space-between; gap:8px; }
.cm-promo > span:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--cm-ink); }
.cm-promo > span:last-child { color:var(--cm-green); white-space:nowrap; }
.cm-promo-items { color:var(--cm-ink-3); }
.cm-promo-ok, .cm-promo-gap, .cm-promo-missing { display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:2px; }
.cm-promo-gap { color:var(--cm-amber); font-weight:600; }
.cm-promo-missing .cm-link { font-size:12px; margin-left:0; color:var(--cm-blue); }
.cm-strip-list { align-items:flex-start; }
.cm-strip-row { font-weight:400; }
.cm-strip-row b { font-weight:600; }
.cm-savings { display:flex; justify-content:space-between; padding:10px 20px 0; border-top:1px solid var(--cm-line); color:var(--cm-green); font-size:14px; line-height:20px; }
html.cm-on #order-summary-body .summary-left, html.cm-on #order-summary-body .summary-right,
html.cm-on #order-summary-body .order-estimated, html.cm-on #order-summary-body .order-estimated * { font-size:14px !important; line-height:20px !important; margin-bottom:6px !important; }
html.cm-on #order-summary-body .estimated-total-label, html.cm-on #order-estimated-total { font-size:18px !important; line-height:24px !important; font-weight:700 !important; }
html.cm-on #order-summary-body .order-summary-text-info { font-size:12px; color:var(--cm-ink-3); margin:2px 0 12px; }
html.cm-on #order-summary-body .divider-line { margin:8px 0 10px; border-color:var(--cm-line); }
html.cm-on #order-estimated-zip { width:75%; }
html.cm-on #order-estimated-shipping { width:25%; text-align:right; }
html.cm-on #shopCartCheckoutSubmitButton { width:100%; height:44px; border-radius:4px; font-weight:600; }
.cm-btn:focus-visible, .cm-link:focus-visible, .cm-svc-toggle:focus-visible, .cm-row:focus-visible { outline:2px solid var(--cm-blue); outline-offset:2px; }
#cm-restore { position:fixed; right:16px; bottom:16px; z-index:9999; font:600 13px/1 system-ui, sans-serif; padding:10px 14px; border-radius:4px;
  border:0; background:#005DAB; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.2); cursor:pointer; }
html.cm-on #cm-restore { display:none; }
#cm-redline-btn { position:fixed; left:16px; bottom:16px; z-index:9999; display:inline-flex; align-items:center; gap:6px; font:600 12px/1 system-ui, sans-serif;
  padding:8px 12px; border-radius:4px; border:1px solid #E31837; background:#fff; color:#E31837; cursor:pointer; box-shadow:0 0 5px rgba(0,0,0,.3); }
#cm-redline-btn[aria-pressed="true"] { background:#E31837; color:#fff; }

/* ---- mobile + tablet: Costco's own stacking, plus a checkout bar ---- */
#cm-bar { display:none; }
@media (max-width:1024px) {
  html.cm-on #order-items .order-item > .row { display:flex; flex-direction:column; }
  html.cm-on #order-items .order-item > .row > [class*="col-xl-7"] { order:-2; }
  html.cm-on #order-items .order-item > .row > .cm-price-slot { order:-1; padding:0 15px 0 calc(25% + 15px); }
  html.cm-on #cart-body { padding-bottom:96px; }
  html.cm-on #order-items .order-item .cart-part-services:not(.hidden) { padding-left:20px !important; }
  html.cm-on #cm-bar { display:flex; position:fixed; left:0; right:0; bottom:0; z-index:1000; background:#fff; border-top:1px solid var(--cm-line);
    box-shadow:0 -2px 8px rgba(0,0,0,.08); padding:10px 16px calc(10px + env(safe-area-inset-bottom)); align-items:center; justify-content:space-between; gap:12px; }
  #cm-bar .cm-bar-label { font-size:12px; color:var(--cm-ink-3); }
  #cm-bar .cm-bar-total { font-size:18px; font-weight:700; font-variant-numeric:tabular-nums; }
  #cm-bar .cm-bar-alert { font-size:12px; color:var(--cm-red); font-weight:600; background:none; border:0; padding:0; }
  #cm-bar .cm-bar-go { height:44px; padding:0 24px; border-radius:4px; border:0; background:var(--cm-green); color:#fff; font-weight:600; font-size:16px; }
}
`;

  const SAME_DAY = /required to ship on the same day/i;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'class' ? (n.className = v) : n.setAttribute(k, v);
    for (const k of kids.flat()) if (k != null && k !== false && k !== '') n.append(k.nodeType ? k : String(k));
    return n;
  };

  function readItems() {
    const dateMap = {};
    const raw = ($('[name="calendarItemSelectedDate"]') || {}).value || '';
    for (const m of raw.matchAll(/scheduler_picker_(\d+)_\d+_(\w+)\|(\d{4}-\d{2}-\d{2})/g)) {
      // ponytail: pickup (LPU) entries can come first; any delivery mode replaces them.
      if (!dateMap[m[1]] || dateMap[m[1]].mode === 'LPU') dateMap[m[1]] = { mode: m[2], date: m[3] };
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);

    return $$('#order-items .order-item').map((card) => {
      const idEl = $('[data-orderitemid]', card);
      const orderItemId = idEl ? idEl.dataset.orderitemid : '';
      const itemNo = ($('[data-orderitemnumber]', card) || { dataset: {} }).dataset.orderitemnumber || '';
      const link = $('.product-title a', card);
      const priceEl = $('.product-price .price', card);
      const promo = text($('.h8-style-guide-green', card));
      const save = money((promo.match(/\$([\d,.]+) savings/i) || [])[1] || 0);
      const endM = promo.match(/through (\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
      let end = null, days = null;
      if (endM) {
        end = new Date(+endM[3] < 100 ? 2000 + +endM[3] : +endM[3], +endM[1] - 1, +endM[2]);
        days = Math.round((end - today) / 864e5);
      }
      const dateInput = $('input.date-input', card);
      let deliv = null;
      if (dateMap[orderItemId]) deliv = new Date(dateMap[orderItemId].date + 'T00:00:00');
      else if (dateInput && dateInput.value && !isNaN(Date.parse(dateInput.value))) deliv = new Date(dateInput.value);
      const qtyEl = $('input[id^="quantity_"]', card);
      return {
        card, orderItemId, itemNo,
        name: text(link) || text($('.product-title', card)),
        href: link ? link.href : '',
        price: priceEl ? money(priceEl.firstChild ? priceEl.firstChild.textContent : priceEl.textContent) : 0,
        qty: qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1,
        save, end, days, deliv,
        shipsTogether: $$('.ltl-warning-text, .cart-informational.warning', card).some((n) => SAME_DAY.test(n.textContent)),
        email: /delivery via email/i.test(text($('.ship-type-and-cost', card))),
        autoadd: /autoadd/i.test(($('[name="controllingAttributes"]', card) || {}).value || ''),
      };
    });
  }

  // An "autoadd" item's companion (e.g. the TV's Allstate plan) is the order item created right after it.
  // ponytail: id+1 heuristic; the product page's ACCESSORY association is exact but costs a fetch per load.
  function linkAutoAdds(items) {
    const out = [];
    for (const it of items) if (!it.parent) {
      out.push(it);
      const kid = it.autoadd && items.find((k) => +k.orderItemId === +it.orderItemId + 1);
      if (kid) { kid.parent = it; out.push(kid); }
    }
    out.forEach((it, i) => {
      it.card.style.order = i;
      it.card.classList.toggle('cm-child', !!it.parent);
      it.card.classList.toggle('cm-parent', out[i + 1] ? out[i + 1].parent === it : false);
    });
    return out;
  }

  function urgency(days) {
    if (days == null || days > 7) return null;
    if (days < 0) return { cls: 'cm-urgent', label: 'Promo ended' };
    if (days <= 1) return { cls: 'cm-urgent', label: days === 0 ? 'Ends today' : 'Ends tomorrow' };
    return { cls: 'cm-warn', label: `Ends in ${days} days` };
  }

  // Inserts a Phosphor icon once into a Costco node.
  const addIcon = (node, name, where = 'prepend') => { if (node && !$(':scope > .cm-ic', node)) node[where](ic(name)); };

  function decorateCards(items) {
    $$('.cm-extra').forEach((n) => n.remove());
    for (const it of items) {
      const c = it.card;
      const row = $(':scope > .row', c), priceBox = $('.item-description-prices', c)?.parentElement;
      if (row && priceBox && priceBox.parentElement !== row) { priceBox.classList.add('cm-price-slot'); row.append(priceBox); }
      if (it.parent) $('.item-thumbnail + .col-xs-9', c)?.prepend(el('div', { class: 'cm-child-tag cm-extra' }, ic('link-simple'), `Added with ${shortName(it.parent.name)}`));
      c.classList.toggle('cm-qty1', it.qty === 1);
      c.classList.toggle('cm-email', !!it.email);
      $$('.ltl-container, [id^="item_level_message_"]', c).forEach((n) => { if (SAME_DAY.test(n.textContent)) n.classList.add('cm-hide'); });

      // Price line: Costco's two green lines become "Save $X" plus an end date beside the price.
      const promoEl = $('.h8-style-guide-green', c);
      if (promoEl && (it.save || it.end)) promoEl.classList.add('cm-hide');
      const priceRow = $('.item-description-prices > .price', c);
      const u = urgency(it.days);
      const extras = [];
      if (it.save) extras.push(el('span', { class: 'cm-save cm-extra' }, `Save ${fmt0(it.save)}`));
      if (it.end && u && u.cls === 'cm-urgent') extras.push(el('span', { class: 'cm-badge cm-extra' }, `${u.label} · ${shortDate(it.end)}`));
      else if (it.end) extras.push(el('span', { class: `cm-when cm-extra ${u ? u.cls : ''}` }, ic('timer'), u ? `${u.label} · ${shortDate(it.end)}` : `Ends ${shortDate(it.end)}`));
      if (it.email) extras.push(el('span', { class: 'cm-when cm-extra' }, ic('envelope-simple'), 'Delivered by email'));
      if (priceRow) priceRow.append(...extras);
      else { const t = $('.product-title', c); if (t) t.after(el('div', { class: 'cm-extra' }, ...extras)); }

      // Repeats: "Shipping & Handling Included" on every item, and Earliest Delivery when it equals the chosen date.
      $$('.shipping-cost', c).forEach((s) => s.classList.toggle('cm-hide', /included/i.test(s.textContent)));
      const edd = $('.estimated-delivery-date-div', c);
      if (edd && it.deliv) {
        const shown = Date.parse(text(edd).replace(/^Earliest Delivery\s*/i, ''));
        edd.classList.toggle('cm-hide', !isNaN(shown) && new Date(shown).toDateString() === it.deliv.toDateString());
      }

      // Icons: actions, stepper, ship mode, calendar, help.
      addIcon($('.remove-link button', c), 'trash');
      const wl = $$('.wish-list button', c);
      addIcon(wl[0], 'list-plus');
      addIcon(wl[1], 'bookmark-simple');
      if (wl[1] && !wl[1].getAttribute('aria-label')) wl[1].setAttribute('aria-label', 'Save for Later');
      const stepRow = $('.quantity-selector-v2', c)?.parentElement, wlBox = $('.wish-list', c);
      if (stepRow && wlBox && wlBox.parentElement !== stepRow) { wlBox.parentElement.classList.add('cm-hide'); stepRow.append(wlBox); }
      addIcon($('.quantity-selector-v2 button[id^="sub-"]', c), 'minus');
      addIcon($('.quantity-selector-v2 button[id^="add-"]', c), 'plus');
      $$('.ship-type-and-cost', c).forEach((s) => addIcon(s, /room of choice|set up|delivery and/i.test(s.textContent) ? 'truck' : /email/i.test(s.textContent) ? 'envelope-simple' : 'package'));
      $$('.cart-calendar-box label:has(> .co-calendar)', c).forEach((l) => { if (!$('.cm-cal', l)) l.append(ic('calendar-blank', 'cm-cal')); });
      $$('.a11y-tooltip', c).forEach((b) => addIcon(b, 'info'));
      $$('.cart-delivery-details-link > a, .cart-delivery-details-link > button', c).forEach((b) => {
        if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', text(b));
        addIcon(b, 'info');
      });
      const opts = $('.delivery-options', c);
      // Any card with 2+ ship modes gets a segmented toggle, one segment per Costco radio; clicking a segment clicks that radio.
      const radios = opts ? $$('input.shipModeId[type="radio"]', opts) : [];
      if (radios.length > 1) {
        const block = (r) => r.closest('.individualShipBlock, .warehouse_pickup') || r.parentElement;
        const name = (r) => {
          const l = opts.querySelector(`label[for="${r.id}"]`) || block(r);
          return (text($('.ship-type-and-cost', l)) || text(l)).split(/[:(]/)[0].trim() || 'Option';
        };
        const icon = (r, n) => /pick-?up|warehouse/i.test(r.id + n) ? 'storefront' : /mail/i.test(n) ? 'envelope-simple' : 'truck';
        let tog = $(':scope > .cm-mode', opts);
        if (!tog || tog.children.length !== radios.length) {
          tog?.remove();
          tog = el('div', { class: 'cm-mode', role: 'group', 'aria-label': 'Delivery options' }, ...radios.map((r) => {
            const n = name(r);
            const b = el('button', { type: 'button', class: 'cm-mode-btn', title: n }, ic(icon(r, n)), n);
            b.addEventListener('click', () => { if (!r.checked) r.click(); render(); });
            return b;
          }));
          opts.prepend(tog);
        }
        opts.classList.add('cm-has-mode');
        radios.forEach((r, i) => {
          block(r).classList.add('cm-opt');
          block(r).classList.toggle('cm-opt-on', r.checked);
          tog.children[i].setAttribute('aria-pressed', String(r.checked));
        });
      }
      const infoLink = $('.cart-delivery-details-link', c), shipType = $('.delivery-options .ship-type-and-cost', c);
      if (shipType && !shipType.title) { shipType.title = text(shipType).replace(/:.*$/, '').trim(); shipType.setAttribute('aria-label', shipType.title); }
      const infoHome = shipType && (shipType.closest('label.selection-item:has(.cart-calendar-box)') || shipType);
      if (infoLink && infoHome && infoLink.parentElement !== infoHome) infoHome.append(infoLink);
      $$('.cart-calendar-box input.date-input', c).forEach((inp) => {
        const d = new Date(inp.value);
        const label = isNaN(d) ? inp.value : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const chip = $(':scope > .cm-date-chip', inp.parentElement);
        if (chip) chip.lastChild.textContent = label;
        else {
          inp.after(el('span', { class: 'cm-date-chip', 'aria-hidden': 'true' }, ic('calendar-blank'), el('span', {}, label)));
          inp.addEventListener('change', () => render());
        }
      });
    }

    $$('.cart-part-services:not(.hidden)').forEach((svc) => {
      addIcon($('.delivery-services-notification .add-cart-list-row', svc), 'info');
      $$('ul.edd-delivery-services img.parts-services-tick', svc).forEach((img) => addIcon(img.parentElement, img.alt === 'included' ? 'check' : 'info'));
      const h3 = $('.delivery-services-main h3', svc);
      if (!h3 || $('.cm-svc-toggle', h3)) return;
      addIcon($('label', h3), 'wrench');
      const lists = $$('ul.edd-delivery-services', svc);
      const included = lists[0] ? $$('li', lists[0]).length : 0;
      const notes = lists[1] ? $$('li', lists[1]).length : 0;
      svc.classList.add('cm-collapsed');
      const btn = el('button', { type: 'button', class: 'cm-svc-toggle', 'aria-expanded': 'false' }, 'Details', ic('caret-down'));
      btn.addEventListener('click', () => {
        const open = !svc.classList.toggle('cm-collapsed');
        btn.replaceChildren(open ? 'Hide' : 'Details', ic(open ? 'caret-up' : 'caret-down'));
        btn.setAttribute('aria-expanded', String(open));
      });
      h3.append(el('span', { class: 'cm-svc-count' }, `${included} included · ${notes} notes`), btn);
    });
  }

  // ponytail: keyword list for common big-ticket items; falls back to the first three words.
  const shortName = (n) => ['microwave', 'refrigerator', 'freezer', 'dishwasher', 'washer', 'dryer', 'cooktop', 'range', 'oven', 'TV']
    .find((w) => new RegExp(`\\b${w}\\b`, 'i').test(n)) || n.split(/\s+/).slice(0, 3).join(' ');

  function dateGroups(items) {
    const groups = new Map();
    for (const i of items.filter((x) => x.deliv)) {
      const k = i.deliv.toDateString();
      if (!groups.has(k)) groups.set(k, { date: i.deliv, items: [] });
      groups.get(k).items.push(i);
    }
    return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  }

  function deliveryStrip(groups) {
    if (!groups.length) return null;
    if (groups.length === 1) return el('div', { class: 'cm-strip cm-ok' }, ic('truck'), `All deliveries arrive ${longDate(groups[0].date)}`);
    const [main, ...rest] = groups;
    const names = (g) => g.items.map((i) => shortName(i.name)).join(', ');
    if (groups.length === 2) return el('div', { class: 'cm-strip cm-warn' }, ic('warning'),
      `Separate delivery days: ${names(rest[0])} arrives ${longDate(rest[0].date)}; everything else ${longDate(main.date)}.`);
    return el('div', { class: 'cm-strip cm-warn cm-strip-list' }, ic('warning'),
      el('div', {}, el('div', {}, `${groups.length} separate delivery days`),
        ...[...groups].sort((x, y) => x.date - y.date).map((g) => el('div', { class: 'cm-strip-row' }, el('b', {}, longDate(g.date)), ' · ' + names(g)))));
  }

  function summaryText(items, totals) {
    return [
      ...items.map((i) => [
        i.name, fmt(i.price * i.qty) + (i.qty > 1 ? ` (x${i.qty})` : ''),
        i.save && `saves ${fmt0(i.save)}`, i.end && `promo ends ${shortDate(i.end)}`,
        i.deliv && `delivery ${shortDate(i.deliv)}`, i.href,
      ].filter(Boolean).join(' | ')),
      '',
      `Subtotal: ${totals.subtotal}`,
      totals.discount && `Discount: ${totals.discount}`,
      `Shipping: ${totals.shipping}`,
      `Estimated total (pre-tax): ${totals.total}`,
    ].filter((l) => l != null && l !== false).join('\n');
  }

  async function copy(str) {
    try { await navigator.clipboard.writeText(str); return true; } catch {}
    const ta = el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = str; document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }

  function renderPanel(items) {
    const col = $('#order-summary-column');
    const totals = {
      subtotal: text($('#orderSubtotal')),
      discount: text($('#totalDiscountOutput')),
      shipping: text($('[automation-id="orderEstimatedShipping"]')) || text($('#order-estimated-shipping')),
      total: text($('#order-estimated-total')),
    };
    const count = items.reduce((n, i) => n + i.qty, 0);
    const itemSavings = items.reduce((n, i) => n + i.save * i.qty, 0);
    const groups = dateGroups(items);
    const mainDate = groups[0] && groups[0].date.toDateString();

    const rows = items.map((i) => {
      const u = urgency(i.days);
      const meta = [];
      if (i.end) meta.push(el('span', { class: u ? u.cls : '', 'aria-label': `Promo ends ${shortDate(i.end)}` }, ic('timer'),
        shortDate(i.end) + (u && u.cls === 'cm-urgent' ? (i.days < 0 ? ' (ended)' : i.days === 0 ? ' (today)' : ' (tomorrow)') : '')));
      if (i.deliv && groups.length > 1 && i.deliv.toDateString() !== mainDate) meta.push(el('span', { class: 'cm-warn', 'aria-label': `Delivery ${shortDate(i.deliv)}` }, ic('truck'), shortDate(i.deliv)));
      if (i.qty > 1) meta.push(el('span', {}, `Qty ${i.qty}`));
      const li = el('li', { class: 'cm-row', tabindex: '0' },
        el('div', { class: 'cm-name' }, i.href ? el('a', { href: i.href, title: i.name }, i.name) : i.name),
        el('div', { class: 'cm-price' }, fmt(i.price * i.qty)),
        el('div', { class: 'cm-meta' }, meta),
        i.save ? el('div', { class: 'cm-save' }, '-' + fmt0(i.save * i.qty)) : el('div'));
      const jump = (e) => {
        if (e.target.closest('a') || (e.type === 'keydown' && e.key !== 'Enter')) return;
        i.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        i.card.classList.add('cm-flash');
        setTimeout(() => i.card.classList.remove('cm-flash'), 1200);
      };
      li.addEventListener('click', jump);
      li.addEventListener('keydown', jump);
      return li;
    });

    const pre = el('pre', { class: 'cm-pre' }, summaryText(items, totals));
    const copyBtn = el('button', { type: 'button', class: 'cm-btn' }, ic('copy'), 'Copy summary');
    copyBtn.addEventListener('click', async () => {
      const ok = await copy(summaryText(items, totals));
      copyBtn.replaceChildren(ic(ok ? 'check' : 'warning'), ok ? 'Copied' : 'Copy failed');
      setTimeout(() => copyBtn.replaceChildren(ic('copy'), 'Copy summary'), 2000);
    });
    const showBtn = el('button', { type: 'button', class: 'cm-btn cm-icon-btn', 'aria-label': 'Preview summary text', title: 'Preview summary text' }, ic('eye'));
    showBtn.addEventListener('click', () => pre.classList.toggle('cm-open'));
    const offBtn = el('button', { type: 'button', class: 'cm-link' }, 'Original view');
    offBtn.addEventListener('click', () => setOn(false));

    const review = el('section', { id: 'cm-review', 'aria-label': 'Order review' },
      el('div', { class: 'cm-head' }, 'Order review ', el('span', {}, `· ${count} item${count === 1 ? '' : 's'}`)),
      deliveryStrip(groups),
      el('ul', { class: 'cm-rows' }, rows),
      el('div', { class: 'cm-foot' }, copyBtn, showBtn, offBtn),
      pre,
      itemSavings ? el('div', { class: 'cm-savings' }, el('span', {}, 'Instant savings (in prices)'), el('span', {}, '-' + fmt(itemSavings))) : null);
    const old = $('#cm-review');
    old ? old.replaceWith(review) : col.before(review);

    let bar = $('#cm-bar');
    if (!bar) { bar = el('div', { id: 'cm-bar', role: 'region', 'aria-label': 'Checkout bar' }); document.body.append(bar); }
    const real = $('#shopCartCheckoutSubmitButton');
    const go = el('button', { type: 'button', class: 'cm-bar-go' }, 'Checkout');
    go.disabled = !real || real.disabled;
    go.addEventListener('click', () => real && real.click());
    const urgentCount = items.filter((i) => i.days != null && i.days <= 1).length;
    const alertBtn = urgentCount ? el('button', { type: 'button', class: 'cm-bar-alert' }, ic('timer'), ` ${urgentCount} promo${urgentCount > 1 ? 's' : ''} ending`) : null;
    if (alertBtn) alertBtn.addEventListener('click', () => review.scrollIntoView({ behavior: 'smooth' }));
    bar.replaceChildren(el('div', {}, el('div', { class: 'cm-bar-label' }, 'Est. total'), el('div', { class: 'cm-bar-total' }, totals.total), alertBtn), go);
  }

  // Explains Costco's "Discount on Order" line from the cached promos, and checks the sum against Costco's total.
  function promoLines(items) {
    const groups = new Map();
    for (const it of items) for (const p of (promoCache.get(it.itemNo) || { promos: [] }).promos) {
      const g = groups.get(p.key) || { p, items: [] };
      g.items.push(it);
      groups.set(p.key, g);
    }
    const lines = [];
    for (const { p, items: its } of groups.values()) {
      let amount = 0;
      if (p.type === 'bundle') amount = items.some((i) => !its.includes(i) && i.name.toLowerCase().includes(p.partner)) ? p.amount : 0;
      else {
        const have = p.type === 'spend' ? its.reduce((s, i) => s + i.price * i.qty, 0) : its.reduce((s, i) => s + i.qty, 0);
        amount = p.tiers.filter(([need]) => have >= need).reduce((best, [, save]) => Math.max(best, save), 0);
      }
      if (amount) lines.push({ name: p.name, amount, items: its });
    }
    return lines.sort((a, b) => b.amount - a.amount);
  }

  let fetching = false;
  async function fetchPromos(itemNos) {
    fetching = true;
    renderPromos();
    for (const n of itemNos) {
      try {
        const r = await fetch(`${location.origin}/p/-/${n}`, { credentials: 'same-origin' });
        if (r.ok) promoCache.set(n, parsePromos(await r.text()).promos);
      } catch {}
    }
    fetching = false;
    render();
  }

  const fetchBtn = (missing) => {
    const b = el('button', { type: 'button', class: 'cm-link' }, fetching ? 'Fetching…' : 'Fetch now');
    b.disabled = fetching;
    b.addEventListener('click', () => fetchPromos(missing));
    return b;
  };

  let lastItems = [];
  function renderPromos(items = lastItems) {
    lastItems = items;
    $('#cm-promos')?.remove();
    const anchor = $('#totalDiscountOutput');
    const discount = Math.abs(money(anchor && (anchor.getAttribute('discount') || anchor.textContent)));
    if (!anchor || !discount) return;
    const missing = items.filter((i) => i.itemNo && !promoCache.get(i.itemNo)).map((i) => i.itemNo);
    const lines = promoLines(items);
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    const gap = Math.round((discount - sum) * 100) / 100;
    const box = el('div', { id: 'cm-promos' },
      ...lines.map((l) => el('div', { class: 'cm-promo' },
        el('span', {}, l.name, el('span', { class: 'cm-promo-items' }, ' · ' + l.items.map((i) => shortName(i.name)).join(', '))),
        el('span', {}, '-' + fmt0(l.amount)))),
      missing.length
        ? el('div', { class: 'cm-promo-missing' },
          ic('info'), el('span', { title: 'Visiting each product page also fills these in. Everything stays in this browser.' }, `Promo details missing for ${missing.length} item${missing.length > 1 ? 's' : ''}.`),
          fetchBtn(missing))
        : gap === 0
          ? el('div', { class: 'cm-promo-ok' }, ic('check-circle'), "Matches Costco's discount")
          : el('div', { class: 'cm-promo-gap' }, ic('warning'), `${gap > 0 ? 'Unexplained' : 'Over-counted'} ${fmt(Math.abs(gap))}`));
    anchor.after(box);
  }

  let observer, t;
  function render() {
    observer && observer.disconnect();
    const items = linkAutoAdds(readItems());
    decorateCards(items);
    renderPanel(items);
    renderPromos(items);
    observer = observer || new MutationObserver(() => { clearTimeout(t); t = setTimeout(render, 150); });
    ['#order-items', '#order-summary-column'].forEach((s) => { const n = $(s); n && observer.observe(n, { childList: true, subtree: true, characterData: true }); });
  }

  function setOn(on) {
    document.documentElement.classList.toggle('cm-on', on);
    store.set(!on);
  }

  loadIcons();
  document.head.append(el('style', { id: 'cm-style' }, CSS));
  const restore = el('button', { type: 'button', id: 'cm-restore' }, 'Cleaned-up view');
  restore.addEventListener('click', () => setOn(true));
  document.body.append(restore);

  // Dev-only redline toggle: outlines every node in the cart, colored by nesting depth.
  // Turn on with localStorage.setItem('cm-dev', '1') in the cart tab's console.
  const DEV = (() => { try { return localStorage.getItem('cm-dev') === '1'; } catch { return false; } })();
  if (DEV) {
    const sel = (d) => '#cart-body' + ' > *'.repeat(d);
    const css = ['html.cm-redline #cart-body * { outline:1px solid hsl(0 0% 50% / .5) !important; outline-offset:-1px; }',
      ...Array.from({ length: 16 }, (_, i) => `html.cm-redline ${sel(i + 1)} { outline-color:hsl(${(i * 47) % 360} 80% 50% / .6) !important; }`)];
    document.head.append(el('style', { id: 'cm-redline-css' }, css.join('\n')));
    const key = 'cm-redline';
    const on = () => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
    const btn = el('button', { type: 'button', id: 'cm-redline-btn', title: 'Toggle redlines' }, ic('ruler'), 'Redlines');
    const apply = (v) => { document.documentElement.classList.toggle('cm-redline', v); btn.setAttribute('aria-pressed', String(v)); };
    btn.addEventListener('click', () => { const v = !on(); try { v ? localStorage.setItem(key, '1') : localStorage.removeItem(key); } catch {} apply(v); });
    document.body.append(btn);
    apply(on());
  }
  setOn(!store.get());
  render();
})();
