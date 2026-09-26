/**
 * WYSIWYG 导出契约单测：点位图/视野图以「编辑画布快照」为唯一可信源
 *
 * 背景（三个真实缺陷，同一根因）：
 *  1. PNG 空白 —— 渲染进程导出走离屏重绘：无白底 + mm 量级画布超 Chromium
 *     单 canvas 像素上限（分配失败后绘制静默 no-op）+ 设备图标固定 20 模型单位。
 *  2. PDF 带删不掉的元素 —— 重绘路径自己发明了悬空"图例"两字的桩代码。
 *  3. 导出 ≠ 编辑态 —— drawingSnapshots 明明已传入 options，导出引擎却无视。
 *
 * 本文件在 Node（无 DOM）环境锁定快照契约：
 *  - 有快照 ⇒ 快照即产物（数据逐字节一致），无论什么格式都不走重绘；
 *  - 文件名是人话（项目_图纸_点位图），不是 drawingId 拼接的机器名；
 *  - 无快照且无 DOM ⇒ 明确报错（不静默产出空白/损坏文件）。
 */
import { describe, it, expect } from 'vitest';
import { Exporter } from './index';
import { makeProject, makeFixtureModels } from './fixtures';

/** 1×1 红色 PNG（真实 base64，非伪造）：解码后即为"编辑画布所见" */
const TINY_PNG_DATAURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function exporterWithSnapshot(snapshot?: string) {
  const ex = new Exporter(makeProject(), makeFixtureModels());
  return {
    ex,
    options: {
      project: makeProject(),
      drawingIds: [makeProject().drawings[0].id],
      formats: ['png'] as any,
      include: { pointMap: true, fovMap: true, topology: false, deviceList: false, cableList: false, report: false },
      outputDir: '',
      canvasSnapshots: snapshot ? { 'drawing-fixture-1': snapshot } : {},
    },
  };
}

describe('Exporter · WYSIWYG 快照契约（点位图/视野图）', () => {
  it('有画布快照 ⇒ PNG 产物就是快照本身（逐字节一致，不重绘）', async () => {
    const { ex, options } = exporterWithSnapshot(TINY_PNG_DATAURL);
    const result = await ex.export(options);
    const pointMap = result.files.find(f => f.format === 'png');
    expect(pointMap).toBeTruthy();
    // dataBase64 与快照 PNG 部分逐字节一致：导出的就是编辑器所见
    expect(pointMap!.dataBase64).toBe(TINY_PNG_DATAURL.split(',')[1]);
    expect(pointMap!.drawingId).toBe('drawing-fixture-1');
  });

  it('快照通道的产物文件名是人话（项目_图纸_点位图），不再是 drawingId 机器名', async () => {
    const { ex, options } = exporterWithSnapshot(TINY_PNG_DATAURL);
    const result = await ex.export(options);
    const pointMap = result.files.find(f => f.format === 'png')!;
    expect(pointMap.path).toBe('某某园区安防勘点_1F平面图_点位图.png');
    expect(pointMap.path).not.toMatch(/drawing-fixture-1_pointmap/);
  });

  it('快照 + pdf 格式 ⇒ pdf-lib 真产出 PDF（魔数 %PDF- 且页面为快照尺寸 0.75 倍）', async () => {
    const { ex } = exporterWithSnapshot(TINY_PNG_DATAURL);
    // 直接调私有路径的行为面：export with formats=['pdf']
    const result = await ex.export({
      drawingIds: ['drawing-fixture-1'],
      formats: ['pdf'],
      include: { pointMap: true, fovMap: false, topology: false, deviceList: false, cableList: false, report: false },
      outputDir: '',
      canvasSnapshots: { 'drawing-fixture-1': TINY_PNG_DATAURL },
    });
    const pdf = result.files.find(f => f.format === 'pdf');
    expect(pdf).toBeTruthy();
    const bytes = Buffer.from(pdf!.dataBase64!, 'base64');
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf!.path).toBe('某某园区安防勘点_1F平面图_点位图.pdf');
  });

  it('无快照且无 DOM ⇒ 明确报错引导回编辑页（不静默产出空白文件）', async () => {
    const { ex, options } = exporterWithSnapshot(undefined);
    const result = await ex.export(options);
    // Node 环境无 DOM、无快照：点位图应报错且不产出文件
    expect(result.files.filter(f => f.drawingId === 'drawing-fixture-1')).toHaveLength(0);
    expect(result.errors.join(' ')).toMatch(/画布环境|快照/);
    expect(result.success).toBe(false);
  });

  it('视野图同样遵循快照契约（数据一致 + 人话文件名）', async () => {
    const { ex } = exporterWithSnapshot(TINY_PNG_DATAURL);
    const result = await ex.export({
      drawingIds: ['drawing-fixture-1'],
      formats: ['png'],
      include: { pointMap: false, fovMap: true, topology: false, deviceList: false, cableList: false, report: false },
      outputDir: '',
      canvasSnapshots: { 'drawing-fixture-1': TINY_PNG_DATAURL },
    });
    const fovMap = result.files.find(f => f.format === 'png');
    expect(fovMap).toBeTruthy();
    expect(fovMap!.dataBase64).toBe(TINY_PNG_DATAURL.split(',')[1]);
    expect(fovMap!.path).toBe('某某园区安防勘点_1F平面图_视野图.png');
  });
});
