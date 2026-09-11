// CAD 解析器核心模块
// 负责 DXF/DWG 解析、实体转换、大文件流式处理

import {
  GraphicEntity,
  Drawing,
  Layer,
  Point2D,
  BBox,
  TransformMatrix,
  ViewportState,
  DeviceModel,
  DeviceInstance,
  Cable,
  WeakPoint,
  CableTray,
  Project,
  ProjectSettings,
} from '@security-survey/shared-types';

import { parseDxf } from './ezdxf-shim.js';
import type { DxfDocument, DxfEntity } from './ezdxf-shim.js';
import { existsSync, copyFileSync, mkdtempSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, basename, join } from 'path';
import { tmpdir } from 'os';

// ============ 配置常量 ============

const CHUNK_SIZE = 5000;           // 分批处理实体数量
const MAX_ENTITIES_IN_MEMORY = 100000; // 内存中最大实体数，超出触发分级渲染
const SIMPLIFICATION_THRESHOLD = 50000; // 超过此数量启用简化渲染

// ============ 类型扩展 ============

interface ParseOptions {
  filePath: string;
  fileType: 'dxf' | 'dwg';
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
}

interface ParseResult {
  drawing: Drawing;
  stats: ParseStats;
}

interface ParseStats {
  totalEntities: number;
  parsedEntities: number;
  skippedEntities: number;
  layers: number;
  blocks: number;
  parseTimeMs: number;
  memoryPeakMB: number;
}

interface EntityFilter {
  layerNames?: string[];
  entityTypes?: string[];
  bounds?: BBox;
}

// ============ 主解析器类 ============

export class CadParser {
  private doc: DxfDocument | null = null;
  private abortSignal: AbortSignal | null = null;

  /**
   * 解析 DXF/DWG 文件
   * DWG 会先通过 ODA File Converter 转为 DXF 再解析
   */
  async parse(options: ParseOptions): Promise<ParseResult> {
    const startTime = performance.now();
    this.abortSignal = options.signal || null;

    let dxfPath = options.filePath;

    // 如果是 DWG，先转换
    if (options.fileType === 'dwg') {
      options.onProgress?.(5, '正在转换 DWG 到 DXF...');
      dxfPath = await this.convertDwgToDxf(options.filePath);
    }

    options.onProgress?.(10, '正在解析 DXF 文件...');

    // 使用 ezdxf 解析
    const parseResult = await this.parseDxfWithProgress(dxfPath, options.onProgress);

    options.onProgress?.(90, '正在构建图纸模型...');
    const drawing = this.buildDrawingModel(parseResult.doc, options.filePath);

    options.onProgress?.(100, '解析完成');

    const stats: ParseStats = {
      totalEntities: parseResult.totalEntities,
      parsedEntities: parseResult.parsedEntities,
      skippedEntities: parseResult.skippedEntities,
      layers: parseResult.layers.length,
      blocks: parseResult.blocks.size,
      parseTimeMs: performance.now() - startTime,
      memoryPeakMB: this.getMemoryUsage(),
    };

    return { drawing, stats };
  }

  /**
   * 带进度回调的 DXF 解析
   */
  private async parseDxfWithProgress(
    filePath: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<{
    doc: DxfDocument;
    totalEntities: number;
    parsedEntities: number;
    skippedEntities: number;
    layers: Layer[];
    blocks: Map<string, DxfEntity[]>;
  }> {
    // 使用 ezdxf 解析
    const doc = await parseDxf(filePath);

    const totalEntities = doc.modelspace().length();
    let parsedEntities = 0;
    let skippedEntities = 0;

    // 提取图层信息
    const layers = this.extractLayers(doc);

    // 提取块定义
    const blocks = this.extractBlocks(doc);

    onProgress?.(50, `发现 ${totalEntities} 个图元，正在转换...`);

    // 分批处理实体，避免阻塞主线程
    for (let i = 0; i < totalEntities; i += CHUNK_SIZE) {
      if (this.abortSignal?.aborted) {
        throw new Error('解析被中止');
      }

      const chunk = doc.modelspace().slice(i, i + CHUNK_SIZE);
      for (const entity of chunk) {
        // 这里可以添加过滤逻辑
        parsedEntities++;
      }

      const progress = 50 + Math.floor((i / totalEntities) * 40);
      onProgress?.(progress, `已处理 ${Math.min(i + CHUNK_SIZE, totalEntities)} / ${totalEntities} 个图元`);
    }

    return { doc, totalEntities, parsedEntities, skippedEntities, layers, blocks };
  }

  /**
   * 构建标准化 Drawing 模型（符合 shared-types Drawing 结构）
   */
  private buildDrawingModel(doc: DxfDocument, filePath: string): Drawing {
    const modelspace = doc.modelspace();
    const entities: GraphicEntity[] = [];

    // 转换所有模型空间实体
    for (const entity of modelspace) {
      const converted = this.convertEntity(entity);
      if (converted) {
        entities.push(converted);
      }
    }

    // 计算图纸边界
    const bounds = this.calculateBounds(entities);
    const name = filePath.split(/[\\/]/).pop() || 'drawing';
    const now = Date.now();
    const drawingId = this.generateId();

    const drawing: Drawing = {
      id: drawingId,
      projectId: '',
      name,
      floor: '',
      order: 0,
      file: {
        originalName: name,
        format: filePath.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf',
        size: 0,
        path: filePath,
      },
      calibration: {
        isCalibrated: false,
        point1: { x: 0, y: 0 },
        point2: { x: 0, y: 0 },
        realDistance: 0,
        scale: 1,
        unit: 'm',
      },
      layers: this.extractLayers(doc),
      entities,
      viewport: {
        transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        center: { x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 },
        zoom: 1,
        showGrid: true,
        showRuler: true,
      },
      devices: [],
      wiring: {
        id: this.generateId(),
        drawingId,
        weakPoints: [],
        trays: [],
        cables: [],
        topology: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    return drawing;
  }

  /**
   * 转换单个 DXF 实体为统一 GraphicEntity
   */
  private convertEntity(entity: DxfEntity): GraphicEntity | null {
    const commonProps = {
      id: this.generateId(),
      layer: entity.dxf.layer || '0',
      color: entity.dxf.color || 256, // 256 = ByLayer
      lineType: entity.dxf.linetype || 'BYLAYER',
      lineWeight: entity.dxf.lineweight || -1, // -1 = ByLayer
      visible: true,
    };

    switch (entity.dxf.type) {
      case 'LINE':
        return {
          ...commonProps,
          type: 'LINE',
          data: {
            start: { x: entity.dxf.start.x, y: entity.dxf.start.y },
            end: { x: entity.dxf.end.x, y: entity.dxf.end.y },
          },
          bounds: this.lineBounds(entity.dxf.start, entity.dxf.end),
        };

      case 'LWPOLYLINE':
      case 'POLYLINE':
        return this.convertPolyline(entity, commonProps);

      case 'ARC':
        return {
          ...commonProps,
          type: 'ARC',
          data: {
            center: { x: entity.dxf.center.x, y: entity.dxf.center.y },
            radius: entity.dxf.radius,
            startAngle: entity.dxf.start_angle,
            endAngle: entity.dxf.end_angle,
          },
          bounds: this.arcBounds(entity.dxf.center, entity.dxf.radius, entity.dxf.start_angle, entity.dxf.end_angle),
        };

      case 'CIRCLE':
        return {
          ...commonProps,
          type: 'CIRCLE',
          data: {
            center: { x: entity.dxf.center.x, y: entity.dxf.center.y },
            radius: entity.dxf.radius,
          },
          bounds: {
            minX: entity.dxf.center.x - entity.dxf.radius,
            maxX: entity.dxf.center.x + entity.dxf.radius,
            minY: entity.dxf.center.y - entity.dxf.radius,
            maxY: entity.dxf.center.y + entity.dxf.radius,
            width: entity.dxf.radius * 2,
            height: entity.dxf.radius * 2,
          },
        };

      case 'TEXT':
      case 'MTEXT':
        return this.convertText(entity, commonProps);

      case 'INSERT':
        return this.convertInsert(entity, commonProps);

      case 'HATCH':
        return this.convertHatch(entity, commonProps);

      case 'DIMENSION':
        return this.convertDimension(entity, commonProps);

      case 'POINT':
        return {
          ...commonProps,
          type: 'POINT',
          data: { position: { x: entity.dxf.location.x, y: entity.dxf.location.y } },
          bounds: { minX: entity.dxf.location.x, maxX: entity.dxf.location.x, minY: entity.dxf.location.y, maxY: entity.dxf.location.y, width: 0, height: 0 },
        };

      case 'SPLINE':
        return this.convertSpline(entity, commonProps);

      case 'IMAGE':
        return this.convertImage(entity, commonProps);

      default:
        // 不支持的实体类型，记录日志但不中断
        console.warn(`Unsupported entity type: ${entity.dxf.type}`);
        return null;
    }
  }

  // ============ 实体转换辅助方法 ============

  private convertPolyline(entity: DxfEntity, commonProps: any): GraphicEntity | null {
    const vertices = entity.dxf.vertices || [];
    if (vertices.length < 2) return null;

    const points: Point2D[] = vertices.map(v => ({ x: v.x, y: v.y }));
    const bulges = entity.dxf.bulges || [];
    const closed = entity.dxf.closed || false;

    return {
      ...commonProps,
      type: 'LWPOLYLINE',
      data: {
        vertices: points,
        bulges: bulges,
        closed,
        width: entity.dxf.width || 0,
        vertexWidths: entity.dxf.vertex_widths,
      },
      bounds: this.polylineBounds(points),
    };
  }

  private convertText(entity: DxfEntity, commonProps: any): GraphicEntity {
    const isMText = entity.dxf.type === 'MTEXT';

    return {
      ...commonProps,
      type: isMText ? 'MTEXT' : 'TEXT',
      data: {
        position: { x: entity.dxf.insert.x, y: entity.dxf.insert.y },
        text: entity.dxf.text || entity.dxf.plain_text() || '',
        height: entity.dxf.height || 2.5,
        rotation: entity.dxf.rotation || 0,
        hAlign: entity.dxf.halign || 0,
        vAlign: entity.dxf.valign || 0,
        style: entity.dxf.style || 'STANDARD',
        width: isMText ? entity.dxf.width : undefined,
        attachmentPoint: isMText ? entity.dxf.attachment_point : undefined,
        lineSpacing: isMText ? entity.dxf.line_spacing : undefined,
      },
      bounds: this.textBounds(entity),
    };
  }

  private convertInsert(entity: DxfEntity, commonProps: any): GraphicEntity {
    return {
      ...commonProps,
      type: 'INSERT',
      data: {
        blockName: entity.dxf.name,
        position: { x: entity.dxf.insert.x, y: entity.dxf.insert.y },
        scale: {
          x: entity.dxf.xscale || 1,
          y: entity.dxf.yscale || 1,
          z: entity.dxf.zscale || 1,
        },
        rotation: entity.dxf.rotation || 0,
        attributes: entity.dxf.attribs || {},
      },
      bounds: this.insertBounds(entity),
    };
  }

  private convertHatch(entity: DxfEntity, commonProps: any): GraphicEntity {
    const loops = entity.dxf.paths.map(path => path.vertices.map(v => ({ x: v.x, y: v.y })));

    return {
      ...commonProps,
      type: 'HATCH',
      data: {
        patternName: entity.dxf.pattern_name,
        scale: entity.dxf.pattern_scale,
        angle: entity.dxf.pattern_angle,
        loops,
        solidFill: entity.dxf.solid_fill,
      },
      bounds: this.hatchBounds(loops),
    };
  }

  private convertDimension(entity: DxfEntity, commonProps: any): GraphicEntity {
    return {
      ...commonProps,
      type: 'DIMENSION',
      data: {
        dimType: entity.dxf.dimtype,
        defPoints: entity.dxf.defpoints.map(p => ({ x: p.x, y: p.y })),
        textPosition: { x: entity.dxf.text_midpoint.x, y: entity.dxf.text_midpoint.y },
        dimensionText: entity.dxf.measurement,
        style: entity.dxf.dimstyle,
      },
      bounds: this.dimensionBounds(entity),
    };
  }

  private convertSpline(entity: DxfEntity, commonProps: any): GraphicEntity {
    return {
      ...commonProps,
      type: 'SPLINE',
      data: {
        controlPoints: entity.dxf.control_points.map(p => ({ x: p.x, y: p.y })),
        knots: entity.dxf.knots,
        degree: entity.dxf.degree,
        closed: entity.dxf.closed,
      },
      bounds: this.splineBounds(entity.dxf.control_points),
    };
  }

  private convertImage(entity: DxfEntity, commonProps: any): GraphicEntity {
    return {
      ...commonProps,
      type: 'IMAGE',
      data: {
        position: { x: entity.dxf.insert.x, y: entity.dxf.insert.y },
        size: { width: entity.dxf.u_pixel.x, height: entity.dxf.v_pixel.y },
        rotation: entity.dxf.rotation,
        imagePath: entity.dxf.path,
      },
      bounds: this.imageBounds(entity),
    };
  }

  // ============ 边界计算 ============

  private lineBounds(start: any, end: any): BBox {
    return {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  private polylineBounds(points: Point2D[]): BBox {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  private arcBounds(center: any, radius: number, startAngle: number, endAngle: number): BBox {
    // 简化：返回整个圆的包围盒，实际应计算弧段包围盒
    return {
      minX: center.x - radius,
      maxX: center.x + radius,
      minY: center.y - radius,
      maxY: center.y + radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  private textBounds(entity: DxfEntity): BBox {
    // 简化估算
    const text = entity.dxf.text || entity.dxf.plain_text() || '';
    const height = entity.dxf.height || 2.5;
    const width = text.length * height * 0.6;
    const x = entity.dxf.insert.x;
    const y = entity.dxf.insert.y;
    return { minX: x, maxX: x + width, minY: y - height, maxY: y, width, height };
  }

  private insertBounds(entity: DxfEntity): BBox {
    // 块引用边界需要递归计算块定义边界，这里简化
    return { minX: entity.dxf.insert.x, maxX: entity.dxf.insert.x, minY: entity.dxf.insert.y, maxY: entity.dxf.insert.y, width: 0, height: 0 };
  }

  private hatchBounds(loops: Point2D[][]): BBox {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const loop of loops) {
      for (const p of loop) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  private dimensionBounds(entity: DxfEntity): BBox {
    return this.polylineBounds(entity.dxf.defpoints.map(p => ({ x: p.x, y: p.y })));
  }

  private splineBounds(controlPoints: any[]): BBox {
    return this.polylineBounds(controlPoints.map(p => ({ x: p.x, y: p.y })));
  }

  private imageBounds(entity: DxfEntity): BBox {
    return {
      minX: entity.dxf.insert.x,
      maxX: entity.dxf.insert.x + entity.dxf.u_pixel.x,
      minY: entity.dxf.insert.y,
      maxY: entity.dxf.insert.y + entity.dxf.v_pixel.y,
      width: entity.dxf.u_pixel.x,
      height: entity.dxf.v_pixel.y,
    };
  }

  private calculateBounds(entities: GraphicEntity[]): BBox {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const e of entities) {
      minX = Math.min(minX, e.bounds.minX);
      maxX = Math.max(maxX, e.bounds.maxX);
      minY = Math.min(minY, e.bounds.minY);
      maxY = Math.max(maxY, e.bounds.maxY);
    }
    return {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 1000 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 1000 : maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // ============ 图层/块提取 ============

  private extractLayers(doc: DxfDocument): Layer[] {
    const layers: Layer[] = [];
    for (const layer of doc.layers()) {
      layers.push({
        name: layer.dxf.name,
        color: layer.dxf.color,
        lineType: layer.dxf.linetype,
        lineWeight: layer.dxf.lineweight,
        visible: !layer.dxf.off,
        locked: layer.dxf.lock,
      });
    }
    return layers;
  }

  private extractBlocks(doc: DxfDocument): Map<string, DxfEntity[]> {
    const blocks = new Map<string, DxfEntity[]>();
    for (const block of doc.blocks()) {
      const entities: DxfEntity[] = [];
      for (const entity of block) {
        entities.push(entity);
      }
      blocks.set(block.dxf.name, entities);
    }
    return blocks;
  }

  // ============ DWG 转 DXF ============

  /**
   * 调用 ODA File Converter CLI 将 DWG 转换为 DXF
   * 需要预先安装 ODA File Converter (免费)
   * CLI 为目录式参数: <输入目录> <输出目录> <版本> <格式> <递归> <审计> <过滤>
   */
  private async convertDwgToDxf(dwgPath: string): Promise<string> {
    const dxfPath = dwgPath.replace(/\.dwg$/i, '.dxf');
    const converterPath = this.findOdaConverter();

    if (!converterPath) {
      throw new Error('未找到 ODA File Converter。请安装后重试，或手动将 DWG 转为 DXF。');
    }

    const inDir = dirname(dwgPath);
    const outDir = mkdtempSync(join(tmpdir(), 'oda-conv-'));

    return new Promise((resolve, reject) => {
      const args = [
        inDir,
        outDir,
        'ACAD2018', // 输出版本
        'DXF',
        '0',        // 不递归子目录
        '1',        // 审计修复
        basename(dwgPath),
      ];

      const proc = spawn(converterPath, args, { stdio: 'pipe' });

      proc.on('error', (err) => reject(new Error(`ODA 启动失败: ${err.message}`)));

      proc.on('close', (code) => {
        if (code === 0) {
          const produced = join(outDir, basename(dwgPath).replace(/\.dwg$/i, '.dxf'));
          if (existsSync(produced)) {
            copyFileSync(produced, dxfPath);
            resolve(dxfPath);
          } else {
            reject(new Error(`ODA 转换失败：未找到输出文件 (退出码 ${code})`));
          }
        } else {
          reject(new Error(`ODA 转换失败，退出码: ${code}`));
        }
      });
    });
  }

  private findOdaConverter(): string | null {
    // 优先使用环境变量指定的路径
    const envPath = process.env.ODA_PATH;
    const possiblePaths = [
      ...(envPath ? [envPath] : []),
      'C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
      'C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
      '/usr/local/bin/ODAFileConverter',
      '/opt/ODA/ODAFileConverter/ODAFileConverter',
      '/opt/ODA/ODAFileConverter',
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) return path;
    }
    return null;
  }

  // ============ 工具方法 ============

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  }

  // ============ 大文件优化：分级渲染数据生成 ============

  /**
   * 生成分级渲染数据（LOD）
   * Level 0: 全量图元（缩放 > 50%）
   * Level 1: 仅墙体/门窗/柱等结构图元（缩放 10-50%）
   * Level 2: 仅外轮廓/轴网（缩放 < 10%）
   */
  generateLodData(entities: GraphicEntity[]): { level0: GraphicEntity[]; level1: GraphicEntity[]; level2: GraphicEntity[] } {
    const structureLayers = ['墙体', '壁', 'WALL', 'door', '窗', 'WINDOW', '柱', 'COLUMN', '轴网', 'GRID', 'AXIS'];
    const outlineLayers = ['外轮廓', 'OUTLINE', '建筑轮廓', 'BUILDING_OUTLINE'];

    const level0 = entities; // 全量
    const level1 = entities.filter(e =>
      structureLayers.some(l => e.layer.toUpperCase().includes(l.toUpperCase()))
    );
    const level2 = entities.filter(e =>
      outlineLayers.some(l => e.layer.toUpperCase().includes(l.toUpperCase()))
    );

    return { level0, level1, level2 };
  }

  /**
   * 视口裁剪：仅返回可见区域内的图元
   */
  cullEntities(entities: GraphicEntity[], viewport: ViewportState): GraphicEntity[] {
    const { transform, center, zoom } = viewport;
    // 计算屏幕可见区域对应的模型坐标范围
    // 简化：使用变换矩阵逆变换
    const invZoom = 1 / zoom;
    const screenWidth = 1920 * invZoom; // 假设屏幕宽
    const screenHeight = 1080 * invZoom;

    const viewBounds: BBox = {
      minX: center.x - screenWidth / 2,
      maxX: center.x + screenWidth / 2,
      minY: center.y - screenHeight / 2,
      maxY: center.y + screenHeight / 2,
      width: screenWidth,
      height: screenHeight,
    };

    return entities.filter(e =>
      e.bounds.maxX >= viewBounds.minX &&
      e.bounds.minX <= viewBounds.maxX &&
      e.bounds.maxY >= viewBounds.minY &&
      e.bounds.minY <= viewBounds.maxY
    );
  }
}

// ============ 导出单例 ============

export const cadParser = new CadParser();