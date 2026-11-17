---
name: costco-mod
description: How the owner wants the costco-mod userscript built, reviewed and tested on live costco.com. Use for any work in ~/code/costco-mod - restyling a Costco page, fixing spacing or alignment, exploring costco.com for new improvements, screenshots, README updates, commits.
---

# costco-mod

The costco-mod userscript restyles costco.com in place. The owner steers by reacting to screenshots, one change at a time.

## Hard limits

- **Never buy anything.** Never click Place Order, Checkout-submit, Buy Now, or any button that charges, subscribes, or changes membership. Adding to the cart, changing quantities and viewing checkout are fine. When unsure whether a click commits money, don't click it.
- **Everything stays local.** The script talks only to costco.com with same-origin requests. No third-party servers, analytics or telemetry. Saved data lives in Violentmonkey storage or localStorage with a capture date and an expiry.
- **Restyle in place.** Keep Costco's DOM, handlers and React intact. Add classes, CSS and small `data-cm` nodes. Copy nodes from the DOM at runtime instead of hand-cloning markup.
- The owner's email, address, ZIP, warehouse, card and order data are private. Never put them in commits, screenshots or outside requests.

## Design taste

Follow `DESIGN.md` at the repo root. Read it before any design change, and add to it when the owner corrects a look.

## Workflow

1. **Draft live first.** Inject a `<style id="cm-try">` via `evaluate_script` on the open Zen tab (Costco's CSP blocks localhost CSS). Show the owner the real page. Never mock up in ASCII.
2. **Move to source after approval.** Edit `src/`, let `bun run dev` rebuild, reload, and confirm the rule applies in the real build.
3. **Redlines** (gear menu, dev build) for spacing work. Measure gaps with `getBoundingClientRect`, then name the numbers.
4. **Review like a tree.** Shoot leaves (one node), then branches (neighbouring nodes together), then the whole page. Compare the same element across pages side by side, in two separate tabs.
5. **Fix every case.** After a correction, find every place with the same problem: other pages, other card types (2-Day, email, pickup), desktop and mobile.
6. **Commit or push only when asked.** Run `bun run build` first. No attribution lines. When the owner says not to wait for approval, apply the skill's taste yourself, verify each change live, and commit and push to `main` without asking.

## Browser (Zen via the zen-devtools MCP)

- If the MCP can't connect, quit and relaunch Zen yourself:
  `osascript -e 'quit app "Zen"'; open -a Zen --env MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 --args --marionette --remote-debugging-port 9222`
- After a relaunch, re-enable Violentmonkey's "Track external edits": open `http://127.0.0.1:8723/dev/costco-cart.dev.user.js`, select the "confirm" page, click "Track external edits", then load Costco in a fresh tab. Costco signs out on quit; ask the owner to sign in.
- Keep one tab per page type. Don't reuse one tab for pages being compared.
- Inject `meta[name=darkreader-lock]` before screenshots.

## Screenshots

- Verification: screenshot the node, not the page.
- README and before/after: the full page as users see it. Blur prices, discounts and private data with temporary CSS. Never hide parts of the page; if something looks bad, that's a design task.
- Frame with the `shot` skill, transparent background, light mode.

## CSS and code

- Nest rules under `:root.cm-on.cm-p-<plugin>`. Use native nesting and media ranges like `(width > 1024px)`.
- Costco uses IDs and `!important`. An `:is()` holding an ID takes the ID's weight. Bun lowers `:is()`, so don't rely on `:is()` tricks for specificity.
- Use child combinators where Costco nests duplicate IDs or `.row` inside `.row`.
- A margin after `clear:both` is swallowed by the float; use padding.
- Dark Reader: border longhands, no gradients.
- Every file under 180 lines. Edit with the Edit tool, never python or sed.
- Costco's header switches to its phone layout below 1024px. Checkout (`/SinglePageCheckoutView`) reuses the cart's `#order-items` and `#order-summary-column`.

## Talking to the owner

- One thing per reply, SMS-short. Lead with the result.
- When asked for thoughts, give a recommendation and wait; don't implement.
- "Could X get Y-like design updates?" asks for the same look on X. Answer in design terms; whether code is reused is beside the point.
- Before and after shots show the same page state: the same cart, the same scroll anchor.
- Report only what you checked. Say "I don't know" when you don't.
