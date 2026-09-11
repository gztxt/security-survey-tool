/**
 * runDxfExport 参数契约测试（T3 涉及文件清单的可选项）
 *
 * 锁定两件事：
 *  1. DXF 一定走 window.api.export.dxf（主进程直调），**绝不**经
 *     export:request / delegateExportToRenderer 那条 120s 往返通道（AC-5）；
 *  2. 传给主进程的载荷形状：project + 全量 drawingIds + dxfLayers 五开关 + autoSave:false
 *     （由渲染进程统一弹保存框，避免双弹框）。
 *  3. 勾选 dxf 时 include.dxfOverlay 与 formats 必须同时置位（否则 exporter 静默不产出）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useExportStore } from '@/stores/export';
import type { Project } from '@security-survey/shared-types';

function makeProject(): Project {
  return {
    id: 'proj-dxf',
    name: 'DXF 契约项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [
      { id: 'd1', projectId: 'proj-dxf', name: '1F', floor: '1F', order: 0 } as any,
      { id: 'd2', projectId: 'proj-dxf', name: '2F', floor: '2F', order: 1 } as any,
    ],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 0 },
  };
}

function installBridge(dxfImpl?: (options: any) => Promise<any>) {
  const dxf = vi.fn(async (_options: any) => dxfImpl
    ? dxfImpl(_options)
    : ({
        success: true,
        files: [{ path: '标注overlay.dxf', format: 'dxf', size: 12, dataBase64: 'eA==' }],
        errors: [],
      }));
  const on = vi.fn((_channel: string, _cb: (...args: any[]) => void) => () => {});
  const api: any = {
    project: { save: vi.fn(async () => ({ success: true })), saveAs: vi.fn(async () => ({ success: true })), open: vi.fn() },
    drawing: { import: vi.fn(async () => []), calibrate: vi.fn(async () => null) },
    cad: { parse: vi.fn(async () => null), convertDwg: vi.fn(async () => null) },
    export: {
      dxf,
      pointMap: vi.fn(async () => ({ success: true, files: [], errors: [] })),
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
      showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: 'C:/tmp/overlay.dxf' })),
      grantPaths: vi.fn(async (p: string[]) => ({ granted: p, rejected: [] })),
    },
    shell: { openExternal: vi.fn(async () => true), showItemInFolder: vi.fn(async () => true) },
    on,
    off: vi.fn(),
    send: vi.fn(),
  };
  (window as any).api = api;
  (window as any).electronAPI = api;
  return { api, dxf, on };
}

describe('export store · DXF 契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('runDxfExport：载荷含 project / 全量 drawingIds / dxfLayers 五开关 / autoSave=false，且不经 export:request', async () => {
    const store = useExportStore();
    const { dxf, on } = installBridge();
    const project = makeProject();

    const res: any = await store.runDxfExport({ project, layers: { devices: true, cables: true } });

    expect(dxf).toHaveBeenCalledTimes(1);
    const payload = dxf.mock.calls[0][0];
    expect(payload.project.id).toBe('proj-dxf');
    expect(payload.drawingIds).toEqual(['d1', 'd2']);
    expect(payload.dxfLayers).toEqual({ devices: true, cables: true, trays: true, wells: true, texts: true });
    expect(payload.autoSave).toBe(false);
    // AC-5：整个 DXF 链路只注册过渲染进程侧的通用监听，绝不能出现 export:request
    const channels = on.mock.calls.map(c => c[0]);
    expect(channels).not.toContain('export:request');
    // 落盘由渲染进程保存框完成
    expect(res.success).toBe(true);
    expect((window as any).api.fs.showSaveDialog).toHaveBeenCalledTimes(1);
    expect((window as any).api.fs.writeFile).toHaveBeenCalledTimes(1);
    // 历史落到 export-history-v2 且 format=dxf
    const history = JSON.parse(localStorage.getItem('export-history-v2') || '[]');
    expect(history[0].format).toBe('dxf');
  });

  it('runDxfExport：主进程报错时如实透出，不假装成功', async () => {
    const store = useExportStore();
    installBridge(async () => ({ success: false, files: [], errors: ['DXF 导出缺少项目数据'] }));
    const res = await store.runDxfExport({ project: makeProject() });
    expect(res.success).toBe(false);
    expect(res.errors.join()).toContain('缺少项目数据');
  });

  it('runExport(types 含 dxf)：include.dxfOverlay 与 formats 同步置位（不静默丢产物）', async () => {
    const store = useExportStore();
    const { api, dxf } = installBridge();
    const res = await store.runExport({
      project: makeProject(),
      types: ['pointmap', 'dxf'],
      format: 'pdf',
    });

    // 内容项 dxf → 走主进程直调；同时 baseOptions 必须补上 formats:'dxf'
    expect(dxf).toHaveBeenCalledTimes(1);
    const pointMapOptions = api.export.pointMap.mock.calls[0][0];
    expect(pointMapOptions.include.dxfOverlay).toBe(true);
    expect(pointMapOptions.formats).toContain('dxf');
    expect(pointMapOptions.formats).toContain('pdf');
    expect(res.success).toBe(true);
  });

  it('未勾选 dxf 时不得置位 include.dxfOverlay（老项目产物集合不变，向后兼容）', async () => {
    const store = useExportStore();
    const { api, dxf } = installBridge();
    await store.runExport({ project: makeProject(), types: ['pointmap'], format: 'pdf' });
    expect(dxf).not.toHaveBeenCalled();
    expect(api.export.pointMap.mock.calls[0][0].include.dxfOverlay).toBe(false);
    expect(api.export.pointMap.mock.calls[0][0].formats).toEqual(['pdf']);
  });
});

