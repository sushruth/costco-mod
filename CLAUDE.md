# costco-mod

A Violentmonkey userscript (`costco-cart.user.js`) that restyles costco.com's cart in place.

## Principles

- **Everything stays local.** No data leaves the user's browser. The script talks only to costco.com, the site the user is already on, and only with plain same-origin requests. It never calls third-party servers, analytics or telemetry. Anything it learns (promo tiers, item details) is saved in the browser (Violentmonkey storage, or localStorage in the preview) with a capture date and an expiry.
- **Restyle in place.** Costco's DOM and handlers stay intact; the script adds classes, CSS and small extra nodes.
- **Honor Costco's design language.** 4px radius cards, Costco's card shadow, regular-weight titles, `|` separators, slanted badges.

## Workflow

- `bun dev/preview.ts` writes `cart.preview.html` from the saved `cart.html` with Costco's scripts stripped and the userscript injected.
- The floating "Redlines" button (`DEV` flag in the script) outlines every node by nesting depth. Turn `DEV` off before publishing.
