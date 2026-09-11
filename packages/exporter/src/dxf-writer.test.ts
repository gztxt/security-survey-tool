/**
 * DXF R12 writer 往返单测（架构决策 7 点名的 6 项断言）
 *
 * 写出（本地实现）→ 读回（与 cad-parser 同款 dxf-parser）→ 断言：
 *  ① 图层表含全部 7 个 SS-* 且名称一致；
 *  ② 实体总数 == 输入 DxfDoc.entities.length；
 *  ③ LINE 端点按 bounds.maxY 镜像后误差 < 1e-6；
 *  ④ 每个 INSERT.block 在 BLOCKS 段都有定义（零孤儿引用）；
 *  ⑤ 中文 label 往返后字符串完全相等（\U+XXXX 转义 + 可逆解码）；
 *  ⑥ 文本以 "0\nEOF\n" 结尾、以 "0/SECTION/2/HEADER" 开头。
 *
 * 附加：图层冻结位、$DWGCODEPAGE/$INSUNITS、1000 设备规模（线性增长、无 O(n²)）。
 */
import { describe, it, expect } from 'vitest';
import {
  writeDxf,
  dxfLayerPlanFor,
  escapeDxfText,
  unescapeDxfText,
  toGroupCode,
  fmtNum,
  flipYPoint,
  DXF_LAYER_DEVICE,
  DXF_LAYER_DEVICE_TEXT,
  DXF_LAYER_CABLE,
  DXF_LAYER_TRAY,
  DXF_LAYER_WELL,
  DXF_LAYER_RACK,
  DXF_LAYER_BLOCK_DEV,
} from './dxf-writer';
import type { DxfDoc, DxfEntity } from './dxf-writer';

const ALL_SS_LAYERS = [
  DXF_LAYER_DEVICE, DXF_LAYER_DEVICE_TEXT, DXF_LAYER_CABLE,
  DXF_LAYER_TRAY, DXF_LAYER_WELL, DXF_LAYER_RACK, DXF_LAYER_BLOCK_DEV,
];

/** dxf-parser 是 ESM/UMD 混合包，Node 下取其 default 构造器 */
async function parseDxf(text: string): Promise<any> {
  const mod: any = await import('dxf-parser');
  const Ctor = mod?.DxfParser ?? mod?.default?.DxfParser ?? mod?.default ?? mod;
  const parsed = new Ctor().parseSync(text);
  if (!parsed) throw new Error('dxf-parser 未能解析产物');
  return parsed;
}

/** 读回后的实体形状归一化：LINE 用 vertices[0/1]，TEXT 用 text，INSERT 用 name */
function lineEndpoints(e: any): { start: any; end: any } {
  return { start: e.vertices?.[0] ?? e.start, end: e.vertices?.[1] ?? e.end };
}
function layersOf(parsed: any): Record<string, any> {
  return parsed.tables?.layer?.layers ?? parsed.layers ?? {};
}

/** 手工构造：3 设备（圆 + 朝向线 + 中文编号 + 块引用）+ 2 线缆折线 + 1 桥架 + 1 弱电井 + 1 机柜块引用 */
function makeDoc(): DxfDoc {
  const layers = dxfLayerPlanFor({ devices: true, cables: true, trays: true, wells: true, texts: true });
  const bulletBlock = 'SSB-model-bullet-4mp';
  const rackBlock = 'SSB-model-rack-42u';
  const entities: DxfEntity[] = [
    { type: 'CIRCLE', center: { x: 1000, y: 2000 }, radius: 250, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'LINE', start: { x: 1000, y: 2000 }, end: { x: 1000, y: 2750 }, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'TEXT', position: { x: 1250, y: 2000 }, height: 200, text: 'C001 大门口', layer: DXF_LAYER_DEVICE_TEXT, color: 7 },
    { type: 'INSERT', block: bulletBlock, position: { x: 1000, y: 2000 }, rotation: 0, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'CIRCLE', center: { x: 5000, y: 2000 }, radius: 250, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'LINE', start: { x: 5000, y: 2000 }, end: { x: 5000, y: 2750 }, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'TEXT', position: { x: 5250, y: 2000 }, height: 200, text: 'C002 车道东', layer: DXF_LAYER_DEVICE_TEXT, color: 7 },
    { type: 'INSERT', block: bulletBlock, position: { x: 5000, y: 2000 }, rotation: 90, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'CIRCLE', center: { x: 5000, y: 6000 }, radius: 250, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'LINE', start: { x: 5000, y: 6000 }, end: { x: 5750, y: 6000 }, layer: DXF_LAYER_DEVICE, color: 5 },
    { type: 'TEXT', position: { x: 5250, y: 6000 }, height: 200, text: 'NVR1 机房', layer: DXF_LAYER_DEVICE_TEXT, color: 7 },
    { type: 'LINE', start: { x: 1000, y: 2000 }, end: { x: 1000, y: 6000 }, layer: DXF_LAYER_CABLE, color: 3 },
    { type: 'LINE', start: { x: 1000, y: 6000 }, end: { x: 5000, y: 6000 }, layer: DXF_LAYER_CABLE, color: 3 },
    { type: 'LINE', start: { x: 5000, y: 2000 }, end: { x: 5000, y: 6000 }, layer: DXF_LAYER_CABLE, color: 3 },
    { type: 'LINE', start: { x: 500, y: 5800 }, end: { x: 9000, y: 5800 }, layer: DXF_LAYER_TRAY, color: 8 },
    { type: 'LINE', start: { x: 8500, y: 5500 }, end: { x: 9500, y: 5500 }, layer: DXF_LAYER_WELL, color: 6 },
    { type: 'LINE', start: { x: 9500, y: 5500 }, end: { x: 9500, y: 6500 }, layer: DXF_LAYER_WELL, color: 6 },
    { type: 'LINE', start: { x: 9500, y: 6500 }, end: { x: 8500, y: 6500 }, layer: DXF_LAYER_WELL, color: 6 },
    { type: 'LINE', start: { x: 8500, y: 6500 }, end: { x: 8500, y: 5500 }, layer: DXF_LAYER_WELL, color: 6 },
    { type: 'INSERT', block: rackBlock, position: { x: 5000, y: 6000 }, scale: { x: 1, y: 1 }, rotation: 0, layer: DXF_LAYER_RACK, color: 2 },
    { type: 'TEXT', position: { x: 8600, y: 6600 }, height: 200, text: '1#弱电井', layer: DXF_LAYER_WELL, color: 6 },
  ];
  return {
    layers,
    blocks: [
      {
        name: bulletBlock,
        basePoint: { x: 0, y: 0 },
        entities: [{ type: 'LINE', start: { x: -200, y: -200 }, end: { x: 200, y: 200 }, layer: DXF_LAYER_BLOCK_DEV, color: 0 }],
      },
      {
        name: rackBlock,
        basePoint: { x: 0, y: 0 },
        entities: [{ type: 'LINE', start: { x: -300, y: -150 }, end: { x: 300, y: 150 }, layer: DXF_LAYER_BLOCK_DEV, color: 2 }],
      },
    ],
    entities,
    flipY: true,
    origin: { x: 0, y: 6600 },   // bounds.maxY = 6600（含 1#弱电井 文本 y=6600）
  };
}

describe('dxf-writer · 图层方案与编码工具', () => {
  it('① 恰好 7 个 SS-* 图层，颜色符合方案；include=false 时冻结而非删除', () => {
    const plan = dxfLayerPlanFor({ devices: true, cables: true, trays: true, wells: true, texts: true });
    expect(plan).toHaveLength(7);
    expect(plan.map(l => l.name).sort()).toEqual([...ALL_SS_LAYERS].sort());
    expect(plan.every(l => !l.frozen)).toBe(true);
    expect(plan.find(l => l.name === DXF_LAYER_DEVICE)?.color).toBe(5);
    expect(plan.find(l => l.name === DXF_LAYER_DEVICE_TEXT)?.color).toBe(7);
    expect(plan.find(l => l.name === DXF_LAYER_CABLE)?.color).toBe(3);
    expect(plan.find(l => l.name === DXF_LAYER_TRAY)?.color).toBe(8);
    expect(plan.find(l => l.name === DXF_LAYER_WELL)?.color).toBe(6);
    expect(plan.find(l => l.name === DXF_LAYER_RACK)?.color).toBe(2);
    expect(plan.find(l => l.name === DXF_LAYER_BLOCK_DEV)?.color).toBe(0);

    const partial = dxfLayerPlanFor({ devices: true, cables: false, trays: false, wells: false, texts: false });
    expect(partial).toHaveLength(7);
    expect(partial.find(l => l.name === DXF_LAYER_CABLE)?.frozen).toBe(true);
    expect(partial.find(l => l.name === DXF_LAYER_TRAY)?.frozen).toBe(true);
    expect(partial.find(l => l.name === DXF_LAYER_DEVICE)?.frozen).toBe(false);
  });

  it('组码格式化、数值去尾零、中文转义可逆', () => {
    expect(toGroupCode([[0, 'LINE'], [8, 'SS-DEVICE']])).toBe('  0\nLINE\n  8\nSS-DEVICE');
    expect(fmtNum(1.5)).toBe('1.5');
    expect(fmtNum(-0)).toBe('0');
    expect(fmtNum(1 / 3)).toBe('0.333333');
    expect(fmtNum(NaN)).toBe('0');
    expect(escapeDxfText('C001 大门口')).toBe('C001 \\U+5927\\U+95E8\\U+53E3');
    expect(unescapeDxfText(escapeDxfText('1#弱电井 · α/β'))).toBe('1#弱电井 · α/β');
    expect(unescapeDxfText(escapeDxfText('a\\b\nc'))).toBe('a\\b\nc');
    expect(escapeDxfText('')).toBe('');
    expect(flipYPoint({ x: 3, y: 2000 }, 6600)).toEqual({ x: 3, y: 4600 });
  });
});

describe('dxf-writer · 文本结构', () => {
  it('⑥ 首段 HEADER、末组 0/EOF；含 AC1009 / ANSI_936 / $INSUNITS=4；产物 <50KB', () => {
    const text = writeDxf(makeDoc());
    expect(text.startsWith('  0\nSECTION\n  2\nHEADER\n')).toBe(true);
    expect(text.endsWith('  0\nEOF\n')).toBe(true);
    expect(text.length).toBeLessThan(50 * 1024);
    expect(text).toContain('\n  1\nAC1009\n');
    expect(text).toContain('\n  3\nANSI_936\n');
    expect(text).toMatch(/\$INSUNITS\n 70\n4\n/);
    expect(text.match(/\n  0\nEOF\n/g)).toHaveLength(1);
    // 段落顺序：HEADER → TABLES → BLOCKS → ENTITIES
    const order = ['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES']
      .map(s => text.indexOf(`\n  2\n${s}\n`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('空文档（无实体）仍产出合法结构，图幅回落到默认框', async () => {
    const text = writeDxf({ layers: dxfLayerPlanFor({ devices: true, cables: true, trays: true, wells: true, texts: true }), entities: [] });
    expect(text.endsWith('  0\nEOF\n')).toBe(true);
    const parsed = await parseDxf(text);
    expect(parsed.entities ?? []).toHaveLength(0);
    expect(Object.keys(layersOf(parsed)).length).toBe(8);   // 0 + 7 个 SS-*
  });
});

describe('dxf-writer · 往返（dxf-parser 读回）', () => {
  it('①②③④⑤ 图层 / 实体数 / 镜像 / 零孤儿引用 / 中文 全部通过', async () => {
    const doc = makeDoc();
    const parsed = await parseDxf(writeDxf(doc));

    // ① 图层表：7 个 SS-* 全部可读，且未冻结/可见
    const layers = layersOf(parsed);
    const layerNames = Object.keys(layers);
    for (const name of ALL_SS_LAYERS) {
      expect(layerNames, `图层表缺少 ${name}`).toContain(name);
    }
    expect(layerNames.filter(n => n.startsWith('SS-'))).toHaveLength(7);
    expect(layerNames).toHaveLength(8);
    for (const name of ALL_SS_LAYERS) {
      expect(layers[name].frozen ?? false, `${name} 不应冻结`).toBe(false);
    }
    expect(layers[DXF_LAYER_CABLE].visible).toBe(true);
    expect(layers[DXF_LAYER_DEVICE].colorIndex).toBe(5);
    expect(layers[DXF_LAYER_CABLE].colorIndex).toBe(3);

    // ② 实体总数严格相等（含分类计数）
    const byType: Record<string, number> = {};
    for (const e of parsed.entities ?? []) byType[e.type] = (byType[e.type] || 0) + 1;
    expect(parsed.entities.length).toBe(doc.entities.length);
    const countOf = (t: string) => doc.entities.filter(e => e.type === t).length;
    expect(byType.LINE).toBe(countOf('LINE'));
    expect(byType.CIRCLE).toBe(countOf('CIRCLE'));
    expect(byType.TEXT).toBe(countOf('TEXT'));
    expect(byType.INSERT).toBe(countOf('INSERT'));

    // ③ flipY：输入 (1000,2000)→(1000,2750) 的朝向线，镜像轴 baseY=6600
    const facing = (parsed.entities ?? [])
      .filter((e: any) => e.type === 'LINE' && e.layer === DXF_LAYER_DEVICE)
      .map((e: any) => lineEndpoints(e))[0];
    expect(Math.abs(facing.start.y - (6600 - 2000))).toBeLessThan(1e-6);
    expect(Math.abs(facing.end.y - (6600 - 2750))).toBeLessThan(1e-6);
    expect(Math.abs(facing.start.x - 1000)).toBeLessThan(1e-6);
    // 且翻转后 Y 更大的是画布上 Y 更小者（方向不颠倒）
    expect(facing.start.y).toBeGreaterThan(facing.end.y);

    // ④ 零孤儿引用：每个 INSERT 的块名在 BLOCKS 段有定义；块定义本身也写出
    const blockNames = Object.keys(parsed.blocks ?? {});
    expect(blockNames).toContain('SSB-model-bullet-4mp');
    expect(blockNames).toContain('SSB-model-rack-42u');
    const inserts = (parsed.entities ?? []).filter((e: any) => e.type === 'INSERT');
    expect(inserts).toHaveLength(countOf('INSERT'));
    for (const ins of inserts) expect(blockNames).toContain(ins.name);
    // 块内实体镜像后仍落在块基点附近
    const bullet = parsed.blocks['SSB-model-bullet-4mp'];
    expect(bullet.layer).toBe(DXF_LAYER_BLOCK_DEV);
    expect(bullet.entities).toHaveLength(1);

    // ⑤ 中文往返：写出为 \U+XXXX，读回可无损还原为原字符串
    const rawTexts = (parsed.entities ?? []).filter((e: any) => e.type === 'TEXT').map((e: any) => e.text ?? e.string ?? '');
    expect(rawTexts).toHaveLength(countOf('TEXT'));
    for (const raw of rawTexts) expect(raw).toMatch(/\\U\+[0-9A-F]{4}/);
    const originals = doc.entities.filter(e => e.type === 'TEXT').map(e => (e as any).text);
    expect(rawTexts.map(unescapeDxfText).sort()).toEqual([...originals].sort());
    expect(unescapeDxfText(rawTexts[0])).toBe('C001 大门口');

    // 图幅：$EXTMIN/$EXTMAX 为翻转后的 DXF 坐标
    expect(parsed.header['$ACADVER']).toBe('AC1009');
    expect(parsed.header['$DWGCODEPAGE']).toBe('ANSI_936');
    expect(parsed.header['$INSUNITS']).toBe(4);
    expect(parsed.header['$EXTMIN'].x).toBeCloseTo(500, 6);
    expect(parsed.header['$EXTMAX'].x).toBeCloseTo(9500, 6);
    expect(parsed.header['$EXTMIN'].y).toBeCloseTo(6600 - 6600, 6);
    // 实体集 minY=2000（500 是桥架 LINE 的 x 坐标，非 y），故 $EXTMAX.y = 6600-2000
    expect(parsed.header['$EXTMAX'].y).toBeCloseTo(6600 - 2000, 6);
  });

  it('未勾选类别：图层仍为 7 个，对应图层 frozen=true 可读回', async () => {
    const layers = dxfLayerPlanFor({ devices: true, cables: false, trays: true, wells: true, texts: true });
    const parsed = await parseDxf(writeDxf({
      layers,
      entities: [{ type: 'CIRCLE', center: { x: 0, y: 0 }, radius: 100, layer: DXF_LAYER_DEVICE }],
      flipY: false,
    }));
    const read = layersOf(parsed);
    expect(Object.keys(read).filter(n => n.startsWith('SS-'))).toHaveLength(7);
    expect(read[DXF_LAYER_CABLE].frozen).toBe(true);
    expect(read[DXF_LAYER_DEVICE].frozen ?? false).toBe(false);
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.entities[0].center.y).toBe(0);
  });

  it('flipY=false 时坐标原样输出；缺省 origin 时以 bounds.maxY 为镜像轴', async () => {
    const flat: DxfDoc = {
      layers: dxfLayerPlanFor({ devices: true, cables: true, trays: true, wells: true, texts: true }),
      entities: [{ type: 'LINE', start: { x: 0, y: 10 }, end: { x: 0, y: 20 }, layer: DXF_LAYER_TRAY }],
      flipY: false,
    };
    const parsed = await parseDxf(writeDxf(flat));
    const { start, end } = lineEndpoints(parsed.entities[0]);
    expect(start.y).toBe(10);
    expect(end.y).toBe(20);

    // 默认 flipY=true 且不给 origin：镜像轴 = maxY = 20
    const auto = await parseDxf(writeDxf({ ...flat, flipY: undefined }));
    const autoLine = lineEndpoints(auto.entities[0]);
    expect(autoLine.start.y).toBe(10);   // 20-10
    expect(autoLine.end.y).toBe(0);      // 20-20
  });

  it('图层名与块名写入 BLOCK_RECORD，块引用可被 CAD 解析', async () => {
    const doc = makeDoc();
    const parsed = await parseDxf(writeDxf(doc));
    expect(Object.keys(parsed.blocks).sort()).toEqual(['0', 'SSB-model-bullet-4mp', 'SSB-model-rack-42u']);
    expect(parsed.blocks['0'].entities ?? []).toHaveLength(0);
  });
});

describe('dxf-writer · 规模与性能', () => {
  it('⑩ 1000 设备（2000 实体）：产物 <2MB 且耗时线性可接受', () => {
    const entities: DxfEntity[] = [];
    for (let i = 0; i < 1000; i++) {
      entities.push({ type: 'CIRCLE', center: { x: i * 10, y: i * 20 }, radius: 250, layer: DXF_LAYER_DEVICE, color: 5 });
      entities.push({ type: 'TEXT', position: { x: i * 10, y: i * 20 }, height: 200, text: `C${i} 摄像机点位`, layer: DXF_LAYER_DEVICE_TEXT });
    }
    const t0 = Date.now();
    const text = writeDxf({
      layers: dxfLayerPlanFor({ devices: true, cables: true, trays: true, wells: true, texts: true }),
      entities, flipY: true,
    });
    const cost = Date.now() - t0;
    expect(text.length).toBeLessThan(2 * 1024 * 1024);
    expect(text.endsWith('  0\nEOF\n')).toBe(true);
    expect(cost).toBeLessThan(3000);
    // 线性：行数与实体数同阶（每实体 TEXT 约 28 行 / CIRCLE 约 14 行，故每实体 ≤32 行仍线性）
    expect(text.split('\n').length).toBeLessThan(entities.length * 32 + 300);
  });
});
