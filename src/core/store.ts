// Everything stays in this browser: the userscript manager's storage, or localStorage in the preview.
export const kv = typeof GM_getValue === 'function'
  ? { get: <T>(k: string) => GM_getValue<T | null>(k, null), set: (k: string, v: unknown) => GM_setValue(k, v) }
  : {
    get: <T>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
    set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

// Per-tab switches kept in localStorage: the view toggle, dev mode, redlines.
export const flag = {
  get: (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } },
  set: (k: string, on: boolean) => { try { on ? localStorage.setItem(k, '1') : localStorage.removeItem(k); } catch {} },
};
