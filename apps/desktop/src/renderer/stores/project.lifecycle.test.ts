/**
 * 项目列表闭环回归测试
 *
 * 历史缺陷（本文件即为防回归）：
 *  - ProjectsView 用 generateMockProjects() 编造 28 个假项目，真实保存的项目一个都不显示；
 *  - "复制项目"只弹 toast + 跳新建页，索引里塞一条没有 drawings 的记录，点进去是空项目；
 *  - "导出项目""归档""刷新"全是 TODO；
 *  - 索引不记落盘路径 ⇒ 即便列表显示了项目也打不开（loadProject 读的是文件路径，不是项目 id）。
 *
 * 口径：只断言"用户能观察到的后果"，不断言实现细节。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from './project';
import type { Drawing, Project } from '@security-survey/shared-types';

function makeDrawing(id: string, withCalibration = true): Drawing {
  return {
    id,
    projectId: 'proj-lc',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 1, path: 'C:/tmp/plan.dxf' } as Drawing['file'],
    calibration: {
      isCalibrated: withCalibration,
      point1: { x: 0, y: 0 },
      point2: { x: 100, y: 0 },
      realDistance: 10,
      scale: 0.01,
      unit: 'm',
    },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: false },
    devices: [],
    wiring: { id: 'w-' + id, drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

function makeProject(drawings?: Drawing[]): Project {
  return {
    id: 'proj-lc',
    name: '生命周期项目',
    createdAt: 1000,
    updatedAt: 1000,
    drawings: drawings || [makeDrawing('draw-1')],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 0 },
    meta: { code: 'PRJ-2026-001', type: 'video-surveillance', description: '测试', location: '北京' },
  } as any;
}

/** 安装最小 window.api：可控的 project.save + fs.readFile */
function installBridge(opts: { savePath?: string; files?: Record<string, string> } = {}) {
  const saved: Array<{ data: any; path?: string }> = [];
  const api = {
    project: {
      save: vi.fn(async (data: any, path?: string) => {
        saved.push({ data, path });
        return { success: true, path: opts.savePath || 'C:/projects/a.survey' };
      }),
      saveAs: vi.fn(async () => ({ success: true, path: 'C:/projects/as.survey' })),
      open: vi.fn(async () => null),
    },
    drawing: { import: vi.fn(async () => []), calibrate: vi.fn(async () => null) },
    export: {},
    fs: {
      readFile: vi.fn(async (p: string) => opts.files?.[p] ?? ''),
      readFileBase64: vi.fn(async () => ''),
      writeFile: vi.fn(async () => true),
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: '' })),
      grantPaths: vi.fn(async (paths: string[]) => ({ granted: paths, rejected: [] })),
    },
    shell: { openExternal: vi.fn(async () => true), openPath: vi.fn(async () => true) },
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    send: vi.fn(),
  };
  (window as any).api = api;
  (window as any).electronAPI = api;
  return { api, saved };
}

describe('项目列表闭环 · 索引与重开', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    delete (window as any).api;
    delete (window as any).electronAPI;
  });

  it('① 保存成功后，索引项必须带上落盘路径与台账字段（列表页唯一的真相源）', async () => {
    installBridge();
    const store = useProjectStore();
    store.setProject(makeProject());
    const res = await store.saveProject();
    expect(res.success).toBe(true);

    const item = store.projectIndex.find(p => p.id === 'proj-lc') as any;
    expect(item).toBeTruthy();
    expect(item.path).toBe('C:/projects/a.survey');
    expect(item.name).toBe('生命周期项目');
    expect(item.code).toBe('PRJ-2026-001');
    expect(item.type).toBe('video-surveillance');
    expect(item.drawingCount).toBe(1);
    expect(item.calibratedDrawingCount).toBe(1);
  });

  it('② 未保存过的索引项不可重开：报错必须指向"先保存"，而不是白屏空画布', async () => {
    installBridge();
    const store = useProjectStore();
    store.setProject(makeProject());
    // setProject 会 touchIndex；此时从未落盘 ⇒ path 为空
    const item = store.projectIndex[0] as any;
    expect(item.path).toBeFalsy();

    const res = await store.openProjectById('proj-lc');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('保存');
  });

  it('③ 重开走的是文件路径：loadProject(path) 成功 → 索引标记 lastOpened', async () => {
    const project = makeProject();
    const { api } = installBridge({ files: { 'C:/projects/a.survey': JSON.stringify(project) } });
    const store = useProjectStore();
    store.setProject(project);
    await store.saveProject();

    store.clearProject();
    expect(store.currentProject).toBeNull();

    const res = await store.openProjectById('proj-lc');
    expect(res.ok).toBe(true);
    expect((api.fs.readFile as any).mock.calls[0][0]).toBe('C:/projects/a.survey');
    expect(store.currentProject?.id).toBe('proj-lc');
    expect((store.projectIndex[0] as any).lastOpened).toBeGreaterThan(0);
  });

  it('④ 文件被移动/删除时，重开失败并说明原因，不把空项目塞进当前状态', async () => {
    installBridge({ files: {} });
    const store = useProjectStore();
    store.setProject(makeProject());
    await store.saveProject();
    store.clearProject();

    const res = await store.openProjectById('proj-lc');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/读取|失败/);
    expect(store.currentProject).toBeNull();
  });

  it('⑤ 切换项目必须重指当前图纸：旧项目的 drawingId 不属于新项目', async () => {
    installBridge({
      files: {
        'C:/projects/a.survey': JSON.stringify(makeProject([makeDrawing('draw-1')])),
        'C:/projects/b.survey': JSON.stringify({ ...makeProject(), id: 'proj-b', drawings: [makeDrawing('draw-9')] }),
      },
    });
    const store = useProjectStore();
    store.setProject(makeProject());
    expect(store.currentDrawingId).toBe('draw-1');
    await store.saveProject();

    const b = { ...makeProject([makeDrawing('draw-9')]), id: 'proj-b' } as any;
    store.setProject(b);
    expect(store.currentDrawingId).toBe('draw-9');

    // 再切回 a：不得停留在 draw-9（否则画布指向不存在的图纸）
    const ok = await store.openProjectById('proj-lc');
    expect(ok.ok).toBe(true);
    expect(store.currentDrawingId).toBe('draw-1');
  });

  it('⑥ 复制项目产出可打开的完整副本，且副本不与原项目共享落盘路径（防覆盖原件）', async () => {
    const { api } = installBridge({ files: { 'C:/projects/a.survey': JSON.stringify(makeProject()) } });
    const store = useProjectStore();
    store.setProject(makeProject());
    await store.saveProject();

    const res = await store.duplicateProject('proj-lc');
    expect(res.ok).toBe(true);
    const copyId = res.newId!;
    expect(copyId).not.toBe('proj-lc');

    // 副本必须真的被载入（有图纸），不是"索引里的一条空记录"
    expect(store.currentProject?.id).toBe(copyId);
    expect(store.currentProject?.drawings.length).toBe(1);
    expect(store.currentProject?.drawings[0].projectId).toBe(copyId);
    expect(store.currentProject?.name).toContain('副本');

    // 关键安全属性：副本没有 path ⇒ 保存时必然弹另存为，不会覆盖原文件
    const copyItem = store.projectIndex.find(p => p.id === copyId) as any;
    expect(copyItem).toBeTruthy();
    expect(copyItem.path).toBeFalsy();

    // 副本尚未落盘 ⇒ 不可"重开"，但已在列表中（真实内容靠当前内存态）
    const reopened = await store.openProjectById(copyId);
    expect(reopened.ok).toBe(false);
    // 源项目仍在列表且路径未变：复制不得把原项目的落盘路径分给副本
    const origin = store.projectIndex.find(p => p.id === 'proj-lc') as any;
    expect(origin.path).toBe('C:/projects/a.survey');
    void api;
  });

  it('⑪ 复制必须带上底图：内存态副本不得被落盘剥离逻辑掏空背景', async () => {
    installBridge();
    const store = useProjectStore();
    const project = makeProject();
    // 模拟一张已内联底图的位图图元（imagePath 有值 ⇒ 重水合会跳过，属"已在内存"）
    (project.drawings[0] as any).entities = [
      { type: 'IMAGE', layer: 'BASEMAP', x: 0, y: 0, width: 100, height: 100, imageData: 'data:image/png;base64,AAAA', data: { imagePath: 'C:/tmp/plan.png' } },
    ];
    store.setProject(project);
    await store.saveProject();

    const res = await store.duplicateProject('proj-lc');
    expect(res.ok).toBe(true);
    const copied = store.currentProject as any;
    expect(copied.drawings[0].entities.length).toBe(1);
    expect(copied.drawings[0].entities[0].imageData).toContain('data:image/png;base64');
  });

  it('⑦ 归档只是索引属性：不重写磁盘文件，且保存一次不会把归档态抹掉', async () => {
    installBridge();
    const store = useProjectStore();
    store.setProject(makeProject());
    await store.saveProject();

    expect(store.setProjectArchived('proj-lc', true)).toBe(true);
    expect((store.projectIndex[0] as any).archived).toBe(true);

    await store.saveProject();
    expect((store.projectIndex[0] as any).archived).toBe(true);
    expect((store.projectIndex[0] as any).path).toBe('C:/projects/a.survey');

    expect(store.setProjectArchived('not-exist', true)).toBe(false);
  });

  it('⑧ 从列表删除项目：只移除索引记录，绝不删磁盘文件', async () => {
    const { api } = installBridge();
    const store = useProjectStore();
    store.setProject(makeProject());
    await store.saveProject();
    expect(store.projectIndex.length).toBe(1);

    store.deleteProject('proj-lc');
    expect(store.projectIndex.length).toBe(0);
    expect(api.fs.writeFile as any).not.toHaveBeenCalled();
    expect(localStorage.getItem('projects-index')).not.toContain('proj-lc');
  });

  it('⑨ 索引持久化到 localStorage ⇒ 重新载入页面后列表仍有项目', async () => {
    installBridge();
    const store = useProjectStore();
    store.setProject(makeProject());
    await store.saveProject();

    const raw = JSON.parse(localStorage.getItem('projects-index') || '[]');
    expect(raw[0].id).toBe('proj-lc');
    expect(raw[0].path).toBe('C:/projects/a.survey');
  });

  it('⑩ 无桥环境（纯浏览器）：保存明确失败，索引不留假路径', async () => {
    const store = useProjectStore();
    store.setProject(makeProject());
    const res = await store.saveProject();
    expect(res.success).toBe(false);
    expect((store.projectIndex[0] as any).path).toBeFalsy();
  });
});
