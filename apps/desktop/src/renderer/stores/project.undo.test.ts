/**
 * 撤销 / 重做回归测试
 *
 * 旧实现的 undo/redo 只移动历史下标，不反向执行任何动作（按 Ctrl+Z 无事发生）。
 * 现实现为"当前图纸布点+布线"的结构性快照。本文件锁死其核心语义：
 *  1. 删除设备后 undo ⇒ 设备原样恢复（含属性）。
 *  2. 添加线路后 undo ⇒ 线路消失；redo ⇒ 再次出现。
 *  3. runBatched 内的多次变更 = 一步历史（批量误删一次可回）。
 *  4. undo 后追加新变更 ⇒ redo 栈清空（标准编辑器语义）。
 *  5. 空历史时 undo/redo 返回 false，不发生任何写操作。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from './project';
import type { DeviceInstance, Drawing, Project } from '@security-survey/shared-types';

function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-undo',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 1, path: 'x', thumbnailPath: '' } as Drawing['file'],
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 10, scale: 0.01, unit: 'm' },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
    devices: [],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as Drawing;
}

function makeDevice(id: string, overrides: Partial<DeviceInstance> = {}): DeviceInstance {
  return {
    id,
    drawingId: 'draw-1',
    modelId: 'cam-dome',
    position: { x: 1000, y: 2000 },
    rotation: 0,
    label: id.toUpperCase(),
    remarks: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function setup(): ReturnType<typeof useProjectStore> {
  setActivePinia(createPinia());
  localStorage.clear();
  const store = useProjectStore();
  const project = {
    id: 'proj-undo',
    name: '撤销测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [makeDrawing('draw-1')],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
  } as Project;
  store.setProject(project);
  return store;
}

describe('project store · 撤销/重做', () => {
  beforeEach(() => { /* pinia 在 setup() 里重建 */ });

  it('① 删除设备 → undo：设备连同属性原样恢复', () => {
    const store = setup();
    store.addDevice(makeDevice('dev-a', { remarks: '大门侧' }));
    store.removeDevice('dev-a');
    expect(store.currentDrawing!.devices).toHaveLength(0);
    expect(store.canUndo).toBe(true);

    expect(store.undo()).toBe(true);
    const restored = store.currentDrawing!.devices;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('dev-a');
    expect(restored[0].remarks).toBe('大门侧');
    expect(restored[0].position).toEqual({ x: 1000, y: 2000 });
  });

  it('② 添加线路 → undo 掉线路本身 → redo 线路回来', () => {
    const store = setup();
    store.addDevice(makeDevice('dev-a'));
    store.addDevice(makeDevice('dev-b'));
    store.manualWire('dev-a', 'dev-b', [{ x: 0, y: 0 }, { x: 3000, y: 0 }]);
    expect(store.currentDrawing!.wiring.cables).toHaveLength(1);

    // 栈顶快照是"加线之前"：undo 只回退线缆，设备保持
    expect(store.undo()).toBe(true);
    expect(store.currentDrawing!.wiring.cables).toHaveLength(0);
    expect(store.currentDrawing!.devices).toHaveLength(2);

    expect(store.redo()).toBe(true);
    expect(store.currentDrawing!.wiring.cables).toHaveLength(1);
    expect(store.currentDrawing!.wiring.cables[0].length).toBeCloseTo(300, 6);

    // 逐步回退到空图
    store.undo(); // 撤销 add-cable
    store.undo(); // 撤销 add dev-b
    store.undo(); // 撤销 add dev-a
    expect(store.currentDrawing!.devices).toHaveLength(0);
    expect(store.currentDrawing!.wiring.cables).toHaveLength(0);
  });

  it('③ runBatched 批量删除 = 一步历史，一次 undo 全部回来', () => {
    const store = setup();
    store.addDevice(makeDevice('dev-a'));
    store.addDevice(makeDevice('dev-b'));
    store.addDevice(makeDevice('dev-c'));
    // 清掉添加产生的历史，只考察批量删除
    store.clearHistory();

    store.runBatched('删除 3 个设备', () => {
      for (const id of ['dev-a', 'dev-b', 'dev-c']) store.removeDevice(id);
    });
    expect(store.currentDrawing!.devices).toHaveLength(0);
    expect(store.undoLabel).toContain('删除 3 个设备');

    expect(store.undo()).toBe(true);
    expect(store.currentDrawing!.devices.map(d => d.id).sort()).toEqual(['dev-a', 'dev-b', 'dev-c']);
  });

  it('④ undo 后产生新变更 → redo 栈被清空', () => {
    const store = setup();
    store.addDevice(makeDevice('dev-a'));
    store.addDevice(makeDevice('dev-b'));
    store.undo(); // 撤掉 dev-b
    expect(store.canRedo).toBe(true);
    store.addDevice(makeDevice('dev-c'));
    expect(store.canRedo).toBe(false);
  });

  it('⑤ 空历史：undo/redo 返回 false 且不改数据', () => {
    const store = setup();
    store.addDevice(makeDevice('dev-a'));
    store.clearHistory();
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
    expect(store.currentDrawing!.devices).toHaveLength(1);
    expect(store.canUndo).toBe(false);
  });

  it('⑥ 切换图纸后不得跨图纸回滚', () => {
    const store = setup();
    store.addDrawing(makeDrawing('draw-2'));
    store.setCurrentDrawing('draw-2'); // addDrawing 不自动切换，需显式进入第二张
    expect(store.currentDrawing!.id).toBe('draw-2');
    store.addDevice(makeDevice('dev-a')); // 历史记在 draw-2
    store.setCurrentDrawing('draw-1');
    expect(store.undo()).toBe(false); // 不能把 draw-2 的历史套到 draw-1
    expect(store.currentDrawing!.devices).toHaveLength(0);
    // 回到 draw-2 后仍可正常撤销
    store.setCurrentDrawing('draw-2');
    expect(store.undo()).toBe(true);
    expect(store.currentDrawing!.devices).toHaveLength(0);
  });

  it('⑦ 快照是深拷贝：捕获后的原地改动不会污染历史', () => {
    const store = setup();
    store.addDevice(makeDevice('dev-a'));
    const live = store.currentDrawing!.devices[0];
    live.position.x = 555;
    // 这次 add 在变更前捕获快照，快照里的 dev-a 应为 x=555
    store.addDevice(makeDevice('dev-b'));
    expect(store.currentDrawing!.devices).toHaveLength(2);
    live.position.x = 777; // 捕获之后再原地改，不应影响已入栈快照
    store.undo();
    expect(store.currentDrawing!.devices).toHaveLength(1);
    expect(store.currentDrawing!.devices[0].position.x).toBe(555);
  });
});
