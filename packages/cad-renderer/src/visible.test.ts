// @vitest-environment jsdom
/**
 * 图元级可见性回归测试
 *
 * 缺陷：CadRenderer 只看图层显隐，完全不理图元自己的 visible 字段。
 * 于是「隐藏图元」写进数据后画面照旧 —— 功能看起来做了，实际骗人。
 * 本文件锁死两条：隐藏图元不画、也选不中（看不见却选得到会导致误删）。
 */
import { describe, it, expect } from 'vitest';
import { CadRenderer } from './index';
import type { CadEntity, ViewportState } from '@security-survey/shared-types';

function line(id: string, y: number, visible: boolean): CadEntity {
  return {
    id,
    type: 'LINE',
    layer: 'WALL',
    color: 256,
    lineType: 'BYLAYER',
    lineWeight: -1,
    visible,
    data: { start: { x: 0, y }, end: { x: 1000, y } },
    bounds: { minX: 0, minY: y, maxX: 1000, maxY: y, width: 1000, height: 0 },
  } as CadEntity;
}

const IDENTITY: ViewportState = {
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  center: { x: 0, y: 0 },
  zoom: 1,
  showGrid: false,
  showRuler: false,
};

/**
 * 本包没有 jsdom 的 node-canvas（getContext('2d') 返回 null），
 * 故用一个"什么都接得住"的 ctx 桩：渲染器的绘制调用全部被吞掉，
 * 本测试只关心"哪些图元被挑出来画/被允许选中"，不关心像素。
 */
function stubCtx(): CanvasRenderingContext2D {
  const sink: any = function sinkFn(): any { return sink; };
  return new Proxy(sink, {
    get: () => sink,
    set: () => true,
    apply: () => sink,
  }) as unknown as CanvasRenderingContext2D;
}

function makeRenderer(entities: CadEntity[]): CadRenderer {
  // jsdom 的 getBoundingClientRect 恒为 0：手动给出尺寸，否则视口裁剪会把一切剔掉
  const rect = {
    x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}),
  } as DOMRect;
  const canvas = {
    getContext: () => stubCtx(),
    getBoundingClientRect: () => rect,
    width: 0,
    height: 0,
    style: {},
  } as unknown as HTMLCanvasElement;
  const r = new CadRenderer(canvas);
  r.setViewport(IDENTITY);
  r.setEntities(entities);
  return r;
}

describe('CadRenderer · 图元 visible', () => {
  it('① 隐藏图元不参与渲染（renderStats 只数可见图元）', () => {
    const r = makeRenderer([line('shown', 100, true), line('hidden', 200, false)]);
    r.render();
    const stats = r.getRenderStats();
    // 视口内只有 1 条可见线：隐藏的那条被滤掉
    expect(stats.entities).toBe(1);
  });

  it('② 隐藏图元选不中（避免"看不见却能选中再误删"）', () => {
    const r = makeRenderer([line('shown', 100, true), line('hidden', 200, false)]);
    expect(r.pickEntity(500, 100)).toBe('entity:shown');
    expect(r.pickEntity(500, 200)).toBeNull();
  });

  it('③ visible 未定义（旧数据）按可见处理，不会被误隐藏', () => {
    const legacy = { ...line('legacy', 300, true) } as CadEntity;
    delete (legacy as any).visible;
    const r = makeRenderer([legacy]);
    expect(r.pickEntity(500, 300)).toBe('entity:legacy');
    r.render();
    expect(r.getRenderStats().entities).toBe(1);
  });
});
