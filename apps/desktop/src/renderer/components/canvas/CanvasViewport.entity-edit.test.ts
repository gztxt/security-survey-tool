/**
 * 底图图元「删得掉 / 搬得动」回归测试
 *
 * 用户原始反馈：「有部分页面元素是不需要的 不能编辑 删除部分元素」。
 * 根因：删除图元的循环是空的（deleteSelected 里只有一句注释），
 * 拖动图元也没有任何接线 —— 选中 CAD 图元后既删不掉也搬不动。
 * 本文件在真实组件上锁死这两条交互（CadRenderer 与 rAF 渲染循环 mock 掉，
 * 其余坐标换算 / 拾取 / 交互编排 / 历史走真实代码）：
 *  1. 按下图元并拖动 ⇒ 几何真的位移、bounds 同步、整次拖拽只算一步历史。
 *  2. 选中图元按 Delete ⇒ 图元消失；undo ⇒ 原样回到原下标。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

const rendererMock = {
  setEntities: vi.fn(),
  setDevices: vi.fn(),
  setDeviceCategories: vi.fn(),
  setCables: vi.fn(),
  setWeakPoints: vi.fn(),
  setCableTrays: vi.fn(),
  setLayerVisibility: vi.fn(),
  registerImage: vi.fn(),
  setViewport: vi.fn(),
  setHoveredEntity: vi.fn(),
  setHoveredDevice: vi.fn(),
  setSelectedEntities: vi.fn(),
  setSelectedDevices: vi.fn(),
  pickEntity: vi.fn(() => null),
  render: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
};
vi.mock('@security-survey/cad-renderer', () => ({
  CadRenderer: class {},
  createRenderer: () => rendererMock,
}));
vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: { name: 'ContextMenuStub', template: '<div />' },
}));

import CanvasViewport from '@/components/canvas/CanvasViewport.vue';
import WiringPanel from '@/components/wiring/WiringPanel.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import type { CadEntity, Drawing, Project } from '@security-survey/shared-types';

function line(id: string, x1: number, y1: number, x2: number, y2: number): CadEntity {
  return {
    id,
    type: 'LINE',
    layer: 'WALL',
    color: 256,
    lineType: 'BYLAYER',
    lineWeight: -1,
    visible: true,
    data: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    bounds: {
      minX: Math.min(x1, x2), minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2), maxY: Math.max(y1, y2),
      width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
    },
  } as CadEntity;
}

function makeDrawing(id: string, entities: CadEntity[]): Drawing {
  return {
    id,
    projectId: 'proj-ent',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 100, path: '/tmp/plan.dxf' },
    // 1:1 校准 + 单位阵 ⇒ 屏幕坐标即模型坐标，测试可直接用整数断言
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 100, scale: 1, unit: 'm' },
    layers: [],
    entities,
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: false, showRuler: false },
    devices: [],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

async function mountCanvas(drawing: Drawing) {
  const projectStore = useProjectStore();
  projectStore.setProject({
    id: 'proj-ent',
    name: '图元编辑测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [drawing],
    settings: { defaultScale: 100, unit: 'm', gridSize: 1, snapEnabled: false, autoSaveInterval: 0 },
  } as unknown as Project);
  projectStore.setCurrentDrawing(drawing.id);
  // 关吸附：断言聚焦"拖动是否生效"，不被网格取整干扰
  useSettingsStore().snapEnabled = false;
  const wrapper = mount(CanvasViewport, { props: { drawing }, attachTo: document.body });
  await nextTick();
  return wrapper;
}

const canvas = (w: any) => w.find('.main-canvas');
async function down(w: any, p: { x: number; y: number }) {
  await canvas(w).trigger('mousedown', { clientX: p.x, clientY: p.y, button: 0 });
}
async function moveTo(w: any, p: { x: number; y: number }) {
  await canvas(w).trigger('mousemove', { clientX: p.x, clientY: p.y });
}
async function up(w: any, p: { x: number; y: number }) {
  await canvas(w).trigger('mouseup', { clientX: p.x, clientY: p.y, button: 0 });
}
function pressDelete() {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true }));
}
function ent(id: string): CadEntity | undefined {
  return useProjectStore().currentDrawing?.entities?.find(e => e.id === id);
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
});

describe('底图图元编辑', () => {
  it('① 拖动图元 ⇒ 几何位移且 bounds 同步，整次拖拽只记一步历史', async () => {
    const drawing = makeDrawing('dw-ent-1', [line('e1', 1000, 1000, 2000, 1000)]);
    const wrapper = await mountCanvas(drawing);
    const store = useProjectStore();
    rendererMock.pickEntity.mockReturnValue('e1');
    expect(store.canUndo).toBe(false);

    await down(wrapper, { x: 1000, y: 1000 });
    await moveTo(wrapper, { x: 1200, y: 1100 });
    await up(wrapper, { x: 1200, y: 1100 });

    const moved = ent('e1')!;
    expect((moved.data as any).start).toEqual({ x: 1200, y: 1100 });
    expect((moved.data as any).end).toEqual({ x: 2200, y: 1100 });
    expect(moved.bounds.minX).toBe(1200);
    expect(moved.bounds.maxY).toBe(1100);

    expect(store.canUndo).toBe(true);
    store.undo();
    expect((ent('e1')!.data as any).start).toEqual({ x: 1000, y: 1000 });
    expect(store.canUndo).toBe(false);
    wrapper.unmount();
  });

  it('② 选中图元按 Delete ⇒ 图元消失；undo ⇒ 按原下标回来', async () => {
    const drawing = makeDrawing('dw-ent-2', [
      line('a1', 0, 0, 100, 0),
      line('a2', 0, 0, 0, 100),
      line('a3', 0, 0, 50, 50),
    ]);
    const wrapper = await mountCanvas(drawing);
    const store = useProjectStore();
    rendererMock.pickEntity.mockReturnValue('a2');

    // 原地按下抬起 = 选中（不产生历史）
    await down(wrapper, { x: 0, y: 0 });
    await up(wrapper, { x: 0, y: 0 });
    expect(store.canUndo).toBe(false);

    pressDelete();
    await nextTick();
    expect(store.currentDrawing!.entities.map(e => e.id)).toEqual(['a1', 'a3']);

    store.undo();
    expect(store.currentDrawing!.entities.map(e => e.id)).toEqual(['a1', 'a2', 'a3']);
    wrapper.unmount();
  });

  it('③ 空白处按 Delete 不产生空历史（此前删不存在的图元也会压栈）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-ent-3', [line('b1', 0, 0, 10, 0)]));
    const store = useProjectStore();
    rendererMock.pickEntity.mockReturnValue(null);

    pressDelete();
    await nextTick();
    expect(store.canUndo).toBe(false);
    expect(store.currentDrawing!.entities).toHaveLength(1);
    wrapper.unmount();
  });

  it('④ 多帧 mousemove 只产生一步历史（不是每帧一步）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-ent-4', [line('c1', 0, 0, 100, 0)]));
    const store = useProjectStore();
    rendererMock.pickEntity.mockReturnValue('c1');

    await down(wrapper, { x: 0, y: 0 });
    await moveTo(wrapper, { x: 20, y: 0 });
    await moveTo(wrapper, { x: 40, y: 10 });
    await moveTo(wrapper, { x: 60, y: 20 });
    await up(wrapper, { x: 60, y: 20 });

    // 总位移 = 最后一次鼠标位置相对起点，而不是各帧累加
    expect((ent('c1')!.data as any).start).toEqual({ x: 60, y: 20 });
    expect(store.canUndo).toBe(true);
    store.undo();
    expect(store.canUndo).toBe(false);
    wrapper.unmount();
  });
});
