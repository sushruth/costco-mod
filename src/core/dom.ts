export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
export const text = (n: Node | null | undefined) => (n ? (n.textContent ?? '').replace(/\s+/g, ' ').trim() : '');

type Kid = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Kid | Kid[])[]) {
  const n = document.createElement(tag);
  n.dataset.cm = ''; // marks every node this script adds, so the original view can hide them all
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? (n.className = v) : n.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null && k !== false && k !== '') n.append(typeof k === 'object' ? k : String(k));
  return n;
}

export const ic = (name: string, extra = '') => el('i', { class: `ph ph-${name} cm-ic ${extra}`, 'aria-hidden': 'true' });

// Inserts a Phosphor icon once into a Costco node, and gives it a hover title from its own text.
export function addIcon(node: HTMLElement | null | undefined, name: string, where: 'prepend' | 'append' = 'prepend') {
  if (!node) return;
  if (!node.title) node.title = text(node);
  if (!$(':scope > .cm-ic', node)) node[where](ic(name));
}

export const addStyle = (id: string, css: string) => document.head.append(el('style', { id }, css));

// Phosphor icons. Costco's CSP blocks CDN stylesheets but allows inline styles and data: fonts,
// so the userscript manager fetches both @resources at install time and the font is inlined as a data URL.
export function loadIcons() {
  if (typeof GM_getResourceText === 'function') {
    const css = GM_getResourceText('phCss').replace(/src:[\s\S]*?;/, `src: url("${GM_getResourceURL('phFont', false)}") format("woff2");`);
    addStyle('cm-ph', css);
  } else {
    // Local preview: no GM API and no CSP, so the CDN stylesheet loads directly.
    document.head.append(el('link', { rel: 'stylesheet', href: 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css' }));
  }
}

export async function copy(str: string) {
  try { await navigator.clipboard.writeText(str); return true; } catch {}
  const ta = el('textarea', { style: 'position:fixed;opacity:0' });
  ta.value = str; document.body.append(ta); ta.select();
  const ok = document.execCommand('copy'); ta.remove(); return ok;
}
