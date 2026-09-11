/**
 * 位图底图服务单元测试（T5a）
 * 只覆盖纯函数（imageToEntity / attachBasemap / isRaster / mime 分类）：
 *  - rasterToEntity / loadImageSize 依赖真实 Image.onload 与 electronAPI，jsdom 下不可靠，故不进单测。
 */
import { describe, it, expect } from 'vitest';
import { imageToEntity, attachBasemap, isRaster, isPdf } from './basemapService';
import type { GraphicEntity } from '@security-survey/shared-types';

describe('basemapService · 位图底图', () => {
  it('imageToEntity：产出 IMAGE / BASEMAP 图层 / 正确 bounds', () => {
    const e = imageToEntity('data:image/png;base64,AAAA', 800, 600);
    expect(e.type).toBe('IMAGE');
    expect(e.layer).toBe('BASEMAP');
    expect(e.bounds).toEqual({ minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 });
    expect((e.data as any).imagePath).toBe('data:image/png;base64,AAAA');
    expect((e.data as any).position).toEqual({ x: 0, y: 0 });
    expect((e.data as any).size).toEqual({ width: 800, height: 600 });
  });

  it('imageToEntity：连续调用生成唯一 id（不覆盖）', () => {
    const a = imageToEntity('data:image/png;base64,A', 10, 10);
    const b = imageToEntity('data:image/png;base64,B', 10, 10);
    expect(a.id).not.toBe(b.id);
  });

  it('attachBasemap：加入实体 + 建立 BASEMAP 图层，且重复挂载不堆叠', () => {
    const drawing: any = { entities: [] as GraphicEntity[], layers: [] };
    const e1 = imageToEntity('data:image/png;base64,1', 100, 100);
    attachBasemap(drawing, e1);
    expect(drawing.entities.length).toBe(1);
    expect(drawing.layers.some((l: any) => l.name === 'BASEMAP')).toBe(true);

    const e2 = imageToEntity('data:image/png;base64,2', 200, 200);
    attachBasemap(drawing, e2);
    // 覆盖旧 BASEMAP：仍只有 1 条
    expect(drawing.entities.length).toBe(1);
    expect(drawing.entities[0].id).toBe(e2.id);
    // 图层不重复
    expect(drawing.layers.filter((l: any) => l.name === 'BASEMAP').length).toBe(1);
  });

  it('isRaster：png/jpg/jpeg 判真，pdf/dxf 判假', () => {
    expect(isRaster('C:/a/plan.png')).toBe(true);
    expect(isRaster('plan.JPG')).toBe(true);
    expect(isRaster('plan.jpeg')).toBe(true);
    expect(isRaster('plan.pdf')).toBe(false);
    expect(isRaster('plan.dxf')).toBe(false);
    expect(isRaster('plan')).toBe(false);
  });

  it('isPdf：仅 pdf 判真，图片与 CAD 判假', () => {
    expect(isPdf('C:/a/floor.PDF')).toBe(true);
    expect(isPdf('floor.pdf')).toBe(true);
    expect(isPdf('floor.png')).toBe(false);
    expect(isPdf('floor.dxf')).toBe(false);
    expect(isPdf('floor')).toBe(false);
  });
});
