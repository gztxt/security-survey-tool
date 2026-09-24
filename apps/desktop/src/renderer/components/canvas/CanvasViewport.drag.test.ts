/**
 * 画布设备拖拽 + 工具状态单一真相源 回归测试
 *
 * 覆盖两个真实缺陷：
 *  1. 设备拖拽从未实现（device-moved 只声明未 emit，store 侧
 *     updateDevicePosition/commitDevicePositions 两个函数无人调用）⇒ 用户在图纸上
 *     拖动摄像头没有任何反应。现要求：按下选中设备并位移 ⇒ 位置真的改变、
 *     且整次拖拽只算一步撤销历史（不是每帧一步）。
 *  2. 画布工具此前是组件私有 ref，与 uiStore.activeTool（工具栏高亮读取处）脱节，
 *     侧栏「绘制桥架」因此只能是个空函数 ⇒ 点了没反应。现要求：uiStore.setTool
 *     即等于切工具，任何入口（工具栏/快捷键/侧栏）都走同一状态。
 *
 * 与 CanvasViewport.wiring.test.ts 同理：mock 掉 CadRenderer 与 rAF 渲染循环，
 * 组件其余逻辑（坐标换算/拾取/交互编排/历史）走真实代码。
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
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import type { Drawing, Project } from '@security-survey/shared-types';

function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-drag',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 100, path: '/tmp/plan.dxf' },
    // 1:1 校准 ⇒ 模型坐标即屏幕坐标，测试可用整数位置直接断言
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 100, scale: 1, unit: 'm' },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: false, showRuler: false },
    devices: [
      { id: 'devA', drawingId: id, modelId: 'hik-dome-2mp', position: { x: 5000, y: 5000 }, rotation: 0, label: 'C001', remarks: '', createdAt: 1, updatedAt: 1 },
      { id: 'devB', drawingId: id, modelId: 'hik-switch-ds3e0310p', position: { x: 9000, y: 5000 }, rotation: 0, label: 'S001', remarks: '', createdAt: 1, updatedAt: 1 },
    ],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

async function mountCanvas(drawing: Drawing) {
  const projectStore = useProjectStore();
  projectStore.setProject({
    id: 'proj-drag',
    name: '拖拽测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [drawing],
    settings: { defaultScale: 100, unit: 'm', gridSize: 1, snapEnabled: false, autoSaveInterval: 0 },
  } as unknown as Project);
  projectStore.setCurrentDrawing(drawing.id);
  // 关掉吸附：网格吸附会把落点吸到格点，位置断言应聚焦"拖动是否生效"
  const settings = useSettingsStore();
  settings.snapEnabled = false;
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

function devicePos(id: string) {
  const d = useProjectStore().currentDrawing?.devices?.find(x => x.id === id);
  return d ? { x: d.position.x, y: d.position.y } : null;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
});

describe('设备拖拽', () => {
  it('按下设备并位移 ⇒ 位置真实改变，且整次拖拽只记一步历史', async () => {
    const drawing = makeDrawing('dw-drag-1');
    const wrapper = await mountCanvas(drawing);
    const store = useProjectStore();
    expect(store.canUndo).toBe(false);

    await down(wrapper, { x: 5000, y: 5000 });
    await moveTo(wrapper, { x: 5200, y: 5100 });
    await up(wrapper, { x: 5200, y: 5100 });

    expect(devicePos('devA')).toEqual({ x: 5200, y: 5100 });
    // 一次拖拽 = 一步撤销：撤销后回到原位置
    expect(store.canUndo).toBe(true);
    store.undo();
    expect(devicePos('devA')).toEqual({ x: 5000, y: 5000 });
    expect(store.canUndo).toBe(false);
    wrapper.unmount();
  });

  it('拖拽中途多次 mousemove 不产生多步历史（只有松手收口）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-drag-2'));
    const store = useProjectStore();
    await down(wrapper, { x: 5000, y: 5000 });
    for (const p of [[5100, 5000], [5200, 5000], [5300, 5050], [5400, 5100]]) {
      await moveTo(wrapper, { x: p[0], y: p[1] });
    }
    await up(wrapper, { x: 5400, y: 5100 });
    expect(devicePos('devA')).toEqual({ x: 5400, y: 5100 });
    store.undo();
    expect(devicePos('devA')).toEqual({ x: 5000, y: 5000 });
    wrapper.unmount();
  });

  it('点击设备（无位移）只选择不移动，不产生历史', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-drag-3'));
    const store = useProjectStore();
    await down(wrapper, { x: 5000, y: 5000 });
    await up(wrapper, { x: 5000, y: 5000 });
    expect(devicePos('devA')).toEqual({ x: 5000, y: 5000 });
    expect(store.canUndo).toBe(false);
    expect(useUiStore().selectedDeviceId).toBe('devA');
    wrapper.unmount();
  });

  it('拖拽后设备与线缆跟随：move 事件对后级广播（属性面板/自动布线依赖）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-drag-4'));
    await down(wrapper, { x: 5000, y: 5000 });
    await moveTo(wrapper, { x: 6000, y: 6000 });
    await up(wrapper, { x: 6000, y: 6000 });
    const moved = wrapper.emitted('device-moved');
    expect(moved?.length).toBe(1);
    expect((moved![0][0] as any).id).toBe('devA');
    wrapper.unmount();
  });

  it('松手在画布外（移出到侧栏）也要收尾，不能持续跟随鼠标', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-drag-5'));
    await down(wrapper, { x: 5000, y: 5000 });
    await moveTo(wrapper, { x: 5200, y: 5100 });
    // 画布外松手：只有 window 级兜底才能结束拖拽
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40, buttons: 0 }));
    await nextTick();
    const after = devicePos('devA');
    await moveTo(wrapper, { x: 7777, y: 7777 });
    expect(devicePos('devA')).toEqual(after);
    wrapper.unmount();
  });
});

describe('工具状态单一真相源', () => {
  it('uiStore.setTool 即切画布工具（侧栏/高级菜单/工具栏共用一个状态）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-tool-1'));
    const ui = useUiStore();
    ui.setTool('tray');
    await nextTick();
    expect((wrapper.vm as any).tool).toBe('tray');
    ui.setTool('wire');
    await nextTick();
    expect((wrapper.vm as any).tool).toBe('wire');
    wrapper.unmount();
  });

  it('侧栏「绘制桥架」按钮真实把画布切进桥架模式（此前是空函数）', async () => {
    const ui = useUiStore();
    ui.setTool('select');
    const wrapper = mount(WiringPanel, { attachTo: document.body });
    const btn = wrapper.findAll('button').find(b => (b.text() || '').includes('绘制桥架'));
    expect(btn, '桥架区应有「绘制桥架」入口').toBeTruthy();
    await btn!.trigger('click');
    expect(ui.activeTool).toBe('tray');
    wrapper.unmount();
  });
});
