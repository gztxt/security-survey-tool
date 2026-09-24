/**
 * 按键所有权回归测试（P1 键位冲突治理）
 *
 * 背景（审计发现，2026-09-12）：
 *  1. CanvasViewport 的画布工具键 switch(e.code) 不判修饰键 ⇒
 *     - Ctrl+T（宣称"新建图纸"）同时把画布切到"桥架"工具；
 *     - Ctrl+V（宣称"粘贴"）静默把当前工具改成"选择"；
 *     - Ctrl+W / Ctrl+S 等组合键虽然此处无 KeyW+ctrl 分支，但同类风险存在。
 *  2. 工具栏按钮点击后保留焦点，此后按空格/回车会同时触发
 *     "按钮 click"和"画布抓手/桥架完成"，一次按键两件事。
 *  3. v/w 曾是双重绑定：DrawingView 的"视图模式"假状态 + 画布工具选择，
 *     按一次 v 两件事同时发生（其中一件还是假的）。DrawingView 侧已删除，
 *     本文件锁定"v/w 唯一主人是画布工具层"。
 *
 * 断言全部走真实 window keydown 派发（与产品代码同一入口），
 * 不直接调用内部函数。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import type { Drawing, Project } from '@security-survey/shared-types';

const rendererMock = {
  setEntities: vi.fn(), setDevices: vi.fn(), setDeviceCategories: vi.fn(),
  setCables: vi.fn(), setWeakPoints: vi.fn(), setCableTrays: vi.fn(),
  setLayerVisibility: vi.fn(), registerImage: vi.fn(), setViewport: vi.fn(),
  setHoveredEntity: vi.fn(), setHoveredDevice: vi.fn(),
  setSelectedEntities: vi.fn(), setSelectedDevices: vi.fn(),
  pickEntity: vi.fn(() => null), render: vi.fn(), resize: vi.fn(), destroy: vi.fn(),
};
vi.mock('@security-survey/cad-renderer', () => ({
  CadRenderer: class {},
  createRenderer: () => rendererMock,
}));
vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: { name: 'ContextMenuStub', template: '<div />' },
}));

import CanvasViewport from '@/components/canvas/CanvasViewport.vue';
import { useProjectStore } from '@/stores/project';

function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-keys',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 100, path: '/tmp/plan.dxf' },
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 10, scale: 0.01, unit: 'm' },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: false, showRuler: false },
    devices: [
      { id: 'devA', drawingId: id, modelId: 'hik-dome-2mp', position: { x: 5000, y: 5000 }, rotation: 0, label: 'C001', remarks: '', createdAt: 1, updatedAt: 1 },
    ],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

async function mountCanvas(drawing: Drawing) {
  const projectStore = useProjectStore();
  projectStore.setProject({
    id: 'proj-keys', name: '键位测试', createdAt: 1, updatedAt: 1, drawings: [drawing],
    settings: { defaultScale: 100, unit: 'm', gridSize: 1000, snapEnabled: true, autoSaveInterval: 0 },
  } as unknown as Project);
  projectStore.setCurrentDrawing(drawing.id);
  const wrapper = mount(CanvasViewport, { props: { drawing }, attachTo: document.body });
  await vi.waitFor(() => {
    expect((wrapper.vm as any).tool).toBeTruthy();
  });
  return wrapper;
}

/** 向 window 派发真实 keydown（产品代码监听的就是 window） */
function press(opts: { code?: string; key?: string; ctrlKey?: boolean; shiftKey?: boolean; target?: EventTarget }) {
  const ev = new KeyboardEvent('keydown', {
    code: opts.code ?? '',
    key: opts.key ?? '',
    ctrlKey: !!opts.ctrlKey,
    shiftKey: !!opts.shiftKey,
    bubbles: true,
    cancelable: true,
  });
  (opts.target ?? window).dispatchEvent(ev);
}

function toolOf(wrapper: any): string {
  return (wrapper.vm as any).tool;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
  document.body.style.cursor = '';
});

describe('画布工具键的修饰键所有权', () => {
  it('裸键 v/d/w/t 仍正常切工具（功能未被误伤）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k1'));
    press({ code: 'KeyV', key: 'v' });
    expect(toolOf(wrapper)).toBe('select');
    press({ code: 'KeyD', key: 'd' });
    expect(toolOf(wrapper)).toBe('device');
    press({ code: 'KeyW', key: 'w' });
    expect(toolOf(wrapper)).toBe('wire');
    press({ code: 'KeyT', key: 't' });
    expect(toolOf(wrapper)).toBe('tray');
  });

  it('Shift+T = 桥架、Shift+W = 弱电井：与帮助表/按钮 title 宣称一致', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k2'));
    press({ code: 'KeyV', key: 'v' });
    expect(toolOf(wrapper)).toBe('select');
    press({ code: 'KeyT', key: 'T', shiftKey: true });
    expect(toolOf(wrapper)).toBe('tray');
    press({ code: 'KeyV', key: 'v' });
    press({ code: 'KeyW', key: 'W', shiftKey: true });
    expect(toolOf(wrapper)).toBe('well');
    // 裸 W 仍是布线（不与 Shift+W 抢语义）
    press({ code: 'KeyW', key: 'w' });
    expect(toolOf(wrapper)).toBe('wire');
  });

  it('Ctrl+T（新建图纸）不再顺手把画布切到桥架工具', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k3'));
    press({ code: 'KeyT', key: 't', ctrlKey: true });
    expect(toolOf(wrapper)).toBe('select');
  });

  it('Ctrl+V（粘贴）不再静默改掉当前工具', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k4'));
    press({ code: 'KeyW', key: 'w' });
    expect(toolOf(wrapper)).toBe('wire');
    press({ code: 'KeyV', key: 'v', ctrlKey: true });
    expect(toolOf(wrapper)).toBe('wire'); // 保持原工具
  });

  it('Ctrl+Z / Ctrl+Y 撤销重做仍归画布处理（守卫顺序正确）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k5'));
    const store = useProjectStore();
    const before = store.currentDrawing?.devices.length ?? 0;
    store.addDevice({ modelId: 'm-x', position: { x: 1000, y: 1000 }, label: 'C009', rotation: 0 } as any);
    expect(store.currentDrawing?.devices.length).toBe(before + 1);
    press({ code: 'KeyZ', key: 'z', ctrlKey: true });
    expect(store.currentDrawing?.devices.length).toBe(before);
    press({ code: 'KeyY', key: 'y', ctrlKey: true });
    expect(store.currentDrawing?.devices.length).toBe(before + 1);
  });
});

describe('Space/Enter 与焦点控件互不劫持', () => {
  it('焦点在按钮上时空格不抢抓手工具、回车不误触桥架完成', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k6'));
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    press({ code: 'Space', key: ' ', target: btn });
    expect(toolOf(wrapper)).toBe('select');
    expect(document.body.style.cursor).not.toBe('grab');
    press({ code: 'Enter', key: 'Enter', target: btn });
    expect(toolOf(wrapper)).toBe('select');
    btn.remove();
  });

  it('非交互元素上按空格仍临时切抓手（既有功能保留）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-k7'));
    const div = document.createElement('div');
    document.body.appendChild(div);
    press({ code: 'Space', key: ' ', target: div });
    expect(toolOf(wrapper)).toBe('pan');
    div.remove();
  });
});
