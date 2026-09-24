// 测试环境补丁：jsdom(v24) + vitest(v1.2) 下 window.localStorage 为「空对象」且无方法，
// settings store / project store 依赖 getItem/setItem，此处注入内存版实现。
// 同时补 matchMedia（settings.applyTheme 依赖），避免 store 实例化即抛。
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
});
Object.defineProperty(window, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
});

// jsdom 的 HTMLCanvasElement.getContext 默认抛「Not implemented」（本机 canvas 原生
// 模块未生效），组件每次重绘都刷一屏无意义堆栈，淹没真实失败信息。
// 这里注入 no-op 2D 上下文：属性读写放行，方法调用返回 undefined。
if (typeof HTMLCanvasElement !== 'undefined') {
  const noopCtx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, p) => (p in t ? t[p] : () => undefined),
    set: (t, p, v) => { t[p] = v; return true },
  });
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, _type: string) {
    return noopCtx as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
    writable: true,
  });
}
