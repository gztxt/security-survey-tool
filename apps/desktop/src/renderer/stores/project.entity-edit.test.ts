/**
 * 底图图元编辑回归测试
 *
 * 历史缺陷：选中 CAD 图元后按 Delete 是空循环（CanvasViewport.deleteSelected 里
 * "删除图元（如果支持）" 注释下没有任何代码），拖动图元也无响应 —— 用户只能
 * 整张底图重新导入。本文件锁死"图元可删、可搬、可改、且一步可撤销"这组契约：
 *  1. 删除图元 → undo 按原下标回填，几何与属性原样恢复。
 *  2. 批量删除"设备 + 图元"（runBatched）= 一步历史，一次 undo 全回来。
 *  3. 移动图元后 bounds 同步更新（渲染器/导出按 bounds 做视口裁剪）。
 *  4. 位移为 0 / 图元不存在时不产生历史（点一下不该留空历史）。
 *  5. updateEntity 改可见性 → undo 恢复。
 *  6. 删除 → undo → redo：图元再次消失。
 */
import { describe, it, expect } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore } from './project';
import { translateCadEntity } from '@security-survey/shared-types';
import type { CadEntity, Drawing, Project } from '@security-survey/shared-types';

function bbox(minX: number, minY: number, maxX: number, maxY: number) {
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

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
    bounds: bbox(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)),
  } as CadEntity;
}

function circle(id: string, cx: number, cy: number, r: number): CadEntity {
  return {
    id,
    type: 'CIRCLE',
    layer: '0',
    color: 256,
    lineType: 'BYLAYER',
    lineWeight: -1,
    visible: true,
    data: { center: { x: cx, y: cy }, radius: r },
    bounds: bbox(cx - r, cy - r, cx + r, cy + r),
  } as CadEntity;
}

function makeDrawing(id: string, entities: CadEntity[]): Drawing {
  return {
    id,
    projectId: 'proj-entity',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 1, path: 'x', thumbnailPath: '' } as Drawing['file'],
    calibration: { isCalibrated: true, point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, realDistance: 10, scale: 0.01, unit: 'm' },
    layers: [],
    entities,
    viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
    devices: [],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as Drawing;
}

function setup(entities: CadEntity[]): ReturnType<typeof useProjectStore> {
  setActivePinia(createPinia());
  localStorage.clear();
  const store = useProjectStore();
  const project = {
    id: 'proj-entity',
    name: '图元编辑测试项目',
    createdAt: 1,
    updatedAt: 1,
    drawings: [makeDrawing('draw-1', entities)],
    settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
  } as Project;
  store.setProject(project);
  return store;
}

function ids(list: CadEntity[] | undefined): string[] {
  return (list || []).map(e => e.id);
}

describe('project store · 底图图元编辑', () => {
  it('① 删除图元 → undo：按原下标回填，几何与属性原样恢复', () => {
    const store = setup([line('e1', 0, 0, 1000, 0), line('e2', 0, 0, 0, 1000), line('e3', 0, 0, 500, 500)]);

    expect(store.removeEntities(['e2'])).toBe(1);
    expect(ids(store.currentDrawing!.entities)).toEqual(['e1', 'e3']);

    expect(store.undo()).toBe(true);
    const list = store.currentDrawing!.entities;
    expect(ids(list)).toEqual(['e1', 'e2', 'e3']); // 回到原下标，不是追加到末尾
    const restored = list.find(e => e.id === 'e2')!;
    expect((restored.data as any).end).toEqual({ x: 0, y: 1000 });
    expect(restored.layer).toBe('WALL');
  });

  it('② 批量删除「设备 + 图元」= 一步历史，一次 undo 全部回来', () => {
    const store = setup([line('e1', 0, 0, 1000, 0), line('e2', 0, 0, 0, 1000)]);
    store.addDevice({
      id: 'dev-a', drawingId: 'draw-1', modelId: 'cam', position: { x: 0, y: 0 },
      rotation: 0, label: 'A', remarks: '', createdAt: 1, updatedAt: 1,
    } as any);

    store.runBatched('批量删除', () => {
      store.removeDevice('dev-a');
      store.removeEntities(['e1', 'e2']);
    });
    expect(store.currentDrawing!.devices).toHaveLength(0);
    expect(store.currentDrawing!.entities).toHaveLength(0);

    expect(store.undo()).toBe(true);
    expect(store.currentDrawing!.devices).toHaveLength(1);
    expect(ids(store.currentDrawing!.entities)).toEqual(['e1', 'e2']);
  });

  it('③ 移动图元：几何与 bounds 同步更新，且一步可撤销', () => {
    const store = setup([line('m1', 0, 0, 1000, 0), circle('m2', 100, 100, 50)]);
    const before = store.captureEntities(['m1', 'm2']);
    expect(before).toHaveLength(2);

    expect(store.translateEntities(['m1', 'm2'], 500, 200)).toBe(2);
    store.commitEntities('移动 2 个图元', before);

    const l = store.currentDrawing!.entities[0];
    expect((l.data as any).start).toEqual({ x: 500, y: 200 });
    expect((l.data as any).end).toEqual({ x: 1500, y: 200 });
    // bounds 必须跟着走：渲染器与导出都按 bounds 做视口裁剪
    expect(l.bounds.minX).toBe(500);
    expect(l.bounds.maxX).toBe(1500);
    expect(l.bounds.maxY).toBe(200);

    const c = store.currentDrawing!.entities[1];
    expect((c.data as any).center).toEqual({ x: 600, y: 300 });
    expect(c.bounds.minX).toBe(550);

    expect(store.undo()).toBe(true);
    expect((store.currentDrawing!.entities[0].data as any).start).toEqual({ x: 0, y: 0 });
    expect(store.currentDrawing!.entities[0].bounds.maxX).toBe(1000);
  });

  it('④ 位移为 0 / id 不存在 → 不动数据、不产生历史', () => {
    const store = setup([line('z1', 0, 0, 1000, 0)]);
    expect(store.translateEntities(['z1'], 0, 0)).toBe(0);
    expect(store.translateEntities(['nope'], 10, 10)).toBe(0);
    expect(store.removeEntities(['nope'])).toBe(0);
    expect(store.canUndo).toBe(false);
    expect(ids(store.currentDrawing!.entities)).toEqual(['z1']);
  });

  it('⑤ updateEntity 隐藏图元 → 数据仍在，undo 恢复可见', () => {
    const store = setup([line('v1', 0, 0, 1000, 0)]);
    expect(store.updateEntity('v1', { visible: false })).toBe(true);
    expect(store.currentDrawing!.entities[0].visible).toBe(false);
    // 隐藏不等于删除：图元还在，可再显示回来
    expect(store.currentDrawing!.entities).toHaveLength(1);

    expect(store.undo()).toBe(true);
    expect(store.currentDrawing!.entities[0].visible).toBe(true);
  });

  it('⑥ 删除 → undo → redo：图元再次消失（redo 不能变成空操作）', () => {
    const store = setup([line('r1', 0, 0, 1000, 0), line('r2', 0, 0, 0, 1000)]);
    store.removeEntities(['r1']);
    expect(store.undo()).toBe(true);
    expect(ids(store.currentDrawing!.entities)).toEqual(['r1', 'r2']);

    expect(store.redo()).toBe(true);
    expect(ids(store.currentDrawing!.entities)).toEqual(['r2']);
  });
});

describe('shared-types · translateCadEntity', () => {
  it('LINE / CIRCLE / TEXT / HATCH 等各类图元的点位都被平移', () => {
    const l = line('t1', 0, 0, 10, 20);
    expect(translateCadEntity(l, 5, -5)).toBe(true);
    expect((l.data as any).start).toEqual({ x: 5, y: -5 });
    expect((l.data as any).end).toEqual({ x: 15, y: 15 });

    const c = circle('t2', 0, 0, 10);
    translateCadEntity(c, 100, 100);
    expect((c.data as any).center).toEqual({ x: 100, y: 100 });
    expect(c.bounds.minX).toBe(90);

    const hatch = {
      id: 't3', type: 'HATCH', layer: '0', color: 0, lineType: '', lineWeight: 0, visible: true,
      data: { patternName: 'ANSI31', scale: 1, angle: 0, loops: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]], solidFill: false },
      bounds: bbox(0, 0, 10, 10),
    } as unknown as CadEntity;
    translateCadEntity(hatch, 1, 2);
    expect((hatch.data as any).loops[0][0]).toEqual({ x: 1, y: 2 });
    expect(hatch.bounds.maxX).toBe(11);
  });

  it('非有限位移 / 位移为 0 / 未知类型 → 返回 false 且几何不动', () => {
    const l = line('k1', 0, 0, 10, 0);
    expect(translateCadEntity(l, NaN, 0)).toBe(false);
    expect(translateCadEntity(l, 0, 0)).toBe(false);
    expect((l.data as any).start).toEqual({ x: 0, y: 0 });

    const unknown = {
      id: 'k2', type: 'NOSUCHTYPE', layer: '0', color: 0, lineType: '', lineWeight: 0, visible: true,
      data: { position: { x: 0, y: 0 } }, bounds: bbox(0, 0, 0, 0),
    } as unknown as CadEntity;
    expect(translateCadEntity(unknown, 10, 10)).toBe(false);
    expect((unknown.data as any).position).toEqual({ x: 0, y: 0 });
  });
});
