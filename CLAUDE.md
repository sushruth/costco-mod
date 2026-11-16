# costco-mod

A Violentmonkey userscript (`costco-cart.user.js`) that restyles costco.com in place: the site header on every page, and the cart.

## Principles

- **Everything stays local.** No data leaves the user's browser. The script talks only to costco.com, the site the user is already on, and only with plain same-origin requests. It never calls third-party servers, analytics or telemetry. Anything it learns (promo tiers, item details) is saved in the browser (Violentmonkey storage, or localStorage in the preview) with a capture date and an expiry.
- **Restyle in place.** Costco's DOM and handlers stay intact; the script adds classes, CSS and small extra nodes.
- **Honor Costco's design language.** 4px radius cards, Costco's card shadow, regular-weight titles, `|` separators, slanted badges.

## Architecture

- `src/` is the source; `costco-cart.user.js` is the build output, committed so the raw GitHub URL installs and updates. Never edit the output by hand.
- `src/main.ts` lists the plugins in run order. Each plugin in `src/plugins/<id>/` exports a `Plugin` (`src/core/plugin.ts`) with optional `product`, `setup`, `render` and `toggle` hooks, and gets a switch in the gear menu. Off the cart, only the header, search results, deals, checkout, footer and settings plugins run (`here` in `main.ts`).
- Every file stays under 180 lines.
- CSS: native nesting, modern media ranges. Rules for Costco's markup live in `<plugin>.css`, nested under `:root.cm-on.cm-p-<id>`, so a switched-off plugin's CSS stops matching. Nodes a plugin creates are styled with a CSS module (`<plugin>.module.css`, hashed class names). Every node the script creates carries `data-cm`.
- Watch specificity: Costco uses IDs and `!important`. An `:is()` with an ID inside takes the ID's weight.

## Workflow

- `bun run dev` writes the dev build `dev/costco-cart.dev.user.js` (git-ignored, `__DEV__` true, no update URLs) on every change; Violentmonkey's "Track external edits" tab (open `http://127.0.0.1:8723/dev/costco-cart.dev.user.js` from `python3 -m http.server 8723`) picks up each build.
- `bun run build` writes the published `costco-cart.user.js`; run it before committing. `bun run check` type-checks.
- Plugins marked `dev` (Redlines) only exist in the dev build and start switched off; switch them in the gear menu.
- `bun dev/preview.ts` writes `cart.preview.html` from a saved `cart.html` with Costco's scripts stripped and the built userscript injected.
