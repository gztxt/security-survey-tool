/**
 * export:request 监听签名契约测试 —— 主进程委托导出的握手不能断在第一跳
 *
 * 背景（真实链路事故）：preload 的 `on()` 会把 IpcRendererEvent 剥掉再转发
 *    const listener = (_event, ...args) => callback(...args);
 * 因此页面侧回调只收到**一个**实参即 payload。而 ExportService 曾按 Electron 原生
 * 习惯写成 `(_event, payload) => ...`，于是 payload 恒为 undefined，
 * `payload.requestId` 在构造实参时就抛错 —— 且抛在 handleExportRequest 的 try 之外：
 *   · 不向主进程回任何消息 ⇒ 主进程 delegate 白白等到 120s 超时，点位图导出失败；
 *   · 同时给渲染进程留下一枚未捕获异常。
 * 真机冒烟 R10/R15 就是这么红的。本文件把这个签名契约钉死。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('exportService · export:request 监听签名', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  /** 安装一个模仿 preload 语义的 api：回调只收到 payload（事件已剥离） */
  function installApi() {
    const handlers: Record<string, ((...args: any[]) => void)[]> = {};
    const sent: any[] = [];
    const api: any = {
      on: (channel: string, cb: (...args: any[]) => void) => {
        (handlers[channel] = handlers[channel] || []).push(cb);
        return () => {};
      },
      send: (channel: string, payload: any) => { sent.push({ channel, payload }); },
    };
    (window as any).electronAPI = api;
    (window as any).api = api;
    return { handlers, sent };
  }

  it('preload 只回传 payload（无 event）时，回调仍能正确取到 requestId 并回包', async () => {
    const { handlers, sent } = installApi();
    // 导入服务单例：构造时会注册 export:request 监听
    await import('@/services/exportService');

    const list = handlers['export:request'] || [];
    expect(list.length).toBeGreaterThan(0);

    // 严格按 preload 的调用方式：**只传一个** payload
    const handler = list[0];
    await handler({ requestId: 'req-1', channel: 'export:pointMap', options: {} });

    // 无论导出本身成败，都必须回一个带 requestId 的包（否则主进程会卡死到超时）
    await new Promise(r => setTimeout(r, 0));
    const res = sent.find(s => s.channel === 'export:response');
    expect(res).toBeTruthy();
    expect(res.payload.requestId).toBe('req-1');
  });

  it('同一 payload 再怎么多传参数都不影响取参（不依赖 event 位）', async () => {
    const { handlers, sent } = installApi();
    await import('@/services/exportService');
    const handler = (handlers['export:request'] || [])[0];

    // 即使误传了两个参数（旧误解写法的调用面），第一个实参仍是 payload
    await handler({ requestId: 'req-2', channel: 'export:fovMap', options: {} }, undefined);
    await new Promise(r => setTimeout(r, 0));
    const res = sent.find(s => s.channel === 'export:response');
    expect(res?.payload.requestId).toBe('req-2');
  });
});
