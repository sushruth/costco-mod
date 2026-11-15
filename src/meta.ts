import pkg from '../package.json';

const REPO = 'https://github.com/sushruth/costco-mod';
const RAW = 'https://raw.githubusercontent.com/sushruth/costco-mod/main/costco-cart.user.js';
const PH = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular';

export const meta = [
  ['name', 'Costco Cart, Cleaned Up'],
  ['namespace', REPO],
  ['version', pkg.version],
  ['description', pkg.description],
  ['match', 'https://www.costco.com/*'],
  ['run-at', 'document-idle'],
  ['resource', `phCss  ${PH}/style.css`],
  ['resource', `phFont ${PH}/Phosphor.woff2`],
  ['grant', 'GM_getResourceText'],
  ['grant', 'GM_getResourceURL'],
  ['grant', 'GM_getValue'],
  ['grant', 'GM_setValue'],
  ['grant', 'GM_registerMenuCommand'],
  ['license', 'MIT'],
  ['homepageURL', REPO],
  ['supportURL', `${REPO}/issues`],
  ['updateURL', RAW],
  ['downloadURL', RAW],
];

// The dev build drops the update URLs, so the manager never swaps it for the published copy.
export const banner = (dev = false) => ['// ==UserScript==',
  ...meta.filter(([k]) => !(dev && /^(update|download)URL$/.test(k))).map(([k, v]) => `// @${k.padEnd(12)} ${v}`),
  '// ==/UserScript=='].join('\n');
