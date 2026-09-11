/**
 * DXF overlay 导出集成单测（T3 验收 ②③：真实夹具 → 图层/实体/中文/图元映射）
 *
 * 与 dxf-writer.test.ts 的分工：
 * - dxf-writer.test.ts 验"文本格式正确性"（手写 doc → 读回）；
 * - 本文件验"业务映射正确性"（Project/Drawing 领域对象 → doc → 读回），
 *   即 buildDxfDoc 是否把设备/线缆/桥架/弱电井/中文标注如实落到对应 SS-* 图层。
 */
import { describe, it, expect } from 'vitest';
import { Exporter, INCLUDE_DXF_OVERLAY } from './index';
import type { DxfIncludeFlags } from './dxf-writer';
import {
  DXF_LAYER_BLOCK_DEV,
  DXF_LAYER_CABLE,
  DXF_LAYER_DEVICE,
  DXF_LAYER_DEVICE_TEXT,
  DXF_LAYER_RACK,
  DXF_LAYER_TRAY,
  DXF_LAYER_WELL,
  unescapeDxfText,
} from './dxf-writer';
import { makeFixtureModels, makeProject } from './fixtures';

async function parseDxf(text: string): Promise<any> {
  const mod: any = await import('dxf-parser');
  const Ctor = mod?.DxfParser ?? mod?.default?.DxfParser ?? mod?.default ?? mod;
  return new Ctor().parseSync(text);
}

const ALL_ON: DxfIncludeFlags = { devices: true, cables: true, trays: true, wells: true, texts: true };

function exporterForFixture() {
  return new Exporter(makeProject(), makeFixtureModels());
}

describe('Exporter · DXF overlay 业务映射', () => {
  it('夹具项目（2 设备 + 1 线缆 + 1 桥架 + 1 弱电井）→ 7 个 SS-* 图层 + 各图层均有实体', async () => {
    const ex = exporterForFixture();
    const drawing = makeProject().drawings[0];
    const text = ex.exportDxfText({
      project: makeProject(),
      drawingIds: [drawing.id],
      dxfLayers: ALL_ON,
    });
    expect(text.startsWith('  0\nSECTION\n  2\nHEADER\n')).toBe(true);
    expect(text.endsWith('  0\nEOF\n')).toBe(true);

    const parsed = await parseDxf(text);
    const layerNames = Object.keys(parsed.tables.layer.layers);
    const ss = layerNames.filter(n => n.startsWith('SS-'));
    expect(ss).toHaveLength(7);
    for (const name of [DXF_LAYER_DEVICE, DXF_LAYER_DEVICE_TEXT, DXF_LAYER_CABLE, DXF_LAYER_TRAY, DXF_LAYER_WELL, DXF_LAYER_RACK]) {
      expect(ss, `缺少图层 ${name}`).toContain(name);
    }

    const byLayer: Record<string, number> = {};
    for (const e of parsed.entities) byLayer[e.layer] = (byLayer[e.layer] || 0) + 1;
    expect(byLayer[DXF_LAYER_DEVICE] ?? 0).toBeGreaterThan(0);   // 设备 INSERT + 朝向线
    expect(byLayer[DXF_LAYER_CABLE] ?? 0).toBeGreaterThan(0);    // 线缆折线（1 条 3 点路径 → 2 段）
    expect(byLayer[DXF_LAYER_TRAY] ?? 0).toBe(1);                // 桥架 2 点路径 → 1 段
    expect(byLayer[DXF_LAYER_WELL] ?? 0).toBe(5);                // 弱电井 4 段围合 + 1 文本
    expect(byLayer[DXF_LAYER_DEVICE_TEXT] ?? 0).toBe(2);         // 2 个设备编号

    // 线缆折线拆分：makeCable 的 3 点路径必须变成 2 段 LINE（R12 无 LWPOLYLINE）
    const cableLines = parsed.entities.filter((e: any) => e.layer === DXF_LAYER_CABLE && e.type === 'LINE');
    expect(cableLines).toHaveLength(2);

    // 设备块：每个型号一个 SSB-<modelId>，INSERT 零孤儿
    const blockNames = Object.keys(parsed.blocks);
    expect(blockNames).toContain('SSB-model-bullet-4mp');
    expect(blockNames).toContain('SSB-model-rack-42u');
    for (const ins of parsed.entities.filter((e: any) => e.type === 'INSERT')) {
      expect(blockNames).toContain(ins.name);
    }
    // 块定义落在 SS-BLOCK-DEV 层
    expect(parsed.blocks['SSB-model-bullet-4mp'].layer).toBe(DXF_LAYER_BLOCK_DEV);
  });

  it('中文标注：点位编号与弱电井名可无损往返（\U+XXXX）', async () => {
    const ex = exporterForFixture();
    const project = makeProject();
    const parsed = await parseDxf(ex.exportDxfText({ project, drawingIds: [project.drawings[0].id], dxfLayers: ALL_ON }));
    const texts = parsed.entities.filter((e: any) => e.type === 'TEXT').map((e: any) => unescapeDxfText(e.text));
    // fixtures 中的中文 label
    expect(texts).toContain('C001 大门口');
    expect(texts).toContain('NVR1 机房');
    expect(texts).toContain('1#弱电井');
    // 原始文本必须是转义形态（不得出现裸非 ASCII 字节序列）
    const raw = parsed.entities.filter((e: any) => e.type === 'TEXT').map((e: any) => e.text);
    expect(raw.some((s: string) => /\\U\+/.test(s))).toBe(true);
  });

  it('勾选过滤：devices=false 时不输出设备实体，但 7 个图层仍在（冻结）', async () => {
    const ex = exporterForFixture();
    const project = makeProject();
    const parsed = await parseDxf(ex.exportDxfText({
      project,
      drawingIds: [project.drawings[0].id],
      dxfLayers: { ...ALL_ON, devices: false },
    }));
    expect(parsed.entities.some((e: any) => e.type === 'INSERT')).toBe(false);
    expect(parsed.entities.some((e: any) => e.layer === DXF_LAYER_RACK)).toBe(false);
    expect(Object.keys(parsed.tables.layer.layers).filter(n => n.startsWith('SS-'))).toHaveLength(7);
    expect(parsed.tables.layer.layers[DXF_LAYER_DEVICE].frozen).toBe(true);
    expect(parsed.tables.layer.layers[DXF_LAYER_CABLE].frozen ?? false).toBe(false);
  });

  it('机柜型号识别：category=other 且名称含"机柜"时额外标注到 SS-RACK', async () => {
    const ex = exporterForFixture();
    const project = makeProject();
    const parsed = await parseDxf(ex.exportDxfText({ project, drawingIds: [project.drawings[0].id], dxfLayers: ALL_ON }));
    const rack = parsed.entities.filter((e: any) => e.layer === DXF_LAYER_RACK);
    expect(rack.length).toBeGreaterThan(0);
    expect(unescapeDxfText(rack[0].text)).toContain('机柜');
  });

  it('export() 主入口：include.dxfOverlay + formats 含 dxf 才产出（向后兼容扩展位）', async () => {
    const ex = exporterForFixture();
    const project = makeProject();
    const include = {
      pointMap: false, fovMap: false, topology: false,
      deviceList: false, cableList: false, report: false,
      [INCLUDE_DXF_OVERLAY]: true,
    };
    const withDxf: any = await ex.export({
      drawingIds: project.drawings.map(d => d.id),
      formats: ['dxf'],
      include,
      outputDir: '',
    });
    expect(withDxf.success).toBe(true);
    const dxf = withDxf.files.find((f: any) => f.format === 'dxf');
    expect(dxf, '未产出 DXF 文件').toBeTruthy();
    expect(dxf.dataBase64.length).toBeGreaterThan(100);
    expect(dxf.size).toBeGreaterThan(0);

    // 老数据（include 无 dxfOverlay 键）不得凭空多出 DXF 产物
    const legacy: any = await ex.export({
      drawingIds: project.drawings.map(d => d.id),
      formats: ['dxf'],
      include: {
        pointMap: false, fovMap: false, topology: false,
        deviceList: false, cableList: false, report: false,
      },
      outputDir: '',
    });
    expect(legacy.files.filter((f: any) => f.format === 'dxf')).toHaveLength(0);
  });

  it('exportDxfOverlay 产出 ExportFile 形状：path 含 .dxf、size 与 base64 解码一致', async () => {
    const ex = exporterForFixture();
    const project = makeProject();
    const file = await ex.exportDxfOverlay({ project, drawingIds: [project.drawings[0].id], dxfLayers: ALL_ON });
    expect(file).toBeTruthy();
    expect(file!.format).toBe('dxf');
    expect(file!.path.endsWith('.dxf')).toBe(true);
    const decoded = Buffer.from(file!.dataBase64!, 'base64').toString('utf8');
    expect(decoded.endsWith('  0\nEOF\n')).toBe(true);
    expect(Buffer.byteLength(decoded, 'utf8')).toBe(file!.size);
  });

  it('图纸不存在时明确报错而非静默产出空文件', async () => {
    const ex = exporterForFixture();
    const project = makeProject();
    expect(() => ex.exportDxfText({ project, drawingIds: ['no-such-drawing'] })).toThrow(/图纸不存在/);
    const viaEntry: any = await ex.export({
      drawingIds: ['no-such-drawing'],
      formats: ['dxf'],
      include: {
        pointMap: false, fovMap: false, topology: false,
        deviceList: false, cableList: false, report: false, [INCLUDE_DXF_OVERLAY]: true,
      } as any,
      outputDir: '',
    });
    expect(viaEntry.files.filter((f: any) => f.format === 'dxf')).toHaveLength(0);
  });
});
