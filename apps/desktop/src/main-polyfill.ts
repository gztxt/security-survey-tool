// 主进程最小 DOM polyfill（必须作为 main.ts 的第一个 import）
//
// 背景：Electron 主进程是纯 Node 环境，没有 window / document / navigator /
// localStorage。部分浏览器向的 UMD 依赖（例如 @security-survey/cad-parser 依赖的
// dxf-parser，其 webpack bundle 内嵌的 loglevel 会探测 window）在模块顶层就访问
// window，主进程加载时会直接抛 `ReferenceError: window is not defined`。
//
// 为什么必须是独立模块：
// ESM 的 import 声明会被提升（hoist）到模块顶部，因此写在同一个文件的 import 之前的
// polyfill 语句，实际执行时机反而在所有被导入模块之后，形同虚设。把 polyfill 放进独立
// 模块并由 main.ts 的第一个 import 引入，ESM 规范保证该模块会先于后续依赖求值，
// Rollup 打 bundle 时也会据此把它排在最前面。
const g = globalThis as any;

if (typeof g.window === 'undefined') {
  g.window = g;
}

if (typeof g.self === 'undefined') {
  g.self = g;
}

if (typeof g.document === 'undefined') {
  g.document = {
    cookie: '',
    createElement: () => ({}),
    addEventListener: () => {},
  };
}

if (typeof g.navigator === 'undefined') {
  g.navigator = { userAgent: 'electron-main', language: 'zh-CN' };
}

if (typeof g.localStorage === 'undefined') {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

export {};
