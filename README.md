# Costco, Cleaned Up

This userscript makes costco.com denser and easier to scan. Every page gets a two-row header, search results fit more products with a price per unit, and the cart gets shorter.

[![Install](https://img.shields.io/badge/Install-userscript-005DAB?style=for-the-badge)](https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js)

[<img src="docs/hero.png" alt="The restyled home, search, savings, product and cart pages, and the phone header" width="100%">](SCREENSHOTS.md)

[Before and after, page by page](SCREENSHOTS.md). The screenshots blur the warehouse, ZIP code and the cart's prices and discounts.

## Install

1. Install a userscript manager: <img src="https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/resources/icon.svg" width="14" height="14" alt=""> [Violentmonkey](https://violentmonkey.github.io/), <img src="https://www.tampermonkey.net/images/icon.png" width="14" height="14" alt=""> [Tampermonkey](https://www.tampermonkey.net/), <img src="https://docs.scriptcat.org/img/logo.png" width="14" height="14" alt=""> [ScriptCat](https://docs.scriptcat.org/) or <img src="https://raw.githubusercontent.com/quoid/userscripts/main/public/ext/safari-15/images/icon-64.png" width="14" height="14" alt=""> [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) for Safari.
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
