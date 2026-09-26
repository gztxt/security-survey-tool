/**
 * 尺寸标识卡单测 —— 锁定「导出必须完整保留尺寸标识」契约
 *
 * 背景：导出改成 WYSIWYG 快照通道后，快照刻意剔除了编辑器装饰（网格/标尺），
 * 导出图上就再没有任何量测锚点。虽然重绘通道旧代码会画一条写死的 10m 比例尺，
 * 但那条路跟真实缩放毫无关系（早被判定为缺陷来源，不再启用）。
 * 因此尺寸信息必须由 drawScaleBadge 在导出图上重新合成，缺一笔导出图就不可量测。
 *
 * 为什么测「绘制」而不是测「像素」：本包单测跑在 Node（无 DOM、无 canvas 原生实现），
 * 无法真出图比对。改为注入一个记录型 CanvasRenderingContext2D 替身，直接断言
 * 三要素是否被画出来 —— 这正是行为契约本身（画了什么、画几次、标了什么数）。
 *
 * 覆盖：
 *  1. 已校准 + 有换算率 ⇒ 1:N 比例、图幅尺寸、黑白相间刻度条带 Nm 标注，三者齐备；
 *  2. 未校准 ⇒ 明确写「未校准」而不是画一条假比例尺；
 *  3. 旧形态快照（无 mmPerPx）⇒ 不画刻度条（宁缺勿错）；
 *  4. 刻度条长度取 1/2/5 系列整数米（工程图习惯，便于目测估读）。
 */
import { describe, it, expect } from 'vitest';
import { Exporter } from './index';
import { makeProject, makeFixtureModels } from './fixtures';
import type { CanvasSnapshotMeta, Drawing } from '@security-survey/shared-types';

/** 记录型 2D 上下文替身：只记录调用，不做真实光栅化 */
interface Recorder {
  calls: { op: string; args?: any[] }[];
  texts: string[];
  fillStyles: string[];
  rects: { x: number; y: number; w: number; h: number }[];
}

function makeCtx(w: number, h: number) {
  const rec: Recorder = { calls: [], texts: [], fillStyles: [], rects: [] };
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {
      rec.calls.push({ op: 'save' });
    },
    restore() {
      rec.calls.push({ op: 'restore' });
    },
    beginPath() {
      rec.calls.push({ op: 'beginPath' });
    },
    roundRect(...args: any[]) {
      rec.calls.push({ op: 'roundRect', args });
    },
    fill() {
      rec.calls.push({ op: 'fill' });
    },
    stroke() {
      rec.calls.push({ op: 'stroke' });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rec.calls.push({ op: 'fillRect' });
      rec.rects.push({ x, y, w, h });
      rec.fillStyles.push(ctx.fillStyle);
    },
    strokeRect(...args: any[]) {
      rec.calls.push({ op: 'strokeRect', args });
    },
    fillText(t: string) {
      rec.calls.push({ op: 'fillText' });
      rec.texts.push(String(t));
    },
  };
  const canvas: any = { width: w, height: h };
  return { ctx, rec, canvas };
}

/** 通过私有方法入口调用绘制逻辑（drawScaleBadge 是类内私有合成步骤） */
function drawBadge(
  meta: CanvasSnapshotMeta | null,
  drawing: Drawing,
  w = 800,
  h = 600
) {
  const { ctx, rec, canvas } = makeCtx(w, h);
  const ex = new Exporter(makeProject(), makeFixtureModels()) as any;
  ex.drawScaleBadge(ctx, canvas, meta, drawing);
  return rec;
}

function drawingFixture(): Drawing {
  return makeProject().drawings[0];
}

describe('Exporter · 尺寸标识卡（导出图量测锚点）', () => {
  it('已校准 + 有换算率 ⇒ 比例 / 图幅 / 刻度条三要素全部画出', () => {
    const drawing = drawingFixture();
    //  fixtures 的 scale=1 ⇒ ratio=1 ⇒ "比例 1:1"；mmPerPx=10 ⇒ 每像素 1cm
    const rec = drawBadge({ dataUrl: 'data:image/png;base64,AA', mmPerPx: 10, widthPx: 800, heightPx: 600 }, drawing);

    expect(rec.texts.some(t => t === '比例 1:1')).toBe(true);
    // 图幅实际尺寸：800px×10mm ⇒ 8.0m；600px ⇒ 6.0m
    expect(rec.texts.some(t => t === '图幅 8.0m × 6.0m')).toBe(true);
    // 刻度条：4 段黑白相间 + 末段上方标注几米
    expect(rec.rects.length).toBe(4);
    expect(rec.texts.some(t => /^\d+m$/.test(t))).toBe(true);
    expect(rec.fillStyles.filter(s => s === '#111827').length).toBe(2);
    expect(rec.fillStyles.filter(s => s === '#FFFFFF').length).toBe(2);
  });

  it('未校准 ⇒ 明确标注「未校准」且**不画**刻度条（不伪造比例尺）', () => {
    const drawing = { ...drawingFixture(), calibration: { ...drawingFixture().calibration, isCalibrated: false } };
    const rec = drawBadge({ dataUrl: 'data:image/png;base64,AA', mmPerPx: 10, widthPx: 800, heightPx: 600 }, drawing);

    expect(rec.texts.some(t => t.includes('未校准'))).toBe(true);
    expect(rec.rects.length).toBe(0);
    expect(rec.texts.some(t => /^\d+m$/.test(t))).toBe(false);
  });

  it('旧形态快照（纯 dataURL，无 mmPerPx）⇒ 兼容渲染比例但省略刻度条', () => {
    const drawing = drawingFixture();
    const rec = drawBadge(null, drawing);

    expect(rec.texts.some(t => t === '比例 1:1')).toBe(true);
    // 无换算率 ⇒ 图幅尺寸算不出，只能省略（宁缺勿错）
    expect(rec.texts.some(t => t.startsWith('图幅'))).toBe(false);
    expect(rec.rects.length).toBe(0);
  });

  it('刻度条长度取 1/2/5 系列整数米（工程图估读习惯）', () => {
    const drawing = drawingFixture();
    // 目标像素 ≈ 卡宽 0.62 ⇒ rawM=1.674m，向上取到 2m
    const rec = drawBadge({ dataUrl: 'data:image/png;base64,AA', mmPerPx: 10, widthPx: 800, heightPx: 600 }, drawing);
    const barLabel = rec.texts.find(t => /^\d+m$/.test(t))!;
    expect(barLabel).toBe('2m');
    // 2m 在 10mm/px 下 = 200px 宽，均分 4 段
    const segs = rec.rects;
    expect(segs.map(s => s.w)).toEqual([50, 50, 50, 50]);
    // 四段首尾相接，总宽正好 200px（末段右边界 - 首段左边界 = 刻度条实宽）
    expect(segs[3].x + segs[3].w - segs[0].x).toBe(200);
  });

  it('小图不至于贴边：标识卡尺寸随图幅缩放并夹在合理区间', () => {
    const drawing = drawingFixture();
    const big = drawBadge({ dataUrl: 'd', mmPerPx: 10, widthPx: 4000, heightPx: 3000 }, drawing, 4000, 3000);
    const small = drawBadge({ dataUrl: 'd', mmPerPx: 10, widthPx: 400, heightPx: 300 }, drawing, 400, 300);
    // 两种尺寸下卡片都能画出刻度条的四段 + 文本，不因尺寸而缺件
    expect(big.rects.length).toBe(4);
    expect(small.rects.length).toBe(4);
    expect(big.texts.length).toBe(small.texts.length);
  });
});
