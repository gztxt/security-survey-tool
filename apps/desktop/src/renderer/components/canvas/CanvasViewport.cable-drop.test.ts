/**
 * 画布「拖线种进画布 → 按线种成缆」回归测试
 *
 * 用户反馈：左侧面板没有网线入口。面板补上材料区之后，画布侧必须接得住
 * application/cable 拖放，且布线生成的线缆要用被拖进来的线种
 * （此前 manualWire 的线种是硬编码 'cat6'，拖什么都不生效）。
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
    projectId: 'proj-cable',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 100, path: '/tmp/plan.dxf' },
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 100, scale: 1, unit: 'm' },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: false, showRuler: false },
    devices: [
      { id: 'devA', drawingId: id, modelId: 'hik-dome-2mp', position: { x: 1000, y: 1000 }, rotation: 0, label: 'C001', remarks: '', createdAt: 1, updatedAt: 1 },
      { id: 'devB', drawingId: id, modelId: 'hik-switch-ds3e0310p', position: { x: 5000, y: 1000 }, rotation: 0, label: 'S001', remarks: '', createdAt: 1, updatedAt: 1 },
    ],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

async function mountCanvas(drawing: Drawing) {
  const projectStore = useProjectStore();
  projectStore.setProject({
    id: 'proj-cable',
    name: '线种测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [drawing],
    settings: { defaultScale: 100, unit: 'm', gridSize: 1, snapEnabled: false, autoSaveInterval: 0 },
  } as unknown as Project);
  projectStore.setCurrentDrawing(drawing.id);
  useSettingsStore().snapEnabled = false;
  const wrapper = mount(CanvasViewport, { props: { drawing }, attachTo: document.body });
  await nextTick();
  return wrapper;
}

/** 构造一个带 types / getData 的 DataTransfer stub（jsdom 无原生实现） */
function dropEvent(type: string, value: string) {
  return {
    dataTransfer: {
      types: [type],
      getData: (t: string) => (t === type ? value : ''),
      dropEffect: '',
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: document.body,
  } as unknown as DragEvent;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
});

describe('布线材料拖放', () => {
  it('① 拖入光纤 ⇒ 切到布线工具且线种 = fiber_sm', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-cable-1'));
    const ui = useUiStore();
    await (wrapper.vm as any).onCanvasDrop(dropEvent('application/cable', 'fiber_sm'));
    expect(ui.activeTool).toBe('wire');
    expect(ui.activeCableType).toBe('fiber_sm');
    wrapper.unmount();
  });

  it('② 布线生成的线缆使用当前线种（此前恒为 cat6）', async () => {
    const wrapper = await mountCanvas(makeDrawing('dw-cable-2'));
    const store = useProjectStore();
    const ui = useUiStore();
    await (wrapper.vm as any).onCanvasDrop(dropEvent('application/cable', 'fiber_mm'));

    // 布线：点起点设备 → 点终点设备
    rendererMock.pickEntity.mockReturnValue('device:devA');
    await wrapper.find('.main-canvas').trigger('mousedown', { clientX: 1000, clientY: 1000, button: 0 });
    await wrapper.find('.main-canvas').trigger('mouseup', { clientX: 1000, clientY: 1000, button: 0 });
    rendererMock.pickEntity.mockReturnValue('device:devB');
    await wrapper.find('.main-canvas').trigger('mousedown', { clientX: 5000, clientY: 1000, button: 0 });
    await wrapper.find('.main-canvas').trigger('mouseup', { clientX: 5000, clientY: 1000, button: 0 });
    await nextTick();

    expect(ui.activeCableType).toBe('fiber_mm');
    const cables = store.currentDrawing!.wiring.cables;
    expect(cables).toHaveLength(1);
    expect(cables[0].type).toBe('fiber_mm');
    wrapper.unmount();
  });
});
