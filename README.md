# Costco, Cleaned Up

This userscript makes costco.com denser and easier to scan. Every page gets a two-row header, and the cart gets shorter.

[![Install](https://img.shields.io/badge/Install-userscript-005DAB?style=for-the-badge)](https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js)

**Before**

| Home | Search | Cart |
| --- | --- | --- |
| <img src="docs/home-before.png" alt="Costco home page before" width="280"> | <img src="docs/search-before.png" alt="Costco search results before" width="280"> | <img src="docs/cart-before.png" alt="Costco cart before" width="280"> |

**After**

| Home | Search | Cart |
| --- | --- | --- |
| <img src="docs/home-after.png" alt="Costco home page after" width="280"> | <img src="docs/search-after.png" alt="Costco search results after" width="280"> | <img src="docs/cart-after.png" alt="Costco cart after" width="280"> |

Home and search show the top of the page; the cart shows the whole page. The screenshots blur the warehouse, ZIP code and the cart's prices and discounts.

## Install

1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/), [Tampermonkey](https://www.tampermonkey.net/), [ScriptCat](https://docs.scriptcat.org/) or [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) for Safari.
2. Click **Install** above.

The script is tested with Violentmonkey. To turn parts on or off, use the gear next to the cart.

## Privacy

The script sends requests only to costco.com. It keeps what it learns in your browser. At install, your userscript manager downloads the [Phosphor](https://phosphoricons.com/) icon font from unpkg.com one time.

## Development

```
bun install
bun run dev
```

CLAUDE.md has the architecture and workflow.

## License

MIT
