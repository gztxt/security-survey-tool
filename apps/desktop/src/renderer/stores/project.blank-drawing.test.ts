/**
 * 新建图纸（createBlankDrawing / addDrawing 归一化）回归
 *
 * 背景（P1 快捷键审计顺带查出的真实缺陷）：帮助页与页签「+」都宣称
 * Ctrl+T / 点击可"新建图纸"，但旧实现是
 *   projectStore.addDrawing({ name: '新建图纸' } as any)
 * 塞进去的是一张除 name 外全空的对象：
 *   - 没有 id ⇒ 页签的 key/currentDrawingId 悬空，点它切不过去；
 *   - 没有 viewport/calibration/wiring/devices ⇒ 渲染与保存路径随时炸；
 *   - 保存后 .survey 里落一张无 id 图纸，破坏 R11 的磁盘契约。
 * 现在 addDrawing 在入口补齐 id/name/order，createBlankDrawing 造完整图纸
 * 并切进新页签。本文件锁死这两条契约。
 */
import { describe, it, expect } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from './project';
import type { Drawing, Project } from '@security-survey/shared-types';

function baseDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-blank',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 1, path: 'x' } as Drawing['file'],
    calibration: { isCalibrated: false, point1: { x: 0, y: 0 }, point2: { x: 0, y: 0 }, realDistance: 0, scale: 1, unit: 'm' },
    layers: [],
    entities: [],
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
    devices: [],
    wiring: { id: `w-${id}`, drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as Drawing;
}

function setup(): ReturnType<typeof useProjectStore> {
  setActivePinia(createPinia());
  localStorage.clear();
  const store = useProjectStore();
  store.setProject({
    id: 'proj-blank',
    name: '空白图纸测试',
    createdAt: 1,
    updatedAt: 1,
    drawings: [baseDrawing('draw-1')],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
  } as Project);
  store.setCurrentDrawing('draw-1');
  return store;
}

describe('project store · 新建图纸', () => {
  it('createBlankDrawing 造出的图纸字段完整（可保存的合法 Drawing）', () => {
    const store = setup();
    const id = store.createBlankDrawing('新建图纸');
    const d = store.drawings.find(x => x.id === id)!;
    expect(d).toBeTruthy();
    expect(typeof d.id).toBe('string');
    expect(d.id).not.toBe('');
    expect(d.projectId).toBe('proj-blank');
    expect(d.name).toBe('新建图纸');
    expect(d.order).toBe(1);
    expect(Array.isArray(d.devices)).toBe(true);
    expect(Array.isArray(d.layers)).toBe(true);
    expect(Array.isArray(d.entities)).toBe(true);
    expect(d.calibration && typeof d.calibration.scale).toBe('number');
    expect(d.viewport && typeof d.viewport.zoom).toBe('number');
    expect(d.wiring && Array.isArray(d.wiring.cables)).toBe(true);
    expect(d.wiring.drawingId).toBe(id);
    expect(typeof d.createdAt).toBe('number');
    // 图纸级 wiring.id 不得为空 —— 保存契约要求
    expect(d.wiring.id).not.toBe('');
  });

  it('createBlankDrawing 立即切进新页签（旧写法只追加不停留，用户仍看到旧图）', () => {
    const store = setup();
    expect(store.currentDrawing!.id).toBe('draw-1');
    const id = store.createBlankDrawing();
    expect(store.currentDrawing!.id).toBe(id);
    expect(store.currentDrawing!.name).toBe('新建图纸');
  });

  it('addDrawing 兜底补齐无 id 图纸（防历史调用方再塞半张图纸）', () => {
    const store = setup();
    store.addDrawing({ name: '无主图纸' } as unknown as Drawing);
    const added = store.drawings[store.drawings.length - 1];
    expect(added.id).toBeTruthy();
    expect(added.order).toBe(1);
    // 补齐 id 后这张图纸必须能被切进去（此前点页签无反应即源于此）
    store.setCurrentDrawing(added.id);
    expect(store.currentDrawing!.id).toBe(added.id);
  });

  it('新建多张图纸 id 不重复且 order 递增', () => {
    const store = setup();
    const a = store.createBlankDrawing('A');
    const b = store.createBlankDrawing('B');
    expect(new Set([a, b]).size).toBe(2);
    const ids = store.drawings.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = store.drawings.map(d => d.order);
    expect([...orders].sort((x, y) => x - y)).toEqual(orders);
  });
});
