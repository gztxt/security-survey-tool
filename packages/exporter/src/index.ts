// 导出引擎模块
// 点位图/视野图/拓扑图/设备清单/方案报告 多格式导出

import {
  Project,
  Drawing,
  DeviceInstance,
  DeviceModel,
  Cable,
  WeakPoint,
  CableTray,
  TopologyNode,
  ExportOptions,
  ExportFormat,
  ExportInclude,
  ExportResult,
  ExportFile,
  GraphicEntity,
  Point2D,
  BBox,
  ViewportState,
} from '@security-survey/shared-types';

import { calculateFieldOfView, generateFovPolygon } from '@security-survey/device-lib';
import dagre from 'dagre';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import PDFKit from 'pdfkit';
import Handlebars from 'handlebars';
import JSZip from 'jszip';
import {
  writeDxf,
  dxfLayerPlanFor,
  DXF_LAYER_DEVICE,
  DXF_LAYER_DEVICE_TEXT,
  DXF_LAYER_CABLE,
  DXF_LAYER_TRAY,
  DXF_LAYER_WELL,
  DXF_LAYER_RACK,
  DXF_LAYER_BLOCK_DEV,
} from './dxf-writer';
import type { DxfBlockDef, DxfDoc, DxfEntity, DxfIncludeFlags } from './dxf-writer';

// ============ 常量 ============

const EXPORT_DPI = 300;
const MM_PER_INCH = 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A0_WIDTH_MM = 841;
const A0_HEIGHT_MM = 1189;

/**
 * DXF overlay 的 include 扩展位。
 * 铁律：不改 ExportInclude 类型（历史 .survey 里存的 include 对象形状不能变），
 * 因此以 `as any` 读取该扩展位 —— 老数据没有该键时视为 false（不会凭空多出 DXF 产物）。
 */
export const INCLUDE_DXF_OVERLAY = 'dxfOverlay';

/** 设备符号半径（模型单位 mm）：设备库无尺寸信息时的兜底 */
const DXF_DEVICE_RADIUS_MM = 250;
/** 点位编号字高（mm） */
const DXF_TEXT_HEIGHT_MM = 200;
/** 弱电井围合半宽/半高（mm） */
const DXF_WELL_HALF = 500;

/** DXF overlay 的分层勾选（缺省全开） */
export interface DxfOverlayFlags {
  devices?: boolean;
  cables?: boolean;
  trays?: boolean;
  wells?: boolean;
  texts?: boolean;
}

/** DXF 导出请求：ExportOptions 的可扩展形态（仅运行期 IPC 载荷，不进 .survey） */
export interface DxfExportOptions extends Partial<ExportOptions> {
  drawingIds: string[];
  /** overlay 分层勾选；缺省全部输出 */
  dxfLayers?: DxfOverlayFlags;
  /** 项目数据（主进程直调场景：无法从 this.project 取得时显式传入） */
  project?: Project;
}


// ============ 同构字节工具（渲染进程/主进程 Node 环境通用）============

function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

function concatBytes(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ============ 类型扩展 ============

interface TopologyLayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
  allowManualAdjust?: boolean;
}

interface ReportTemplateData {
  project: Project;
  drawings: Drawing[];
  generatedAt: string;
  coverPage: CoverPageData;
  tableOfContents: TocItem[];
  floorPlans: FloorPlanData[];
  topology: TopologyData;
  deviceList: DeviceListData;
  cableSchedule: CableScheduleData;
  calculations: CalculationData;
  versionHistory: VersionHistoryItem[];
}

interface CoverPageData {
  projectName: string;
  projectCode: string;
  client: string;
  designer: string;
  date: string;
  version: string;
  approval: { reviewer: string; approver: string; date: string };
}

interface TocItem { title: string; page: number; level: number; }

interface FloorPlanData {
  drawingId: string;
  drawingName: string;
  floor: string;
  scale: string;
  imageData: string; // base64 PNG
  devices: DeviceInstance[];
  cables: Cable[];
  wells: WeakPoint[];
  trays: CableTray[];
  legend: LegendItem[];
}

interface LegendItem { label: string; symbol: string; color: string; }

interface TopologyData {
  nodes: TopologyNode[];
  links: { source: string; target: string; type: string }[];
  layoutImage: string; // base64
}

interface DeviceListData {
  summary: { category: string; count: number; models: ModelSummary[] }[];
  details: DeviceDetailRow[];
  totalDevices: number;
  totalCost: number;
}

interface ModelSummary { modelId: string; modelName: string; count: number; unitPrice: number; totalPrice: number; }

interface DeviceDetailRow {
  id: string; label: string; model: string; floor: string;
  position: string; fovH: number; fovV: number; mountHeight: number;
  focalLength: string; remarks: string;
}

interface CableScheduleData {
  byType: { type: string; totalLength: number; count: number; specs: string }[];
  byFloor: { floor: string; cables: CableDetailRow[] }[];
  totalLength: number;
}

interface CableDetailRow {
  id: string; type: string; from: string; to: string;
  length: number; correctedLength: number; trays: string; status: string;
}

interface CalculationData {
  powerBudget: { deviceId: string; power: number; voltage: string; distance: number; drop: number }[];
  bandwidth: { switchId: string; totalBitrate: number; uplink: number; utilization: number }[];
  storage: { nvrId: string; channels: number; bitrateSum: number; days: number; capacityTB: number }[];
}

interface VersionHistoryItem {
  version: string; date: string; author: string; changes: string;
}

// ============ 导出引擎主类 ============

export class Exporter {
  private project: Project;
  private drawings: Map<string, Drawing> = new Map();
  private deviceModels: Map<string, DeviceModel> = new Map();
  /** 渲染进程提供的画布快照 dataURL（drawingId -> data:image/png;base64,...） */
  private snapshots: Record<string, string> = {};
  /** 位图底图缓存（imagePath -> HTMLImageElement），DOM 导出路径重绘 IMAGE 图元前预加载 */
  private imageCache: Map<string, HTMLImageElement> = new Map();

  constructor(project: Project, deviceModels: DeviceModel[] = []) {
    this.project = project;
    for (const d of project.drawings || []) this.drawings.set(d.id, d);
    for (const m of deviceModels) this.deviceModels.set(m.id, m);
  }

  // ============ 主入口 ============

  async export(options: ExportOptions): Promise<ExportResult> {
    const files: ExportFile[] = [];
    const errors: string[] = [];
    this.snapshots = options.canvasSnapshots || {};

    try {
      // 1. 点位图
      if (options.include.pointMap) {
        for (const drawingId of options.drawingIds) {
          const drawing = this.drawings.get(drawingId);
          if (!drawing) continue;

          for (const fmt of options.formats.filter(f => ['png', 'jpg', 'pdf'].includes(f))) {
            const result = await this.exportPointMap(drawing, fmt, options.resolution);
            if (result) files.push(result);
          }
        }
      }

      // 2. 视野覆盖图
      if (options.include.fovMap) {
        for (const drawingId of options.drawingIds) {
          const drawing = this.drawings.get(drawingId);
          if (!drawing) continue;

          for (const fmt of options.formats.filter(f => ['png', 'jpg', 'pdf'].includes(f))) {
            const result = await this.exportFovMap(drawing, fmt, options.resolution);
            if (result) files.push(result);
          }
        }
      }

      // 3. 拓扑图
      if (options.include.topology) {
        for (const fmt of options.formats.filter(f => ['png', 'jpg', 'pdf', 'svg'].includes(f))) {
          const result = await this.exportTopology(fmt, options.resolution);
          if (result) files.push(result);
        }
      }

      // 4. 设备清单
      if (options.include.deviceList) {
        for (const fmt of options.formats.filter(f => ['xlsx', 'pdf', 'csv'].includes(f))) {
          const result = await this.exportDeviceList(fmt);
          if (result) files.push(result);
        }
      }

      // 5. 线缆清单
      if (options.include.cableList) {
        for (const fmt of options.formats.filter(f => ['xlsx', 'pdf', 'csv'].includes(f))) {
          const result = await this.exportCableSchedule(fmt);
          if (result) files.push(result);
        }
      }

      // 6. 方案报告
      if (options.include.report) {
        for (const fmt of options.formats.filter(f => ['pdf'].includes(f))) {
          const result = await this.exportReport(fmt, options.template);
          if (result) files.push(result);
        }
      }

      // 打包输出（如果多文件）
      if (files.length > 1 && options.formats.includes('zip')) {
        const zipFile = await this.createZipPackage(files, options.outputDir);
        files.push(zipFile);
      }

      // 7. DXF overlay（新建能力：CAD 可编辑标注层，纯文本无需 canvas）
      if ((options.include as any)?.[INCLUDE_DXF_OVERLAY] && options.formats.includes('dxf')) {
        const f = await this.exportDxfOverlay(options);
        if (f) files.push(f);
      }

      return { success: true, files, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '导出失败');
      return { success: false, files, errors };
    }
  }

  // ============ 7. DXF overlay 导出 ============

  /**
   * 生成 DXF R12 ASCII 并包成 ExportFile。
   * 注意：多张图纸合并进同一个 overlay 文档（同一坐标系，CAD 侧按 SS-* 图层过滤即可），
   * 因此文件名以项目名而非图纸名为准。
   */
  async exportDxfOverlay(options: DxfExportOptions): Promise<ExportFile | null> {
    const ids = (options.drawingIds || []).filter(id => this.drawings.has(id));
    if (!ids.length) return null;
    const text = this.exportDxfText(options);
    const bytes = new TextEncoder().encode(text);
    return {
      path: `${this.sanitizeFilename(this.project?.name || 'survey')}_标注overlay.dxf`,
      format: 'dxf',
      size: bytes.length,
      drawingId: ids[0],
      dataBase64: bytesToBase64(bytes),
    };
  }

  /** DXF R12 ASCII 全文（UTF-8）——单测与调试入口 */
  exportDxfText(options: DxfExportOptions): string {
    if (options.project) {
      // 主进程直调：本次请求自带项目数据，用它刷新内部索引，避免 stale 引用
      this.project = options.project;
      this.drawings = new Map();
      for (const d of options.project.drawings || []) this.drawings.set(d.id, d);
    }
    const ids = (options.drawingIds || []).filter(id => this.drawings.has(id));
    if (!ids.length) throw new Error('DXF 导出失败：所选图纸不存在');

    const inc: DxfIncludeFlags = {
      devices: options.dxfLayers?.devices !== false,
      cables: options.dxfLayers?.cables !== false,
      trays: options.dxfLayers?.trays !== false,
      wells: options.dxfLayers?.wells !== false,
      texts: options.dxfLayers?.texts !== false,
    };

    const layers = dxfLayerPlanFor(inc);
    const entities: DxfEntity[] = [];
    const blocks: DxfBlockDef[] = [];
    for (const id of ids) {
      const doc = this.buildDxfDoc(this.drawings.get(id)!, inc);
      entities.push(...doc.entities);
      for (const b of doc.blocks || []) {
        if (!blocks.some(x => x.name === b.name)) blocks.push(b);
      }
    }
    // 未勾选的类别：图层保留（冻结），实体直接不输出
    return writeDxf({ layers, blocks: inc.devices ? blocks : [], entities, flipY: true });
  }

  /**
   * 单张图纸 → DXF 文档片段（不含图幅翻转，由 writeDxf 统一处理）
   * - devices：CIRCLE 符号 + 朝向 LINE + 点位编号 TEXT + INSERT(块)
   * - cables ：path 折线逐段 LINE（R12 无 LWPOLYLINE）
   * - trays ：逐段 LINE；wells：4 段 LINE 围合 + 名称 TEXT
   * 块定义：每个型号一个 SSB-<modelId>，被 INSERT 引用（零孤儿：引用前必须先定义）
   */
  buildDxfDoc(drawing: Drawing, inc: DxfIncludeFlags = {
    devices: true, cables: true, trays: true, wells: true, texts: true,
  }): DxfDoc {
    const entities: DxfEntity[] = [];
    const blocks: DxfBlockDef[] = [];
    const devices = drawing.devices || [];
    const wiring = drawing.wiring || ({ weakPoints: [], trays: [], cables: [] } as any);

    if (inc.devices) {
      const modelIds = new Set(devices.map(d => d.modelId));
      for (const modelId of modelIds) {
        blocks.push({
          name: `SSB-${modelId}`,
          basePoint: { x: 0, y: 0 },
          entities: [
            { type: 'CIRCLE', center: { x: 0, y: 0 }, radius: DXF_DEVICE_RADIUS_MM, layer: DXF_LAYER_BLOCK_DEV, color: 5 },
            { type: 'LINE', start: { x: 0, y: 0 }, end: { x: DXF_DEVICE_RADIUS_MM * 1.5, y: 0 }, layer: DXF_LAYER_BLOCK_DEV, color: 5 },
          ],
        });
      }
      for (const dev of devices) {
        // 朝向角：DeviceInstance.rotation 是弧度（0=向右，顺时针）；DXF 的 50 组码为角度且逆时针
        const angleDeg = -((dev.rotation || 0) * 180 / Math.PI);
        entities.push({
          type: 'INSERT', block: `SSB-${dev.modelId}`, position: dev.position,
          scale: { x: 1, y: 1 }, rotation: angleDeg, layer: DXF_LAYER_DEVICE, color: 5,
        });
        entities.push({
          type: 'LINE', start: dev.position,
          end: {
            x: dev.position.x + Math.cos(dev.rotation || 0) * DXF_DEVICE_RADIUS_MM * 2,
            y: dev.position.y + Math.sin(dev.rotation || 0) * DXF_DEVICE_RADIUS_MM * 2,
          },
          layer: DXF_LAYER_DEVICE, color: 5,
        });
        if (inc.texts && dev.label) {
          entities.push({
            type: 'TEXT', position: { x: dev.position.x + DXF_DEVICE_RADIUS_MM, y: dev.position.y - DXF_DEVICE_RADIUS_MM },
            height: DXF_TEXT_HEIGHT_MM, text: dev.label, layer: DXF_LAYER_DEVICE_TEXT, color: 7,
          });
        }
      }
      // 机柜类设备额外落到 SS-RACK，便于 CAD 侧单独开关
      for (const dev of devices) {
        if (this.isRackModel(dev.modelId)) {
          entities.push({
            type: 'TEXT', position: { x: dev.position.x - DXF_DEVICE_RADIUS_MM, y: dev.position.y + DXF_DEVICE_RADIUS_MM },
            height: DXF_TEXT_HEIGHT_MM, text: `机柜 ${dev.label || dev.modelId}`, layer: DXF_LAYER_RACK, color: 2,
          });
        }
      }
    }

    if (inc.cables) {
      for (const cable of wiring.cables || []) {
        for (let i = 1; i < (cable.path || []).length; i++) {
          entities.push({ type: 'LINE', start: cable.path[i - 1], end: cable.path[i], layer: DXF_LAYER_CABLE, color: 3 });
        }
        if (inc.texts && cable.label) {
          const mid = (cable.path || [])[Math.floor((cable.path.length || 1) / 2)] || { x: 0, y: 0 };
          entities.push({
            type: 'TEXT', position: { x: mid.x, y: mid.y }, height: DXF_TEXT_HEIGHT_MM * 0.8,
            text: cable.label, layer: DXF_LAYER_CABLE, color: 3,
          });
        }
      }
    }

    if (inc.trays) {
      for (const tray of wiring.trays || []) {
        for (let i = 1; i < (tray.path || []).length; i++) {
          entities.push({ type: 'LINE', start: tray.path[i - 1], end: tray.path[i], layer: DXF_LAYER_TRAY, color: 8 });
        }
      }
    }

    if (inc.wells) {
      for (const well of wiring.weakPoints || []) {
        const { x, y } = well.position;
        const corners = [
          { x: x - DXF_WELL_HALF, y: y - DXF_WELL_HALF },
          { x: x + DXF_WELL_HALF, y: y - DXF_WELL_HALF },
          { x: x + DXF_WELL_HALF, y: y + DXF_WELL_HALF },
          { x: x - DXF_WELL_HALF, y: y + DXF_WELL_HALF },
        ];
        for (let i = 0; i < corners.length; i++) {
          entities.push({
            type: 'LINE', start: corners[i], end: corners[(i + 1) % corners.length],
            layer: DXF_LAYER_WELL, color: 6,
          });
        }
        if (inc.texts && well.name) {
          entities.push({
            type: 'TEXT', position: { x: x - DXF_WELL_HALF, y: y + DXF_WELL_HALF + DXF_TEXT_HEIGHT_MM },
            height: DXF_TEXT_HEIGHT_MM, text: well.name, layer: DXF_LAYER_WELL, color: 6,
          });
        }
      }
    }

    return { layers: dxfLayerPlanFor(inc), blocks, entities, flipY: true };
  }

  /** 是否机柜类型号（按 category / 名称启发式判定，命中则额外落到 SS-RACK） */
  private isRackModel(modelId: string): boolean {
    const model = this.deviceModels.get(modelId);
    if (!model) return false;
    const cat = String((model as any).category || '');
    const name = String((model as any).name || '');
    return cat === 'other' && /机柜|rack|42U|网络柜/i.test(name);
  }


  // ============ 1. 点位图导出 ============

  private async exportPointMap(
    drawing: Drawing,
    format: ExportFormat,
    dpi?: number
  ): Promise<ExportFile | null> {
    const scale = (dpi || EXPORT_DPI) / 72; // 72 DPI 基准
    const bounds = this.calculateDrawingBounds(drawing);

    // 无 DOM 环境（主进程）时优先使用渲染进程提供的画布快照
    const snapshot = this.snapshots[drawing.id];
    if (!hasDom()) {
      if (!snapshot) {
        throw new Error('点位图导出需要画布环境：请在渲染进程导出，或通过 canvasSnapshots 提供画布快照');
      }
      return this.exportFromSnapshot(snapshot, `${drawing.id}_pointmap.${format}`, format, drawing.id);
    }

    // 创建离屏 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = bounds.width * scale;
    canvas.height = bounds.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.translate(-bounds.minX, -bounds.minY);

    // 0) 预加载位图底图（IMAGE 图元），保证重绘时同步可用
    await this.preloadImages(drawing.entities);

    // 1) 绘制 CAD 背景
    this.drawCadEntities(ctx, drawing.entities, drawing.layers);

    // 2) 绘制桥架
    this.drawCableTrays(ctx, drawing.wiring?.trays || []);

    // 3) 绘制线缆
    this.drawCables(ctx, drawing.wiring?.cables || []);

    // 4) 绘制弱电井
    this.drawWeakPoints(ctx, drawing.wiring?.weakPoints || []);

    // 5) 绘制设备
    this.drawDevices(ctx, drawing.devices || []);

    // 6) 绘制图例/标尺/比例尺
    this.drawLegend(ctx, drawing);
    this.drawScaleBar(ctx, drawing, bounds);

    // 输出
    const filename = `${this.sanitizeFilename(this.project.name)}_${drawing.name}_点位图.${format}`;
    const outputPath = `${drawing.id}_pointmap.${format}`;

    if (format === 'pdf') {
      return this.canvasToPdf(canvas, outputPath, filename, bounds);
    } else {
      return this.canvasToImage(canvas, outputPath, filename, format);
    }
  }

  private drawCadEntities(ctx: CanvasRenderingContext2D, entities: GraphicEntity[], layers: any[]): void {
    const layerMap = new Map(layers.map(l => [l.name, l]));
    ctx.lineWidth = 0.5;

    for (const entity of entities) {
      const layer = layerMap.get(entity.layer);
      if (layer && !layer.visible) continue;

      ctx.strokeStyle = this.getEntityColor(entity, layer);
      ctx.lineWidth = (entity.lineWeight || 0.25) * 0.3528; // 转换为 pt

      this.drawEntityGeometry(ctx, entity);
    }
  }

  /** 预加载 IMAGE 图元的位图资源（DOM 导出路径在重绘前调用，等待全部就绪） */
  private async preloadImages(entities: GraphicEntity[]): Promise<void> {
    const srcs = new Set<string>();
    for (const e of entities) {
      if (e.type !== 'IMAGE') continue;
      const src = (e.data as any)?.imagePath as string | undefined;
      if (src && !this.imageCache.has(src)) srcs.add(src);
    }
    if (!srcs.size) return;
    await Promise.all(Array.from(srcs).map(src => this.loadImage(src)));
  }

  /** 加载单张位图并入缓存；失败仅告警不阻断（底图缺失时其余标注照常导出） */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error('底图加载失败'));
      img.src = src;
    });
  }

  private drawEntityGeometry(ctx: CanvasRenderingContext2D, entity: GraphicEntity): void {
    const data = entity.data as any;
    ctx.beginPath();

    switch (entity.type) {
      case 'LINE':
        ctx.moveTo(data.start.x, data.start.y);
        ctx.lineTo(data.end.x, data.end.y);
        ctx.stroke();
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (data.vertices.length > 0) {
          ctx.moveTo(data.vertices[0].x, data.vertices[0].y);
          for (let i = 1; i < data.vertices.length; i++) {
            ctx.lineTo(data.vertices[i].x, data.vertices[i].y);
          }
          if (data.closed) ctx.closePath();
          ctx.stroke();
        }
        break;
      case 'ARC':
        ctx.arc(data.center.x, data.center.y, data.radius, data.startAngle, data.endAngle);
        ctx.stroke();
        break;
      case 'CIRCLE':
        ctx.arc(data.center.x, data.center.y, data.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'TEXT':
        ctx.font = `${data.height}px sans-serif`;
        ctx.textAlign = data.hAlign;
        ctx.textBaseline = data.vAlign;
        ctx.fillText(data.text, data.position.x, data.position.y);
        break;
      case 'IMAGE': {
        const img = this.imageCache.get(data.imagePath as string);
        if (!img || img.naturalWidth === 0) break;
        ctx.save();
        const rotation = Number(data.rotation) || 0;
        if (rotation) {
          ctx.translate(data.position.x, data.position.y);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.drawImage(img, 0, 0, data.size.width, data.size.height);
        } else {
          ctx.drawImage(img, data.position.x, data.position.y, data.size.width, data.size.height);
        }
        ctx.restore();
        break;
      }
      // 其他类型简化处理...
    }
  }

  private drawCableTrays(ctx: CanvasRenderingContext2D, trays: CableTray[]): void {
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);

    for (const tray of trays) {
      if (tray.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(tray.path[0].x, tray.path[0].y);
      for (let i = 1; i < tray.path.length; i++) {
        ctx.lineTo(tray.path[i].x, tray.path[i].y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawCables(ctx: CanvasRenderingContext2D, cables: Cable[]): void {
    const colors: Record<string, string> = {
      cat6: '#3B82F6', cat6a: '#2563EB', cat7: '#1D4ED8',
      fiber_sm: '#F59E0B', fiber_mm: '#FBBF24',
      power: '#EF4444', custom: '#8B5CF6',
    };

    for (const cable of cables) {
      if (cable.path.length < 2) continue;
      ctx.strokeStyle = colors[cable.type] || colors.custom;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (cable.type.startsWith('fiber')) ctx.setLineDash([4, 2]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(cable.path[0].x, cable.path[0].y);
      for (let i = 1; i < cable.path.length; i++) {
        ctx.lineTo(cable.path[i].x, cable.path[i].y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawWeakPoints(ctx: CanvasRenderingContext2D, wells: WeakPoint[]): void {
    for (const well of wells) {
      const size = 12;
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(well.position.x - size, well.position.y - size);
      ctx.lineTo(well.position.x + size, well.position.y - size);
      ctx.lineTo(well.position.x + size * 0.6, well.position.y + size);
      ctx.lineTo(well.position.x - size * 0.6, well.position.y + size);
      ctx.closePath();
      ctx.fill();

      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#1F2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(well.name, well.position.x, well.position.y + size + 4);
    }
  }

  private drawDevices(ctx: CanvasRenderingContext2D, devices: DeviceInstance[]): void {
    for (const device of devices) {
      const model = this.deviceModels.get(device.modelId);
      const size = 20;
      ctx.save();
      ctx.translate(device.position.x, device.position.y);
      ctx.rotate(device.rotation);

      // 设备图标
      ctx.fillStyle = '#3B82F6';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 朝向指示
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(size * 0.8, 0);
      ctx.lineTo(size * 0.3, -size * 0.3);
      ctx.lineTo(size * 0.3, size * 0.3);
      ctx.closePath();
      ctx.fill();

      // 标签
      if (device.label) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#1F2937';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(device.label, 0, size / 2 + 4);
      }

      ctx.restore();
    }
  }

  private drawLegend(ctx: CanvasRenderingContext2D, drawing: Drawing): void {
    // 简化：右下角绘制图例
    const x = 20, y = 20;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#1F2937';
    ctx.textAlign = 'left';
    ctx.fillText('图例', x, y);
  }

  private drawScaleBar(ctx: CanvasRenderingContext2D, drawing: Drawing, bounds: BBox): void {
    if (!drawing.calibration?.isCalibrated) return;
    const scale = drawing.calibration.scale; // 模型单位/米
    const barLengthM = 10; // 10米比例尺
    const barLengthPx = barLengthM * scale;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bounds.minX + 20, bounds.maxY - 20);
    ctx.lineTo(bounds.minX + 20 + barLengthPx, bounds.maxY - 20);
    ctx.stroke();

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(`${barLengthM}m`, bounds.minX + 20 + barLengthPx / 2, bounds.maxY - 25);
  }

  // ============ 2. 视野覆盖图 ============

  private async exportFovMap(
    drawing: Drawing,
    format: ExportFormat,
    dpi?: number
  ): Promise<ExportFile | null> {
    // 类似点位图，但额外绘制视野多边形（半透明叠加）
    const scale = (dpi || EXPORT_DPI) / 72;
    const bounds = this.calculateDrawingBounds(drawing);

    // 无 DOM 环境（主进程）时优先使用渲染进程提供的画布快照
    const snapshot = this.snapshots[drawing.id];
    if (!hasDom()) {
      if (!snapshot) {
        throw new Error('视野图导出需要画布环境：请在渲染进程导出，或通过 canvasSnapshots 提供画布快照');
      }
      return this.exportFromSnapshot(snapshot, `${drawing.id}_fovmap.${format}`, format, drawing.id);
    }

    const canvas = document.createElement('canvas');
    canvas.width = bounds.width * scale;
    canvas.height = bounds.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.translate(-bounds.minX, -bounds.minY);

    // 0) 预加载位图底图（IMAGE 图元），保证淡化重绘时同步可用
    await this.preloadImages(drawing.entities);

    // 背景：淡化 CAD 图元
    ctx.globalAlpha = 0.3;
    this.drawCadEntities(ctx, drawing.entities, drawing.layers);
    ctx.globalAlpha = 1.0;

    // 视野多边形
    for (const device of drawing.devices || []) {
      const polygon = generateFovPolygon(device);
      if (polygon.length < 3) continue;

      const model = this.deviceModels.get(device.modelId);
      const isSelected = false; // 可扩展

      // 主视野
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i].x, polygon[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 盲区（近距离）
      // 简化：内切圆
    }

    // 设备图标（不透明）
    this.drawDevices(ctx, drawing.devices || []);

    // 图例：视野/盲区
    this.drawFovLegend(ctx, drawing);

    const filename = `${this.sanitizeFilename(this.project.name)}_${drawing.name}_视野图.${format}`;
    const outputPath = `${drawing.id}_fovmap.${format}`;

    if (format === 'pdf') {
      return this.canvasToPdf(canvas, outputPath, filename, bounds);
    } else {
      return this.canvasToImage(canvas, outputPath, filename, format);
    }
  }

  private drawFovLegend(ctx: CanvasRenderingContext2D, drawing: Drawing): void {
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#1F2937';
    ctx.textAlign = 'left';
    let y = 20;

    // 视野
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(20, y, 15, 15);
    ctx.strokeStyle = '#22C55E';
    ctx.strokeRect(20, y, 15, 15);
    ctx.fillStyle = '#1F2937';
    ctx.fillText('监控视野', 45, y + 11);
    y += 20;

    // 盲区
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(20, y, 15, 15);
    ctx.fillStyle = '#1F2937';
    ctx.fillText('盲区', 45, y + 11);
  }

  // ============ 3. 拓扑图 ============

  private async exportTopology(
    format: ExportFormat,
    dpi?: number
  ): Promise<ExportFile | null> {
    // 构建拓扑节点：弱电井 -> 交换机 -> NVR -> 核心
    const allDevices = this.project.drawings.flatMap(d => d.devices || []);
    const allWells = this.project.drawings.flatMap(d => d.wiring?.weakPoints || []);
    const allCables = this.project.drawings.flatMap(d => d.wiring?.cables || []);

    // 使用 dagre 布局
    const layout = this.computeTopologyLayout(allWells, allDevices, allCables);

    // SVG 无 DOM 依赖；位图格式需要画布环境
    if (!hasDom() && format !== 'svg') {
      throw new Error('拓扑图 PNG/JPG/PDF 导出需要画布环境：请使用 SVG 格式或在渲染进程导出');
    }

    // 绘制到 Canvas/SVG
    const canvas = document.createElement('canvas');
    const scale = (dpi || EXPORT_DPI) / 72;
    const bounds = this.calculateTopologyBounds(layout.nodes);
    canvas.width = bounds.width * scale + 100;
    canvas.height = bounds.height * scale + 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.translate(-bounds.minX + 50, -bounds.minY + 50);

    // 绘制连线
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1.5;
    for (const link of layout.links) {
      const source = layout.nodes.find(n => n.id === link.source);
      const target = layout.nodes.find(n => n.id === link.target);
      if (!source || !target) continue;

      ctx.beginPath();
      ctx.moveTo(source.position.x, source.position.y);
      ctx.lineTo(target.position.x, target.position.y);
      ctx.stroke();
    }

    // 绘制节点
    for (const node of layout.nodes) {
      this.drawTopologyNode(ctx, node);
    }

    const filename = `${this.sanitizeFilename(this.project.name)}_拓扑图.${format}`;
    const outputPath = `topology.${format}`;

    if (format === 'pdf') {
      return this.canvasToPdf(canvas, outputPath, filename, bounds);
    } else if (format === 'svg') {
      return this.topologyToSvg(layout, outputPath, filename);
    } else {
      return this.canvasToImage(canvas, outputPath, filename, format);
    }
  }

  private computeTopologyLayout(
    wells: WeakPoint[],
    devices: DeviceInstance[],
    cables: Cable[]
  ): { nodes: TopologyNode[]; links: { source: string; target: string; type: string }[] } {
    const nodes: TopologyNode[] = [];
    const links: { source: string; target: string; type: string }[] = [];

    // 1. 弱电井节点
    for (const well of wells) {
      nodes.push({
        id: `well-${well.id}`,
        type: 'weak_point',
        refId: well.id,
        position: { x: 0, y: 0 }, // dagre 会重新布局
        children: [],
        metadata: { name: well.name, floor: '汇聚' },
      });
    }

    // 2. 按楼层分组的交换机节点（从线缆终端推断）
    const switchesByFloor = new Map<string, Set<string>>();
    for (const cable of cables) {
      if (cable.endDeviceId) {
        const device = devices.find(d => d.id === cable.endDeviceId);
        if (device) {
          const drawing = this.project.drawings.find(d => d.id === device.drawingId);
          const floor = drawing?.floor || '未知';
          if (!switchesByFloor.has(floor)) switchesByFloor.set(floor, new Set());
          switchesByFloor.get(floor)!.add(`switch-${floor}`);
        }
      }
    }

    let switchIndex = 0;
    for (const [floor, _] of switchesByFloor) {
      const switchId = `switch-${floor}`;
      nodes.push({
        id: switchId,
        type: 'switch',
        refId: switchId,
        position: { x: 0, y: 0 },
        children: [],
        metadata: { name: `${floor} 接入交换机`, floor },
      });

      // 连接到对应楼层弱电井
      const well = wells.find(w => w.name.includes(floor) || w.type === 'floor');
      if (well) {
        links.push({ source: `well-${well.id}`, target: switchId, type: 'fiber' });
      }
    }

    // 3. 核心交换机/NVR
    const coreId = 'core-switch';
    nodes.push({
      id: coreId,
      type: 'core',
      refId: coreId,
      position: { x: 0, y: 0 },
      children: [],
      metadata: { name: '核心交换机', floor: '机房' },
    });

    // 所有接入交换机汇聚到核心
    for (const switchId of switchesByFloor.keys()) {
      links.push({ source: switchId, target: coreId, type: 'fiber' });
    }

    // NVR
    const nvrId = 'nvr';
    nodes.push({
      id: nvrId,
      type: 'nvr',
      refId: nvrId,
      position: { x: 0, y: 0 },
      children: [],
      metadata: { name: 'NVR 录像机', floor: '机房' },
    });
    links.push({ source: coreId, target: nvrId, type: 'data' });

    // 使用 dagre 自动布局
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120, edgesep: 20 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) g.setNode(node.id, { width: 120, height: 60 });
    for (const link of links) g.setEdge(link.source, link.target);

    dagre.layout(g);

    for (const node of nodes) {
      const gn = g.node(node.id);
      node.position = { x: gn.x, y: gn.y };
    }

    return { nodes, links };
  }

  private drawTopologyNode(ctx: CanvasRenderingContext2D, node: TopologyNode): void {
    const { x, y } = node.position;
    const w = 120, h = 60;

    // 背景
    let fillColor = '#3B82F6';
    if (node.type === 'weak_point') fillColor = '#6B7280';
    else if (node.type === 'switch') fillColor = '#F59E0B';
    else if (node.type === 'core') fillColor = '#8B5CF6';
    else if (node.type === 'nvr') fillColor = '#EF4444';

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    this.roundRect(ctx, x - w/2, y - h/2, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // 图标/文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.metadata.name, x, y);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private calculateTopologyBounds(nodes: TopologyNode[]): BBox {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x - 60);
      maxX = Math.max(maxX, node.position.x + 60);
      minY = Math.min(minY, node.position.y - 30);
      maxY = Math.max(maxY, node.position.y + 30);
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  private topologyToSvg(layout: any, outputPath: string, filename: string): ExportFile {
    // 生成 SVG 字符串
    const bounds = this.calculateTopologyBounds(layout.nodes);
    const width = bounds.width + 100;
    const height = bounds.height + 100;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;
    svg += `<g transform="translate(50, 50)">`;

    // Links
    for (const link of layout.links) {
      const source = layout.nodes.find((n: TopologyNode) => n.id === link.source);
      const target = layout.nodes.find((n: TopologyNode) => n.id === link.target);
      if (source && target) {
        svg += `<line x1="${source.position.x}" y1="${source.position.y}" x2="${target.position.x}" y2="${target.position.y}" stroke="#9CA3AF" stroke-width="2"/>`;
      }
    }

    // Nodes
    for (const node of layout.nodes) {
      const { x, y } = node.position;
      const w = 120, h = 60;
      let fill = '#3B82F6';
      if (node.type === 'weak_point') fill = '#6B7280';
      else if (node.type === 'switch') fill = '#F59E0B';
      else if (node.type === 'core') fill = '#8B5CF6';
      else if (node.type === 'nvr') fill = '#EF4444';

      svg += `<rect x="${x - w/2}" y="${y - h/2}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="white" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12" font-weight="bold">${this.escapeXml(node.metadata.name)}</text>`;
    }

    svg += `</g></svg>`;

    const svgBytes = new TextEncoder().encode(svg);
    return {
      path: outputPath,
      format: 'svg',
      size: svgBytes.length,
      drawingId: 'topology',
      dataBase64: bytesToBase64(svgBytes),
    };
  }

  /**
   * 从渲染进程提供的画布快照（dataURL）导出，用于无 DOM 的主进程环境
   */
  private async exportFromSnapshot(
    dataUrl: string,
    outputPath: string,
    format: ExportFormat,
    drawingId: string
  ): Promise<ExportFile> {
    const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const pngBytes = base64ToBytes(b64);

    if (format === 'png') {
      return { path: outputPath, format: 'png', size: pngBytes.length, drawingId, dataBase64: b64 };
    }

    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      const png = await pdfDoc.embedPng(pngBytes);
      // px -> pt（96dpi 屏幕快照）
      const page = pdfDoc.addPage([png.width * 0.75, png.height * 0.75]);
      page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      const pdfBytes = await pdfDoc.save();
      return {
        path: outputPath.replace(/\.[^.]+$/, '.pdf'),
        format: 'pdf',
        size: pdfBytes.length,
        drawingId,
        dataBase64: bytesToBase64(pdfBytes),
      };
    }

    // 快照为 PNG，无 canvas 无法重编码为 JPG，降级为 PNG 输出
    return {
      path: outputPath.replace(/\.[^.]+$/, '.png'),
      format: 'png',
      size: pngBytes.length,
      drawingId,
      dataBase64: b64,
    };
  }

  // ============ 4. 设备清单 ============

  private async exportDeviceList(format: ExportFormat): Promise<ExportFile | null> {
    const allDevices = this.project.drawings.flatMap(d => d.devices || []);
    const data = this.prepareDeviceListData(allDevices);

    if (format === 'xlsx') {
      return this.exportDeviceListXlsx(data);
    } else if (format === 'csv') {
      return this.exportDeviceListCsv(data);
    } else if (format === 'pdf') {
      return this.exportDeviceListPdf(data);
    }
    return null;
  }

  private prepareDeviceListData(devices: DeviceInstance[]) {
    const byCategory = new Map<string, { modelId: string; modelName: string; count: number; unitPrice: number }[]>();

    for (const device of devices) {
      const model = this.deviceModels.get(device.modelId);
      if (!model) continue;

      const cat = model.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);

      const list = byCategory.get(cat)!;
      const existing = list.find(m => m.modelId === model.id);
      if (existing) {
        existing.count++;
      } else {
        list.push({ modelId: model.id, modelName: model.name, count: 1, unitPrice: model.price || 0 });
      }
    }

    const summary = Array.from(byCategory.entries()).map(([category, models]) => ({
      category,
      count: models.reduce((s, m) => s + m.count, 0),
      models: models.map(m => ({ ...m, totalPrice: m.count * m.unitPrice })),
    }));

    const details: DeviceDetailRow[] = devices.map(device => {
      const model = this.deviceModels.get(device.modelId);
      const drawing = this.project.drawings.find(d => d.id === device.drawingId);
      return {
        id: device.id,
        label: device.label,
        model: model?.name || device.modelId,
        floor: drawing?.floor || '',
        position: `(${device.position.x.toFixed(0)}, ${device.position.y.toFixed(0)})`,
        fovH: model?.specs.horizontalFOV || 0,
        fovV: model?.specs.verticalFOV || 0,
        mountHeight: device.mountHeight || model?.specs.mountHeight || 0,
        focalLength: Array.isArray(model?.specs.focalLength)
          ? `${model.specs.focalLength[0]}-${model.specs.focalLength[1]}mm`
          : `${model?.specs.focalLength || ''}mm`,
        remarks: device.remarks,
      };
    });

    const totalDevices = devices.length;
    const totalCost = summary.reduce((s, cat) => s + cat.models.reduce((s2, m) => s2 + m.totalPrice, 0), 0);

    return { summary, details, totalDevices, totalCost };
  }

  private exportDeviceListXlsx(data: any): ExportFile {
    const wb = XLSX.utils.book_new();

    // Sheet 1: 汇总表
    const summaryRows = [
      ['类别', '型号', '数量', '单价(元)', '小计(元)'],
      ...data.summary.flatMap((cat: any) => cat.models.map((m: any) => [
        cat.category, m.modelName, m.count, m.unitPrice, m.totalPrice
      ])),
      ['', '合计', data.totalDevices, '', data.totalCost],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws1, '设备汇总');

    // Sheet 2: 明细表
    const detailRows = [
      ['点位编号', '型号', '楼层', '坐标(X,Y)', '水平视场角(°)', '垂直视场角(°)', '安装高度(m)', '焦距', '备注'],
      ...data.details.map((d: any) => [
        d.label, d.model, d.floor, d.position, d.fovH, d.fovV, d.mountHeight, d.focalLength, d.remarks
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, ws2, '设备明细');

    // Sheet 3: 统计透视
    const pivotRows = [
      ['楼层', '设备类别', '数量'],
      ...data.details.flatMap((d: any) => {
        const model = this.deviceModels.get(d.model);
        return [[d.floor, model?.category || '未知', 1]];
      }),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(pivotRows);
    XLSX.utils.book_append_sheet(wb, ws3, '楼层统计');

    const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    return {
      path: 'device_list.xlsx',
      format: 'xlsx',
      size: buf.length,
      dataBase64: bytesToBase64(buf),
    };
  }

  private exportDeviceListCsv(data: any): ExportFile {
    const rows = [
      '点位编号,型号,楼层,坐标,水平视场角,垂直视场角,安装高度,焦距,备注',
      ...data.details.map((d: any) =>
        `"${d.label}","${d.model}","${d.floor}","${d.position}",${d.fovH},${d.fovV},${d.mountHeight},"${d.focalLength}","${d.remarks}"`
      ),
    ];
    const csv = rows.join('\n');
    return {
      path: 'device_list.csv',
      format: 'csv',
      size: utf8Length(csv),
      dataBase64: bytesToBase64(new TextEncoder().encode(csv)),
    };
  }

  private async exportDeviceListPdf(data: any): Promise<ExportFile> {
    const doc = new PDFKit({ size: 'A4', margin: 40 });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: any) => chunks.push(chunk as Uint8Array));

    // 标题
    doc.fontSize(18).text(`${this.project.name} - 设备清单`, { align: 'center' });
    doc.moveDown();

    // 汇总表
    doc.fontSize(14).text('设备汇总', { underline: true });
    doc.moveDown(0.5);

    for (const cat of data.summary) {
      doc.font('Helvetica-Bold').fontSize(12).text(`${cat.category} (共 ${cat.count} 台)`); doc.font('Helvetica');
      for (const m of cat.models) {
        doc.fontSize(10).text(`  ${m.modelName} × ${m.count}  单价: ¥${m.unitPrice}  小计: ¥${m.totalPrice}`);
      }
      doc.moveDown(0.3);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text(`总计: ${data.totalDevices} 台设备，预估成本: ¥${data.totalCost}`); doc.font('Helvetica');

    // 明细表（简化）
    doc.addPage();
    doc.fontSize(14).text('设备明细', { underline: true });
    doc.moveDown(0.5);

    for (const d of data.details) {
      doc.fontSize(9).text(`${d.label} | ${d.model} | ${d.floor} | ${d.position} | H:${d.fovH}° V:${d.fovV}° | ${d.mountHeight}m | ${d.focalLength} | ${d.remarks}`);
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        const buf = concatBytes(chunks);
        resolve({
          path: 'device_list.pdf',
          format: 'pdf',
          size: buf.length,
          dataBase64: bytesToBase64(buf),
        });
      });
    });
  }

  // ============ 5. 线缆清单 ============

  private async exportCableSchedule(format: ExportFormat): Promise<ExportFile | null> {
    const allCables = this.project.drawings.flatMap(d => d.wiring?.cables || []);
    const allWells = this.project.drawings.flatMap(d => d.wiring?.weakPoints || []);
    const allTrays = this.project.drawings.flatMap(d => d.wiring?.trays || []);

    const data = this.prepareCableScheduleData(allCables, allWells, allTrays);

    if (format === 'xlsx') return this.exportCableScheduleXlsx(data);
    if (format === 'csv') return this.exportCableScheduleCsv(data);
    if (format === 'pdf') return this.exportCableSchedulePdf(data);
    return null;
  }

  private prepareCableScheduleData(cables: Cable[], wells: WeakPoint[], trays: CableTray[]) {
    // 按类型统计
    const byType = new Map<string, { totalLength: number; count: number; specs: Set<string> }>();
    for (const cable of cables) {
      const entry = byType.get(cable.type) || { totalLength: 0, count: 0, specs: new Set() };
      entry.totalLength += cable.correctedLength || cable.length;
      entry.count++;
      entry.specs.add(cable.type.toUpperCase());
      byType.set(cable.type, entry);
    }

    // 按楼层统计
    const byFloor = new Map<string, CableDetailRow[]>();
    for (const cable of cables) {
      // 根据起点设备所在楼层分组
      const drawing = this.project.drawings.find(d =>
        d.devices?.some(dev => dev.id === cable.startDeviceId)
      );
      const floor = drawing?.floor || '未知';

      if (!byFloor.has(floor)) byFloor.set(floor, []);
      byFloor.get(floor)!.push({
        id: cable.id,
        type: cable.type,
        from: cable.startDeviceId,
        to: cable.endDeviceId || '',
        length: cable.length,
        correctedLength: cable.correctedLength || cable.length,
        trays: cable.trayIds.join(', '),
        status: cable.status,
      });
    }

    const totalLength = cables.reduce((s, c) => s + (c.correctedLength || c.length), 0);

    return {
      byType: Array.from(byType.entries()).map(([type, v]) => ({
        type, totalLength: v.totalLength, count: v.count, specs: Array.from(v.specs).join(', ')
      })),
      byFloor: Array.from(byFloor.entries()).map(([floor, cables]) => ({ floor, cables })),
      totalLength,
      totalCount: cables.length,
    };
  }

  private exportCableScheduleXlsx(data: any): ExportFile {
    const wb = XLSX.utils.book_new();

    // Sheet 1: 按类型汇总
    const typeRows = [
      ['线缆类型', '总长度(米)', '根数', '规格'],
      ...data.byType.map((t: any) => [t.type, t.totalLength.toFixed(1), t.count, t.specs]),
      ['合计', data.totalLength.toFixed(1), data.byType.reduce((s: number, t: any) => s + t.count, 0), ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(typeRows), '按类型汇总');

    // Sheet 2: 按楼层明细
    const floorRows = [
      ['楼层', '线缆ID', '类型', '起点', '终点', '设计长度(米)', '含盘留长度(米)', '经过桥架', '状态'],
      ...data.byFloor.flatMap((f: any) => f.cables.map((c: any) => [
        f.floor, c.id, c.type, c.from, c.to, c.length.toFixed(1), c.correctedLength.toFixed(1), c.trays, c.status
      ])),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(floorRows), '按楼层明细');

    const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    return { path: 'cable_schedule.xlsx', format: 'xlsx', size: buf.length, dataBase64: bytesToBase64(buf) };
  }

  private exportCableScheduleCsv(data: any): ExportFile {
    const rows = [
      '楼层,线缆ID,类型,起点,终点,设计长度,含盘留长度,经过桥架,状态',
      ...data.byFloor.flatMap((f: any) => f.cables.map((c: any) =>
        `${f.floor},${c.id},${c.type},${c.from},${c.to},${c.length.toFixed(1)},${c.correctedLength.toFixed(1)},"${c.trays}",${c.status}`
      )),
    ];
    const csv = rows.join('\n');
    return { path: 'cable_schedule.csv', format: 'csv', size: utf8Length(csv), dataBase64: bytesToBase64(new TextEncoder().encode(csv)) };
  }

  private async exportCableSchedulePdf(data: any): Promise<ExportFile> {
    const doc = new PDFKit({ size: 'A4', margin: 40 });
    const chunks: Uint8Array[] = [];
    doc.on('data', (c: any) => chunks.push(c as Uint8Array));

    doc.fontSize(18).text(`${this.project.name} - 线缆清单`, { align: 'center' });
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text(`总长度: ${data.totalLength.toFixed(1)} 米`); doc.font('Helvetica');
    doc.moveDown();

    for (const f of data.byFloor) {
      doc.fontSize(11).text(`${f.floor} (${f.cables.length} 根)`, { underline: true });
      for (const c of f.cables) {
        doc.fontSize(9).text(`  ${c.id} | ${c.type} | ${c.from}→${c.to} | ${c.correctedLength.toFixed(1)}m | ${c.trays || '无'} | ${c.status}`);
      }
      doc.moveDown(0.3);
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        const buf = concatBytes(chunks);
        resolve({
          path: 'cable_schedule.pdf',
          format: 'pdf',
          size: buf.length,
          dataBase64: bytesToBase64(buf),
        });
      });
    });
  }

  // ============ 6. 方案报告 ============

  private async exportReport(format: ExportFormat, templateName?: string): Promise<ExportFile | null> {
    if (format !== 'pdf') return null;

    const reportData = await this.prepareReportData();
    const html = this.renderReportTemplate(reportData, templateName);
    const pdfBytes = await this.htmlToPdf(html);

    return {
      path: `${this.sanitizeFilename(this.project.name)}_方案报告.pdf`,
      format: 'pdf',
      size: pdfBytes.length,
      dataBase64: bytesToBase64(pdfBytes),
    };
  }

  private async prepareReportData(): Promise<ReportTemplateData> {
    const allDevices = this.project.drawings.flatMap(d => d.devices || []);
    const allCables = this.project.drawings.flatMap(d => d.wiring?.cables || []);
    const allWells = this.project.drawings.flatMap(d => d.wiring?.weakPoints || []);
    const allTrays = this.project.drawings.flatMap(d => d.wiring?.trays || []);

    // 生成各楼层平面图图片
    const floorPlans: FloorPlanData[] = [];
    for (const drawing of this.project.drawings) {
      // 这里应调用 exportPointMap 生成 base64 图片，简化处理
      floorPlans.push({
        drawingId: drawing.id,
        drawingName: drawing.name,
        floor: drawing.floor,
        scale: drawing.calibration?.isCalibrated ? `1:${1/drawing.calibration.scale}` : '未校准',
        imageData: '', // base64
        devices: drawing.devices || [],
        cables: drawing.wiring?.cables || [],
        wells: drawing.wiring?.weakPoints || [],
        trays: drawing.wiring?.trays || [],
        legend: this.generateLegendItems(drawing),
      });
    }

    // 拓扑图
    const topologyLayout = this.computeTopologyLayout(allWells, allDevices, allCables);
    const topologyImage = ''; // base64

    // 设备清单数据
    const deviceData = this.prepareDeviceListData(allDevices);

    // 线缆清单数据
    const cableData = this.prepareCableScheduleData(allCables, allWells, allTrays);

    // 计算书数据
    const calculations = this.prepareCalculationData(allDevices, allCables);

    return {
      project: this.project,
      drawings: this.project.drawings,
      generatedAt: new Date().toLocaleString('zh-CN'),
      coverPage: {
        projectName: this.project.name,
        projectCode: this.project.id.slice(0, 8).toUpperCase(),
        client: '项目业主',
        designer: '设计单位',
        date: new Date().toLocaleDateString('zh-CN'),
        version: 'V1.0',
        approval: { reviewer: '审核人', approver: '批准人', date: new Date().toLocaleDateString('zh-CN') },
      },
      tableOfContents: [
        { title: '1. 项目概况', page: 1, level: 1 },
        { title: '2. 系统设计方案', page: 2, level: 1 },
        { title: '3. 平面布点图', page: 3, level: 1 },
        { title: '4. 系统拓扑图', page: 4, level: 1 },
        { title: '5. 设备清单', page: 5, level: 1 },
        { title: '6. 线缆清单', page: 6, level: 1 },
        { title: '7. 计算书', page: 7, level: 1 },
        { title: '8. 版本记录', page: 8, level: 1 },
      ],
      floorPlans,
      topology: {
        nodes: topologyLayout.nodes,
        links: topologyLayout.links,
        layoutImage: topologyImage,
      },
      deviceList: deviceData,
      cableSchedule: cableData,
      calculations,
      versionHistory: [
        { version: 'V1.0', date: new Date().toLocaleDateString('zh-CN'), author: '设计师', changes: '初版发布' },
      ],
    };
  }

  private prepareCalculationData(devices: DeviceInstance[], cables: Cable[]): CalculationData {
    // 供电预算
    const powerBudget = devices.map(d => {
      const model = this.deviceModels.get(d.modelId);
      const power = model?.specs.powerConsumption || 0;
      const voltage = model?.specs.voltage || 'PoE';
      const distance = 50; // 估算
      const drop = voltage === 'PoE' ? 0 : (power * distance * 0.018) / 1000; // 简化压降
      return { deviceId: d.id, power, voltage, distance, drop };
    });

    // 带宽估算
    const bandwidth: any[] = [];
    // 按交换机汇聚估算

    // 存储估算
    const storage: any[] = [];

    return { powerBudget, bandwidth, storage };
  }

  private generateLegendItems(drawing: Drawing): LegendItem[] {
    return [
      { label: '墙体', symbol: '▬', color: '#000000' },
      { label: '门窗', symbol: '▭', color: '#666666' },
      { label: '半球机', symbol: '●', color: '#3B82F6' },
      { label: '枪机', symbol: '▲', color: '#3B82F6' },
      { label: '球机', symbol: '◆', color: '#8B5CF6' },
      { label: '弱电井', symbol: '▼', color: '#374151' },
      { label: '桥架', symbol: '══', color: '#6B7280' },
      { label: '网线', symbol: '━', color: '#3B82F6' },
      { label: '光纤', symbol: '━', color: '#F59E0B' },
      { label: '电源', symbol: '━', color: '#EF4444' },
    ];
  }

  private renderReportTemplate(data: ReportTemplateData, templateName?: string): string {
    // 使用 Handlebars 模板，这里简化为内联模板
    const template = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; font-size: 12px; line-height: 1.6; color: #333; }
    .page { page-break-after: always; padding: 40px; }
    .cover { text-align: center; padding-top: 150px; }
    .cover h1 { font-size: 36px; margin-bottom: 20px; }
    .cover p { font-size: 18px; margin: 10px 0; }
    .toc { columns: 2; column-gap: 40px; }
    .toc-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
    .floor-plan { page-break-inside: avoid; }
    .floor-plan img { max-width: 100%; height: auto; }
    .legend { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 10px; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    .header-row { background: #1f2937; color: white; }
  </style>
</head>
<body>
  <!-- 封面 -->
  <div class="page cover">
    <h1>{{coverPage.projectName}}</h1>
    <p>安防监控系统设计方案报告</p>
    <p>项目编号: {{coverPage.projectCode}}</p>
    <p>建设单位: {{coverPage.client}}</p>
    <p>设计单位: {{coverPage.designer}}</p>
    <p>日期: {{coverPage.date}}</p>
    <p>版本: {{coverPage.version}}</p>
    <div style="margin-top: 80px;">
      <p>审核: {{coverPage.approval.reviewer}}</p>
      <p>批准: {{coverPage.approval.approver}}</p>
      <p>日期: {{coverPage.approval.date}}</p>
    </div>
  </div>

  <!-- 目录 -->
  <div class="page">
    <h2>目录</h2>
    <div class="toc">
      {{#each tableOfContents}}
        <div class="toc-item">
          <span>{{title}}</span>
          <span>{{page}}</span>
        </div>
      {{/each}}
    </div>
  </div>

  <!-- 平面图 -->
  {{#each floorPlans}}
  <div class="page floor-plan">
    <h3>{{floor}} - {{drawingName}}</h3>
    <p>比例尺: {{scale}}</p>
    {{#if imageData}}
      <img src="data:image/png;base64,{{imageData}}" alt="{{drawingName}}">
    {{/if}}
    <div class="legend">
      {{#each legend}}
        <div class="legend-item">
          <span style="color: {{color}}">{{symbol}}</span>
          <span>{{label}}</span>
        </div>
      {{/each}}
    </div>
  </div>
  {{/each}}

  <!-- 拓扑图 -->
  <div class="page">
    <h3>系统拓扑图</h3>
    {{#if topology.layoutImage}}
      <img src="data:image/png;base64,{{topology.layoutImage}}" style="max-width:100%">
    {{/if}}
  </div>

  <!-- 设备清单 -->
  <div class="page">
    <h3>设备清单</h3>
    <table>
      <thead><tr class="header-row"><th>类别</th><th>型号</th><th>数量</th><th>单价(元)</th><th>小计(元)</th></tr></thead>
      <tbody>
        {{#each deviceList.summary}}
          {{#each models}}
          <tr><td>{{../category}}</td><td>{{modelName}}</td><td>{{count}}</td><td>{{unitPrice}}</td><td>{{totalPrice}}</td></tr>
          {{/each}}
        {{/each}}
        <tr class="header-row"><td colspan="2">合计</td><td>{{deviceList.totalDevices}}</td><td></td><td>{{deviceList.totalCost}}</td></tr>
      </tbody>
    </table>
    <h4>设备明细</h4>
    <table>
      <thead><tr class="header-row"><th>点位</th><th>型号</th><th>楼层</th><th>坐标</th><th>水平FOV</th><th>垂直FOV</th><th>安装高度</th><th>焦距</th><th>备注</th></tr></thead>
      <tbody>
        {{#each deviceList.details}}
        <tr><td>{{label}}</td><td>{{model}}</td><td>{{floor}}</td><td>{{position}}</td><td>{{fovH}}°</td><td>{{fovV}}°</td><td>{{mountHeight}}m</td><td>{{focalLength}}</td><td>{{remarks}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- 线缆清单 -->
  <div class="page">
    <h3>线缆清单</h3>
    <table>
      <thead><tr class="header-row"><th>类型</th><th>总长度(米)</th><th>根数</th><th>规格</th></tr></thead>
      <tbody>
        {{#each cableSchedule.byType}}
        <tr><td>{{type}}</td><td>{{totalLength}}</td><td>{{count}}</td><td>{{specs}}</td></tr>
        {{/each}}
        <tr class="header-row"><td>合计</td><td>{{cableSchedule.totalLength}}</td><td>{{cableSchedule.totalCount}}</td><td></td></tr>
      </tbody>
    </table>
    <h4>分楼层明细</h4>
    {{#each cableSchedule.byFloor}}
      <h5>{{floor}}</h5>
      <table>
        <thead><tr class="header-row"><th>线缆ID</th><th>类型</th><th>起点</th><th>终点</th><th>设计长度</th><th>含盘留</th><th>桥架</th><th>状态</th></tr></thead>
        <tbody>
          {{#each cables}}
          <tr><td>{{id}}</td><td>{{type}}</td><td>{{from}}</td><td>{{to}}</td><td>{{length}}</td><td>{{correctedLength}}</td><td>{{trays}}</td><td>{{status}}</td></tr>
          {{/each}}
        </tbody>
      </table>
    {{/each}}
  </div>

  <!-- 计算书 -->
  <div class="page">
    <h3>计算书</h3>
    <h4>供电预算</h4>
    <table>
      <thead><tr class="header-row"><th>设备</th><th>功率(W)</th><th>供电方式</th><th>距离(m)</th><th>压降(V)</th></tr></thead>
      <tbody>
        {{#each calculations.powerBudget}}
        <tr><td>{{deviceId}}</td><td>{{power}}</td><td>{{voltage}}</td><td>{{distance}}</td><td>{{toFixed drop 2}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- 版本记录 -->
  <div class="page">
    <h3>版本记录</h3>
    <table>
      <thead><tr class="header-row"><th>版本</th><th>日期</th><th>编制</th><th>变更内容</th></tr></thead>
      <tbody>
        {{#each versionHistory}}
        <tr><td>{{version}}</td><td>{{date}}</td><td>{{author}}</td><td>{{changes}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;

    Handlebars.registerHelper('toFixed', (value: any, digits: any) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value ?? '');
      return n.toFixed(typeof digits === 'number' ? digits : 2);
    });
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }

  /**
   * HTML 转 PDF（简化实现）
   * 提取 HTML 中的标题/表格/段落文本用 PDFKit 排版。
   * 完整 HTML 排版（CSS/图片）需 puppeteer/chromium，不在本阶段范围。
   */
  private async htmlToPdf(html: string): Promise<Uint8Array> {
    const doc = new PDFKit({ size: 'A4', margin: 40 });
    const chunks: Uint8Array[] = [];
    doc.on('data', (c: any) => chunks.push(c as Uint8Array));
    const done = new Promise<Uint8Array>((resolve) => {
      doc.on('end', () => resolve(concatBytes(chunks)));
    });

    // 去除 style/script，抽取块级元素
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '');
    const blocks = text.match(/<(h[1-4]|p|td|th|li)[^>]*>([\s\S]*?)<\/\1>/gi) || [];

    const decode = (s: string) =>
      s.replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

    for (const block of blocks) {
      const m = block.match(/<(h[1-4]|p|td|th|li)[^>]*>([\s\S]*?)<\/\1>/i);
      if (!m) continue;
      const tag = m[1].toLowerCase();
      const content = decode(m[2]);
      if (!content) continue;

      if (doc.y > doc.page.height - 60) doc.addPage();

      if (tag === 'h1') doc.fontSize(22).text(content, { align: 'center' });
      else if (tag === 'h2') { doc.moveDown(0.5); doc.fontSize(16).text(content); }
      else if (tag === 'h3') doc.fontSize(13).text(content);
      else if (tag === 'h4') doc.fontSize(12).text(content);
      else doc.fontSize(9.5).text(content);
      doc.moveDown(0.15);
    }

    doc.end();
    return done;
  }

  // ============ 工具方法 ============

  private calculateDrawingBounds(drawing: Drawing): BBox {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const entity of drawing.entities) {
      minX = Math.min(minX, entity.bounds.minX);
      maxX = Math.max(maxX, entity.bounds.maxX);
      minY = Math.min(minY, entity.bounds.minY);
      maxY = Math.max(maxY, entity.bounds.maxY);
    }

    // 包含设备/线缆
    for (const device of drawing.devices || []) {
      minX = Math.min(minX, device.position.x - 50);
      maxX = Math.max(maxX, device.position.x + 50);
      minY = Math.min(minY, device.position.y - 50);
      maxY = Math.max(maxY, device.position.y + 50);
    }

    if (minX === Infinity) { minX = 0; maxX = 1000; minY = 0; maxY = 1000; }

    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  private async canvasToPdf(canvas: HTMLCanvasElement, outputPath: string, filename: string, bounds: BBox): Promise<ExportFile> {
    // 使用 pdf-lib 将 canvas 位图嵌入 PDF
    const dataUrl = canvas.toDataURL('image/png');
    const pngBytes = base64ToBytes(dataUrl.split(',')[1]);
    const pdfDoc = await PDFDocument.create();
    const png = await pdfDoc.embedPng(pngBytes);
    // px -> pt（96dpi）
    const page = pdfDoc.addPage([canvas.width * 0.75, canvas.height * 0.75]);
    page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    const pdfBytes = await pdfDoc.save();
    return {
      path: outputPath.replace(/\.[^.]+$/, '.pdf'),
      format: 'pdf',
      size: pdfBytes.length,
      drawingId: '',
      dataBase64: bytesToBase64(pdfBytes),
    };
  }

  private canvasToImage(canvas: HTMLCanvasElement, outputPath: string, filename: string, format: ExportFormat): ExportFile {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'jpg' ? 0.9 : undefined;
    const dataUrl = canvas.toDataURL(mime, quality);
    const base64 = dataUrl.split(',')[1];
    const buf = base64ToBytes(base64);
    return { path: outputPath, format, size: buf.length, drawingId: '', dataBase64: base64 };
  }

  private createZipPackage(files: ExportFile[], outputDir: string): Promise<ExportFile> {
    return new Promise((resolve) => {
      const zip = new JSZip();
      for (const file of files) {
        if (file.dataBase64) {
          zip.file(file.path, base64ToBytes(file.dataBase64));
        }
      }
      zip.generateAsync({ type: 'uint8array' }).then((content: Uint8Array) => {
        resolve({
          path: `${this.sanitizeFilename(this.project.name)}_导出包.zip`,
          format: 'zip',
          size: content.length,
          dataBase64: bytesToBase64(content),
        });
      });
    });
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getEntityColor(entity: GraphicEntity, layer: any): string {
    if (entity.color >= 1 && entity.color <= 255) {
      // ACI 色号简化映射
      const colors = ['#FF0000','#FFFF00','#00FF00','#00FFFF','#FF00FF','#FFFFFF','#808080','#C0C0C0'];
      return colors[entity.color % 8] || '#FFFFFF';
    }
    return layer?.color || '#FFFFFF';
  }
}

// ============ 单例导出 ============

export const createExporter = (project: Project, models: DeviceModel[]) => new Exporter(project, models);