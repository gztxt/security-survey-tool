/**
 * saveProject 契约测试（T2 验收标准 10）
 *
 * 覆盖三条关键契约（对应 PRD US-05 / 架构决策 4）：
 *  1. 保存成功 → 清除脏标记、记录落盘路径、且载荷向后兼容（不新增顶层字段、
 *     运行期附加信息 knownPath/__filePath/imageData 一律剔除）。
 *  2. 保存失败或用户取消对话框 → 脏标记必须保留（★PRD §5 风险：静默丢改动）。
 *  3. 无桥环境（纯浏览器 / 单测）→ 明确失败、不弹框、不抛异常；
 *     已有落盘路径时二次保存把路径透传给主进程（不再弹对话框）。
 *
 * 通过 mock window.api 完成，不依赖 Electron 实机。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from './project';
import type { CalibrationData, Drawing, Project } from '@security-survey/shared-types';

const PROJECT_TOP_KEYS = ['id', 'name', 'createdAt', 'updatedAt', 'drawings', 'settings'];

function makeCalibration(): CalibrationData {
  return {
    isCalibrated: true,
    point1: { x: 0, y: 0 },
    point2: { x: 100, y: 0 },
    realDistance: 10,
    scale: 10,
    unit: 'm',
  };
}

function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-contract',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: {
      originalName: 'plan.dxf',
      format: 'dxf',
      size: 1024,
      path: 'C:/tmp/plan.dxf',
      thumbnailPath: '',
    } as Drawing['file'],
    calibration: makeCalibration(),
    layers: [{ name: '0', color: 7, visible: true, locked: false, lineType: 'CONTINUOUS', lineWeight: 0.25 }],
    // 运行期内嵌的位图内容：必须在落盘前被剔除
    entities: [
      { type: 'LINE', layer: 'BASEMAP', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      { type: 'IMAGE', layer: 'BASEMAP', x: 0, y: 0, width: 100, height: 100, imageData: 'data:image/png;base64,AAAA' },
    ] as unknown as Drawing['entities'],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: false },
    devices: [],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeProject(): Project {
  return {
    id: 'proj-contract',
    name: '契约测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [makeDrawing('draw-1')],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
  };
}

/** 安装一个可控的 window.api 桥桩，返回各 mock 以便断言 */
function installBridge(impl: { save?: (data: any, path?: string) => Promise<any> }) {
  const showOpenDialog = vi.fn(async () => ({ canceled: true, filePaths: [] }));
  const save = vi.fn(impl.save ?? (async (data: any, path?: string) => ({ success: true, path: path || 'C:/tmp/out.survey' })));
  const api = {
    project: {
      save,
      saveAs: vi.fn(async () => ({ success: true, path: 'C:/tmp/as.survey' })),
      open: vi.fn(async () => null),
    },
    drawing: { import: vi.fn(async () => []), calibrate: vi.fn(async () => null) },
    export: { dxf: vi.fn(async () => ({ success: true })) },
    fs: {
      readFile: vi.fn(async () => ''),
      readFileBase64: vi.fn(async () => ''),
      writeFile: vi.fn(async () => true),
      showOpenDialog,
      showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: '' })),
      grantPaths: vi.fn(async (paths: string[]) => ({ granted: paths, rejected: [] })),
    },
    shell: { openExternal: vi.fn(async () => true), showItemInFolder: vi.fn(async () => true) },
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    send: vi.fn(),
  };
  (window as any).api = api;
  (window as any).electronAPI = api;
  return { api, save, showOpenDialog };
}

describe('project store · saveProject 契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    delete (window as any).api;
    delete (window as any).electronAPI;
  });

  it('① 保存成功：清脏 + 记录路径 + 载荷向后兼容（无新增顶层字段、剔除运行期数据）', async () => {
    // Arrange
    const store = useProjectStore();
    const project = makeProject();
    (project as any).knownPath = 'C:/legacy/leak.survey';
    (project as any).__filePath = 'C:/legacy/leak.survey';
    store.setProject(project);
    store.addDevice({
      id: 'dev-1', drawingId: 'draw-1', modelId: 'cam-dome-2mp',
      position: { x: 5, y: 5 }, rotation: 0, label: '摄像机 1', status: 'planned',
    } as any);
    expect(store.isDirty).toBe(true);
    const { save } = installBridge({});

    // Act
    const res: any = await store.saveProject();

    // Assert — 契约 1a：成功回传 + 清脏 + 记路径
    expect(res.success).toBe(true);
    expect(res.path).toBe('C:/tmp/out.survey');
    expect(store.isDirty).toBe(false);
    expect(store.projectFilePath).toBe('C:/tmp/out.survey');
    expect(store.lastSavedAt).toBeTypeOf('number');
    expect(store.lastSaveError).toBe(null);

    // 契约 1b：向后兼容 —— 顶层字段集合不得扩张
    const payload = save.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([...PROJECT_TOP_KEYS].sort());

    // 契约 1c：运行期信息（落盘路径、内嵌位图）绝不进载荷
    expect(payload.knownPath).toBeUndefined();
    expect(payload.__filePath).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('data:image/png;base64');
    expect(JSON.stringify(payload)).not.toContain('C:/legacy/leak.survey');
  });

  it('② 保存失败 / 用户取消：脏标记必须保留且带错误原因（不静默丢改动）', async () => {
    // Arrange — 主进程返回"用户取消"
    const store = useProjectStore();
    store.setProject(makeProject());
    store.addDevice({ id: 'dev-2', drawingId: 'draw-1', modelId: 'cam-gun-2mp', position: { x: 1, y: 1 }, rotation: 0, label: '枪机', status: 'planned' } as any);
    installBridge({ save: async () => ({ success: false, error: '用户取消保存' }) });
    expect(store.isDirty).toBe(true);

    // Act
    const res: any = await store.saveProject();

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toBe('用户取消保存');
    expect(store.isDirty).toBe(true);                 // ★ 关键回归点
    expect(store.lastSaveError).toBe('用户取消保存');
    expect(store.lastSavedAt).toBe(null);             // 未成功不得伪造"已保存"时间
  });

  it('② 补充：主进程抛异常时同样保留脏标记（异常不得被吞成成功）', async () => {
    const store = useProjectStore();
    store.setProject(makeProject());
    store.markDirty();
    installBridge({ save: async () => { throw new Error('EACCES: permission denied'); } });

    const res: any = await store.saveProject();

    expect(res.success).toBe(false);
    expect(res.error).toContain('EACCES');
    expect(store.isDirty).toBe(true);
    expect(store.saving).toBe(false);                 // finally 必须复位，否则后续保存永久被拒
  });

  it('③ 无桥环境：明确失败、不弹框、不抛异常；已有路径时二次保存透传路径不再弹框', async () => {
    // Arrange — 纯浏览器/单测环境：完全没有 window.api
    const store = useProjectStore();
    store.setProject(makeProject());
    store.markDirty();

    // Act
    const res: any = await store.saveProject();

    // Assert — 契约 3a：不假装成功（旧的"假成功"会掩盖 D-1 类故障）
    expect(res.success).toBe(false);
    expect(res.error).toContain('不支持保存');
    expect(store.isDirty).toBe(true);

    // 契约 3b：有落盘路径时，保存应把路径作为第二参透传给主进程（主进程据此跳过对话框）
    const store2 = useProjectStore();
    store2.setProject(makeProject());
    store2.markDirty();
    const { save, showOpenDialog } = installBridge({});
    store2.projectFilePath = 'C:/tmp/known.survey';
    const res2: any = await store2.saveProject();

    expect(res2.success).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toBe('C:/tmp/known.survey');
    expect(showOpenDialog).not.toHaveBeenCalled();    // 渲染进程侧不得自行弹框

    // 契约 3c：路径命中 localStorage 索引时同样免弹框
    localStorage.setItem('project-paths', JSON.stringify({ 'proj-contract': 'C:/tmp/mapped.survey' }));
    const store3 = useProjectStore();
    store3.setProject(makeProject());
    store3.markDirty();
    const { save: save3 } = installBridge({});
    const res3: any = await store3.saveProject();
    expect(res3.success).toBe(true);
    expect(save3.mock.calls[0][1]).toBe('C:/tmp/mapped.survey');
  });
});
