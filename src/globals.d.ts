declare function GM_getValue<T>(key: string, fallback: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_getResourceText(name: string): string;
declare function GM_getResourceURL(name: string, isBlobUrl?: boolean): string;
declare function GM_registerMenuCommand(caption: string, onClick: () => void): void;

// CSS modules map each class in the file to its hashed name. Plain .css files are side-effect imports.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.css';
