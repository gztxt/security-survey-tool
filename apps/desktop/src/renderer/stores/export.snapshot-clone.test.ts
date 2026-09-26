/**
 * 快照跨 IPC 契约测试 —— 「An object could not be cloned」回归防线
 *
 * 起因：尺寸标识需求把快照从「纯 dataURL 字符串」升级成「带 mmPerPx 的元数据对象」。
 * 字符串是原始值，塞进 ref 读出来仍是原值；但**对象**会被 Vue 包成 reactive Proxy。
 * Electron 的结构化克隆拒绝 Proxy ⇒ ipcRenderer.invoke 直接抛
 * "An object could not be cloned"，整张点位图静默导出失败（真机冒烟 R15 抓到）。
 *
 * 本文件锁定：出站载荷里的快照必须是**纯对象**（响应式已剥离），
 * 这是 Phase B 引入对象形态快照后新增的硬性约束。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { isReactive } from 'vue';
import { useExportStore } from '@/stores/export';
import { useProjectStore } from '@/stores/project';
import type { Project } from '@security-survey/shared-types';

const META = { dataUrl: 'data:image/png;base64,SNAP', mmPerPx: 10, widthPx: 800, heightPx: 600 };

function makeProject(): Project {
  return {
    id: 'proj-ipc',
    name: 'IPC 契约项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [{ id: 'd1', projectId: 'proj-ipc', name: '1F', floor: '1F', order: 0 } as any],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 0 },
  };
}

/** 安装 window.api 桥接，并捕获真正要送去主进程的 pointMap 载荷 */
function installBridge() {
  const pointMap = vi.fn(async (_options: any) => ({ success: true, files: [] as any[], errors: [] as string[] }));
  const api: any = {
    project: { save: vi.fn(async () => ({ success: true })), saveAs: vi.fn(async () => ({ success: true })), open: vi.fn() },
    drawing: { import: vi.fn(async () => []), calibrate: vi.fn(async () => null) },
    cad: { parse: vi.fn(async () => null), convertDwg: vi.fn(async () => null) },
    export: {
      dxf: vi.fn(async () => ({ success: true, files: [], errors: [] })),
      pointMap,
      fovMap: vi.fn(async () => ({ success: true, files: [], errors: [] })),
      topology: vi.fn(async () => ({ success: true, files: [], errors: [] })),
      deviceList: vi.fn(async () => ({ success: true, files: [], errors: [] })),
      cableSchedule: vi.fn(async () => ({ success: true, files: [], errors: [] })),
      report: vi.fn(async () => ({ success: true, files: [], errors: [] })),
      saveFile: vi.fn(async () => ({ success: true })),
    },
    fs: {
      readFile: vi.fn(async () => ''),
      readFileBase64: vi.fn(async () => ''),
      writeFile: vi.fn(async () => true),
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: '' })),
      grantPaths: vi.fn(async (p: string[]) => ({ granted: p, rejected: [] })),
    },
    shell: { openExternal: vi.fn(async () => true), showItemInFolder: vi.fn(async () => true) },
    on: vi.fn((_c: string, _cb: any) => () => {}),
    off: vi.fn(),
    send: vi.fn(),
  };
  (window as any).api = api;
  (window as any).electronAPI = api;
  return { api, pointMap };
}

describe('export store · 快照出站 IPC 契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('对象形态快照出站时已剥离响应式（不能被 IPC 的克隆器拒绝）', async () => {
    const { pointMap } = installBridge();
    const projectStore = useProjectStore();
    // 走真实 store：写入 ref 后再读出来必然是 Vue reactive Proxy
    projectStore.setDrawingSnapshot('d1', { ...META });
    const reactiveSnaps = projectStore.drawingSnapshots;
    expect(isReactive(reactiveSnaps)).toBe(true);

    const store = useExportStore();
    await store.runExport({ project: makeProject(), types: ['pointmap'], format: 'png', canvasSnapshots: reactiveSnaps as any });

    const call = pointMap.mock.calls[0];
    expect(call).toBeTruthy();
    const payload: any = call?.[0];
    const out = payload.canvasSnapshots['d1'];
    // 核心断言：出站对象**不是** reactive Proxy
    expect(isReactive(out)).toBe(false);
    // 数据完整，且只有约定的四个原始值字段
    expect(out.dataUrl).toBe(META.dataUrl);
    expect(out.mmPerPx).toBe(10);
    expect(Object.keys(out).sort()).toEqual(['dataUrl', 'heightPx', 'mmPerPx', 'widthPx']);
  });

  it('出站快照是与 store 解耦的副本（后续 store 变更不回写到 IPC 载荷）', async () => {
    const { pointMap } = installBridge();
    const projectStore = useProjectStore();
    projectStore.setDrawingSnapshot('d1', { ...META });

    const store = useExportStore();
    await store.runExport({
      project: makeProject(),
      types: ['pointmap'],
      format: 'png',
      canvasSnapshots: projectStore.drawingSnapshots as any,
    });

    const snapshot = (pointMap.mock.calls[0]?.[0] as any).canvasSnapshots['d1'];
    // 导出后再改 store，出站副本不应受影响
    projectStore.setDrawingSnapshot('d1', { dataUrl: 'data:image/png;base64,CHANGED', mmPerPx: 99, widthPx: 1, heightPx: 1 });
    expect(snapshot.mmPerPx).toBe(10);
    expect(snapshot.dataUrl).toBe(META.dataUrl);
  });

  it('旧形态纯字符串快照原样透出（向后兼容，不被改写）', async () => {
    const { pointMap } = installBridge();
    const store = useExportStore();
    await store.runExport({
      project: makeProject(),
      types: ['pointmap'],
      format: 'png',
      canvasSnapshots: { d1: 'data:image/png;base64,OLD-FORM' },
    });
    expect((pointMap.mock.calls[0]?.[0] as any).canvasSnapshots['d1']).toBe('data:image/png;base64,OLD-FORM');
  });

  it('project 载荷也必须是纯对象（reactive Proxy 会被 IPC 拒绝，实测结论）', async () => {
    const { pointMap } = installBridge();
    const projectStore = useProjectStore();
    // 真实 store 里取项目：深响应式树
    projectStore.setProject({
      id: 'proj-reactive',
      name: '响应式项目',
      createdAt: 1,
      updatedAt: 1,
      drawings: [{ id: 'd1', projectId: 'proj-reactive', name: '1F', floor: '1F', order: 0 } as any],
      settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 0 },
    } as any);

    const project = projectStore.currentProject!;
    expect(isReactive(project)).toBe(true);

    const store = useExportStore();
    await store.runExport({ project, types: ['pointmap'], format: 'png' });

    const payload = pointMap.mock.calls[0]?.[0] as any;
    expect(isReactive(payload.project)).toBe(false);
    expect(payload.project.id).toBe('proj-reactive');
  });

  it('无快照 ⇒ 出站空对象（不是 undefined，不把 Proxy 空 ref 漏出去）', async () => {
    const { pointMap } = installBridge();
    const store = useExportStore();
    await store.runExport({ project: makeProject(), types: ['pointmap'], format: 'png' });
    expect((pointMap.mock.calls[0]?.[0] as any).canvasSnapshots).toEqual({});
  });
});
