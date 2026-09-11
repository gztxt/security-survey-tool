/**
 * DXF R12 ASCII writer（纯函数、无 DOM、零第三方依赖）
 *
 * 设计依据：架构决策 2 —— 需求实体集极小且确定（LINE / CIRCLE / TEXT / INSERT +
 * LAYER / BLOCK_RECORD / LTYPE 表），R12 ASCII 是中望 / 浩辰 / CASS / AutoCAD
 * 兼容性最好的下限格式。本文件只负责"结构化文档 → DXF 文本"，不做业务映射
 * （业务映射在 exporter/index.ts 的 buildDxfDoc）。
 *
 * 关键约定：
 * - 坐标系：DXF 为 Y 向上，画布为 Y 向下。默认 flipY=true，按 origin.y（缺省取全图
 *   maxY）镜像，保证在 CAD 中打开方向不颠倒。
 * - 中文：R12 ASCII 的 TEXT 在中文 CAD 里按 GBK 解、AutoCAD 看 $DWGCODEPAGE。
 *   两者唯一同时正确的组合是：header 写 ANSI_936，非 ASCII 字符统一转义为
 *   DXF 标准 \U+XXXX（Unicode 码点，4 位十六进制大写）。零依赖、纯字符串实现。
 */

import type { Point2D } from '@security-survey/shared-types';

// ============ 文档模型 ============

export interface DxfLayerSpec {
  name: string;
  /** ACI 颜色索引（1-255） */
  color?: number;
  lineType?: string;
  /** true → 图层表 70 标志置 1（冻结）。overlay 场景用于"未勾选该类别时冻结其图层" */
  frozen?: boolean;
}

export interface DxfLine {
  type: 'LINE';
  start: Point2D;
  end: Point2D;
  layer: string;
  color?: number;
}

export interface DxfCircle {
  type: 'CIRCLE';
  center: Point2D;
  radius: number;
  layer: string;
  color?: number;
}

export interface DxfText {
  type: 'TEXT';
  position: Point2D;
  height: number;
  text: string;
  layer: string;
  rotation?: number;
  color?: number;
}

export interface DxfInsert {
  type: 'INSERT';
  block: string;
  position: Point2D;
  scale?: Point2D;
  rotation?: number;
  layer: string;
  color?: number;
}

export type DxfEntity = DxfLine | DxfCircle | DxfText | DxfInsert;

export interface DxfBlockDef {
  name: string;
  entities: DxfEntity[];
  basePoint?: Point2D;
}

export interface DxfDoc {
  layers: DxfLayerSpec[];
  blocks?: DxfBlockDef[];
  entities: DxfEntity[];
  /** 默认 true：按 baseY 镜像 Y（CAD Y 向上） */
  flipY?: boolean;
  /** 镜像基准与图幅原点；缺省由全图 bounds 推得 */
  origin?: Point2D;
  /** 显式图幅（未翻转的画布坐标）。缺省由 entities 推得 */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

// ============ 固定图层方案（overlay 专用，统一 SS- 前缀避免与底图重名）============

export const DXF_LAYER_DEVICE = 'SS-DEVICE';
export const DXF_LAYER_DEVICE_TEXT = 'SS-DEVICE-TXT';
export const DXF_LAYER_CABLE = 'SS-CABLE';
export const DXF_LAYER_TRAY = 'SS-TRAY';
export const DXF_LAYER_WELL = 'SS-WELL';
export const DXF_LAYER_RACK = 'SS-RACK';
export const DXF_LAYER_BLOCK_DEV = 'SS-BLOCK-DEV';
/** R12 必备的标准图层 */
export const DXF_LAYER_ZERO = '0';

/** include 开关 → 图层冻结位（图层数量恒为 7，仅冻结） */
export interface DxfIncludeFlags {
  devices: boolean;
  cables: boolean;
  trays: boolean;
  wells: boolean;
  texts: boolean;
}

const PLANNED_LAYERS: ReadonlyArray<{ name: string; color: number; key?: keyof DxfIncludeFlags }> = [
  { name: DXF_LAYER_DEVICE, color: 5, key: 'devices' },        // 蓝
  { name: DXF_LAYER_DEVICE_TEXT, color: 7, key: 'texts' },     // 白
  { name: DXF_LAYER_CABLE, color: 3, key: 'cables' },          // 绿
  { name: DXF_LAYER_TRAY, color: 8, key: 'trays' },            // 灰
  { name: DXF_LAYER_WELL, color: 6, key: 'wells' },            // 品红
  { name: DXF_LAYER_RACK, color: 2, key: 'devices' },          // 黄
  { name: DXF_LAYER_BLOCK_DEV, color: 0 },                     // 块定义专用
];

/**
 * 按勾选范围给出 7 个 SS-* 图层（顺序稳定）。未勾选的类别其图层以"冻结"呈现，
 * 而不是从表里删除 —— 保证 CAD 侧图层管理器结构稳定，用户可自行解冻比对。
 */
export function dxfLayerPlanFor(inc: DxfIncludeFlags): DxfLayerSpec[] {
  return PLANNED_LAYERS.map(spec => ({
    name: spec.name,
    color: spec.color,
    lineType: 'CONTINUOUS',
    frozen: spec.key ? !inc[spec.key] : false,
  }));
}

// ============ 基础工具 ============

/** 组码对 → "code\nvalue" 文本。0 组码顶格，其余右对齐占 3 位（DXF 惯例） */
export function toGroupCode(pairs: Array<[number, string | number]>): string {
  const out: string[] = [];
  for (const [code, value] of pairs) {
    out.push(code < 1000 ? String(code).padStart(3, ' ') : String(code));
    out.push(typeof value === 'number' ? fmtNum(value) : String(value));
  }
  return out.join('\n');
}

/** 数值格式化：最多 6 位小数，去尾零，避免 -0 与科学计数法 */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  let s = n.toFixed(6).replace(/\.?0+$/, '');
  if (s === '' || s === '-') s = '0';
  if (s === '-0') s = '0';
  return s;
}

/** 非 ASCII → \U+XXXX；ASCII 控制字符与分号按 DXF 惯例保守处理 */
export function escapeDxfText(s: string): string {
  const src = String(s ?? '');
  const out: string[] = [];
  for (const ch of src) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0a || cp === 0x0d) {
      out.push('\\P');            // DXF 内换行
    } else if (cp < 0x20) {
      out.push(' ');              // 其余控制字符不可打印，降级为空格
    } else if (cp < 0x7f) {
      out.push(ch === '\\' ? '\\\\' : ch);
    } else if (cp <= 0xffff) {
      out.push('\\U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
    } else {
      out.push('?');              // R12 无法转义辅助平面字符
    }
  }
  return out.join('');
}

/** escapeDxfText 的逆运算，供"写出 → 读回"往返断言使用 */
export function unescapeDxfText(s: string): string {
  return String(s ?? '')
    .replace(/\\P/g, '\n')
    .replace(/\\\\/g, '\u0000BACKSLASH\u0000')
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\u0000BACKSLASH\u0000/g, '\\');
}

/** Y 向翻转（baseY 为镜像轴） */
export function flipYPoint(p: Point2D, baseY: number): Point2D {
  return { x: p.x, y: baseY - p.y };
}

function collectBounds(doc: DxfDoc): { minX: number; maxX: number; minY: number; maxY: number } {
  if (doc.bounds) return doc.bounds;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const eat = (p: Point2D) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  };
  // 只统计模型空间实体：块内坐标是"相对基点"的局部量，纳入全局图幅会失真
  for (const e of doc.entities || []) {
    if (e.type === 'LINE') { eat(e.start); eat(e.end); }
    else if (e.type === 'CIRCLE') { eat(e.center); eat({ x: e.center.x + e.radius, y: e.center.y + e.radius }); }
    else { eat(e.position); }
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
  return { minX, maxX, minY, maxY };
}

// ============ 段写出 ============

function pointLines(prefix: number, p: Point2D, baseY: number, flip: boolean): Array<[number, string | number]> {
  const q = flip ? flipYPoint(p, baseY) : p;
  return [[prefix, q.x], [prefix + 10, q.y], [prefix + 20, 0]];
}

function writeEntity(e: DxfEntity, baseY: number, flip: boolean, out: string[]): void {
  const pairs: Array<[number, string | number]> = [[0, e.type], [8, e.layer || DXF_LAYER_ZERO]];
  if (typeof e.color === 'number' && e.color > 0) pairs.push([62, e.color]);
  switch (e.type) {
    case 'LINE':
      pairs.push(...pointLines(10, e.start, baseY, flip), ...pointLines(11, e.end, baseY, flip));
      break;
    case 'CIRCLE':
      pairs.push(...pointLines(10, e.center, baseY, flip), [40, e.radius]);
      break;
    case 'TEXT':
      pairs.push(
        ...pointLines(10, e.position, baseY, flip),
        ...pointLines(11, e.position, baseY, flip),   // 对齐点与插入点重合，兼容 strict parser
        [40, e.height], [1, escapeDxfText(e.text)],
        [50, e.rotation ?? 0], [72, 0], [73, 0],
      );
      break;
    case 'INSERT':
      pairs.push(
        ...pointLines(10, e.position, baseY, flip),
        [2, e.block],
        [41, e.scale?.x ?? 1], [42, e.scale?.y ?? 1], [43, 1],
        [50, e.rotation ?? 0],
      );
      break;
  }
  out.push(toGroupCode(pairs));
}

/** DXF 变量：组码 9 + 值组码。类型码由值类型决定（1=串、10=点、40=浮点、70=整型） */
function writeVar(name: string, pairs: Array<[number, string | number]>): string {
  return toGroupCode([[9, name], ...pairs]);
}

function writeHeader(bounds: { minX: number; maxX: number; minY: number; maxY: number }, out: string[]): void {
  out.push(toGroupCode([[0, 'SECTION'], [2, 'HEADER']]));
  out.push(writeVar('$ACADVER', [[1, 'AC1009']]));
  out.push(writeVar('$DWGCODEPAGE', [[3, 'ANSI_936']]));
  out.push(writeVar('$INSUNITS', [[70, 4]]));            // 4 = 毫米（与模型坐标单位一致）
  out.push(writeVar('$MEASUREMENT', [[70, 1]]));         // 1 = 公制
  out.push(writeVar('$LUNITS', [[70, 2]]));              // 2 = 十进制
  out.push(writeVar('$LUPREC', [[70, 2]]));
  out.push(writeVar('$AUPREC', [[70, 0]]));
  out.push(writeVar('$LTSCALE', [[40, 1]]));
  out.push(writeVar('$TEXTSIZE', [[40, 250]]));
  out.push(writeVar('$ATTMODE', [[70, 0]]));
  out.push(writeVar('$FILEDIA', [[70, 1]]));
  out.push(writeVar('$SNAPSTYLE', [[70, 0]]));
  out.push(writeVar('$PDMODE', [[70, 0]]));
  out.push(writeVar('$PDSIZE', [[40, 0]]));
  out.push(writeVar('$SPLINESEGS', [[70, 8]]));
  out.push(writeVar('$EXTMIN', [[10, bounds.minX], [20, bounds.minY], [30, 0]]));
  out.push(writeVar('$EXTMAX', [[10, bounds.maxX], [20, bounds.maxY], [30, 0]]));
  out.push(writeVar('$LIMMIN', [[10, bounds.minX], [20, bounds.minY]]));
  out.push(writeVar('$LIMMAX', [[10, bounds.maxX], [20, bounds.maxY]]));
  out.push(toGroupCode([[0, 'ENDSEC']]));
}

function writeTable(name: string, rows: string[][], out: string[]): void {
  out.push(toGroupCode([[0, 'TABLE'], [2, name], [70, rows.length]]));
  for (const row of rows) out.push(row.join('\n'));
  out.push(toGroupCode([[0, 'ENDTAB']]));
}

function writeLayers(layers: DxfLayerSpec[], out: string[]): void {
  const rows: string[][] = [];
  const all: DxfLayerSpec[] = [{ name: DXF_LAYER_ZERO, color: 7, lineType: 'CONTINUOUS' }, ...layers];
  for (const l of all) {
    rows.push([
      toGroupCode([[0, 'LAYER'], [2, l.name], [70, l.frozen ? 1 : 0], [62, l.color ?? 7], [6, l.lineType || 'CONTINUOUS']]),
    ]);
  }
  writeTable('LAYER', rows, out);
}

function writeLTypes(out: string[]): void {
  const rows = [
    [toGroupCode([[0, 'LTYPE'], [2, 'ByBlock'], [70, 0], [3, ''], [72, 65], [73, 0], [40, 0]])],
    [toGroupCode([[0, 'LTYPE'], [2, 'ByLayer'], [70, 0], [3, ''], [72, 65], [73, 0], [40, 0]])],
    [toGroupCode([[0, 'LTYPE'], [2, 'CONTINUOUS'], [70, 0], [3, 'Solid line'], [72, 65], [73, 0], [40, 0]])],
  ];
  writeTable('LTYPE', rows, out);
}

function writeBlockRecords(blockNames: string[], out: string[]): void {
  const rows = [DXF_LAYER_ZERO, ...blockNames].map(n =>
    [toGroupCode([[0, 'BLOCK_RECORD'], [2, n], [70, 0]])]);
  writeTable('BLOCK_RECORD', rows, out);
}

function writeStyle(out: string[]): void {
  writeTable('STYLE', [[toGroupCode([[0, 'STYLE'], [2, 'Standard'], [70, 0], [40, 0], [41, 1], [50, 0], [71, 0], [42, 250], [3, ''], [4, '']])]], out);
}

function writeBlocks(doc: DxfDoc, baseY: number, flip: boolean, out: string[]): void {
  out.push(toGroupCode([[0, 'SECTION'], [2, 'BLOCKS']]));
  // 1) 模型空间块（R12 名为 "0"），必须存在
  out.push(toGroupCode([[0, 'BLOCK'], [8, DXF_LAYER_ZERO], [2, DXF_LAYER_ZERO], [70, 0], [10, 0], [20, 0], [30, 0], [3, DXF_LAYER_ZERO]]));
  out.push(toGroupCode([[0, 'ENDBLK']]));
  for (const block of doc.blocks || []) {
    const bp = flip ? flipYPoint(block.basePoint ?? { x: 0, y: 0 }, baseY) : (block.basePoint ?? { x: 0, y: 0 });
    out.push(toGroupCode([
      [0, 'BLOCK'], [8, DXF_LAYER_BLOCK_DEV], [2, block.name], [70, 0],
      [10, bp.x], [20, bp.y], [30, 0], [3, block.name],
    ]));
    // 块内是"相对基点"的局部坐标：整体镜像等价于绕基点取反（y' = 2·baseY_local − y），
    // 与已镜像的 INSERT 位置保持一致，符号/朝向才不会上下颠倒。
    const localBase = (block.basePoint ?? { x: 0, y: 0 }).y;
    for (const e of block.entities) {
      const inner = flip ? ({ ...e, ...remapEntity(e, localBase, true) } as DxfEntity) : e;
      writeEntity(inner, localBase, false, out);
    }
    out.push(toGroupCode([[0, 'ENDBLK']]));
  }
  out.push(toGroupCode([[0, 'ENDSEC']]));
}

/** 块内实体做 Y 取反换算（writeBlocks 内部以 flip=false 原样输出已换算坐标） */
function remapEntity(e: DxfEntity, axisY: number, flip: boolean): Partial<DxfEntity> {
  if (!flip) return {};
  switch (e.type) {
    case 'LINE': return { start: flipYPoint(e.start, axisY), end: flipYPoint(e.end, axisY) };
    case 'CIRCLE': return { center: flipYPoint(e.center, axisY) };
    default: return { position: flipYPoint((e as DxfText | DxfInsert).position, axisY) };
  }
}

function writeEntities(doc: DxfDoc, baseY: number, flip: boolean, out: string[]): void {
  out.push(toGroupCode([[0, 'SECTION'], [2, 'ENTITIES']]));
  for (const e of doc.entities) writeEntity(e, baseY, flip, out);
  out.push(toGroupCode([[0, 'ENDSEC']]));
}

// ============ 主入口 ============

/**
 * 输出一份完整的 DXF R12 ASCII 文本（LF 换行，UTF-8 字节）。
 * 结构：HEADER → TABLES(LAYER/LTYPE/BLOCK_RECORD/STYLE) → BLOCKS → ENTITIES → EOF
 */
export function writeDxf(doc: DxfDoc): string {
  const bounds = collectBounds(doc);
  const flip = doc.flipY !== false;
  const baseY = doc.origin?.y ?? bounds.maxY;
  // $EXTMIN/$EXTMAX 必须是 DXF 坐标系（Y 向上）下的图幅，故翻转后需换算
  const headerBounds = flip
    ? { minX: bounds.minX, maxX: bounds.maxX, minY: baseY - bounds.maxY, maxY: baseY - bounds.minY }
    : bounds;
  const out: string[] = [];

  writeHeader(headerBounds, out);

  out.push(toGroupCode([[0, 'SECTION'], [2, 'TABLES']]));
  writeLayers(doc.layers || [], out);
  writeLTypes(out);
  writeBlockRecords((doc.blocks || []).map(b => b.name), out);
  writeStyle(out);
  out.push(toGroupCode([[0, 'ENDSEC']]));

  writeBlocks(doc, baseY, flip, out);
  writeEntities(doc, baseY, flip, out);

  out.push(toGroupCode([[0, 'EOF']]));
  return out.join('\n') + '\n';
}
