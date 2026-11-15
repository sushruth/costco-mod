// ==UserScript==
// @name         Costco, Cleaned Up
// @namespace    https://github.com/sushruth/costco-mod
// @version      0.10.1
// @description  Restyles costco.com in place: a compact header on every page, and a cart with compact item cards, an order review panel with promo end dates, delivery-day checks and a breakdown of order discounts. Everything stays in your browser.
// @match        https://www.costco.com/*
// @run-at       document-idle
// @resource     phCss  https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css
// @resource     phFont https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/Phosphor.woff2
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// @homepageURL  https://github.com/sushruth/costco-mod
// @supportURL   https://github.com/sushruth/costco-mod/issues
// @updateURL    https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js
// @downloadURL  https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js
// ==/UserScript==

(() => {
  // src/core/dom.ts
  var $ = (s, r = document) => r.querySelector(s);
  var $$ = (s, r = document) => [...r.querySelectorAll(s)];
  var text = (n) => n ? (n.textContent ?? "").replace(/\s+/g, " ").trim() : "";
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    n.dataset.cm = "";
    for (const [k, v] of Object.entries(attrs))
      k === "class" ? n.className = v : n.setAttribute(k, v);
    for (const k of kids.flat())
      if (k != null && k !== false && k !== "")
        n.append(typeof k === "object" ? k : String(k));
    return n;
  }
  var ic = (name, extra = "") => el("i", { class: `ph ph-${name} cm-ic ${extra}`, "aria-hidden": "true" });
  function addIcon(node, name, where = "prepend") {
    if (!node)
      return;
    if (!node.title)
      node.title = text(node);
    if (!$(":scope > .cm-ic", node))
      node[where](ic(name));
  }
  var addStyle = (id, css) => document.head.append(el("style", { id }, css));
  function loadIcons() {
    if (typeof GM_getResourceText === "function") {
      const css = GM_getResourceText("phCss").replace(/src:[\s\S]*?;/, `src: url("${GM_getResourceURL("phFont", false)}") format("woff2");`);
      addStyle("cm-ph", css);
    } else {
      document.head.append(el("link", { rel: "stylesheet", href: "https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css" }));
    }
  }
  async function copy(str) {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {}
    const ta = el("textarea", { style: "position:fixed;opacity:0" });
    ta.value = str;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }

  // src/core/format.ts
  var DAY = 86400000;
  var money = (s) => parseFloat(String(s).replace(/[^0-9.-]/g, "")) || 0;
  var fmt = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmt0 = (n) => "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  var shortDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  var longDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  function toDate(s) {
    const [m, d, y] = s.split("/").map(Number);
    return new Date(y < 100 ? 2000 + y : y, m - 1, d, 23, 59, 59);
  }
  function urgency(days) {
    if (days == null || days > 7)
      return null;
    if (days < 0)
      return { cls: "cm-urgent", label: "Promo ended" };
    if (days <= 1)
      return { cls: "cm-urgent", label: days === 0 ? "Ends today" : "Ends tomorrow" };
    return { cls: "cm-warn", label: `Ends in ${days} days` };
  }

  // src/core/items.ts
  var SAME_DAY = /required to ship on the same day/i;
  function readItems() {
    const dateMap = {};
    const raw = $('[name="calendarItemSelectedDate"]')?.value ?? "";
    for (const m of raw.matchAll(/scheduler_picker_(\d+)_\d+_(\w+)\|(\d{4}-\d{2}-\d{2})/g)) {
      if (!dateMap[m[1]] || dateMap[m[1]].mode === "LPU")
        dateMap[m[1]] = { mode: m[2], date: m[3] };
    }
    const today = new Date;
    today.setHours(0, 0, 0, 0);
    return $$("#order-items .order-item").map((card) => {
      const orderItemId = $("[data-orderitemid]", card)?.dataset.orderitemid ?? "";
      const itemNo = $("[data-orderitemnumber]", card)?.dataset.orderitemnumber ?? "";
      const link = $(".product-title a", card);
      const priceEl = $(".product-price .price", card);
      const promo = text($(".h8-style-guide-green", card));
      const save = money(promo.match(/\$([\d,.]+) savings/i)?.[1] ?? 0);
      const endM = promo.match(/through (\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
      let end = null, days = null;
      if (endM) {
        end = new Date(+endM[3] < 100 ? 2000 + +endM[3] : +endM[3], +endM[1] - 1, +endM[2]);
        days = Math.round((end.getTime() - today.getTime()) / DAY);
      }
      const dateInput = $("input.date-input", card);
      let deliv = null;
      if (dateMap[orderItemId])
        deliv = new Date(dateMap[orderItemId].date + "T00:00:00");
      else if (dateInput?.value && !isNaN(Date.parse(dateInput.value)))
        deliv = new Date(dateInput.value);
      const qtyEl = $('input[id^="quantity_"]', card);
      return {
        card,
        orderItemId,
        itemNo,
        name: text(link) || text($(".product-title", card)),
        href: link?.href ?? "",
        price: priceEl ? money(priceEl.firstChild?.textContent ?? priceEl.textContent) : 0,
        qty: qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1,
        save,
        end,
        days,
        deliv,
        shipsTogether: $$(".ltl-warning-text, .cart-informational.warning", card).some((n) => SAME_DAY.test(n.textContent ?? "")),
        email: /delivery via email/i.test(text($(".ship-type-and-cost", card))),
        autoadd: /autoadd/i.test($('[name="controllingAttributes"]', card)?.value ?? "")
      };
    });
  }

  // src/core/store.ts
  var kv = typeof GM_getValue === "function" ? { get: (k) => GM_getValue(k, null), set: (k, v) => GM_setValue(k, v) } : {
    get: (k) => {
      try {
        return JSON.parse(localStorage.getItem(k) ?? "null");
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    }
  };
  var flag = {
    get: (k) => {
      try {
        return localStorage.getItem(k) === "1";
      } catch {
        return false;
      }
    },
    set: (k, on) => {
      try {
        on ? localStorage.setItem(k, "1") : localStorage.removeItem(k);
      } catch {}
    }
  };

  // src/plugins/cards/index.ts
  function priceLine(it) {
    const c = it.card;
    const promoEl = $(".h8-style-guide-green", c);
    if (promoEl && (it.save || it.end))
      promoEl.classList.add("cm-hide");
    const u = urgency(it.days);
    const extras = [];
    if (it.save)
      extras.push(el("span", { class: "cm-save cm-extra" }, "Save ", el("b", {}, fmt0(it.save))));
    if (it.end && u?.cls === "cm-urgent")
      extras.push(el("span", { class: "cm-badge cm-extra" }, `${u.label} · ${shortDate(it.end)}`));
    else if (it.end)
      extras.push(el("span", { class: `cm-when cm-extra ${u ? u.cls : ""}` }, ic("timer"), u ? `${u.label} · ${shortDate(it.end)}` : `Ends ${shortDate(it.end)}`));
    if (it.email)
      extras.push(el("span", { class: "cm-when cm-extra" }, ic("envelope-simple"), "Delivered by email"));
    const priceRow = $(".item-description-prices > .price", c);
    if (priceRow)
      priceRow.append(...extras);
    else
      $(".product-title", c)?.after(el("div", { class: "cm-extra" }, ...extras));
  }
  function actions(c) {
    addIcon($(".remove-link button", c), "trash");
    const wl = $$(".wish-list button", c);
    addIcon(wl[0], "list-plus");
    addIcon(wl[1], "bookmark-simple");
    if (wl[1] && !wl[1].getAttribute("aria-label"))
      wl[1].setAttribute("aria-label", "Save for Later");
    const stepRow = $(".quantity-selector-v2", c)?.parentElement, wlBox = $(".wish-list", c);
    if (stepRow && wlBox && wlBox.parentElement !== stepRow) {
      wlBox.parentElement?.classList.add("cm-hide");
      stepRow.append(wlBox);
    }
    addIcon($('.quantity-selector-v2 button[id^="sub-"]', c), "minus");
    addIcon($('.quantity-selector-v2 button[id^="add-"]', c), "plus");
    $$(".a11y-tooltip", c).forEach((b) => addIcon(b, "info"));
  }
  function decorate(it) {
    const c = it.card;
    const row = $(":scope > .row", c), priceBox = $(".item-description-prices", c)?.parentElement;
    if (row && priceBox && priceBox.parentElement !== row) {
      priceBox.classList.add("cm-price-slot");
      row.append(priceBox);
    }
    c.classList.toggle("cm-qty1", it.qty === 1);
    c.classList.toggle("cm-email", it.email);
    $$('.ltl-container, [id^="item_level_message_"]', c).forEach((n) => {
      if (SAME_DAY.test(n.textContent ?? ""))
        n.classList.add("cm-hide");
    });
    $$(".shipping-cost", c).forEach((s) => s.classList.toggle("cm-hide", /included/i.test(s.textContent ?? "")));
    priceLine(it);
    actions(c);
  }
  var cards = {
    id: "cards",
    name: "Compact item cards",
    render: (ctx) => ctx.items.forEach(decorate)
  };

  // src/plugins/delivery/delivery.module.css
  var delivery_module_default = {
    mode: "mode_ZVEnOQ",
    modeBtn: "modeBtn_ZVEnOQ",
    "cm-ic": "cm-ic_ZVEnOQ",
    chip: "chip_ZVEnOQ",
    "date-input": "date-input_ZVEnOQ",
    "cm-has-mode": "cm-has-mode_ZVEnOQ"
  };

  // src/plugins/delivery/index.ts
  var label = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  function modeToggle(opts, ctx) {
    const radios = $$('input.shipModeId[type="radio"]', opts);
    if (radios.length < 2)
      return;
    const block = (r) => r.closest(".individualShipBlock, .warehouse_pickup") ?? r.parentElement;
    const name = (r) => {
      const l = opts.querySelector(`label[for="${r.id}"]`) ?? block(r);
      return (text($(".ship-type-and-cost", l)) || text(l)).split(/[:(]/)[0].trim() || "Option";
    };
    const icon = (r, n) => /pick-?up|warehouse/i.test(r.id + n) ? "storefront" : /mail/i.test(n) ? "envelope-simple" : "truck";
    let tog = $(`:scope > .${delivery_module_default.mode}`, opts);
    if (!tog || tog.children.length !== radios.length) {
      tog?.remove();
      tog = el("div", { class: delivery_module_default.mode, role: "group", "aria-label": "Delivery options" }, ...radios.map((r) => {
        const n = name(r);
        const b = el("button", { type: "button", class: delivery_module_default.modeBtn, title: n }, ic(icon(r, n)), n);
        b.addEventListener("click", () => {
          if (!r.checked)
            r.click();
          ctx.render();
        });
        return b;
      }));
      opts.prepend(tog);
    }
    opts.classList.add("cm-has-mode");
    radios.forEach((r, i) => {
      block(r).classList.add("cm-opt");
      block(r).classList.toggle("cm-opt-on", r.checked);
      tog.children[i].setAttribute("aria-pressed", String(r.checked));
    });
  }
  function dateChips(c, ctx) {
    $$(".cart-calendar-box input.date-input", c).forEach((inp) => {
      const d = new Date(inp.value);
      const txt = isNaN(d.getTime()) ? inp.value : label(d);
      const chip = $(`:scope > .${delivery_module_default.chip}`, inp.parentElement);
      if (chip)
        chip.lastChild.textContent = txt;
      else {
        inp.after(el("span", { class: delivery_module_default.chip, "aria-hidden": "true" }, ic("calendar-blank"), el("span", {}, txt)));
        inp.addEventListener("change", () => ctx.render());
      }
    });
  }
  function decorate2(it, ctx) {
    const c = it.card;
    $$(".ship-type-and-cost", c).forEach((t) => addIcon(t, /room of choice|set up|delivery and/i.test(t.textContent ?? "") ? "truck" : /email/i.test(t.textContent ?? "") ? "envelope-simple" : "package"));
    $$(".cart-delivery-details-link > a, .cart-delivery-details-link > button", c).forEach((b) => {
      if (!b.getAttribute("aria-label"))
        b.setAttribute("aria-label", text(b));
      addIcon(b, "info");
    });
    const infoLink = $(".cart-delivery-details-link", c), shipType = $(".delivery-options .ship-type-and-cost", c);
    if (shipType && !shipType.dataset.cmMode) {
      shipType.dataset.cmMode = shipType.title = text(shipType).replace(/:.*$/, "").trim();
      shipType.setAttribute("aria-label", shipType.title);
    }
    const home = shipType && (shipType.closest("label.selection-item:has(.cart-calendar-box)") ?? shipType);
    if (infoLink && home && infoLink.parentElement !== home)
      home.append(infoLink);
    const edd = $(".estimated-delivery-date-div", c);
    if (edd && it.deliv) {
      const shown = Date.parse(text(edd).replace(/^Earliest Delivery\s*/i, ""));
      edd.classList.toggle("cm-hide", !isNaN(shown) && new Date(shown).toDateString() === it.deliv.toDateString());
    }
    const opts = $(".delivery-options", c);
    if (opts)
      modeToggle(opts, ctx);
    dateChips(c, ctx);
  }
  var delivery = {
    id: "delivery",
    name: "Delivery date chips and mode toggle",
    render: (ctx) => ctx.items.forEach((it) => decorate2(it, ctx))
  };

  // src/plugins/footer/index.ts
  var ICONS = [["facebook", "facebook-logo"], ["pinterest", "pinterest-logo"], ["instagram", "instagram-logo"], ["app", "device-mobile"]];
  function icons() {
    const tools = $("#footer-widget .footer-input-boxes");
    if (!tools)
      return;
    const swap = (host, name) => {
      if (host && !$(":scope > .cm-ic", host)) {
        host.classList.add("cm-swapped");
        host.prepend(ic(name));
      }
    };
    const help = $(".get-help a", tools);
    if (help && !$(":scope > .cm-ic", help))
      help.prepend(ic("question"));
    swap($("#footer-find-warehouse-block .input-group-btn :is(button, .btn)", tools), "magnifying-glass");
    for (const img of $$(".social-icons img", tools)) {
      const name = ICONS.find(([k]) => img.alt.toLowerCase().includes(k))?.[1];
      if (name)
        swap(img.closest("a"), name);
      if (name && !img.closest("a")?.getAttribute("aria-label"))
        img.closest("a")?.setAttribute("aria-label", img.alt);
    }
  }
  var footer = {
    id: "footer",
    name: "Compact footer",
    setup: icons
  };

  // src/plugins/header/header.module.css
  var header_module_default = {
    loc: "loc_IDJ-aA",
    "MuiTypography-t7": "MuiTypography-t7_IDJ-aA",
    "MuiTypography-root": "MuiTypography-root_IDJ-aA",
    navEnd: "navEnd_IDJ-aA",
    "banner-list-actions": "banner-list-actions_IDJ-aA"
  };

  // src/plugins/header/index.ts
  var navEnd = el("div", { class: header_module_default.navEnd });
  function fitNav() {
    const items = $$("#navigation-widget nav.menu > .nav-item");
    items.forEach((n) => delete n.dataset.cmOverflow);
    const menu = navEnd.parentElement;
    for (let i = items.length - 1;i >= 0 && menu && menu.scrollWidth > menu.clientWidth; i--)
      items[i].dataset.cmOverflow = "";
  }
  var t = 0;
  var refit = () => {
    clearTimeout(t);
    t = window.setTimeout(fitNav, 50);
  };
  var NAV = "cm-nav";
  var key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  function learnNav() {
    const ul = $("header nav[data-testid=LinkList] > ul:has([data-testid=ShopMenu])");
    if (!ul)
      return false;
    const list = $$(":scope > li", ul).filter((li) => !$("[data-testid=ShopMenu]", li)).map((li) => {
      const a = $(":scope > :is(a, button), :scope > div > :is(a, button)", li);
      return { label: text(a), href: a?.href ?? "" };
    }).filter((n) => n.label);
    if (list.length)
      kv.set(NAV, list);
    return list.length > 0;
  }
  var original = [];
  var added = [];
  function order(on) {
    const shop = $("#navigation-dropdown");
    if (!on) {
      added.splice(0).forEach((n) => n.remove());
      original.reduce((prev2, n) => (prev2?.after(n), n), shop);
      return;
    }
    const saved = kv.get(NAV);
    if (!shop || !saved?.length)
      return;
    original = $$("#navigation-widget nav.menu > .nav-item:not(#navigation-dropdown)");
    const byKey = new Map(original.map((n) => [key(text($("a", n))), n]));
    let prev = shop;
    for (const s of saved) {
      let n = byKey.get(key(s.label));
      if (!n) {
        n = el("div", { class: "nav-item" }, el("a", { href: s.href, class: "nav-flyout" }, s.label));
        added.push(n);
      }
      prev.after(n);
      prev = n;
    }
  }
  function place(on) {
    const hdr = $("#header-widget"), nav = $("#navigation-widget"), menu = $("#navigation-widget nav.menu");
    const loc = $("#deliveryLocation"), lists = $("#banner-list-actions");
    if (!hdr || !nav || !menu)
      return;
    if (on) {
      hdr.before(nav);
      menu.append(navEnd);
      if (loc) {
        loc.classList.add(header_module_default.loc);
        ($("#cart-title") ?? navEnd).append(loc);
      }
      if (lists) {
        navEnd.append(lists);
        $$("a", lists).forEach((a) => {
          a.title ||= text(a);
        });
      }
      const cart = $("#cart-d");
      if (cart && !$(":scope > .cm-ic", cart))
        cart.prepend(ic("shopping-cart-simple"));
      order(true);
      fitNav();
    } else {
      hdr.after(nav);
      if (loc) {
        loc.classList.remove(header_module_default.loc);
        $("#left-bar")?.append(loc);
      }
      if (lists)
        $("#order-nav")?.append(lists);
      navEnd.remove();
      $("#cart-d > .cm-ic")?.remove();
      order(false);
    }
  }
  function holdShopMenu() {
    const wide = matchMedia("(width > 1024px)");
    for (const type of ["mouseover", "mouseout", "pointerover", "pointerout"]) {
      addEventListener(type, (e) => {
        if (!wide.matches)
          return;
        const menu = $("header [data-testid=ShopMenu]:has(> button[aria-expanded=true])");
        if (!menu)
          return;
        const to = e.relatedTarget;
        if (menu.contains(e.target) !== (!!to && menu.contains(to)))
          e.stopPropagation();
      }, true);
    }
  }
  function hoursPopup() {
    addEventListener("pointerover", (e) => {
      const link = e.target.closest?.('[data-testid=Link_wishlist], [data-testid="Buy Again"]');
      if (link instanceof HTMLElement && !link.title)
        link.title = text(link);
      const box = e.target.closest?.('[data-testid=WarehouseSelectorUI], #deliveryLocation [class*="MuiBox-root"]:has(> .MuiTypography-t7)');
      if (!(box instanceof HTMLElement))
        return;
      const lines = $$("*", box).filter((n) => !n.children.length && /hours start/i.test(n.textContent ?? ""));
      if (lines.length)
        box.dataset.cmHours = lines.map((n) => text(n).replace(/\s*hours start at\s*/i, " · ")).join(`
`);
    }, true);
  }
  var header = {
    id: "header",
    name: "Compact site header",
    setup: () => {
      new ResizeObserver(refit).observe(navEnd);
      addEventListener("resize", refit);
      holdShopMenu();
      hoursPopup();
      if (!$("#header-widget") && !learnNav())
        addEventListener("pointerover", learnNav, { once: true });
    },
    toggle: place
  };

  // src/plugins/pairing/index.ts
  function link(items) {
    const out = [];
    for (const it of items)
      if (!it.parent) {
        out.push(it);
        const kid = it.autoadd && items.find((k) => +k.orderItemId === +it.orderItemId + 1);
        if (kid) {
          kid.parent = it;
          out.push(kid);
        }
      }
    out.forEach((it, i) => {
      it.card.style.order = String(i);
      it.card.classList.toggle("cm-child", !!it.parent);
      it.card.classList.toggle("cm-parent", out[i + 1]?.parent === it);
      if (it.parent)
        $(".item-thumbnail + .col-xs-9", it.card)?.prepend(el("div", { class: "cm-child-tag cm-extra" }, ic("link-simple"), "Added with the item above"));
    });
    return out;
  }
  var pairing = {
    id: "pairing",
    name: "Protection plan under its item",
    render: (ctx) => {
      ctx.items = link(ctx.items);
    }
  };

  // src/core/thumbs.module.css
  var thumbs_module_default = {
    row: "row_yTBjSw",
    thumb: "thumb_yTBjSw"
  };

  // src/core/thumbs.ts
  function jumpTo(card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("cm-flash");
    setTimeout(() => card.classList.remove("cm-flash"), 1200);
  }
  function thumbs(items) {
    return el("span", { class: thumbs_module_default.row }, items.map((i) => {
      const src = $(".item-thumbnail img", i.card)?.src;
      const b = el("button", { type: "button", class: thumbs_module_default.thumb, title: i.name, "aria-label": i.name }, src ? el("img", { src, alt: "" }) : i.name.slice(0, 1));
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        jumpTo(i.card);
      });
      return b;
    }));
  }

  // src/plugins/panel/panel.module.css
  var panel_module_default = {
    review: "review_ihOyiA",
    head: "head_ihOyiA",
    strip: "strip_ihOyiA",
    "cm-ic": "cm-ic_ihOyiA",
    warn: "warn_ihOyiA",
    ok: "ok_ihOyiA",
    stripRow: "stripRow_ihOyiA",
    rows: "rows_ihOyiA",
    row: "row_ihOyiA",
    name: "name_ihOyiA",
    price: "price_ihOyiA",
    meta: "meta_ihOyiA",
    "cm-urgent": "cm-urgent_ihOyiA",
    "cm-warn": "cm-warn_ihOyiA",
    rowSave: "rowSave_ihOyiA",
    foot: "foot_ihOyiA",
    pre: "pre_ihOyiA",
    open: "open_ihOyiA",
    savings: "savings_ihOyiA",
    bar: "bar_ihOyiA",
    "cm-on": "cm-on_ihOyiA",
    "cm-p-panel": "cm-p-panel_ihOyiA",
    barLabel: "barLabel_ihOyiA",
    barTotal: "barTotal_ihOyiA",
    barAlert: "barAlert_ihOyiA",
    barGo: "barGo_ihOyiA"
  };

  // src/plugins/panel/bar.ts
  function renderBar(items, total, review) {
    let bar = $(`.${panel_module_default.bar}`);
    if (!bar) {
      bar = el("div", { class: panel_module_default.bar, role: "region", "aria-label": "Checkout bar" });
      document.body.append(bar);
    }
    const real = $("#shopCartCheckoutSubmitButton");
    const go = el("button", { type: "button", class: panel_module_default.barGo }, "Checkout");
    go.disabled = !real || real.disabled;
    go.addEventListener("click", () => real?.click());
    const urgent = items.filter((i) => i.days != null && i.days <= 1).length;
    const alert = urgent ? el("button", { type: "button", class: panel_module_default.barAlert }, ic("timer"), ` ${urgent} promo${urgent > 1 ? "s" : ""} ending`) : null;
    alert?.addEventListener("click", () => review.scrollIntoView({ behavior: "smooth" }));
    bar.replaceChildren(el("div", {}, el("div", { class: panel_module_default.barLabel }, "Est. total"), el("div", { class: panel_module_default.barTotal }, total), alert), go);
  }

  // src/plugins/panel/strip.ts
  function dateGroups(items) {
    const groups = new Map;
    for (const i of items)
      if (i.deliv) {
        const k = i.deliv.toDateString();
        if (!groups.has(k))
          groups.set(k, { date: i.deliv, items: [] });
        groups.get(k).items.push(i);
      }
    return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  }
  function deliveryStrip(groups) {
    if (!groups.length)
      return null;
    if (groups.length === 1)
      return el("div", { class: `${panel_module_default.strip} ${panel_module_default.ok}` }, ic("truck"), `All deliveries arrive ${longDate(groups[0].date)}`);
    return el("div", { class: `${panel_module_default.strip} ${panel_module_default.warn}` }, ic("warning"), el("div", {}, el("div", {}, `${groups.length} separate delivery days`), ...[...groups].sort((x, y) => x.date.getTime() - y.date.getTime()).map((g) => el("div", { class: panel_module_default.stripRow }, el("b", {}, longDate(g.date)), thumbs(g.items)))));
  }

  // src/plugins/panel/summary.ts
  var readTotals = () => ({
    subtotal: text($("#orderSubtotal")),
    discount: text($("#totalDiscountOutput")),
    shipping: text($('[automation-id="orderEstimatedShipping"]')) || text($("#order-estimated-shipping")),
    total: text($("#order-estimated-total"))
  });
  function summaryText(items, t2) {
    return [
      ...items.map((i) => [
        i.name,
        fmt(i.price * i.qty) + (i.qty > 1 ? ` (x${i.qty})` : ""),
        i.save && `saves ${fmt0(i.save)}`,
        i.end && `promo ends ${shortDate(i.end)}`,
        i.deliv && `delivery ${shortDate(i.deliv)}`,
        i.href
      ].filter(Boolean).join(" | ")),
      "",
      `Subtotal: ${t2.subtotal}`,
      t2.discount && `Discount: ${t2.discount}`,
      `Shipping: ${t2.shipping}`,
      `Estimated total (pre-tax): ${t2.total}`
    ].join(`
`);
  }

  // src/plugins/panel/index.ts
  function row(i, offDay) {
    const u = urgency(i.days);
    const meta = [];
    if (i.end)
      meta.push(el("span", { class: u ? u.cls : "", "aria-label": `Promo ends ${shortDate(i.end)}` }, ic("timer"), shortDate(i.end) + (u?.cls === "cm-urgent" ? i.days < 0 ? " (ended)" : i.days === 0 ? " (today)" : " (tomorrow)" : "")));
    if (i.deliv && offDay)
      meta.push(el("span", { class: "cm-warn", "aria-label": `Delivery ${shortDate(i.deliv)}` }, ic("truck"), shortDate(i.deliv)));
    if (i.qty > 1)
      meta.push(el("span", {}, `Qty ${i.qty}`));
    const li = el("li", { class: panel_module_default.row, tabindex: "0" }, el("div", { class: panel_module_default.name }, i.href ? el("a", { href: i.href, title: i.name }, i.name) : i.name), el("div", { class: panel_module_default.price }, fmt(i.price * i.qty)), el("div", { class: panel_module_default.meta }, meta), i.save ? el("div", { class: `cm-save ${panel_module_default.rowSave}` }, el("b", {}, "-" + fmt0(i.save * i.qty))) : el("div"));
    const jump = (e) => {
      if (e.target.closest("a") || e instanceof KeyboardEvent && e.key !== "Enter")
        return;
      jumpTo(i.card);
    };
    li.addEventListener("click", jump);
    li.addEventListener("keydown", jump);
    return li;
  }
  function footer2(items, ctx) {
    const totals = readTotals();
    const pre = el("pre", { class: panel_module_default.pre }, summaryText(items, totals));
    const copyBtn = el("button", { type: "button", class: "cm-btn" }, ic("copy"), "Copy summary");
    copyBtn.addEventListener("click", async () => {
      const ok = await copy(summaryText(items, totals));
      copyBtn.replaceChildren(ic(ok ? "check" : "warning"), ok ? "Copied" : "Copy failed");
      setTimeout(() => copyBtn.replaceChildren(ic("copy"), "Copy summary"), 2000);
    });
    const showBtn = el("button", { type: "button", class: "cm-btn cm-icon-btn", "aria-label": "Preview summary text", title: "Preview summary text" }, ic("eye"));
    showBtn.addEventListener("click", () => pre.classList.toggle(panel_module_default.open));
    const offBtn = el("button", { type: "button", class: "cm-link" }, "Original view");
    offBtn.addEventListener("click", () => ctx.setOn(false));
    return [el("div", { class: panel_module_default.foot }, copyBtn, showBtn, offBtn), pre];
  }
  function render(ctx) {
    const { items } = ctx;
    const count = items.reduce((n, i) => n + i.qty, 0);
    const itemSavings = items.reduce((n, i) => n + i.save * i.qty, 0);
    const groups = dateGroups(items);
    const mainDate = groups[0]?.date.toDateString();
    const review = el("section", { id: "cm-review", class: panel_module_default.review, "aria-label": "Order review" }, el("div", { class: panel_module_default.head }, "Order review ", el("span", {}, `· ${count} item${count === 1 ? "" : "s"}`)), deliveryStrip(groups), el("ul", { class: panel_module_default.rows }, items.map((i) => row(i, groups.length > 1 && i.deliv?.toDateString() !== mainDate))), ...footer2(items, ctx), itemSavings ? el("div", { class: panel_module_default.savings }, el("span", {}, "Instant savings (in prices)"), el("span", {}, "-" + fmt(itemSavings))) : null);
    const old = $("#cm-review");
    old ? old.replaceWith(review) : $("#order-summary-column")?.before(review);
    renderBar(items, readTotals().total, review);
  }
  var panel = {
    id: "panel",
    name: "Order review panel",
    render
  };

  // src/plugins/promos/cache.ts
  var promoCache = {
    get(itemNo) {
      const e = kv.get("cm-promo:" + itemNo);
      return e && Date.now() < e.expires ? e : null;
    },
    set(itemNo, promos) {
      const ends = promos.map((p) => p.until ? toDate(p.until).getTime() : 0).filter(Boolean);
      kv.set("cm-promo:" + itemNo, { at: Date.now(), expires: Math.min(Date.now() + DAY, ...ends), promos });
    }
  };

  // src/plugins/promos/parse.ts
  var num = (x) => +x.replace(/,/g, "");
  var through = (s) => s.match(/through (\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1] ?? null;
  function parsePromos(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
    const t2 = (doc.body?.textContent ?? "").replace(/\s+/g, " ");
    const runs = [];
    const collect = (re, type) => {
      let run = null;
      for (const m of t2.matchAll(re)) {
        const i = m.index;
        if (run && i - run.end < 12) {
          run.tiers.push([num(m[1]), num(m[2])]);
          run.end = i + m[0].length;
          continue;
        }
        if (run)
          runs.push(run);
        run = { type, start: i, end: i + m[0].length, tiers: [[num(m[1]), num(m[2])]] };
      }
      if (run)
        runs.push(run);
    };
    collect(/(?:Buy|Purchase) (\d+)(?:\+| or more)? (?:qualifying [A-Za-z&' ]+?|Items?),? save \$([\d,]+)/gi, "count");
    collect(/Spend \$([\d,]+) Save \$([\d,]+)/g, "spend");
    const out = [];
    for (const r of runs.filter((x) => x.tiers.length > 1)) {
      const before = t2.slice(Math.max(0, r.start - 220), r.start);
      const brand = before.match(/qualifying ([A-Z][A-Za-z]+) (?:Home )?(?:Appliances|Products)/);
      const name = r.type === "spend" ? "Appliance Spend & Save" : brand ? `${brand[1]} buy 2+` : /Costco Direct/.test(before) ? "Costco Direct buy 2+" : "Multi-buy";
      const key2 = name + ":" + r.tiers.map((x) => x.join("-")).join(",");
      if (!out.some((o) => o.key === key2))
        out.push({ key: key2, name, type: r.type, tiers: r.tiers, until: through(t2.slice(r.end, r.end + 300)) });
    }
    const b = t2.match(/\$([\d,]+) BUNDLE SAVINGS WITH PURCHASE OF (.+?) AND (\w+)/i);
    if (b) {
      const partner = b[3].toLowerCase();
      out.push({
        key: "bundle:" + partner,
        name: `Bundle with ${partner[0].toUpperCase() + partner.slice(1)} plan`,
        type: "bundle",
        amount: num(b[1]),
        partner,
        until: through(t2.slice(b.index, b.index + 600))
      });
    }
    return { itemNo: t2.match(/Item (\d{5,8})\b/)?.[1] ?? null, promos: out };
  }

  // src/plugins/promos/promos.module.css
  var promos_module_default = {
    box: "box_X0PRZQ",
    line: "line_X0PRZQ",
    name: "name_X0PRZQ",
    note: "note_X0PRZQ",
    gap: "gap_X0PRZQ",
    fetch: "fetch_X0PRZQ"
  };

  // src/plugins/promos/index.ts
  function promoLines(items) {
    const groups = new Map;
    for (const it of items)
      for (const p of promoCache.get(it.itemNo)?.promos ?? []) {
        const g = groups.get(p.key) ?? { p, items: [] };
        g.items.push(it);
        groups.set(p.key, g);
      }
    const lines = [];
    for (const { p, items: its } of groups.values()) {
      let amount = 0;
      if (p.type === "bundle")
        amount = items.some((i) => !its.includes(i) && i.name.toLowerCase().includes(p.partner)) ? p.amount : 0;
      else {
        const have = p.type === "spend" ? its.reduce((n, i) => n + i.price * i.qty, 0) : its.reduce((n, i) => n + i.qty, 0);
        amount = p.tiers.filter(([need]) => have >= need).reduce((best, [, save]) => Math.max(best, save), 0);
      }
      if (amount)
        lines.push({ name: p.name, amount, items: its });
    }
    return lines.sort((a, b) => b.amount - a.amount);
  }
  var fetching = false;
  var last = null;
  async function fetchPromos(itemNos) {
    fetching = true;
    if (last)
      render2(last);
    for (const n of itemNos) {
      try {
        const r = await fetch(`${location.origin}/p/-/${n}`, { credentials: "same-origin" });
        if (r.ok)
          promoCache.set(n, parsePromos(await r.text()).promos);
      } catch {}
    }
    fetching = false;
    last?.render();
  }
  function render2(ctx) {
    last = ctx;
    $(`.${promos_module_default.box}`)?.remove();
    const anchor = $("#totalDiscountOutput");
    const discount = Math.abs(money(anchor && (anchor.getAttribute("discount") || anchor.textContent)));
    if (!anchor || !discount)
      return;
    const missing = ctx.items.filter((i) => i.itemNo && !promoCache.get(i.itemNo)).map((i) => i.itemNo);
    const lines = promoLines(ctx.items);
    const gap = Math.round((discount - lines.reduce((n, l) => n + l.amount, 0)) * 100) / 100;
    const fetchBtn = el("button", { type: "button", class: `cm-link ${promos_module_default.fetch}` }, fetching ? "Fetching…" : "Fetch now");
    fetchBtn.toggleAttribute("disabled", fetching);
    fetchBtn.addEventListener("click", () => fetchPromos(missing));
    anchor.after(el("div", { class: promos_module_default.box }, ...lines.map((l) => el("div", { class: promos_module_default.line }, el("span", { class: promos_module_default.name }, l.name, thumbs(l.items)), el("span", {}, "-" + fmt0(l.amount)))), missing.length ? el("div", { class: promos_module_default.note }, ic("info"), el("span", { title: "Visiting each product page also fills these in. Everything stays in this browser." }, `Promo details missing for ${missing.length} item${missing.length > 1 ? "s" : ""}.`), fetchBtn) : gap === 0 ? el("div", { class: promos_module_default.note }, ic("check-circle"), "Matches Costco's discount") : el("div", { class: `${promos_module_default.note} ${promos_module_default.gap}` }, ic("warning"), `${gap > 0 ? "Unexplained" : "Over-counted"} ${fmt(Math.abs(gap))}`)));
  }
  var promos = {
    id: "promos",
    name: "Order discount breakdown",
    product: () => {
      const r = parsePromos(document.documentElement.outerHTML);
      if (r.itemNo)
        promoCache.set(r.itemNo, r.promos);
    },
    render: render2
  };

  // src/plugins/redlines/index.ts
  var redlines = {
    id: "redlines",
    name: "Redlines (dev)",
    dev: true,
    live: true
  };

  // src/plugins/services/services.module.css
  var services_module_default = {
    count: "count_HBUsug",
    toggle: "toggle_HBUsug",
    "cm-ic": "cm-ic_HBUsug"
  };

  // src/plugins/services/index.ts
  function decorate3(svc) {
    addIcon($(".delivery-services-notification .add-cart-list-row", svc), "info");
    $$("ul.edd-delivery-services img.parts-services-tick", svc).forEach((img) => addIcon(img.parentElement, img.alt === "included" ? "check" : "info"));
    const h3 = $(".delivery-services-main h3", svc);
    if (!h3 || $(`.${services_module_default.toggle}`, h3))
      return;
    addIcon($("label", h3), "wrench");
    const lists = $$("ul.edd-delivery-services", svc);
    const included = lists[0] ? $$("li", lists[0]).length : 0;
    const notes = lists[1] ? $$("li", lists[1]).length : 0;
    svc.classList.add("cm-collapsed");
    const btn = el("button", { type: "button", class: services_module_default.toggle, "aria-expanded": "false" }, "Details", ic("caret-down"));
    btn.addEventListener("click", () => {
      const open = !svc.classList.toggle("cm-collapsed");
      btn.replaceChildren(open ? "Hide" : "Details", ic(open ? "caret-up" : "caret-down"));
      btn.setAttribute("aria-expanded", String(open));
    });
    h3.append(el("span", { class: services_module_default.count }, `${included} included · ${notes} notes`), btn);
  }
  var services = {
    id: "services",
    name: "Services as a collapsible footer",
    render: () => $$(".cart-part-services:not(.hidden)").forEach(decorate3)
  };

  // src/plugins/settings/settings.module.css
  var settings_module_default = {
    wrap: "wrap_y2ChTw",
    gear: "gear_y2ChTw",
    "cm-ic": "cm-ic_y2ChTw",
    menu: "menu_y2ChTw",
    sub: "sub_y2ChTw",
    floating: "floating_y2ChTw"
  };

  // src/plugins/settings/index.ts
  var on = () => document.documentElement.classList.contains("cm-on");
  function menu(ctx) {
    const box = el("div", { class: settings_module_default.menu, hidden: "", role: "dialog", "aria-label": "Costco Mod settings" }, el("h3", {}, "Costco Mod"));
    const row2 = (label2, checked, set, sub = false) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = checked;
      cb.addEventListener("change", () => set(cb.checked));
      box.append(el("label", { class: sub ? settings_module_default.sub : "" }, cb, label2));
      return cb;
    };
    const view = row2("Cleaned-up view", on(), ctx.setOn);
    ctx.plugins.filter((p) => !p.locked).forEach((p) => row2(p.name, ctx.isEnabled(p), (v) => ctx.setEnabled(p, v), true));
    const gear = el("button", { type: "button", class: `${settings_module_default.gear} cm-gear`, title: "Costco Mod settings", "aria-label": "Costco Mod settings", "aria-expanded": "false" }, ic("gear-six"));
    const show = (v) => {
      view.checked = on();
      box.hidden = !v;
      gear.setAttribute("aria-expanded", String(v));
    };
    gear.addEventListener("click", () => show(!!box.hidden));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target))
        show(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape")
        show(false);
    });
    const wrap = el("li", { class: `list-group-item ${settings_module_default.wrap}` }, gear, box);
    return wrap;
  }
  var settings = {
    id: "settings",
    name: "Settings",
    locked: true,
    setup: (ctx) => {
      const wrap = menu(ctx);
      const acct = $("#header-widget .account-cart ul.t5-header-font");
      if (acct)
        acct.append(wrap);
      else
        document.body.append(el("ul", { class: settings_module_default.floating }, wrap));
      if (typeof GM_registerMenuCommand === "function")
        GM_registerMenuCommand("Toggle cleaned-up view", () => ctx.setOn(!on()));
    }
  };

  // src/main.ts
  var PLUGINS = [pairing, cards, delivery, services, panel, promos, header, footer, settings, redlines];
  var KEY = "cm-plugins";
  var saved = kv.get(KEY) ?? {};
  var listed = PLUGINS.filter((p) => !p.dev || false);
  var wanted = (p) => p.locked || (saved[p.id] ?? !p.dev);
  var active = listed.filter(wanted);
  var isProduct = /^\/p\/|\.product\.\d+\.html/.test(location.pathname);
  var isCart = !!$("#order-items") && !!$("#order-summary-column");
  var here = isCart ? active : active.filter((p) => [header, settings, redlines].includes(p));
  function setOn(on2) {
    document.documentElement.classList.toggle("cm-on", on2);
    flag.set("cm-off", !on2);
    for (const p of here)
      p.toggle?.(on2);
  }
  var observer;
  var timer = 0;
  function render3() {
    observer?.disconnect();
    $$(".cm-extra").forEach((n) => n.remove());
    const ctx = { ...base, items: readItems() };
    for (const p of active)
      p.render?.(ctx);
    observer ??= new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(render3, 150);
    });
    for (const s of ["#order-items", "#order-summary-column"]) {
      const n = $(s);
      if (n)
        observer.observe(n, { childList: true, subtree: true, characterData: true });
    }
  }
  var base = {
    render: render3,
    setOn,
    plugins: listed,
    isEnabled: (p) => p.live ? document.documentElement.classList.contains(`cm-p-${p.id}`) : active.includes(p),
    setEnabled: (p, on2) => {
      kv.set(KEY, { ...saved, [p.id]: on2 });
      saved[p.id] = on2;
      if (p.live)
        document.documentElement.classList.toggle(`cm-p-${p.id}`, on2);
      else
        location.reload();
    }
  };
  if (isProduct)
    for (const p of active)
      p.product?.();
  if (here.length) {
    loadIcons();
    addStyle("cm-style", "/* src/core/base.css */\nhtml.cm-on {\n  --cm-blue: #005dab;\n  --cm-blue-dark: #004b87;\n  --cm-blue-tint: #eff7fb;\n  --cm-red: #e31837;\n  --cm-green: green;\n  --cm-amber: #8a6d3b;\n  --cm-amber-tint: #fff8e1;\n  --cm-ink: #333;\n  --cm-ink-2: #4d4d4d;\n  --cm-ink-3: #5f5f5f;\n  --cm-line: #e5e5e5;\n  --cm-line-strong: #ccc;\n  --cm-group: var(--cm-blue);\n  --cm-surface-2: #f4f5f6;\n  --cm-page: #f5f5f5;\n  --cm-card: 0 0 5px #0000004d;\n}\n\nhtml.cm-on #cart-body {\n  background: var(--cm-page);\n  padding-bottom: 16px;\n}\n\nhtml.cm-on :-webkit-any(#order-items, #order-summary-column, #order-summary-body) {\n  margin-bottom: 0 !important;\n}\n\nhtml.cm-on :-moz-any(#order-items, #order-summary-column, #order-summary-body) {\n  margin-bottom: 0 !important;\n}\n\nhtml.cm-on :is(#order-items, #order-summary-column, #order-summary-body) {\n  margin-bottom: 0 !important;\n}\n\nhtml.cm-on #cart > .row > [class*=\"col-\"]:empty {\n  display: none;\n}\n\nhtml.cm-on #cart {\n  padding-top: 16px !important;\n}\n\nhtml.cm-on #cart.fixed-container {\n  max-width: 1440px !important;\n  padding: 16px 39px 24px 24px !important;\n}\n\nhtml.cm-on #cart-title {\n  display: flex;\n  float: none;\n  color: var(--cm-ink-2);\n  align-items:  center;\n  gap: 8px;\n  width: 100%;\n  margin: 0 0 12px !important;\n  padding: 0 0 0 15px !important;\n}\n\nhtml.cm-on #cart-title h1 {\n  margin: 0 !important;\n  font-size: 20px !important;\n  line-height: 28px !important;\n}\n\nhtml.cm-on #cart-title h2 {\n  margin: 0 !important;\n  font-size: 20px !important;\n  line-height: 28px !important;\n}\n\nhtml.cm-on #cart-title h2 {\n  color: var(--cm-ink-3);\n  font-size: 14px !important;\n}\n\nhtml.cm-on #cart-title #deliveryLocation {\n  margin-left: auto;\n}\n\nhtml.cm-on #cart-region:not(:has(.alert-notification:not(.hidden))) {\n  display: none;\n}\n\nhtml.cm-on .cm-hide, html.cm-on #cart-body .cm-hide {\n  display: none !important;\n}\n\nhtml:not(.cm-on) :-webkit-any(#cart-body, footer) [data-cm] {\n  display: none !important;\n}\n\nhtml:not(.cm-on) :-moz-any(#cart-body, footer) [data-cm] {\n  display: none !important;\n}\n\nhtml:not(.cm-on) :is(#cart-body, footer) [data-cm] {\n  display: none !important;\n}\n\n.cm-ic {\n  vertical-align: -3px;\n  font-size: 18px;\n  line-height: 1;\n}\n\n.cm-save {\n  color: var(--cm-ink-3);\n  white-space: nowrap;\n  font-weight: 400;\n}\n\n.cm-save b {\n  color: var(--cm-green);\n  font-weight: 600;\n}\n\n.cm-when {\n  display: inline-flex;\n  color: var(--cm-ink-3);\n  white-space: nowrap;\n  align-items:  center;\n  gap: 4px;\n  font-size: 12px;\n}\n\n.cm-when.cm-warn {\n  color: var(--cm-amber);\n}\n\n.cm-badge {\n  display: inline-block;\n  background: var(--cm-red);\n  color: #fff;\n  clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);\n  white-space: nowrap;\n  border-radius: 3px 3px 0 0;\n  padding: 2px 16px 2px 6px;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 16px;\n}\n\n.cm-btn {\n  font: inherit;\n  border: 1px solid var(--cm-blue);\n  color: var(--cm-blue);\n  cursor: pointer;\n  display: inline-flex;\n  background: #fff;\n  border-radius: 4px;\n  align-items:  center;\n  gap: 6px;\n  height: 30px;\n  padding: 0 10px;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.cm-btn:hover {\n  background: var(--cm-blue-tint);\n}\n\n.cm-btn .cm-ic {\n  vertical-align: 0;\n  font-size: 16px;\n}\n\n.cm-icon-btn {\n  border-color: var(--cm-line-strong);\n  color: var(--cm-ink-2);\n  justify-content: center;\n  width: 30px;\n  padding: 0;\n}\n\n.cm-link {\n  font: inherit;\n  color: var(--cm-ink-3);\n  cursor: pointer;\n  text-decoration: underline;\n  background: none;\n  border: 0;\n  margin-left: auto;\n  padding: 0;\n  font-size: 12px;\n}\n\n.cm-btn:focus-visible {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: 2px;\n}\n\n.cm-link:focus-visible {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: 2px;\n}\n\n#cm-restore {\n  position: fixed;\n  z-index: 9999;\n  color: #fff;\n  cursor: pointer;\n  background: #005dab;\n  border: 0;\n  border-radius: 4px;\n  padding: 10px 14px;\n  font: 600 13px / 1 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif;\n  bottom: 16px;\n  right: 16px;\n  box-shadow: 0 2px 8px #0003;\n}\n\nhtml.cm-on #cm-restore {\n  display: none;\n}\n\n/* src/plugins/cards/cards.css */\n:root.cm-on.cm-p-cards #order-items-regular {\n  box-shadow: none;\n  display: flex;\n  background: none;\n  flex-direction: column;\n  gap: 12px;\n}\n\n:root.cm-on.cm-p-cards #order-items :-webkit-any(hr, .divider-line, .member-only-msg) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items :-moz-any(hr, .divider-line, .member-only-msg) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items :is(hr, .divider-line, .member-only-msg) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards .a11y-tooltip .co-help {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards .a11y-tooltip .cm-ic {\n  color: var(--cm-blue);\n  vertical-align: -2px;\n  font-size: 15px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item {\n  border: 1px solid var(--cm-line);\n  box-shadow: none;\n  color: var(--cm-ink);\n  background: #fff;\n  border-radius: 4px;\n  margin: 0;\n  transition: background .3s;\n  font-size: 13px;\n  line-height: 18px;\n  padding: 16px 20px !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item.cm-flash {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item.cm-qty1 :-webkit-any(.total-price, [automation-id^=\"totalPriceOutput_\"]) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item.cm-qty1 :-moz-any(.total-price, [automation-id^=\"totalPriceOutput_\"]) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item.cm-qty1 :is(.total-price, [automation-id^=\"totalPriceOutput_\"]) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .item-thumbnail img {\n  object-fit: contain;\n  width: 80px;\n  height: 80px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :is(.product-title[id^=\"product-name_\"], .product-title a) {\n  color: var(--cm-ink);\n  font-size: 16px;\n  font-weight: 400;\n  line-height: 22px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .product-title a {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  overflow: hidden;\n  -webkit-box-orient: vertical;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .product-title a:hover {\n  color: var(--cm-blue);\n  text-decoration: underline;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .col-xs-9 {\n  line-height: 16px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .col-xs-9 > .product-title {\n  display: block;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .col-xs-8 > .product-title {\n  color: var(--cm-ink-3);\n  font-size: 12px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .product-warranty {\n  color: var(--cm-ink-3);\n  display: -webkit-box;\n  -webkit-line-clamp: 1;\n  overflow: hidden;\n  -webkit-box-orient: vertical;\n  font-size: 12px;\n  line-height: 16px;\n  margin-top: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .number-status {\n  display: inline;\n  color: var(--cm-ink-3);\n  font-size: 12px;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .number-status .number {\n  color: var(--cm-ink-3);\n  font-size: 12px;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .defining-attributes {\n  display: inline;\n  color: var(--cm-ink-3);\n  font-size: 12px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .defining-attributes div {\n  display: inline;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .defining-attributes div:before {\n  content: \"|\";\n  color: var(--cm-line-strong);\n  margin: 0 6px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .item-fsa:not(:has(*)) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .item-description-prices {\n  margin-top: 8px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .item-description-prices > .price {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: baseline;\n  gap: 4px 12px;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .product-price .price {\n  color: var(--cm-ink);\n  font-size: 18px;\n  font-weight: 700;\n  line-height: 24px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .azure-entries {\n  display: flex;\n  flex-direction: column;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .azure-entries > .row:has(.quantity-selector-v2) {\n  order: 9;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .row > div:has( > .quantity-selector-v2) {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: 4px 8px;\n  margin-top: 12px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .item-quantity-validation-error {\n  flex-basis: 100%;\n  order: 3;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .item-quantity-validation-error:not(:has(.error:not(:empty))) {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .quantity-selector-v2 {\n  border: 1px solid var(--cm-line-strong);\n  display: inline-flex;\n  overflow: hidden;\n  border-radius: 4px;\n  width: 92px;\n  height: 28px;\n  margin: 0;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .quantity-selector-v2 button {\n  color: var(--cm-blue);\n  background: #fff;\n  border: 0;\n  width: 28px;\n  height: 26px;\n  min-height: 0;\n  padding: 0;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .quantity-selector-v2 button img {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .quantity-selector-v2 button .cm-ic {\n  vertical-align: 0;\n  font-size: 14px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .quantity-selector-v2 input {\n  text-align: center;\n  border: 0;\n  width: 34px;\n  height: 26px;\n  padding: 0;\n  font-size: 13px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .remove-link {\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .wish-list {\n  display: flex;\n  text-align: left;\n  gap: 4px;\n  margin: 0;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .wish-list > span {\n  display: none;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :-webkit-any(.remove-link, .wish-list) button {\n  color: var(--cm-ink-3);\n  display: inline-flex;\n  background: none;\n  border: 0;\n  border-radius: 4px;\n  justify-content: center;\n  align-items:  center;\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :-webkit-any(.remove-link, .wish-list) button .cm-ic {\n  vertical-align: 0;\n  font-size: 18px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :-webkit-any(.remove-link, .wish-list) button:hover {\n  color: var(--cm-blue);\n  background: var(--cm-surface-2);\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :-moz-any(.remove-link, .wish-list) button {\n  color: var(--cm-ink-3);\n  display: inline-flex;\n  background: none;\n  border: 0;\n  border-radius: 4px;\n  justify-content: center;\n  align-items:  center;\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :-moz-any(.remove-link, .wish-list) button .cm-ic {\n  vertical-align: 0;\n  font-size: 18px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :-moz-any(.remove-link, .wish-list) button:hover {\n  color: var(--cm-blue);\n  background: var(--cm-surface-2);\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :is(.remove-link, .wish-list) button {\n  color: var(--cm-ink-3);\n  display: inline-flex;\n  background: none;\n  border: 0;\n  border-radius: 4px;\n  justify-content: center;\n  align-items:  center;\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :is(.remove-link, .wish-list) button .cm-ic {\n  vertical-align: 0;\n  font-size: 18px;\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item :is(.remove-link, .wish-list) button:hover {\n  color: var(--cm-blue);\n  background: var(--cm-surface-2);\n}\n\n:root.cm-on.cm-p-cards #order-items .order-item .remove-link button:hover {\n  color: var(--cm-red);\n}\n\n/* src/plugins/cards/grid.css */\n@media (min-width: 1024px) {\n  :root.cm-on.cm-p-cards #order-items .order-item > .row {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) 320px;\n    grid-template-rows: auto 1fr auto;\n    grid-template-areas: \"main deliv\" \"main price\" \"svc svc\";\n    column-gap: 24px;\n    margin: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row:before {\n    display: none;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row:after {\n    display: none;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > div {\n    float: none;\n    width: auto;\n    min-width: 0;\n    margin-left: 0;\n    padding: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > [class*=\"col-xl-7\"] {\n    grid-area: main;\n    position: relative;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > [class*=\"col-xl-5\"]:not([class*=\"offset\"]) {\n    grid-area: deliv;\n    position: relative;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > .col-xs-12:not([class*=\"col-xl\"]):not(.cart-part-services):not(:has(.cart-part-services)) {\n    grid-area: svc;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > div:has(.cart-part-services) {\n    grid-area: svc;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > .cart-part-services {\n    grid-area: svc;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > [class*=\"col-xl-5\"] .row {\n    margin: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > [class*=\"col-xl-5\"] [class*=\"col-\"] {\n    margin-left: 0;\n    padding: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > .cm-price-slot {\n    grid-area: price;\n    place-self:  end;\n    margin-top: 4px;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item.cm-email > .row {\n    grid-template-areas: \"main price\" \"main price\" \"svc svc\";\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item.cm-email > .row > [class*=\"col-xl-5\"]:not([class*=\"offset\"]) {\n    display: none;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .azure-entries {\n    position: static;\n    min-height: 80px;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .azure-entries [class*=\"col-\"] {\n    min-height: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .azure-entries > .row {\n    margin-inline-start: 0;\n    margin-inline-end: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .azure-entries > .row > .item-thumbnail {\n    position: absolute;\n    width: 80px;\n    padding: 0;\n    inset: 0 auto auto 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .azure-entries > .row > .item-thumbnail + .col-xs-9 {\n    position: static;\n    width: calc(100% - 96px);\n    margin-left: 96px;\n    padding: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .azure-entries > .row > [class*=\"col-xl-offset-3\"] {\n    width: calc(100% - 96px);\n    margin-left: 96px;\n    padding: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .linked-item {\n    margin-bottom: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .cm-price-slot .item-description-prices {\n    margin: 0;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .cm-price-slot .item-description-prices > .price {\n    text-align: right;\n    flex-flow: wrap;\n    justify-content: flex-end;\n    align-items:  center;\n    gap: 0 10px;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item .cm-price-slot .product-price {\n    text-align: right;\n    flex-basis: 100%;\n  }\n}\n\n@media (max-width: 1024px) {\n  :root.cm-on.cm-p-cards #order-items .order-item > .row {\n    display: flex;\n    flex-direction: column;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > [class*=\"col-xl-7\"] {\n    order: -2;\n  }\n\n  :root.cm-on.cm-p-cards #order-items .order-item > .row > .cm-price-slot {\n    order: -1;\n    padding: 0 15px 0 calc(25% + 15px);\n  }\n}\n\n/* src/plugins/delivery/delivery.css */\n:root.cm-on.cm-p-delivery .delivery-options {\n  margin-bottom: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options .selection-item:not(.cart-calendar-box) {\n  box-shadow: none !important;\n  background: none !important;\n  border: 0 !important;\n  border-radius: 0 !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options .selection-box-v3 {\n  background: none !important;\n  border: 0 !important;\n  margin-bottom: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options .ship-type-and-cost {\n  display: flex;\n  color: var(--cm-ink);\n  align-items:  center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 18px;\n}\n\n:root.cm-on.cm-p-delivery .estimated-delivery-date-div {\n  margin: 2px 0 0;\n  line-height: 16px;\n  font-size: 12px !important;\n}\n\n:root.cm-on.cm-p-delivery .estimated-delivery-date-div * {\n  margin: 2px 0 0;\n  line-height: 16px;\n  font-size: 12px !important;\n}\n\n:root.cm-on.cm-p-delivery #order-items .delivery-options label.selection-item {\n  width: -moz-fit-content !important;\n  width: fit-content !important;\n  margin-left: auto !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) {\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  align-items:  center;\n  gap: 4px 0;\n  display: flex !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost {\n  box-sizing: border-box;\n  background: var(--cm-surface-2);\n  border: 1px solid var(--cm-line-strong);\n  border-right: 0;\n  border-radius: 14px 0 0 14px;\n  gap: 0;\n  height: 28px;\n  padding: 0 8px 0 10px;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost > :not(.cm-ic) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost > .cm-ic {\n  font-size: 18px;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .cart-delivery-details-link {\n  flex: none;\n  order: -1;\n  margin-right: 6px !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .estimated-delivery-date-div {\n  text-align: right;\n  flex-basis: 100%;\n  order: 9;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .estimated-delivery-date-div * {\n  display: inline !important;\n  color: var(--cm-ink-3) !important;\n  margin: 0 !important;\n  font-size: 12px !important;\n  font-weight: 400 !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-delivery .delivery-options label.selection-item:has(.cart-calendar-box) > .estimated-delivery-date-div > :first-child:after {\n  content: \": \";\n}\n\n:root.cm-on.cm-p-delivery .cart-calendar-box {\n  display: block;\n  box-shadow: none !important;\n  background: none !important;\n  border: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-calendar-box [id^=\"calendarWrap\"] {\n  position: relative;\n  display: inline-flex;\n}\n\n:root.cm-on.cm-p-delivery .cart-calendar-box input.date-input {\n  opacity: 0;\n  cursor: pointer;\n  z-index: 1;\n  border: 0;\n  padding: 0;\n  inset: 0;\n  position: absolute !important;\n  width: 100% !important;\n  height: 100% !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-calendar-box .cart-calendar-text {\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n  width: 1px;\n  height: 1px;\n  position: absolute !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-calendar-box .co-calendar {\n  display: none;\n}\n\n:root.cm-on.cm-p-delivery .cart-calendar-box label {\n  position: relative;\n  display: block;\n  margin: 0;\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link {\n  display: inline-flex;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link > :-webkit-any(a, button) {\n  display: inline-block;\n  text-align: center;\n  color: var(--cm-ink-3);\n  background: none;\n  border: 0;\n  width: 24px;\n  height: 24px;\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link > :-moz-any(a, button) {\n  display: inline-block;\n  text-align: center;\n  color: var(--cm-ink-3);\n  background: none;\n  border: 0;\n  width: 24px;\n  height: 24px;\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link > :is(a, button) {\n  display: inline-block;\n  text-align: center;\n  color: var(--cm-ink-3);\n  background: none;\n  border: 0;\n  width: 24px;\n  height: 24px;\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link > :-webkit-any(a, button):hover {\n  color: var(--cm-blue);\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link > :-moz-any(a, button):hover {\n  color: var(--cm-blue);\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link > :is(a, button):hover {\n  color: var(--cm-blue);\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link .cm-ic {\n  font-size: 18px;\n  line-height: 24px;\n}\n\n:root.cm-on.cm-p-delivery .cart-delivery-details-link span:not(.cm-ic) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-delivery #order-items .delivery-options.cm-has-mode {\n  display: flex;\n  flex-direction: column;\n  align-items:  flex-end;\n  gap: 6px;\n  width: -moz-fit-content;\n  width: fit-content;\n  margin-left: auto !important;\n}\n\n:root.cm-on.cm-p-delivery #order-items .delivery-options.cm-has-mode label.selection-item {\n  width: auto !important;\n  margin-left: 0 !important;\n  padding-left: 0 !important;\n}\n\n:root.cm-on.cm-p-delivery #order-items .delivery-options.cm-has-mode label.selection-item:before {\n  content: none !important;\n}\n\n:root.cm-on.cm-p-delivery #order-items .delivery-options.cm-has-mode .cm-opt:not(.cm-opt-on) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-delivery #order-items .delivery-options.cm-has-mode label.selection-item:has(.cart-calendar-box) > .ship-type-and-cost {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-delivery .warehouse_pickup {\n  margin-top: 10px;\n}\n\n:root.cm-on.cm-p-delivery .warehouse_pickup .selection-item {\n  color: var(--cm-ink-2);\n  margin: 0 !important;\n  font-size: 12px !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-delivery .warehouse_pickup .selection-item * {\n  color: var(--cm-ink-2);\n  margin: 0 !important;\n  font-size: 12px !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-delivery .warehouse_pickup .warehouse_pickup_address_lines {\n  display: -webkit-box;\n  -webkit-line-clamp: 1;\n  overflow: hidden;\n  -webkit-box-orient: vertical;\n}\n\n:root.cm-on.cm-p-delivery .warehouse_pickup input:not(:checked) + label .warehouse-pickup-address-v2 > div:not(.warehouse_pickup_address_lines) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-delivery .warehouse_pickup .cart-delivery-details-button {\n  background: none;\n  border: 0;\n  padding: 0;\n  color: var(--cm-blue) !important;\n}\n\n/* src/plugins/delivery/delivery.module.css */\n.mode_ZVEnOQ {\n  display: inline-flex;\n  border: 1px solid var(--cm-line-strong);\n  overflow: hidden;\n  border-radius: 14px;\n  flex-wrap: wrap;\n  max-width: 100%;\n  min-height: 28px;\n}\n\n.modeBtn_ZVEnOQ {\n  display: inline-flex;\n  white-space: nowrap;\n  color: var(--cm-ink-3);\n  font: inherit;\n  cursor: pointer;\n  background: #fff;\n  border: 0;\n  align-items:  center;\n  gap: 5px;\n  height: 28px;\n  padding: 0 10px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.modeBtn_ZVEnOQ + .modeBtn_ZVEnOQ {\n  border-left: 1px solid var(--cm-line-strong);\n}\n\n.modeBtn_ZVEnOQ .cm-ic {\n  font-size: 16px;\n}\n\n.modeBtn_ZVEnOQ[aria-pressed=\"true\"] {\n  background: var(--cm-blue);\n  color: #fff;\n}\n\n.modeBtn_ZVEnOQ:focus-visible {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: -2px;\n}\n\n.chip_ZVEnOQ {\n  display: inline-flex;\n  border: 1px solid var(--cm-line-strong);\n  color: var(--cm-blue);\n  white-space: nowrap;\n  background: #fff;\n  border-radius: 0 14px 14px 0;\n  align-items:  center;\n  gap: 6px;\n  height: 28px;\n  padding: 0 10px 0 8px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 18px;\n}\n\n.chip_ZVEnOQ .cm-ic {\n  margin-right: 2px;\n  font-size: 15px;\n}\n\n.chip_ZVEnOQ > span {\n  display: inline !important;\n  line-height: 26px !important;\n}\n\n[id^=\"calendarWrap\"]:hover > .chip_ZVEnOQ {\n  background: var(--cm-blue-tint);\n  border-color: var(--cm-blue);\n}\n\ninput.date-input:focus-visible + .chip_ZVEnOQ {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: 2px;\n}\n\n.cm-has-mode .chip_ZVEnOQ {\n  border-radius: 14px;\n}\n\n/* src/plugins/footer/footer.css */\n:root.cm-on.cm-p-footer #cart {\n  padding-bottom: 24px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget {\n  font-size: 12px;\n  line-height: 18px;\n  margin-top: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget > .container-fluid {\n  padding-block-start: 16px !important;\n  padding-block-end: 12px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget a {\n  color: var(--cm-ink-2);\n}\n\n:root.cm-on.cm-p-footer #footer-widget a:hover {\n  color: var(--cm-blue);\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes {\n  border-bottom: 1px solid var(--cm-line-strong);\n  margin: 0 !important;\n  padding: 0 0 12px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .row {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  align-items:  center;\n  gap: 8px 28px;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .row:before {\n  display: none;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .row:after {\n  display: none;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .row > div {\n  float: none;\n  align-items:  center;\n  gap: 8px;\n  min-height: 0;\n  display: flex !important;\n  width: auto !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes :-webkit-any(label, .h5-style-guide) {\n  color: var(--cm-ink-3);\n  white-space: nowrap;\n  margin: 0 !important;\n  font-size: 12px !important;\n  font-weight: 400 !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes :-moz-any(label, .h5-style-guide) {\n  color: var(--cm-ink-3);\n  white-space: nowrap;\n  margin: 0 !important;\n  font-size: 12px !important;\n  font-weight: 400 !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes :is(label, .h5-style-guide) {\n  color: var(--cm-ink-3);\n  white-space: nowrap;\n  margin: 0 !important;\n  font-size: 12px !important;\n  font-weight: 400 !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .row > div:has(.get-help) > .h5-style-guide {\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  width: 1px;\n  height: 1px;\n  position: absolute !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .form-group {\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .input-group {\n  display: flex;\n  align-items: stretch;\n  width: auto;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes input.form-control {\n  background: #fff;\n  border: 1px solid var(--cm-line-strong) !important;\n  box-shadow: none !important;\n  border-radius: 4px 0 0 4px !important;\n  width: 200px !important;\n  height: 32px !important;\n  padding: 4px 10px !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes input.form-control:focus {\n  outline: none;\n  border-color: var(--cm-blue) !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .input-group-btn {\n  display: flex;\n  width: auto;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .input-group-btn :-webkit-any(.btn, button) {\n  background: var(--cm-blue);\n  color: #fff;\n  font-weight: 600;\n  border: 1px solid var(--cm-blue) !important;\n  border-radius: 0 4px 4px 0 !important;\n  height: 32px !important;\n  min-height: 0 !important;\n  padding: 0 12px !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .input-group-btn :-moz-any(.btn, button) {\n  background: var(--cm-blue);\n  color: #fff;\n  font-weight: 600;\n  border: 1px solid var(--cm-blue) !important;\n  border-radius: 0 4px 4px 0 !important;\n  height: 32px !important;\n  min-height: 0 !important;\n  padding: 0 12px !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .input-group-btn :is(.btn, button) {\n  background: var(--cm-blue);\n  color: #fff;\n  font-weight: 600;\n  border: 1px solid var(--cm-blue) !important;\n  border-radius: 0 4px 4px 0 !important;\n  height: 32px !important;\n  min-height: 0 !important;\n  padding: 0 12px !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes #footer-find-warehouse-block .input-group-btn :-webkit-any(.btn, button) {\n  color: var(--cm-blue);\n  background: #fff;\n  border-color: var(--cm-line-strong) !important;\n  border-left-width: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes #footer-find-warehouse-block .input-group-btn :-moz-any(.btn, button) {\n  color: var(--cm-blue);\n  background: #fff;\n  border-color: var(--cm-line-strong) !important;\n  border-left-width: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes #footer-find-warehouse-block .input-group-btn :is(.btn, button) {\n  color: var(--cm-blue);\n  background: #fff;\n  border-color: var(--cm-line-strong) !important;\n  border-left-width: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .input-group-btn .cm-ic {\n  font-size: 18px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .get-help {\n  display: flex;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .get-help a {\n  display: inline-flex;\n  color: var(--cm-blue);\n  align-items:  center;\n  gap: 6px;\n  height: 32px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 20px;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .get-help a span {\n  padding: 0 !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .get-help a:before {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .get-help .cm-ic {\n  font-size: 20px;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .cm-swapped > :not(.cm-ic) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .cm-swapped .cm-ic {\n  vertical-align: 0;\n  font-size: 20px;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .social-icons {\n  display: flex;\n  gap: 4px;\n  width: auto !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .social-icons :-webkit-any(li, a) {\n  width: auto !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .social-icons :-moz-any(li, a) {\n  width: auto !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .social-icons :is(li, a) {\n  width: auto !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .social-icons a {\n  display: grid;\n  color: var(--cm-ink-2);\n  border-radius: 4px;\n  place-items:  center;\n  height: 28px;\n  width: 28px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget .footer-input-boxes .social-icons a:hover {\n  color: var(--cm-blue);\n  background: #fff;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-list {\n  border-bottom: 1px solid var(--cm-line-strong);\n  margin: 0 !important;\n  padding: 12px 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-list .footer-items {\n  display: grid;\n  grid-template-columns: repeat(5, auto);\n  justify-content: space-between;\n  gap: 0 32px;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-list .footer-items:before {\n  display: none;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-list .footer-items:after {\n  display: none;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-list .footer-items > div {\n  display: contents;\n}\n\n:root.cm-on.cm-p-footer #footer-widget ul.footer-list {\n  list-style: none;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget ul.footer-list li {\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 12px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget ul.footer-list li a {\n  font-size: 12px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget ul.footer-list li.footer-column-title {\n  margin-bottom: 4px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget ul.footer-list li.footer-column-title {\n  font-weight: 600;\n  color: var(--cm-ink) !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget ul.footer-list li.footer-column-title a {\n  font-weight: 600;\n  color: var(--cm-ink) !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom {\n  display: flex;\n  text-align: center;\n  flex-wrap: wrap;\n  justify-content: center;\n  align-items:  center;\n  gap: 4px 16px;\n  margin: 0 !important;\n  padding: 10px 0 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.links {\n  display: contents;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.links li {\n  display: flex;\n  align-items:  center;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.links :-webkit-any(a, button) {\n  padding: 0 !important;\n  font-size: 12px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.links :-moz-any(a, button) {\n  padding: 0 !important;\n  font-size: 12px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.links :is(a, button) {\n  padding: 0 !important;\n  font-size: 12px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.links img {\n  width: 24px !important;\n  height: 12px !important;\n  margin: 0 4px 0 0 !important;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom ul.social-icons:empty {\n  display: none;\n}\n\n:root.cm-on.cm-p-footer #footer-widget #footer-bottom p.copyright {\n  color: var(--cm-ink-3);\n  flex-basis: 100%;\n  margin: 0 !important;\n  font-size: 12px !important;\n}\n\n@media (max-width: 1024px) {\n  :root.cm-on.cm-p-footer #footer-widget #footer-list .footer-items {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 12px 24px;\n  }\n}\n\n/* src/plugins/header/header.css */\n:root.cm-on.cm-p-header :-webkit-any(#header-widget, #navigation-widget) .fixed-container {\n  max-width: 1440px !important;\n  padding: 0 24px !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#header-widget, #navigation-widget) .fixed-container {\n  max-width: 1440px !important;\n  padding: 0 24px !important;\n}\n\n:root.cm-on.cm-p-header :is(#header-widget, #navigation-widget) .fixed-container {\n  max-width: 1440px !important;\n  padding: 0 24px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget ul.top-links {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .table-container.parent {\n  padding: 8px 0 !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .right-cell {\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .logo {\n  vertical-align: middle !important;\n  padding-right: 20px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .logo img {\n  width: auto !important;\n  height: 32px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart {\n  vertical-align: middle !important;\n  padding-left: 20px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart nav {\n  display: flex;\n  justify-content: flex-end;\n  align-items:  center;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart ul {\n  align-items:  center;\n  display: flex !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  top: 0 !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart li {\n  align-items:  center;\n  height: 36px;\n  display: flex !important;\n  border: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart li:after {\n  content: none !important;\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart :-webkit-any(li > a, li > button):not(:-webkit-any(#cart-d, .cm-gear, [style*=\"display: none\"])) {\n  white-space: nowrap;\n  align-items:  center;\n  height: 36px;\n  display: inline-flex !important;\n  color: var(--cm-blue) !important;\n  padding: 0 12px !important;\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart :-moz-any(li > a, li > button):not(:-moz-any(#cart-d, .cm-gear, [style*=\"display: none\"])) {\n  white-space: nowrap;\n  align-items:  center;\n  height: 36px;\n  display: inline-flex !important;\n  color: var(--cm-blue) !important;\n  padding: 0 12px !important;\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart :is(li > a, li > button):not(:is(#cart-d, .cm-gear, [style*=\"display: none\"])) {\n  white-space: nowrap;\n  align-items:  center;\n  height: 36px;\n  display: inline-flex !important;\n  color: var(--cm-blue) !important;\n  padding: 0 12px !important;\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart li + li:before {\n  content: \"\";\n  background: var(--cm-line-strong);\n  width: 1px;\n  height: 14px;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart #banner-list-actions + ul > li:first-child:before {\n  content: \"\";\n  background: var(--cm-line-strong);\n  width: 1px;\n  height: 14px;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart li:has( > #cart-d):before {\n  content: none !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart li:has(.cm-gear):before {\n  content: none !important;\n}\n\n:root.cm-on.cm-p-header #header-widget .account-cart li:has(.cm-gear) {\n  margin-left: 8px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d {\n  position: relative;\n  border: 1px solid var(--cm-blue);\n  border-radius: 4px;\n  align-items:  center;\n  gap: 8px;\n  height: 36px;\n  margin-left: 8px;\n  font-weight: 600;\n  display: inline-flex !important;\n  color: var(--cm-blue) !important;\n  text-decoration: none !important;\n  padding: 0 14px !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d:-webkit-any(:hover, :focus-visible) {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d:-moz-any(:hover, :focus-visible) {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d:is(:hover, :focus-visible) {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d * {\n  text-decoration: none !important;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d *:before {\n  text-decoration: none !important;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d i.co-cart-rwd {\n  display: none;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d .cm-ic {\n  vertical-align: 0;\n  font-size: 20px;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d .offscreen {\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  width: 1px;\n  height: 1px;\n  position: absolute !important;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d .cart-number {\n  order: 2;\n  position: static !important;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-header #header-widget #cart-d .cart-number > div {\n  background: var(--cm-blue);\n  color: #fff;\n  text-align: center;\n  border-radius: 10px;\n  min-width: 20px;\n  height: 20px;\n  padding: 0 6px;\n  font-size: 12px;\n  line-height: 20px;\n  position: static !important;\n}\n\n:root.cm-on.cm-p-header .mini-banner {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget {\n  position: relative;\n  z-index: 20012;\n  background: var(--cm-blue) !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget nav.menu {\n  overflow-x: clip;\n  overflow-y: visible;\n  align-items:  center;\n  gap: 0 28px;\n  height: 36px;\n  display: flex !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget .nav-item {\n  flex: none;\n  align-items:  center;\n  gap: 0;\n  display: inline-flex !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget #navigation-dropdown {\n  flex: none;\n  align-items:  center;\n  gap: 0;\n  display: inline-flex !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget #navigation-dropdown {\n  padding-left: 0 !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget .nav-item[data-cm-overflow] {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget #navigation-dropdown {\n  gap: 6px !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget #navigation-dropdown > i {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget #navigation-dropdown:before {\n  content: \"\";\n  font-family: Phosphor;\n  font-size: 20px;\n  font-weight: 400;\n  line-height: 1;\n}\n\n:root.cm-on.cm-p-header #navigation-widget .nav-item > a {\n  align-items:  center;\n  height: 36px;\n  display: inline-flex !important;\n}\n\n:root.cm-on.cm-p-header #navigation-widget :is(.nav-item > a, #navigation-dropdown) {\n  padding: 0 !important;\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n@media (min-width: 1024px) {\n  :root.cm-on.cm-p-header #navigation-widget {\n    container-type: inline-size;\n  }\n\n  :root.cm-on.cm-p-header #navigation-widget .fixed-container {\n    padding-left: max(24px, 124px + -1 * max(0px, 50cqw - 720px)) !important;\n  }\n\n  :root.cm-on.cm-p-header #navigation-widget #navigation-dropdown {\n    top: 0;\n    left: 24px;\n    position: absolute !important;\n    gap: 6px !important;\n  }\n\n  :root.cm-on.cm-p-header #navigation-widget #navigation-dropdown > i {\n    display: none !important;\n  }\n\n  :root.cm-on.cm-p-header #navigation-widget #navigation-dropdown:before {\n    content: \"\";\n    font-family: Phosphor;\n    font-size: 20px;\n    font-weight: 400;\n    line-height: 1;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) #navigation-overlay-div-element {\n    z-index: 20012 !important;\n    pointer-events: none !important;\n    background: none !important;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) #navigation-v2-category-container {\n    position: fixed !important;\n    z-index: 20013 !important;\n    width: auto !important;\n    height: 100vh !important;\n    inset: 0 auto 0 0 !important;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) #navigation-widget {\n    z-index: 20014;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) #navigation-v2-category {\n    width: auto !important;\n    max-width: none !important;\n    height: 100vh !important;\n    margin: 0 !important;\n    padding: 0 !important;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) #navigation-v2-category:not(:hover) > :not(#level1) {\n    display: none !important;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) .navigation-category-level {\n    overflow-y: auto;\n    background: #fff;\n    height: 100vh !important;\n    padding-top: 44px !important;\n  }\n\n  :root.cm-on.cm-p-header:has(#navigation-dropdown[aria-expanded=\"true\"]) #level1 {\n    box-shadow: 1px 0 0 var(--cm-line), 4px 0 12px #0000001f;\n    flex: none;\n    width: 300px !important;\n  }\n}\n\n/* src/plugins/header/flyouts.css */\n:root.cm-on.cm-p-header .popover.top50pixels {\n  box-shadow: var(--cm-card) !important;\n  border: 0 !important;\n  border-radius: 4px !important;\n  max-width: calc(100vw - 32px) !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels .popover-content {\n  padding: 16px 20px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels .nav-popover {\n  margin: 0 !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels .services-grid-wrapper {\n  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;\n  gap: 16px 20px !important;\n  width: auto !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels .grid-column {\n  width: auto !important;\n  height: auto !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels ol > li:not(.sub-item) {\n  color: var(--cm-ink) !important;\n  margin: 0 0 4px !important;\n  padding: 0 !important;\n  font-size: 13px !important;\n  font-weight: 600 !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels ol > li:not(.sub-item) a {\n  color: var(--cm-ink) !important;\n  margin: 0 0 4px !important;\n  padding: 0 !important;\n  font-size: 13px !important;\n  font-weight: 600 !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels li.sub-item {\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 13px !important;\n  line-height: 22px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels li.sub-item a {\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 13px !important;\n  line-height: 22px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :-webkit-any(h2, h3, h4, p) {\n  margin: 0 0 6px !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :-moz-any(h2, h3, h4, p) {\n  margin: 0 0 6px !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :is(h2, h3, h4, p) {\n  margin: 0 0 6px !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :-webkit-any(h2, h3, h4) {\n  color: var(--cm-ink) !important;\n  font-weight: 600 !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :-moz-any(h2, h3, h4) {\n  color: var(--cm-ink) !important;\n  font-weight: 600 !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :is(h2, h3, h4) {\n  color: var(--cm-ink) !important;\n  font-weight: 600 !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :-webkit-any(a.btn, .btn) {\n  border-radius: 4px !important;\n  height: auto !important;\n  min-height: 0 !important;\n  padding: 6px 12px !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :-moz-any(a.btn, .btn) {\n  border-radius: 4px !important;\n  height: auto !important;\n  min-height: 0 !important;\n  padding: 6px 12px !important;\n  font-size: 13px !important;\n}\n\n:root.cm-on.cm-p-header .popover.top50pixels :is(a.btn, .btn) {\n  border-radius: 4px !important;\n  height: auto !important;\n  min-height: 0 !important;\n  padding: 6px 12px !important;\n  font-size: 13px !important;\n}\n\n/* src/plugins/header/mui.css */\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div {\n  grid-template-columns: minmax(0, 1fr) auto;\n  container-type: inline-size;\n  --cm-edge: max(24px, calc((100cqw - 1440px) / 2 + 24px));\n  display: grid !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"AnnouncementBanner\"]) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) {\n  grid-row: 2;\n  grid-column: 1 / -1;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) > div {\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) > div > div:first-child:has(nav[data-testid=\"LinkList\"]) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) {\n  gap: 20px !important;\n  height: auto !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 8px 24px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) :has( > [data-testid=\"Link_homepagelink_SearchStrip\"]) {\n  flex: none !important;\n  align-self:  center !important;\n  width: auto !important;\n  height: auto !important;\n  margin: 0 !important;\n  top: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) [data-testid=\"Link_homepagelink_SearchStrip\"] {\n  flex: none !important;\n  align-self:  center !important;\n  width: auto !important;\n  height: auto !important;\n  margin: 0 !important;\n  top: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) [data-testid=\"Link_homepagelink_SearchStrip\"] img {\n  width: 108.738px !important;\n  min-width: 0 !important;\n  max-width: none !important;\n  height: 32px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] > ul {\n  align-items:  center;\n  margin: 0 40px 0 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] li {\n  position: relative;\n  align-items:  center;\n  display: flex !important;\n  border: 0 !important;\n  width: auto !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] li > :-webkit-any(a, button):not([data-testid=\"cart-link\"]) {\n  align-items:  center;\n  display: inline-flex !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 12px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] li > :-moz-any(a, button):not([data-testid=\"cart-link\"]) {\n  align-items:  center;\n  display: inline-flex !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 12px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] li > :is(a, button):not([data-testid=\"cart-link\"]) {\n  align-items:  center;\n  display: inline-flex !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 12px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] li + li:before {\n  content: \"\";\n  position: absolute;\n  background: var(--cm-line-strong);\n  width: 1px;\n  height: 14px;\n  top: 11px;\n  left: 0;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] li:has([data-testid=\"cart-link\"]):before {\n  content: none;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] :-webkit-any(a, button, div) {\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] :-moz-any(a, button, div) {\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] :is(a, button, div) {\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"] {\n  border: 1px solid var(--cm-blue);\n  border-radius: 4px;\n  align-items:  center;\n  gap: 8px;\n  margin-left: 8px;\n  display: inline-flex !important;\n  color: var(--cm-blue) !important;\n  text-decoration: none !important;\n  height: 36px !important;\n  padding: 0 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"]:before {\n  content: \"\";\n  font-family: Phosphor;\n  font-size: 20px;\n  line-height: 1;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"]:-webkit-any(:hover, :focus-visible) {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"]:-moz-any(:hover, :focus-visible) {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"]:is(:hover, :focus-visible) {\n  background: var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"] [data-testid=\"Text\"] {\n  order: 1;\n  font-weight: 600;\n  color: inherit !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"] > div:not([data-testid]) {\n  order: 2;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"] svg {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"] span {\n  position: static !important;\n  display: inline-block !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"SearchBarUI\"]) nav[data-testid=\"LinkList\"] [data-testid=\"cart-link\"] span span {\n  box-sizing: border-box;\n  text-align: center;\n  border-radius: 10px;\n  min-width: 20px;\n  padding: 0 6px;\n  font-weight: 600;\n  background: var(--cm-blue) !important;\n  color: #fff !important;\n  height: 20px !important;\n  font-size: 12px !important;\n  line-height: 20px !important;\n  transform: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) {\n  grid-row: 1;\n  grid-column: 1;\n  position: relative;\n  height: 36px;\n  background: var(--cm-blue) !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div {\n  background: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div {\n  height: 36px !important;\n  min-height: 0 !important;\n  padding-top: 0 !important;\n  padding-bottom: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav {\n  height: 36px !important;\n  min-height: 0 !important;\n  padding-top: 0 !important;\n  padding-bottom: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div {\n  width: 100% !important;\n  max-width: none !important;\n  padding-inline-start: 0 !important;\n  padding-inline-end: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav {\n  box-sizing: border-box;\n  width: 100%;\n  padding-left: var(--cm-edge) !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"] > button {\n  gap: 6px;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"] > button > svg {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"] > button:before {\n  content: \"\";\n  font-family: Phosphor;\n  font-size: 20px;\n  font-weight: 400;\n  line-height: 1;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > button + button {\n  display: none !important;\n}\n\n@media (min-width: 1024px) {\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav {\n    padding-left: max(var(--cm-edge), 124px) !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li:has([data-testid=\"ShopMenu\"]) {\n    top: 0;\n    left: 24px;\n    position: absolute !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"] > button {\n    gap: 6px;\n    z-index: 1301 !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"] > button > svg {\n    display: none !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"] > button:before {\n    content: \"\";\n    font-family: Phosphor;\n    font-size: 20px;\n    font-weight: 400;\n    line-height: 1;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"]:has( > button[aria-expanded=\"true\"]) > div:not([data-testid]) {\n    position: fixed !important;\n    z-index: 1300 !important;\n    width: max-content !important;\n    height: calc(100vh - 36px) !important;\n    margin: 0 !important;\n    inset: 36px auto 0 0 !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"]:has( > button[aria-expanded=\"true\"]) > div:not([data-testid]) > [data-testid=\"PopoverMenu\"] {\n    flex: none !important;\n    width: max-content !important;\n    height: 100% !important;\n    margin: 0 !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"]:has( > button[aria-expanded=\"true\"]) > div:not([data-testid]) > [data-testid=\"PopoverMenu\"] > div {\n    overflow-y: auto;\n    box-sizing: border-box;\n    box-shadow: 1px 0 0 var(--cm-line), 4px 0 12px #0000001f !important;\n    border-radius: 0 !important;\n    flex: none !important;\n    width: 260px !important;\n    height: 100% !important;\n    padding-top: 8px !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"]:has( > button[aria-expanded=\"true\"]) > div:not([data-testid]) > [data-testid=\"PopoverMenu\"] > div:first-child {\n    width: 300px !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"]:has( > button[aria-expanded=\"true\"]) > div:not([data-testid]) > [data-testid=\"PopoverMenu\"]:not(:hover) > div:not(:first-child) {\n    display: none !important;\n  }\n\n  :root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"ShopMenu\"]:has( > button[aria-expanded=\"true\"]) > div:not([data-testid]) > [data-testid=\"shop-menu-backdrop\"] {\n    pointer-events: none !important;\n    background: none !important;\n  }\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul {\n  overflow: hidden;\n  height: 36px;\n  display: flex !important;\n  flex-wrap: wrap !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li {\n  width: auto !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul {\n  gap: 0 28px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :-webkit-any(a, button) {\n  min-width: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :-moz-any(a, button) {\n  min-width: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :is(a, button) {\n  min-width: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > div > :-webkit-any(a, button) {\n  min-width: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > div > :-moz-any(a, button) {\n  min-width: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > div > :is(a, button) {\n  min-width: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > div {\n  width: auto !important;\n  min-width: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > a {\n  align-items:  center;\n  display: inline-flex !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > a * {\n  height: auto !important;\n  padding-block-start: 0 !important;\n  padding-block-end: 0 !important;\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) [data-testid=\"Text_shop-menu-button\"] {\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :-webkit-any(a, button, div) > :-webkit-any(a, button) {\n  height: 36px !important;\n  min-height: 0 !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :-moz-any(a, button, div) > :-moz-any(a, button) {\n  height: 36px !important;\n  min-height: 0 !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :is(a, button, div) > :is(a, button) {\n  height: 36px !important;\n  min-height: 0 !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :-webkit-any(a, button) {\n  height: 36px !important;\n  min-height: 0 !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :-moz-any(a, button) {\n  height: 36px !important;\n  min-height: 0 !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has( > div > nav[data-testid=\"LinkList\"]) > div > nav > ul > li > :is(a, button) {\n  height: 36px !important;\n  min-height: 0 !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) {\n  grid-row: 1;\n  grid-column: 2;\n  padding: 0 var(--cm-edge) 0 28px !important;\n  background: var(--cm-blue) !important;\n  height: 36px !important;\n  min-height: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) > div {\n  background: none !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-webkit-any(div, nav):has( > :-webkit-any(div, nav, a, button)) {\n  gap: 6px;\n  height: 36px;\n  display: flex !important;\n  flex-direction: row !important;\n  align-items:  center !important;\n  width: max-content !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-moz-any(div, nav):has( > :-moz-any(div, nav, a, button)) {\n  gap: 6px;\n  height: 36px;\n  display: flex !important;\n  flex-direction: row !important;\n  align-items:  center !important;\n  width: max-content !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :is(div, nav):has( > :is(div, nav, a, button)) {\n  gap: 6px;\n  height: 36px;\n  display: flex !important;\n  flex-direction: row !important;\n  align-items:  center !important;\n  width: max-content !important;\n  min-height: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) > div > div {\n  gap: 12px;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid$=\"-label\"] {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) nav > div:has([data-testid=\"Text_surcharge-and-threshold\"]) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) * {\n  white-space: nowrap;\n  color: #fff !important;\n  fill: #fff !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) svg {\n  width: 14px !important;\n  height: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) button {\n  min-width: 0 !important;\n  padding: 0 !important;\n  font-weight: 600 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid=\"WarehouseSelectorUI\"] {\n  position: relative;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid=\"WarehouseSelectorUI\"]:after {\n  content: \"\";\n  opacity: .85;\n  font-family: Phosphor;\n  font-size: 14px;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid^=\"Text_warehouse-openinghours\"] {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid=\"WarehouseSelectorUI\"][data-cm-hours]:hover:before {\n  position: absolute;\n  z-index: 30;\n  content: attr(data-cm-hours);\n  white-space: pre;\n  color: #fff;\n  background: var(--cm-blue-dark);\n  border-radius: 4px;\n  width: max-content;\n  padding: 6px 10px;\n  top: calc(100% + 6px);\n  left: -8px;\n  box-shadow: 0 2px 6px #00000040;\n  font-size: 12px !important;\n  font-weight: 400 !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid=\"Divider\"] {\n  background: #fff6 !important;\n  border: 0 !important;\n  width: 1px !important;\n  height: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :is([data-testid=\"locationselector_DeliveryLocationSelector\"], nav > div:has([data-testid=\"Link_wishlist\"])):before {\n  content: \"\";\n  background: #fff6;\n  width: 1px;\n  height: 14px;\n  margin: 0 6px;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) nav > div:has([data-testid=\"Link_wishlist\"]) {\n  gap: 12px;\n}\n\n:root.cm-on.cm-p-header:has(nav[data-testid=\"Breadcrumbs\"]) header:has([data-testid=\"SearchBarUI\"]) > div {\n  position: relative;\n}\n\n:root.cm-on.cm-p-header:has(nav[data-testid=\"Breadcrumbs\"]) header:has([data-testid=\"SearchBarUI\"]) > div nav:has( > div > [data-testid=\"WarehouseSelectorUI\"]) {\n  top: calc(100% + 20px);\n  right: var(--cm-edge);\n  z-index: 5;\n  position: absolute !important;\n  height: 24px !important;\n}\n\n:root.cm-on.cm-p-header:has(nav[data-testid=\"Breadcrumbs\"]) header:has([data-testid=\"SearchBarUI\"]) > div nav:has( > div > [data-testid=\"WarehouseSelectorUI\"]) {\n  color: var(--cm-ink-2) !important;\n  fill: var(--cm-ink-2) !important;\n}\n\n:root.cm-on.cm-p-header:has(nav[data-testid=\"Breadcrumbs\"]) header:has([data-testid=\"SearchBarUI\"]) > div nav:has( > div > [data-testid=\"WarehouseSelectorUI\"]) * {\n  color: var(--cm-ink-2) !important;\n  fill: var(--cm-ink-2) !important;\n}\n\n:root.cm-on.cm-p-header:has(nav[data-testid=\"Breadcrumbs\"]) header:has([data-testid=\"SearchBarUI\"]) > div nav:has( > div > [data-testid=\"WarehouseSelectorUI\"]) [data-testid=\"locationselector_DeliveryLocationSelector\"]:before {\n  background: var(--cm-line-strong) !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) nav > div:has([data-testid=\"Link_wishlist\"]) {\n  gap: 14px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) nav > div:has([data-testid=\"Link_wishlist\"]):before {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) nav > div:has([data-testid=\"Link_wishlist\"]) [data-testid=\"Divider\"] {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-webkit-any([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]) {\n  justify-content: center;\n  align-items:  center;\n  width: 24px;\n  display: flex !important;\n  height: 36px !important;\n  font-size: 0 !important;\n  line-height: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-webkit-any([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]):before {\n  content: \"\";\n  height: 18px;\n  font-family: Phosphor;\n  font-size: 18px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-webkit-any([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]) * {\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-moz-any([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]) {\n  justify-content: center;\n  align-items:  center;\n  width: 24px;\n  display: flex !important;\n  height: 36px !important;\n  font-size: 0 !important;\n  line-height: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-moz-any([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]):before {\n  content: \"\";\n  height: 18px;\n  font-family: Phosphor;\n  font-size: 18px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :-moz-any([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]) * {\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :is([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]) {\n  justify-content: center;\n  align-items:  center;\n  width: 24px;\n  display: flex !important;\n  height: 36px !important;\n  font-size: 0 !important;\n  line-height: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :is([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]):before {\n  content: \"\";\n  height: 18px;\n  font-family: Phosphor;\n  font-size: 18px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) :is([data-testid=\"Link_wishlist\"], [data-testid=\"Buy Again\"]) * {\n  font-size: 0 !important;\n}\n\n:root.cm-on.cm-p-header header:has([data-testid=\"SearchBarUI\"]) > div > div:has([data-testid=\"WarehouseSelectorUI\"]) [data-testid=\"Buy Again\"]:before {\n  content: \"\";\n}\n\n/* src/plugins/header/search.css */\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root {\n  overflow: hidden;\n  background: #fff !important;\n  border-radius: 4px !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root:focus-within {\n  box-shadow: 0 0 0 3px var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root:focus-within .MuiOutlinedInput-notchedOutline {\n  border-color: var(--cm-blue) !important;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-notchedOutline {\n  border: 1px solid var(--cm-line-strong) !important;\n  border-radius: 4px !important;\n  top: 0 !important;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-notchedOutline legend {\n  display: none;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) input {\n  box-shadow: none !important;\n  outline: none !important;\n  color: var(--cm-ink) !important;\n  background: none !important;\n  border: 0 !important;\n  height: 36px !important;\n  padding: 0 12px !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) input::placeholder {\n  opacity: 1;\n  color: var(--cm-ink-3) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button {\n  flex: none;\n  border-radius: 0 !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  padding: 0 10px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Clear\"] svg {\n  fill: var(--cm-ink-3) !important;\n  color: var(--cm-ink-3) !important;\n  width: 16px !important;\n  height: 16px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] {\n  justify-content: center;\n  width: 44px;\n  background: var(--cm-blue) !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] svg {\n  fill: #fff !important;\n  color: #fff !important;\n  width: 20px !important;\n  height: 20px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] svg * {\n  fill: #fff !important;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:-webkit-any(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:-moz-any(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:is(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root {\n  overflow: hidden;\n  background: #fff !important;\n  border-radius: 4px !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root:focus-within {\n  box-shadow: 0 0 0 3px var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root:focus-within .MuiOutlinedInput-notchedOutline {\n  border-color: var(--cm-blue) !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-notchedOutline {\n  border: 1px solid var(--cm-line-strong) !important;\n  border-radius: 4px !important;\n  top: 0 !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-notchedOutline legend {\n  display: none;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) input {\n  box-shadow: none !important;\n  outline: none !important;\n  color: var(--cm-ink) !important;\n  background: none !important;\n  border: 0 !important;\n  height: 36px !important;\n  padding: 0 12px !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) input::placeholder {\n  opacity: 1;\n  color: var(--cm-ink-3) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button {\n  flex: none;\n  border-radius: 0 !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  padding: 0 10px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Clear\"] svg {\n  fill: var(--cm-ink-3) !important;\n  color: var(--cm-ink-3) !important;\n  width: 16px !important;\n  height: 16px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] {\n  justify-content: center;\n  width: 44px;\n  background: var(--cm-blue) !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] svg {\n  fill: #fff !important;\n  color: #fff !important;\n  width: 20px !important;\n  height: 20px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] svg * {\n  fill: #fff !important;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:-webkit-any(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:-moz-any(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:is(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root {\n  overflow: hidden;\n  background: #fff !important;\n  border-radius: 4px !important;\n  height: 36px !important;\n  min-height: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root:focus-within {\n  box-shadow: 0 0 0 3px var(--cm-blue-tint);\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-root:focus-within .MuiOutlinedInput-notchedOutline {\n  border-color: var(--cm-blue) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-notchedOutline {\n  border: 1px solid var(--cm-line-strong) !important;\n  border-radius: 4px !important;\n  top: 0 !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) .MuiOutlinedInput-notchedOutline legend {\n  display: none;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) input {\n  box-shadow: none !important;\n  outline: none !important;\n  color: var(--cm-ink) !important;\n  background: none !important;\n  border: 0 !important;\n  height: 36px !important;\n  padding: 0 12px !important;\n  font-size: 14px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) input::placeholder {\n  opacity: 1;\n  color: var(--cm-ink-3) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button {\n  flex: none;\n  border-radius: 0 !important;\n  min-width: 0 !important;\n  height: 36px !important;\n  padding: 0 10px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Clear\"] svg {\n  fill: var(--cm-ink-3) !important;\n  color: var(--cm-ink-3) !important;\n  width: 16px !important;\n  height: 16px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] {\n  justify-content: center;\n  width: 44px;\n  background: var(--cm-blue) !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] svg {\n  fill: #fff !important;\n  color: #fff !important;\n  width: 20px !important;\n  height: 20px !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"] svg * {\n  fill: #fff !important;\n}\n\n:root.cm-on.cm-p-header :-webkit-any(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:-webkit-any(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :-moz-any(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:-moz-any(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n:root.cm-on.cm-p-header :is(#search-widget, [data-testid=\"SearchBarUI\"]) button[aria-label=\"Search\"]:is(:hover, :focus-visible) {\n  background: var(--cm-blue-dark) !important;\n}\n\n/* src/plugins/header/header.module.css */\n.loc_IDJ-aA {\n  display: flex;\n  white-space: nowrap;\n  align-items:  center;\n  font-size: 13px;\n}\n\n.loc_IDJ-aA {\n  fill: currentColor;\n  color: inherit !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n.loc_IDJ-aA * {\n  fill: currentColor;\n  color: inherit !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"] {\n  align-items:  center !important;\n  height: auto !important;\n}\n\n.loc_IDJ-aA svg {\n  width: 14px !important;\n  height: 14px !important;\n}\n\n.loc_IDJ-aA button {\n  min-width: 0 !important;\n  padding: 0 0 0 2px !important;\n  font-weight: 600 !important;\n}\n\n.loc_IDJ-aA .MuiTypography-t7 {\n  display: none !important;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"]:has( > .MuiTypography-t7) {\n  position: relative;\n  align-items:  center;\n  gap: 4px;\n  display: flex !important;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"]:has( > .MuiTypography-t7) + [class*=\"MuiBox-root\"] {\n  border-left: 1px solid color-mix(in srgb, currentColor 40%, transparent);\n  padding-left: 12px;\n  margin-left: 12px !important;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"]:has( > .MuiTypography-t7) > div:last-child:not(.MuiTypography-root) {\n  margin: 0 !important;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"]:has( > .MuiTypography-t7) > div:last-child:not(.MuiTypography-root):before {\n  content: \"\";\n  opacity: .85;\n  font-family: Phosphor;\n  font-size: 14px;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"]:has( > .MuiTypography-t7) > div:last-child:not(.MuiTypography-root) > * {\n  display: none !important;\n}\n\n.loc_IDJ-aA [class*=\"MuiBox-root\"]:has( > .MuiTypography-t7)[data-cm-hours]:hover:before {\n  position: absolute;\n  z-index: 30;\n  content: attr(data-cm-hours);\n  white-space: pre;\n  color: #fff;\n  background: var(--cm-blue-dark);\n  border-radius: 4px;\n  width: max-content;\n  padding: 6px 10px;\n  top: calc(100% + 6px);\n  left: -8px;\n  box-shadow: 0 2px 6px #00000040;\n  font-size: 12px !important;\n  font-weight: 400 !important;\n  line-height: 18px !important;\n}\n\n.navEnd_IDJ-aA {\n  display: flex;\n  color: #fff;\n  white-space: nowrap;\n  flex: none;\n  align-items:  center;\n  gap: 18px;\n  height: 36px;\n  margin-left: auto;\n  padding-left: 0;\n  font-size: 13px;\n}\n\n.navEnd_IDJ-aA #banner-list-actions {\n  list-style: none;\n  align-items:  center;\n  gap: 14px;\n  display: flex !important;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n.navEnd_IDJ-aA #banner-list-actions li {\n  display: flex;\n  align-items:  center;\n  border: 0 !important;\n  padding: 0 !important;\n}\n\n.navEnd_IDJ-aA #banner-list-actions li:before {\n  content: none !important;\n}\n\n.navEnd_IDJ-aA #banner-list-actions li:after {\n  content: none !important;\n}\n\n.navEnd_IDJ-aA #banner-list-actions a {\n  text-decoration: none;\n  justify-content: center;\n  align-items:  center;\n  width: 24px;\n  height: 36px;\n  display: flex !important;\n  color: #fff !important;\n  padding: 0 !important;\n  font-size: 0 !important;\n  line-height: 0 !important;\n}\n\n.navEnd_IDJ-aA #banner-list-actions a:before {\n  content: \"\";\n  height: 18px;\n  font-family: Phosphor;\n  font-size: 18px;\n  line-height: 18px;\n}\n\n.navEnd_IDJ-aA #banner-list-actions li:last-child a:before {\n  content: \"\";\n}\n\n/* src/plugins/pairing/pairing.css */\n:root.cm-on.cm-p-pairing #order-items .order-item.cm-parent {\n  border-color: var(--cm-group);\n  box-shadow: 0 0 0 1px var(--cm-group);\n  border-bottom: 0;\n  border-radius: 4px 4px 0 0;\n}\n\n:root.cm-on.cm-p-pairing #order-items .order-item.cm-child {\n  background: var(--cm-surface-2);\n  border-color: var(--cm-group);\n  border-top-color: var(--cm-line);\n  box-shadow: 0 0 0 1px var(--cm-group);\n  clip-path: inset(0 -2px -2px -2px);\n  border-radius: 0 0 4px 4px;\n  margin-top: -12px;\n  padding: 10px 20px !important;\n}\n\n:root.cm-on.cm-p-pairing #order-items .order-item.cm-child .product-title a {\n  font-size: 14px;\n  line-height: 20px;\n}\n\n.cm-child-tag {\n  display: flex;\n  color: var(--cm-ink);\n  align-items:  center;\n  gap: 6px;\n  margin-bottom: 2px;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 16px;\n}\n\n/* src/core/thumbs.module.css */\n.row_yTBjSw {\n  display: inline-flex;\n  vertical-align: middle;\n  flex-wrap: wrap;\n  gap: 3px;\n}\n\n.thumb_yTBjSw {\n  display: inline-grid;\n  border: 1px solid var(--cm-line);\n  cursor: pointer;\n  color: var(--cm-ink-3);\n  background: #fff;\n  border-radius: 3px;\n  place-items:  center;\n  width: 22px;\n  height: 22px;\n  padding: 1px;\n  font-size: 11px;\n}\n\n.thumb_yTBjSw img {\n  object-fit: contain;\n  width: 100%;\n  height: 100%;\n}\n\n.thumb_yTBjSw:hover {\n  border-color: var(--cm-blue);\n}\n\n.thumb_yTBjSw:focus-visible {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: 1px;\n}\n\n/* src/plugins/panel/panel.module.css */\n.review_ihOyiA {\n  border: 1px solid var(--cm-line);\n  color: var(--cm-ink);\n  background: #fff;\n  border-bottom: 0;\n  border-radius: 4px 4px 0 0;\n  font-size: 13px;\n  line-height: 18px;\n}\n\n.head_ihOyiA {\n  padding: 14px 20px 10px;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 18px;\n}\n\n.head_ihOyiA span {\n  color: var(--cm-ink-3);\n  font-weight: 400;\n}\n\n.strip_ihOyiA {\n  display: flex;\n  border-radius: 4px;\n  align-items:  flex-start;\n  gap: 6px;\n  margin: 0 20px 6px;\n  padding: 6px 10px;\n  font-size: 12px;\n  line-height: 16px;\n}\n\n.strip_ihOyiA .cm-ic {\n  vertical-align: 0;\n  margin-top: 1px;\n  font-size: 14px;\n}\n\n.warn_ihOyiA {\n  background: var(--cm-amber-tint);\n  color: var(--cm-amber);\n}\n\n.ok_ihOyiA {\n  background: var(--cm-blue-tint);\n  color: var(--cm-blue-dark);\n}\n\n.stripRow_ihOyiA {\n  display: flex;\n  align-items:  center;\n  gap: 8px;\n  margin-top: 4px;\n  font-weight: 400;\n}\n\n.stripRow_ihOyiA b {\n  min-width: 84px;\n  font-weight: 600;\n}\n\n.rows_ihOyiA {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n.row_ihOyiA {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  cursor: pointer;\n  border-top: 1px solid var(--cm-line);\n  gap: 2px 12px;\n  padding: 8px 20px;\n}\n\n.row_ihOyiA:first-child {\n  border-top: 0;\n}\n\n.row_ihOyiA:hover {\n  background: var(--cm-surface-2);\n}\n\n.row_ihOyiA:focus-visible {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: -2px;\n}\n\n.name_ihOyiA {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.name_ihOyiA a {\n  color: var(--cm-ink);\n  text-decoration: none;\n}\n\n.name_ihOyiA a:hover {\n  color: var(--cm-blue);\n  text-decoration: underline;\n}\n\n.price_ihOyiA {\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  font-weight: 700;\n}\n\n.meta_ihOyiA {\n  color: var(--cm-ink-3);\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  font-size: 12px;\n  line-height: 16px;\n}\n\n.meta_ihOyiA > span {\n  display: inline-flex;\n  align-items:  center;\n  gap: 3px;\n}\n\n.meta_ihOyiA .cm-ic {\n  vertical-align: 0;\n  font-size: 13px;\n}\n\n.meta_ihOyiA .cm-urgent {\n  color: var(--cm-red);\n  font-weight: 700;\n}\n\n.meta_ihOyiA .cm-warn {\n  color: var(--cm-amber);\n}\n\n.rowSave_ihOyiA {\n  text-align: right;\n  font-size: 12px;\n}\n\n.rowSave_ihOyiA b {\n  font-weight: 400;\n}\n\n.foot_ihOyiA {\n  display: flex;\n  white-space: nowrap;\n  border-top: 1px solid var(--cm-line);\n  align-items:  center;\n  gap: 8px;\n  padding: 10px 20px;\n}\n\n.pre_ihOyiA {\n  display: none;\n  background: var(--cm-surface-2);\n  white-space: pre-wrap;\n  overflow: auto;\n  border-radius: 4px;\n  max-height: 220px;\n  margin: 0 20px 12px;\n  padding: 10px;\n  font-size: 11px;\n  line-height: 15px;\n}\n\n.pre_ihOyiA.open_ihOyiA {\n  display: block;\n}\n\n.savings_ihOyiA {\n  display: flex;\n  border-top: 1px solid var(--cm-line);\n  color: var(--cm-ink);\n  justify-content: space-between;\n  padding: 10px 20px 0;\n  font-size: 14px;\n  line-height: 20px;\n}\n\n.savings_ihOyiA span:last-child {\n  color: var(--cm-green);\n}\n\n.bar_ihOyiA {\n  display: none;\n}\n\n@media (max-width: 1024px) {\n  :root.cm-on.cm-p-panel .bar_ihOyiA {\n    display: flex;\n    position: fixed;\n    z-index: 1000;\n    border-top: 1px solid var(--cm-line);\n    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));\n    background: #fff;\n    justify-content: space-between;\n    align-items:  center;\n    gap: 12px;\n    inset: auto 0 0;\n    box-shadow: 0 -2px 8px #00000014;\n  }\n}\n\n.barLabel_ihOyiA {\n  color: var(--cm-ink-3);\n  font-size: 12px;\n}\n\n.barTotal_ihOyiA {\n  font-variant-numeric: tabular-nums;\n  font-size: 18px;\n  font-weight: 700;\n}\n\n.barAlert_ihOyiA {\n  color: var(--cm-red);\n  background: none;\n  border: 0;\n  padding: 0;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.barGo_ihOyiA {\n  background: var(--cm-green);\n  color: #fff;\n  border: 0;\n  border-radius: 4px;\n  height: 44px;\n  padding: 0 24px;\n  font-size: 16px;\n  font-weight: 600;\n}\n\n/* src/plugins/panel/panel.css */\n:root.cm-on.cm-p-panel #order-summary-column {\n  transform: none !important;\n}\n\n:root.cm-on.cm-p-panel #order-summary-column .e-spot-cart-body {\n  display: none;\n}\n\n@media (min-width: 1024px) {\n  :root.cm-on.cm-p-panel [role=\"region\"][aria-label=\"Checkout\"] {\n    position: sticky;\n    top: 16px;\n  }\n}\n\n@media (max-width: 1024px) {\n  :root.cm-on.cm-p-panel #cart-body {\n    padding-bottom: 96px;\n  }\n}\n\n:root.cm-on.cm-p-panel #order-summary-body {\n  border-radius: 0 0 4px 4px;\n  border-style: solid !important;\n  border-width: 0 1px 1px !important;\n  border-color: var(--cm-line) !important;\n  box-shadow: none !important;\n  background: #fff !important;\n  margin-top: 0 !important;\n  padding: 4px 20px 16px !important;\n}\n\n:root.cm-on.cm-p-panel #order-summary-body :is(.summary-left, .summary-right, .order-estimated, .order-estimated *) {\n  margin-bottom: 6px !important;\n  font-size: 14px !important;\n  line-height: 20px !important;\n}\n\n:root.cm-on.cm-p-panel #order-summary-body .estimated-total-label {\n  font-size: 18px !important;\n  font-weight: 700 !important;\n  line-height: 24px !important;\n}\n\n:root.cm-on.cm-p-panel #order-summary-body .order-summary-text-info {\n  color: var(--cm-ink-3);\n  margin: 2px 0 12px;\n  font-size: 12px;\n}\n\n:root.cm-on.cm-p-panel #order-summary-body .divider-line {\n  border-color: var(--cm-line);\n  margin: 8px 0 10px;\n}\n\n:root.cm-on.cm-p-panel #order-estimated-total {\n  font-size: 18px !important;\n  font-weight: 700 !important;\n  line-height: 24px !important;\n}\n\n:root.cm-on.cm-p-panel #order-estimated-zip {\n  width: 75%;\n}\n\n:root.cm-on.cm-p-panel #order-estimated-shipping {\n  text-align: right;\n  width: 25%;\n}\n\n:root.cm-on.cm-p-panel #shopCartCheckoutSubmitButton {\n  border-radius: 4px;\n  width: 100%;\n  height: 44px;\n  font-weight: 600;\n}\n\n/* src/plugins/promos/promos.module.css */\n.box_X0PRZQ {\n  clear: both;\n  border-left: 2px solid var(--cm-line);\n  color: var(--cm-ink-3);\n  margin: 2px 0 8px;\n  padding-left: 12px;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.line_X0PRZQ {\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.line_X0PRZQ > span:last-child {\n  color: var(--cm-green);\n  white-space: nowrap;\n  align-self:  center;\n}\n\n.name_X0PRZQ {\n  display: flex;\n  color: var(--cm-ink);\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: 4px 8px;\n  min-width: 0;\n}\n\n.note_X0PRZQ {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: 4px;\n  margin-top: 2px;\n}\n\n.gap_X0PRZQ {\n  color: var(--cm-amber);\n  font-weight: 600;\n}\n\n.fetch_X0PRZQ {\n  color: var(--cm-blue);\n  margin-left: 0;\n  font-size: 12px;\n}\n\n/* src/plugins/redlines/redlines.css */\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) * {\n  outline-offset: -1px;\n  outline: 1px solid #80808080 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) * {\n  outline-offset: -1px;\n  outline: 1px solid #80808080 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) * {\n  outline-offset: -1px;\n  outline: 1px solid #80808080 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * {\n  outline-color: #e61a1a99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * {\n  outline-color: #e61a1a99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * {\n  outline-color: #e61a1a99 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * {\n  outline-color: #e6b91a99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * {\n  outline-color: #e6b91a99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * {\n  outline-color: #e6b91a99 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * {\n  outline-color: #72e61a99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * {\n  outline-color: #72e61a99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * {\n  outline-color: #72e61a99 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * {\n  outline-color: #1ae66199 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * {\n  outline-color: #1ae66199 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * {\n  outline-color: #1ae66199 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * {\n  outline-color: #1acae699 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * {\n  outline-color: #1acae699 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * {\n  outline-color: #1acae699 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * {\n  outline-color: #1a2ae699 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * {\n  outline-color: #1a2ae699 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * {\n  outline-color: #1a2ae699 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * {\n  outline-color: #a81ae699 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * {\n  outline-color: #a81ae699 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * {\n  outline-color: #a81ae699 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * {\n  outline-color: #e61a8399 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * {\n  outline-color: #e61a8399 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * {\n  outline-color: #e61a8399 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * {\n  outline-color: #e6501a99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * {\n  outline-color: #e6501a99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * {\n  outline-color: #e6501a99 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #dbe61a99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #dbe61a99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #dbe61a99 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #3ce61a99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #3ce61a99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #3ce61a99 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #1ae69799 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #1ae69799 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #1ae69799 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #1a94e699 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #1a94e699 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #1a94e699 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #3f1ae699 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #3f1ae699 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #3f1ae699 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #df1ae699 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #df1ae699 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #df1ae699 !important;\n}\n\n:root.cm-p-redlines :-webkit-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #e61a4d99 !important;\n}\n\n:root.cm-p-redlines :-moz-any(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #e61a4d99 !important;\n}\n\n:root.cm-p-redlines :is(#cart-body, header, #navigation-widget) > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * > * {\n  outline-color: #e61a4d99 !important;\n}\n\n/* src/plugins/services/services.css */\n:root.cm-on.cm-p-services #order-items .cart-part-services:not(.hidden) {\n  display: block;\n  background: var(--cm-surface-2);\n  border-top: 1px solid var(--cm-line);\n  float: none;\n  border-radius: 0 0 3px 3px;\n  width: auto !important;\n  margin: 8px -20px -16px !important;\n  padding: 10px 20px !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services :-webkit-any(.row, [class*=\"col-\"], .container-fluid) {\n  float: none;\n  width: auto;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services :-moz-any(.row, [class*=\"col-\"], .container-fluid) {\n  float: none;\n  width: auto;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services :is(.row, [class*=\"col-\"], .container-fluid) {\n  float: none;\n  width: auto;\n  margin: 0 !important;\n  padding: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .delivery-services-main {\n  font-size: 12px;\n  line-height: 16px;\n  background: none !important;\n  border: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services h3 {\n  display: flex;\n  align-items:  center;\n  gap: 8px;\n  font-size: 13px;\n  line-height: 18px;\n  margin: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services h3 label.parts-bold {\n  display: inline-flex;\n  align-items:  center;\n  gap: 6px;\n  margin: 0;\n  font-weight: 600;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services [id^=\"edd-delivery-services-container\"] {\n  margin-top: 0 !important;\n  padding-top: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services [id^=\"edd-delivery-services-container\"] > :first-child {\n  margin-top: 0 !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .delivery-services-notification {\n  color: var(--cm-amber);\n  background: none;\n  border: 0;\n  margin: 4px 0 0;\n  padding: 0;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .delivery-services-notification * {\n  padding: 0 !important;\n  font-size: 12px !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .delivery-services-notification img {\n  display: none;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .delivery-services-notification .cm-ic {\n  vertical-align: -2px;\n  margin-right: 6px;\n  font-size: 14px;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services.cm-collapsed :-webkit-any(ul.edd-delivery-services, .parts-types-bold) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services.cm-collapsed :-moz-any(ul.edd-delivery-services, .parts-types-bold) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services.cm-collapsed :is(ul.edd-delivery-services, .parts-types-bold) {\n  display: none !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services:not(.cm-collapsed) ul.edd-delivery-services {\n  list-style: none;\n  max-width: 72ch;\n  margin: 2px 0 6px;\n  padding: 0;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .parts-types-bold {\n  display: block;\n  color: var(--cm-ink-3);\n  font-weight: 600;\n  margin: 8px 0 0 !important;\n  font-size: 12px !important;\n  line-height: 16px !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services ul.edd-delivery-services li {\n  display: flex;\n  color: var(--cm-ink);\n  gap: 6px;\n  margin: 2px 0;\n  font-size: 13px;\n  line-height: 18px;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services ul.edd-delivery-services li .add-cart-list-detail {\n  margin: 0 !important;\n  padding: 0 !important;\n  font-size: 13px !important;\n  line-height: 18px !important;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services ul.edd-delivery-services li > .add-cart-list-cell:first-child {\n  display: flex;\n  flex: none;\n  padding-top: 2px;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services img.parts-services-tick {\n  display: none;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .add-cart-list-cell > .ph-check {\n  color: var(--cm-green);\n  font-size: 14px;\n}\n\n:root.cm-on.cm-p-services #order-items .cart-part-services .add-cart-list-cell > .ph-info {\n  color: var(--cm-ink-3);\n  font-size: 14px;\n}\n\n@media (max-width: 1024px) {\n  :root.cm-on.cm-p-services #order-items .cart-part-services:not(.hidden) {\n    padding-left: 20px !important;\n  }\n}\n\n/* src/plugins/services/services.module.css */\n.count_HBUsug {\n  color: var(--cm-ink-3);\n  font-weight: 400;\n}\n\n.toggle_HBUsug {\n  font: inherit;\n  color: var(--cm-blue);\n  cursor: pointer;\n  display: inline-flex;\n  background: none;\n  border: 0;\n  align-items:  center;\n  gap: 2px;\n  padding: 0;\n  font-size: 13px;\n}\n\n.toggle_HBUsug .cm-ic {\n  vertical-align: 0;\n  font-size: 14px;\n}\n\n.toggle_HBUsug:focus-visible {\n  outline: 2px solid var(--cm-blue);\n  outline-offset: 2px;\n}\n\n/* src/plugins/settings/settings.module.css */\n.wrap_y2ChTw {\n  position: relative;\n  margin-left: 8px !important;\n}\n\n.gear_y2ChTw {\n  color: #005dab;\n  cursor: pointer;\n  display: grid;\n  background: none;\n  border: 0;\n  border-radius: 4px;\n  place-items:  center;\n  width: 32px;\n  height: 32px;\n  padding: 0 !important;\n}\n\n.gear_y2ChTw:-webkit-any(:hover, [aria-expanded=\"true\"]) {\n  background: #eff7fb;\n}\n\n.gear_y2ChTw:-moz-any(:hover, [aria-expanded=\"true\"]) {\n  background: #eff7fb;\n}\n\n.gear_y2ChTw:is(:hover, [aria-expanded=\"true\"]) {\n  background: #eff7fb;\n}\n\n.gear_y2ChTw:focus-visible {\n  outline: 2px solid #005dab;\n  outline-offset: 2px;\n}\n\n.gear_y2ChTw .cm-ic {\n  vertical-align: 0;\n  font-size: 20px;\n}\n\n.menu_y2ChTw {\n  position: absolute;\n  z-index: 1000;\n  color: #333;\n  text-align: left;\n  background: #fff;\n  border-radius: 4px;\n  width: max-content;\n  min-width: 240px;\n  padding: 12px 14px;\n  font: 400 13px / 18px inherit;\n  top: calc(100% + 6px);\n  right: 0;\n  box-shadow: 0 0 5px #0000004d;\n}\n\n.menu_y2ChTw[hidden] {\n  display: none;\n}\n\n.menu_y2ChTw h3 {\n  color: #707070;\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  margin: 0 0 8px;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 16px;\n}\n\n.menu_y2ChTw label {\n  display: flex;\n  cursor: pointer;\n  align-items:  center;\n  gap: 8px;\n  margin: 0 0 6px;\n  font-weight: 400;\n}\n\n.menu_y2ChTw input {\n  accent-color: #005dab;\n  margin: 0;\n}\n\n.sub_y2ChTw {\n  color: #5f5f5f;\n  padding-left: 20px;\n}\n\n.floating_y2ChTw {\n  position: absolute;\n  z-index: 20;\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  top: 46px;\n  right: max(24px, 50% - 696px);\n}\n");
    document.documentElement.classList.add(...here.map((p) => `cm-p-${p.id}`));
    if (isCart) {
      const restore = el("button", { type: "button", id: "cm-restore" }, "Cleaned-up view");
      restore.addEventListener("click", () => setOn(true));
      document.body.append(restore);
    }
    const ctx = { ...base, items: [] };
    for (const p of here)
      p.setup?.(ctx);
    setOn(!flag.get("cm-off"));
    if (isCart)
      render3();
  }
})();
