/**
 * 布线交互回归测试（工作流重排）
 *
 * 覆盖旧版真实断点：
 *  1. finishWire 从未被调用 ⇒ 起点后线永远落不了地。现要求：
 *     点击起点设备 → 点击终点设备 = 生成线缆（两点直连）。
 *  2. 起点约束：空白处点击不得开始布线（wire 没有电气归属）。
 *  3. Esc 取消：清空临时路径，不产生线缆。
 *  4. 设备库拖放：drop application/device 数据 → 按落点生成设备实例。
 *
 * 说明：CanvasViewport 依赖 CadRenderer（canvas 2d）与 requestAnimationFrame 渲染循环，
 * jsdom 下均不可用，故 mock 掉 createRenderer，组件其余逻辑（坐标换算/拾取/交互编排）走真实代码。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { markRaw, nextTick } from 'vue';

// --- mock 渲染器：保留视口写入，空实现绘制 ---
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

// --- mock ContextMenu（Teleport + 全局监听，与被测逻辑无关）---
vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: { name: 'ContextMenuStub', template: '<div />' },
}));

import CanvasViewport from '@/components/canvas/CanvasViewport.vue';
import { useProjectStore } from '@/stores/project';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import type { Drawing, Project } from '@security-survey/shared-types';

function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-wire-test',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 100, path: '/tmp/plan.dxf' },
    // scale 语义 = 图上模型单位 / 实际毫米（无量纲）。1:100 图纸 ⇒ scale=0.01：
    // 图上 100 单位 ↔ 实际 10000mm=10m。
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 10, scale: 0.01, unit: 'm' },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: false, showRuler: false },
    devices: [
      { id: 'devA', drawingId: id, modelId: 'hik-dome-2mp', position: { x: 5000, y: 5000 }, rotation: 0, label: 'C001', remarks: '', createdAt: 1, updatedAt: 1 },
      { id: 'devB', drawingId: id, modelId: 'hik-switch-ds3e0310p', position: { x: 8000, y: 5000 }, rotation: 0, label: 'S001', remarks: '', createdAt: 1, updatedAt: 1 },
    ],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

function makeProject(drawing: Drawing): Project {
  return {
    id: 'proj-wire-test',
    name: '布线测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [drawing],
    settings: { defaultScale: 100, unit: 'm', gridSize: 1000, snapEnabled: true, autoSaveInterval: 0 },
  } as unknown as Project;
}

async function mountCanvas(drawing: Drawing) {
  const projectStore = useProjectStore();
  projectStore.setProject(makeProject(drawing));
  projectStore.setCurrentDrawing(drawing.id);
  const wrapper = mount(CanvasViewport, {
    props: { drawing },
    attachTo: document.body,
  });
  await nextTick();
  return wrapper;
}

/** 模拟画布鼠标点击（main canvas，transform=identity ⇒ screen==model） */
async function click(wrapper: any, model: { x: number; y: number }) {
  const canvas = wrapper.find('.main-canvas');
  await canvas.trigger('mousedown', { clientX: model.x, clientY: model.y, button: 0 });
  await canvas.trigger('mouseup', { clientX: model.x, clientY: model.y, button: 0 });
}

async function move(wrapper: any, model: { x: number; y: number }) {
  const canvas = wrapper.find('.main-canvas');
  await canvas.trigger('mousemove', { clientX: model.x, clientY: model.y });
}

function vm(wrapper: any) {
  return wrapper.vm as unknown as {
    tool: string;
    setActiveTool: (t: string) => void;
    tempWirePath: { x: number; y: number }[];
    wireStartId: string | null;
    wireHint: string | null;
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
});

describe('布线交互（点选式）', () => {
  it('两点直连：起点设备 → 终点设备生成 cat6 线缆并落库', async () => {
    const drawing = makeDrawing('dw-1');
    const wrapper = await mountCanvas(drawing);
    const view = vm(wrapper);
    // jsdom 下 defineExpose 经 wrapper.vm 直调
    view.setActiveTool('wire');

    await click(wrapper, { x: 5000, y: 5000 }); // 起点：devA
    expect(wrapper.vm as any).toBeTruthy();
    const projectStore = useProjectStore();
    expect(projectStore.currentDrawing?.wiring.cables.length).toBe(0);

    await move(wrapper, { x: 6500, y: 5000 }); // 橡皮筋预览（不成线）
    await click(wrapper, { x: 8000, y: 5000 }); // 终点：devB ⇒ 完成

    const cables = projectStore.currentDrawing?.wiring.cables || [];
    expect(cables.length).toBe(1);
    expect(cables[0].startDeviceId).toBe('devA');
    expect(cables[0].endDeviceId).toBe('devB');
    expect(cables[0].type).toBe('cat6');
    // 3000 模型单位 × scale(0.1 m/单位) = 300m（snap 后无折点：path=[start,end]）
    expect(cables[0].length).toBeCloseTo(300, 0);
    // 完成后回到选择工具、临时状态清空
    expect(view.tool).toBe('select');
    expect(view.tempWirePath.length).toBe(0);
    wrapper.unmount();
  });

  it('起点在空白处：不开始布线，提示落点约束', async () => {
    const drawing = makeDrawing('dw-2');
    const wrapper = await mountCanvas(drawing);
    vm(wrapper).setActiveTool('wire');

    await click(wrapper, { x: 100, y: 100 }); // 无设备处

    expect(view(wrapper).wireHint).toBeTruthy();
    expect(useProjectStore().currentDrawing?.wiring.cables.length).toBe(0);
    wrapper.unmount();
  });

  function view(wrapper: any) {
    return vm(wrapper);
  }

  it('Esc 取消：清空临时路径，不生成线缆', async () => {
    const drawing = makeDrawing('dw-3');
    const wrapper = await mountCanvas(drawing);
    vm(wrapper).setActiveTool('wire');

    await click(wrapper, { x: 5000, y: 5000 }); // 起点 devA
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    await nextTick();

    expect(vm(wrapper).tool).toBe('select');
    expect(vm(wrapper).tempWirePath.length).toBe(0);
    expect(useProjectStore().currentDrawing?.wiring.cables.length).toBe(0);
    wrapper.unmount();
  });

  it('中间折点：点击空白加折点，终点成线含全部路径', async () => {
    const drawing = makeDrawing('dw-4');
    const wrapper = await mountCanvas(drawing);
    vm(wrapper).setActiveTool('wire');

    await click(wrapper, { x: 5000, y: 5000 });       // 起点
    await click(wrapper, { x: 6000, y: 6000 });       // 折点（snap 到 6000,6000）
    await click(wrapper, { x: 8000, y: 5000 });       // 终点 devB

    const cables = useProjectStore().currentDrawing?.wiring.cables || [];
    expect(cables.length).toBe(1);
    expect(cables[0].path.length).toBe(3);
    wrapper.unmount();
  });
});

describe('设备库拖放', () => {
  it('drop application/device → 按落点生成设备实例', async () => {
    const drawing = makeDrawing('dw-5');
    const wrapper = await mountCanvas(drawing);
    const deviceLib = useDeviceLibraryStore();

    const device = deviceLib.allDevices.find(d => d.category === 'rack');
    expect(device).toBeTruthy(); // 内置机柜存在

    const dataTransfer = {
      types: ['application/device'],
      getData: (t: string) => (t === 'application/device' ? JSON.stringify(device) : ''),
    };
    const canvas = wrapper.find('.main-canvas');
    await canvas.trigger('drop', { dataTransfer, clientX: 2500, clientY: 2500 });

    const devices = useProjectStore().currentDrawing?.devices || [];
    expect(devices.length).toBe(3); // 2 预置 + 1 新放
    const placed = devices[devices.length - 1];
    expect(placed.modelId).toBe(device!.id);
    expect(placed.position).toEqual({ x: 3000, y: 3000 }); // snap 到 1000 网格：Math.round(2500/1000)*1000
    wrapper.unmount();
  });
});
