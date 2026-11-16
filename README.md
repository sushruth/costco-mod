# Costco, Cleaned Up

This userscript makes costco.com denser and easier to scan. Every page gets a two-row header, search results fit more products with a price per unit, and the cart gets shorter.

<sub>1. Install a userscript extension for your browser</sub>

<table><tr><th><sub>Chrome</sub></th><th><sub>Firefox</sub></th><th><sub>Edge</sub></th><th><sub>Safari</sub></th></tr><tr>
<td><a href="https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag"><img src="https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/resources/icon.svg" width="20" height="20" alt="Violentmonkey for Chrome" title="Violentmonkey for Chrome"></a> <a href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo"><img src="https://www.tampermonkey.net/images/icon.png" width="20" height="20" alt="Tampermonkey for Chrome" title="Tampermonkey for Chrome"></a> <a href="https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf"><img src="https://docs.scriptcat.org/img/logo.png" width="20" height="20" alt="ScriptCat for Chrome" title="ScriptCat for Chrome"></a></td>
<td><a href="https://addons.mozilla.org/firefox/addon/violentmonkey/"><img src="https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/resources/icon.svg" width="20" height="20" alt="Violentmonkey for Firefox" title="Violentmonkey for Firefox"></a> <a href="https://addons.mozilla.org/firefox/addon/tampermonkey/"><img src="https://www.tampermonkey.net/images/icon.png" width="20" height="20" alt="Tampermonkey for Firefox" title="Tampermonkey for Firefox"></a> <a href="https://addons.mozilla.org/firefox/addon/scriptcat/"><img src="https://docs.scriptcat.org/img/logo.png" width="20" height="20" alt="ScriptCat for Firefox" title="ScriptCat for Firefox"></a></td>
<td><a href="https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjdenkkddmbclomhiblgggliao"><img src="https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/resources/icon.svg" width="20" height="20" alt="Violentmonkey for Edge" title="Violentmonkey for Edge"></a> <a href="https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd"><img src="https://www.tampermonkey.net/images/icon.png" width="20" height="20" alt="Tampermonkey for Edge" title="Tampermonkey for Edge"></a> <a href="https://microsoftedge.microsoft.com/addons/detail/scriptcat/liilgpjgabokdklappibcjfablkpcekh"><img src="https://docs.scriptcat.org/img/logo.png" width="20" height="20" alt="ScriptCat for Edge" title="ScriptCat for Edge"></a></td>
<td><a href="https://apps.apple.com/app/userscripts/id1463298887"><img src="https://raw.githubusercontent.com/quoid/userscripts/main/public/ext/safari-15/images/icon-64.png" width="20" height="20" alt="Userscripts for Safari" title="Userscripts for Safari"></a> <a href="https://apps.apple.com/app/tampermonkey/id6738342400"><img src="https://www.tampermonkey.net/images/icon.png" width="20" height="20" alt="Tampermonkey for Safari" title="Tampermonkey for Safari"></a></td>
</tr></table>

<sub>2. Then install the userscript</sub>

[![Install](https://img.shields.io/badge/Install-userscript-005DAB?style=for-the-badge)](https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js)

<sub>What it looks like</sub>

[<img src="docs/hero.png" alt="The restyled home, search, savings, product and cart pages, and the phone header" width="100%">](SCREENSHOTS.md)

[Before and after, page by page](SCREENSHOTS.md). The screenshots blur the warehouse, ZIP code and the cart's prices and discounts.

## Install

1. Install a userscript extension for your browser from the table at the top.
2. Click **Install userscript** under it.

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
