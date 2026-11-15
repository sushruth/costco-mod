# Costco, Cleaned Up

This userscript makes costco.com denser and easier to scan. Every page gets a two-row header, search results fit more products with a price per unit, and the cart gets shorter.

[![Install](https://img.shields.io/badge/Install-userscript-005DAB?style=for-the-badge)](https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js)

<img src="docs/header.png" alt="The header: category row on top, then logo, search and account links" width="100%">

<img src="docs/tiles.png" alt="Search results: compact tiles with badges on the image and a price per 100 sheets" width="100%">

| Filters | Cart |
| --- | --- |
| <img src="docs/filters.png" alt="Filter sidebar with a price slider and star rating" width="180"> | <img src="docs/cart.png" alt="Cart with compact item cards and an order review panel" width="620"> |

[Before and after, page by page](SCREENSHOTS.md). The screenshots blur the warehouse, ZIP code and the cart's prices and discounts.

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
