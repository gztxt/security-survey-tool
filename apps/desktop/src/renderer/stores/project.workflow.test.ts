/**
 * 工作流步骤派生回归测试
 *
 * workflowStep 是步骤条高亮、侧栏面板跟随、引导文案的唯一判定处。
 * 此前这三处各自 if 判断（步骤条算自己的 activeIndex、引导卡片再算一遍
 * hasBase/calibrated、侧栏干脆不感知步骤），口径容易漂移。
 * 本文件锁死派生口径：底图步骤要求"已导入且已校准"。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from './project';
import type { Drawing, Project } from '@security-survey/shared-types';

function makeDrawing(id: string, calibrated: boolean): Drawing {
  return {
    id,
    projectId: 'p1',
    name: '1F',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 1, path: 'x', thumbnailPath: '' } as Drawing['file'],
    calibration: {
      isCalibrated: calibrated,
      point1: { x: 0, y: 0 },
      point2: { x: 100, y: 0 },
      realDistance: calibrated ? 10 : 0,
      scale: calibrated ? 0.01 : 1,
      unit: 'm',
    },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
    devices: [],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

function setup(calibrated = false): ReturnType<typeof useProjectStore> {
  setActivePinia(createPinia());
  localStorage.clear();
  const store = useProjectStore();
  store.setProject({
    id: 'p1',
    name: '步骤测试',
    createdAt: 1,
    updatedAt: 1,
    drawings: [makeDrawing('d1', calibrated)],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
  } as Project);
  return store;
}

const device = (id: string) => ({
  id,
  drawingId: 'd1',
  modelId: 'cam',
  position: { x: 0, y: 0 },
  rotation: 0,
  label: id,
  remarks: '',
  createdAt: 1,
  updatedAt: 1,
});

describe('project store · workflowStep 派生', () => {
  beforeEach(() => { /* setup() 内重建 pinia */ });

  it('无底图 = basemap 步骤', () => {
    const store = setup();
    store.currentDrawing!.entities = [];
    (store.currentDrawing as any).file = null;
    expect(store.workflowStep).toBe('basemap');
  });

  it('有底图但未校准仍停在 basemap（未校准则线长不可信）', () => {
    const store = setup(false);
    expect(store.hasBasemap).toBe(true);
    expect(store.workflowStep).toBe('basemap');
  });

  it('校准后进入 devices；满 2 台进入 wiring；画线后进入 export', () => {
    const store = setup(true);
    expect(store.workflowStep).toBe('devices');

    // 1 台设备仍停在布点：线缆要两个端点，此时催用户去连线是做不到的动作
    store.addDevice(device('c1') as any);
    expect(store.workflowStep).toBe('devices');
    store.addDevice(device('c2') as any);
    expect(store.workflowStep).toBe('wiring');
    store.manualWire('c1', 'c2', [{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
    expect(store.workflowStep).toBe('export');
  });

  it('删除全部线路后回退到 wiring 步骤（步骤是派生量而非单向进度条）', () => {
    const store = setup(true);
    store.addDevice(device('c1') as any);
    store.addDevice(device('c2') as any);
    store.manualWire('c1', 'c2', [{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
    expect(store.workflowStep).toBe('export');
    store.removeCable(store.currentDrawing!.wiring.cables[0].id);
    expect(store.workflowStep).toBe('wiring');
  });

  it('撤销删除的设备后步骤跟着回退（与 undo 同源，不会各自漂移）', () => {
    const store = setup(true);
    store.addDevice(device('c1') as any);
    store.addDevice(device('c2') as any);
    expect(store.workflowStep).toBe('wiring'); // 2 台就位，该连线了
    store.removeDevice('c2');
    expect(store.workflowStep).toBe('devices'); // 只剩 1 台，回退到布点
    expect(store.undo()).toBe(true);
    expect(store.currentDrawing!.devices).toHaveLength(2);
    expect(store.workflowStep).toBe('wiring'); // undo 之后步骤判定同步跟上
  });
});
