/**
 * 画布快照 WYSIWYG 契约测试：captureSnapshot 剔除编辑器装饰 + 不污染项目状态
 *
 * 快照是导出（点位图/视野图/PDF）的唯一视觉真源。两个真实缺陷的防线：
 *  1. 快照不得带编辑器装饰（网格/标尺/选中高亮）—— 那是"删不掉的元素"的
 *     实际来源（导出 PDF 里出现编辑器辅助元素，用户在编辑页删不掉）。
 *  2. 截快照不得把项目标脏 —— 旧写法替换 viewport.value 触发 deep watcher
 *     → markDirty()，导出前截个快照就亮"未保存"徽章，属交互级假信号。
 *
 * renderer mock 出 getter/setter 对：断言"传入禁装饰视口 → 截图 → 恢复原视口"
 * 的完整往返，以及 selected/hover 集合的清空与恢复顺序。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

// 渲染器 mock：记录 setViewport / render 调用序列，getter 返回可断言状态
const rendererState = {
  viewport: null as any,
  selectedEntities: new Set(['ent-1']),
  selectedDevices: new Set(['dev-1']),
  hoveredEntity: 'ent-2' as string | null,
  hoveredDevice: 'dev-2' as string | null,
  renderCount: 0,
};
const rendererMock = {
  setEntities: vi.fn(),
  setDevices: vi.fn(),
  setDeviceCategories: vi.fn(),
  setCables: vi.fn(),
  setWeakPoints: vi.fn(),
  setCableTrays: vi.fn(),
  setLayerVisibility: vi.fn(),
  registerImage: vi.fn(),
  setViewport: vi.fn((v: any) => { rendererState.viewport = v; }),
  setHoveredEntity: vi.fn((id: string | null) => { rendererState.hoveredEntity = id; }),
  setHoveredDevice: vi.fn((id: string | null) => { rendererState.hoveredDevice = id; }),
  setSelectedEntities: vi.fn((ids: Set<string>) => { rendererState.selectedEntities = ids; }),
  setSelectedDevices: vi.fn((ids: Set<string>) => { rendererState.selectedDevices = ids; }),
  getSelectedEntities: vi.fn(() => new Set(rendererState.selectedEntities)),
  getSelectedDevices: vi.fn(() => new Set(rendererState.selectedDevices)),
  getHoveredEntity: vi.fn(() => rendererState.hoveredEntity),
  getHoveredDevice: vi.fn(() => rendererState.hoveredDevice),
  pickEntity: vi.fn(() => null),
  render: vi.fn(() => { rendererState.renderCount += 1; }),
  resize: vi.fn(),
  destroy: vi.fn(),
  // 快照换算率：每像素对应多少毫米（真实 CadRenderer 由 transform.a / dpr 推出）
  getMmPerPixel: vi.fn(() => 10),
};
vi.mock('@security-survey/cad-renderer', () => ({
  CadRenderer: class {},
  createRenderer: () => rendererMock,
}));
vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: { name: 'ContextMenuStub', template: '<div />' },
}));

// toDataURL mock：jsdom canvas 无 2D 实现，返回确定 dataURL 供断言"有产物"
const TODataURL_STUB = 'data:image/png;base64,SNAPSHOT-STUB';
vi.stubGlobal('URL', URL); // 保持全局 URL 可用（jsdom 已有）

import CanvasViewport from '@/components/canvas/CanvasViewport.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import type { Drawing, Project } from '@security-survey/shared-types';

function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-snap',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 100, path: '/tmp/plan.dxf' },
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 100, scale: 1, unit: 'm' },
    layers: [],
    entities: [],
    // 编辑态开着网格与标尺：快照必须临时关掉它们
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
    devices: [
      { id: 'dev-1', drawingId: id, modelId: 'hik-dome-2mp', position: { x: 5000, y: 5000 }, rotation: 0, label: 'C001', remarks: '', createdAt: 1, updatedAt: 1 },
    ],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

async function mountCanvas(drawing: Drawing) {
  const projectStore = useProjectStore();
  projectStore.setProject({
    id: 'proj-snap',
    name: '快照测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [drawing],
    settings: { defaultScale: 100, unit: 'm', gridSize: 1, snapEnabled: false, autoSaveInterval: 0 },
  } as unknown as Project);
  projectStore.setCurrentDrawing(drawing.id);
  const settings = useSettingsStore();
  settings.snapEnabled = false;
  const wrapper = mount(CanvasViewport, { props: { drawing }, attachTo: document.body });
  await nextTick();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
  rendererState.selectedEntities = new Set(['ent-1']);
  rendererState.selectedDevices = new Set(['dev-1']);
  rendererState.hoveredEntity = 'ent-2';
  rendererState.hoveredDevice = 'dev-2';
  rendererState.renderCount = 0;
});

describe('captureSnapshot · WYSIWYG 契约', () => {
  it('快照期间渲染器收到禁装饰视口（网格/标尺关闭），截完恢复编辑视口', async () => {
    const drawing = makeDrawing('dw-snap-1');
    const wrapper = await mountCanvas(drawing);
    const expose = (wrapper.vm as any) as {
      captureSnapshot: () => { dataUrl: string; mmPerPx: number; widthPx: number; heightPx: number } | null;
    };

    // jsdom 的 canvas.toDataURL 不可用（无 2D 上下文实现），stub 成确定值
    const cv = wrapper.find('.main-canvas').element as HTMLCanvasElement;
    cv.toDataURL = vi.fn(() => TODataURL_STUB) as any;

    const out = expose.captureSnapshot();
    // 新形态：快照携带 mmPerPx 换算率，导出侧据此合成尺寸标识
    expect(out).not.toBeNull();
    expect(out!.dataUrl).toBe(TODataURL_STUB);
    expect(out!.mmPerPx).toBe(10);

    // setViewport 调用序列：禁装饰视口（后一次）→ 恢复编辑视口（最终态）
    const vpCalls = rendererMock.setViewport.mock.calls.map(c => c[0]);
    expect(vpCalls.at(-2)).toMatchObject({ showGrid: false, showRuler: false });
    expect(vpCalls.at(-1)).toMatchObject({ showGrid: true, showRuler: true });
    // 截图前后各 render 一次
    expect(rendererMock.render.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('快照清空选中/悬停高亮，截完恢复原集合', async () => {
    const drawing = makeDrawing('dw-snap-2');
    const wrapper = await mountCanvas(drawing);
    const expose = (wrapper.vm as any) as { captureSnapshot: () => string | null };
    const cv = wrapper.find('.main-canvas').element as HTMLCanvasElement;
    cv.toDataURL = vi.fn(() => TODataURL_STUB) as any;

    expose.captureSnapshot();

    // 最终态恢复：选中/悬停回到截图前的值
    expect(rendererState.selectedEntities.has('ent-1')).toBe(true);
    expect(rendererState.selectedDevices.has('dev-1')).toBe(true);
    expect(rendererState.hoveredEntity).toBe('ent-2');
    expect(rendererState.hoveredDevice).toBe('dev-2');
    // 中途确实发生过清空（setSelectedEntities 至少收到过空集合）
    const emptyCalled = rendererMock.setSelectedEntities.mock.calls.some(c => c[0].size === 0);
    expect(emptyCalled).toBe(true);
  });

  it('截快照不得把项目标脏（isDirty 保持 false）', async () => {
    const drawing = makeDrawing('dw-snap-3');
    const wrapper = await mountCanvas(drawing);
    const store = useProjectStore();
    store.isDirty = false;

    const expose = (wrapper.vm as any) as { captureSnapshot: () => string | null };
    const cv = wrapper.find('.main-canvas').element as HTMLCanvasElement;
    cv.toDataURL = vi.fn(() => TODataURL_STUB) as any;

    expose.captureSnapshot();
    expect(store.isDirty).toBe(false);
  });

  it('画布或渲染器缺失时安全返回 null（不抛错）', async () => {
    const drawing = makeDrawing('dw-snap-4');
    const wrapper = await mountCanvas(drawing);
    const expose = (wrapper.vm as any) as { captureSnapshot: () => string | null };
    // toDataURL 抛错路径：模拟截图失败
    const cv = wrapper.find('.main-canvas').element as HTMLCanvasElement;
    cv.toDataURL = vi.fn(() => { throw new Error('canvas tainted'); }) as any;
    expect(expose.captureSnapshot()).toBeNull();
  });

  it('渲染器未提供换算率 ⇒ 快照照旧产出且 mmPerPx=0（只缺比例尺，不丢导出图）', async () => {
    const drawing = makeDrawing('dw-snap-5');
    const wrapper = await mountCanvas(drawing);
    const expose = (wrapper.vm as any) as { captureSnapshot: () => any };
    const cv = wrapper.find('.main-canvas').element as HTMLCanvasElement;
    cv.toDataURL = vi.fn(() => TODataURL_STUB) as any;

    // 模拟 renderer 缺少 getMmPerPixel（旧版实现 / 后续重构漏实现）
    const backup = (rendererMock as any).getMmPerPixel;
    delete (rendererMock as any).getMmPerPixel;
    try {
      const out = expose.captureSnapshot();
      expect(out).not.toBeNull();
      expect(out.dataUrl).toBe(TODataURL_STUB);
      expect(out.mmPerPx).toBe(0);
    } finally {
      (rendererMock as any).getMmPerPixel = backup;
    }
  });

  it('换算率为 NaN/0 ⇒ 归一化为 0（不把脏值穿给导出层）', async () => {
    const drawing = makeDrawing('dw-snap-6');
    const wrapper = await mountCanvas(drawing);
    const expose = (wrapper.vm as any) as { captureSnapshot: () => any };
    const cv = wrapper.find('.main-canvas').element as HTMLCanvasElement;
    cv.toDataURL = vi.fn(() => TODataURL_STUB) as any;

    const backup = (rendererMock as any).getMmPerPixel;
    (rendererMock as any).getMmPerPixel = () => Number.NaN;
    try {
      const out = expose.captureSnapshot();
      expect(out!.mmPerPx).toBe(0);
      expect(Number.isFinite(out!.mmPerPx)).toBe(true);
    } finally {
      (rendererMock as any).getMmPerPixel = backup;
    }
  });
});
