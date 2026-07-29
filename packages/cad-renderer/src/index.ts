// Canvas 2D 渲染引擎
// 支持大量图元高性能渲染、视口裁剪、LOD 分级、拾取

import {
  GraphicEntity,
  Point2D,
  Rect,
  TransformMatrix,
  ViewportState,
  BBox,
  DeviceInstance,
  Cable,
  WeakPoint,
  CableTray,
  FieldOfView,
} from '@security-survey/shared-types';

// ============ 常量 ============

const DEVICE_ICON_SIZE = 24;
const SELECTION_TOLERANCE = 6; // 拾取容差(像素)
const GRID_COLOR = '#E5E7EB';
const GRID_COLOR_DARK = '#374151';
const RULER_COLOR = '#9CA3AF';
const SELECTION_COLOR = '#3B82F6';
const SELECTION_HIGHLIGHT = 'rgba(59, 130, 246, 0.2)';
const FOV_COLOR = 'rgba(34, 197, 94, 0.15)';
const FOV_BORDER = '#22C55E';
const BLIND_ZONE_COLOR = 'rgba(239, 68, 68, 0.2)';
const CABLE_COLORS: Record<string, string> = {
  cat6: '#3B82F6',
  cat6a: '#2563EB',
  cat7: '#1D4ED8',
  fiber_sm: '#F59E0B',
  fiber_mm: '#FBBF24',
  power: '#EF4444',
  custom: '#8B5CF6',
};

const LAYER_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
  5: '#FF00FF', 6: '#FFFFFF', 7: '#808080', 8: '#C0C0C0',
};

// ACI 颜色索引到十六进制映射（简化版）
const ACI_TO_HEX: Record<number, string> = {
  0: '#FFFFFF', 1: '#FF0000', 2: '#FFFF00', 3: '#00FF00',
  4: '#00FFFF', 5: '#FF00FF', 6: '#FFFFFF', 7: '#808080',
  8: '#C0C0C0', 9: '#800000', 10: '#808000', 20: '#008000',
  30: '#008080', 40: '#800080', 50: '#808080', 60: '#C0C0C0',
  256: '#FFFFFF', // ByBlock
};

// ============ 渲染器核心类 ============

export class CadRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  // 渲染数据
  private entities: GraphicEntity[] = [];
  private layers: Map<string, { visible: boolean; color: string }> = new Map();
  private lodData: { level0: GraphicEntity[]; level1: GraphicEntity[]; level2: GraphicEntity[] } = { level0: [], level1: [], level2: [] };

  // 视口状态
  private viewport: ViewportState = {
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    center: { x: 0, y: 0 },
    zoom: 1,
    showGrid: true,
    showRuler: true,
  };

  // 业务图层
  private devices: DeviceInstance[] = [];
  private cables: Cable[] = [];
  private weakPoints: WeakPoint[] = [];
  private cableTrays: CableTray[] = [];
  private fovs: Map<string, FieldOfView> = new Map();

  // 交互状态
  private hoveredEntityId: string | null = null;
  private selectedEntityIds: Set<string> = new Set();
  private hoveredDeviceId: string | null = null;
  private selectedDeviceIds: Set<string> = new Set();

  // 性能监控
  private renderStats = { entities: 0, culled: 0, timeMs: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
  }

  // ============ 生命周期 ============

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  // ============ 数据设置 ============

  setEntities(entities: GraphicEntity[]): void {
    this.entities = entities;
    this.buildLayerMap(entities);
    this.generateLod(entities);
  }

  setViewport(viewport: ViewportState): void {
    this.viewport = viewport;
  }

  setDevices(devices: DeviceInstance[]): void {
    this.devices = devices;
  }

  setCables(cables: Cable[]): void {
    this.cables = cables;
  }

  setWeakPoints(points: WeakPoint[]): void {
    this.weakPoints = points;
  }

  setCableTrays(trays: CableTray[]): void {
    this.cableTrays = trays;
  }

  setFovs(fovs: Map<string, FieldOfView>): void {
    this.fovs = fovs;
  }

  setLayerVisibility(layerName: string, visible: boolean): void {
    const layer = this.layers.get(layerName);
    if (layer) layer.visible = visible;
  }

  setLayerColor(layerName: string, color: string): void {
    const layer = this.layers.get(layerName);
    if (layer) layer.color = color;
  }

  // 交互状态
  setHoveredEntity(id: string | null): void {
    this.hoveredEntityId = id;
  }

  setSelectedEntities(ids: Set<string>): void {
    this.selectedEntityIds = ids;
  }

  setHoveredDevice(id: string | null): void {
    this.hoveredDeviceId = id;
  }

  setSelectedDevices(ids: Set<string>): void {
    this.selectedDeviceIds = ids;
  }

  // ============ 核心渲染循环 ============

  render(): RenderStats {
    const start = performance.now();
    const { ctx, canvas, viewport, dpr } = this;

    // 清屏
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // 应用视口变换
    this.applyTransform(viewport.transform);

    // 1. 网格
    if (viewport.showGrid) this.drawGrid();

    // 2. 标尺
    if (viewport.showRuler) this.drawRuler();

    // 3. CAD 图元（LOD + 视口裁剪）
    this.renderEntities();

    // 4. 桥架
    this.renderCableTrays();

    // 5. 线缆
    this.renderCables();

    // 6. 弱电井
    this.renderWeakPoints();

    // 7. 设备及视野
    this.renderDevices();

    // 8. 拾取高亮（最后绘制，确保在最上层）
    this.renderHighlights();

    const timeMs = performance.now() - start;
    this.renderStats.timeMs = timeMs;

    return { ...this.renderStats };
  }

  // ============ 变换矩阵应用 ============

  private applyTransform(t: TransformMatrix): void {
    this.ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
  }

  // ============ 网格渲染 ============

  private drawGrid(): void {
    const { ctx, viewport } = this;
    const zoom = viewport.zoom;
    const gridSize = 1000 / zoom; // 1米网格，按缩放调整

    if (gridSize < 20) return; // 太密不画

    ctx.save();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5 / zoom;
    ctx.globalAlpha = 0.3;

    const bounds = this.getViewBounds();
    const startX = Math.floor(bounds.minX / gridSize) * gridSize;
    const startY = Math.floor(bounds.minY / gridSize) * gridSize;

    // 垂直线
    for (let x = startX; x <= bounds.maxX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.minY);
      ctx.lineTo(x, bounds.maxY);
      ctx.stroke();
    }

    // 水平线
    for (let y = startY; y <= bounds.maxY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.maxX, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============ 标尺渲染 ============

  private drawRuler(): void {
    const { ctx, viewport } = this;
    const zoom = viewport.zoom;
    const bounds = this.getViewBounds();
    const rulerSize = 24 / zoom;

    ctx.save();
    ctx.font = `${10 / zoom}px sans-serif`;
    ctx.fillStyle = RULER_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 顶部标尺
    ctx.fillRect(bounds.minX, bounds.minY - rulerSize, bounds.width, rulerSize);
    // 左侧标尺
    ctx.fillRect(bounds.minX - rulerSize, bounds.minY, rulerSize, bounds.height);

    // 刻度
    const gridSize = 1000 / zoom;
    if (gridSize >= 20) {
      const startX = Math.floor(bounds.minX / 1000) * 1000;
      for (let x = startX; x <= bounds.maxX; x += 1000) {
        const screenX = x;
        // 顶部刻度
        ctx.fillText(`${(x / 1000).toFixed(0)}m`, screenX, bounds.minY - rulerSize / 2);
        // 刻度线
        ctx.beginPath();
        ctx.moveTo(screenX, bounds.minY - rulerSize);
        ctx.lineTo(screenX, bounds.minY);
        ctx.stroke();
      }

      const startY = Math.floor(bounds.minY / 1000) * 1000;
      for (let y = startY; y <= bounds.maxY; y += 1000) {
        ctx.save();
        ctx.translate(bounds.minX - rulerSize / 2, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${(y / 1000).toFixed(0)}m`, 0, 0);
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(bounds.minX - rulerSize, y);
        ctx.lineTo(bounds.minX, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ============ CAD 图元渲染（核心） ============

  private renderEntities(): void {
    const { ctx, viewport, lodData } = this;

    // 根据缩放级别选择 LOD
    let entitiesToRender: GraphicEntity[];
    if (viewport.zoom > 0.5) {
      entitiesToRender = lodData.level0;
    } else if (viewport.zoom > 0.1) {
      entitiesToRender = lodData.level1;
    } else {
      entitiesToRender = lodData.level2;
    }

    // 视口裁剪
    const viewBounds = this.getViewBounds();
    const visibleEntities = entitiesToRender.filter(e =>
      e.bounds.maxX >= viewBounds.minX &&
      e.bounds.minX <= viewBounds.maxX &&
      e.bounds.maxY >= viewBounds.minY &&
      e.bounds.minY <= viewBounds.maxY
    );

    this.renderStats.entities = visibleEntities.length;
    this.renderStats.culled = entitiesToRender.length - visibleEntities.length;

    // 分层渲染：先画非选中，再画选中/悬停（保证高亮在上层）
    const normalEntities = visibleEntities.filter(e => !this.selectedEntityIds.has(e.id) && e.id !== this.hoveredEntityId);
    const highlightEntities = visibleEntities.filter(e => this.selectedEntityIds.has(e.id) || e.id === this.hoveredEntityId);

    this.drawEntityBatch(normalEntities, false);
    this.drawEntityBatch(highlightEntities, true);
  }

  private drawEntityBatch(entities: GraphicEntity[], isHighlight: boolean): void {
    const { ctx } = this;

    for (const entity of entities) {
      const layer = this.layers.get(entity.layer);
      if (layer && !layer.visible) continue;

      ctx.save();

      // 设置样式
      const color = layer?.color || this.getEntityColor(entity);
      ctx.strokeStyle = isHighlight ? SELECTION_COLOR : color;
      ctx.fillStyle = isHighlight ? SELECTION_HIGHLIGHT : color;
      ctx.lineWidth = (entity.lineWeight || 0.25) / this.viewport.zoom;
      ctx.globalAlpha = isHighlight ? 1 : 0.9;

      // 线型（简化：仅支持实线/虚线）
      if (entity.lineType && entity.lineType !== 'CONTINUOUS' && entity.lineType !== 'ByLayer') {
        ctx.setLineDash([5 / this.viewport.zoom, 3 / this.viewport.zoom]);
      } else {
        ctx.setLineDash([]);
      }

      // 绘制几何体
      this.drawEntityGeometry(entity);

      // 高亮包围盒
      if (isHighlight) {
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 2 / this.viewport.zoom;
        ctx.setLineDash([4 / this.viewport.zoom, 2 / this.viewport.zoom]);
        ctx.strokeRect(entity.bounds.minX, entity.bounds.minY, entity.bounds.width, entity.bounds.height);
      }

      ctx.restore();
    }
  }

  private drawEntityGeometry(entity: GraphicEntity): void {
    const { ctx } = this;
    const data = entity.data as any; // 运行时类型根据 entity.type

    switch (entity.type) {
      case 'LINE':
        ctx.beginPath();
        ctx.moveTo(data.start.x, data.start.y);
        ctx.lineTo(data.end.x, data.end.y);
        ctx.stroke();
        break;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        this.drawPolyline(data);
        break;

      case 'ARC':
        this.drawArc(data);
        break;

      case 'CIRCLE':
        ctx.beginPath();
        ctx.arc(data.center.x, data.center.y, data.radius, 0, Math.PI * 2);
        if (entity.type === 'CIRCLE') ctx.stroke();
        break;

      case 'TEXT':
        this.drawText(data);
        break;

      case 'MTEXT':
        this.drawMText(data);
        break;

      case 'INSERT':
        this.drawInsert(data);
        break;

      case 'HATCH':
        this.drawHatch(data);
        break;

      case 'POINT':
        this.drawPoint(data);
        break;

      case 'ELLIPSE':
        this.drawEllipse(data);
        break;

      case 'SPLINE':
        this.drawSpline(data);
        break;

      case 'IMAGE':
        this.drawImage(data);
        break;

      default:
        // 忽略不支持的类型
        break;
    }
  }

  private drawPolyline(data: any): void {
    const { ctx } = this;
    if (!data.vertices || data.vertices.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(data.vertices[0].x, data.vertices[0].y);

    for (let i = 1; i < data.vertices.length; i++) {
      const bulge = data.bulges?.[i - 1] || 0;
      if (Math.abs(bulge) > 0.001) {
        // 圆弧段：bulge = tan(theta/4)
        const p1 = data.vertices[i - 1];
        const p2 = data.vertices[i];
        this.drawArcFromBulge(p1, p2, bulge);
      } else {
        ctx.lineTo(data.vertices[i].x, data.vertices[i].y);
      }
    }

    if (data.closed) ctx.closePath();
    ctx.stroke();

    // 宽度（简化：仅描边，不填充宽度）
    if (data.width && data.width > 0) {
      ctx.lineWidth = data.width / this.viewport.zoom;
      ctx.stroke();
    }
  }

  private drawArcFromBulge(p1: Point2D, p2: Point2D, bulge: number): void {
    const { ctx } = this;
    // bulge = tan(θ/4) => θ = 4 * atan(bulge)
    const angle = 4 * Math.atan(bulge);
    const chordLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const radius = chordLen / (2 * Math.sin(Math.abs(angle) / 2));
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dirX = (p2.x - p1.x) / chordLen;
    const dirY = (p2.y - p1.y) / chordLen;
    // 垂直方向（根据 bulge 符号）
    const perpX = -dirY * (bulge > 0 ? 1 : -1);
    const perpY = dirX * (bulge > 0 ? 1 : -1);
    const centerX = midX + perpX * radius * Math.cos(angle / 2);
    const centerY = midY + perpY * radius * Math.cos(angle / 2);

    const startAngle = Math.atan2(p1.y - centerY, p1.x - centerX);
    const endAngle = startAngle + angle;

    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  }

  private drawArc(data: any): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(data.center.x, data.center.y, data.radius, data.startAngle, data.endAngle);
    ctx.stroke();
  }

  private drawText(data: any): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(data.position.x, data.position.y);
    ctx.rotate(data.rotation);
    ctx.font = `${data.height}px sans-serif`;
    ctx.textAlign = data.hAlign;
    ctx.textBaseline = data.vAlign;
    ctx.fillText(data.text, 0, 0);
    ctx.restore();
  }

  private drawMText(data: any): void {
    // 简化：按单行文本处理
    this.drawText({
      position: data.position,
      text: data.text.replace(/\\P/g, '\n'),
      height: data.height,
      rotation: data.rotation,
      hAlign: 'left',
      vAlign: 'top',
    });
  }

  private drawInsert(data: any): void {
    // 块引用：简化为绘制包围盒
    const { ctx } = this;
    ctx.save();
    ctx.translate(data.position.x, data.position.y);
    ctx.rotate(data.rotation);
    ctx.scale(data.scale.x, data.scale.y);
    // 实际应用中应递归绘制块定义中的实体
    ctx.strokeRect(-5, -5, 10, 10); // 占位
    ctx.restore();
  }

  private drawHatch(data: any): void {
    // 简化：仅绘制边界
    if (data.loops && data.loops.length > 0) {
      for (const loop of data.loops) {
        const { ctx } = this;
        ctx.beginPath();
        ctx.moveTo(loop[0].x, loop[0].y);
        for (let i = 1; i < loop.length; i++) {
          ctx.lineTo(loop[i].x, loop[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 0.9;
      }
    }
  }

  private drawPoint(data: any): void {
    const { ctx } = this;
    const size = 3 / this.viewport.zoom;
    ctx.beginPath();
    ctx.arc(data.position.x, data.position.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEllipse(data: any): void {
    // 简化：按圆绘制
    this.drawArc({ center: data.center, radius: data.majorRadius, startAngle: 0, endAngle: Math.PI * 2 });
  }

  private drawSpline(data: any): void {
    // 简化：按控制点连线
    const { ctx } = this;
    if (!data.controlPoints || data.controlPoints.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(data.controlPoints[0].x, data.controlPoints[0].y);
    for (let i = 1; i < data.controlPoints.length; i++) {
      ctx.lineTo(data.controlPoints[i].x, data.controlPoints[i].y);
    }
    ctx.stroke();
  }

  private drawImage(data: any): void {
    // 图片渲染：需要加载 Image 对象，此处略过
  }

  private getEntityColor(entity: GraphicEntity): string {
    if (entity.color >= 1 && entity.color <= 255) {
      return ACI_TO_HEX[entity.color] || '#FFFFFF';
    }
    return '#FFFFFF';
  }

  // ============ 业务图层渲染 ============

  private renderCableTrays(): void {
    const { ctx, viewport } = this;
    ctx.save();
    ctx.lineWidth = 2 / viewport.zoom;

    for (const tray of this.cableTrays) {
      if (tray.path.length < 2) continue;
      ctx.strokeStyle = '#6B7280';
      ctx.setLineDash([10 / viewport.zoom, 5 / viewport.zoom]);
      ctx.beginPath();
      ctx.moveTo(tray.path[0].x, tray.path[0].y);
      for (let i = 1; i < tray.path.length; i++) {
        ctx.lineTo(tray.path[i].x, tray.path[i].y);
      }
      ctx.stroke();

      // 宽度指示
      ctx.fillStyle = 'rgba(107, 114, 128, 0.1)';
      ctx.strokeRect(tray.path[0].x - tray.width / 2, tray.path[0].y - tray.height / 2, tray.width, tray.height);
    }
    ctx.restore();
  }

  private renderCables(): void {
    const { ctx, viewport } = this;
    ctx.save();
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const cable of this.cables) {
      if (cable.path.length < 2) continue;
      ctx.strokeStyle = CABLE_COLORS[cable.type] || CABLE_COLORS.custom;
      ctx.setLineDash(cable.type === 'fiber_sm' || cable.type === 'fiber_mm' ? [4 / viewport.zoom, 2 / viewport.zoom] : []);

      ctx.beginPath();
      ctx.moveTo(cable.path[0].x, cable.path[0].y);
      for (let i = 1; i < cable.path.length; i++) {
        ctx.lineTo(cable.path[i].x, cable.path[i].y);
      }
      ctx.stroke();

      // 长度标注（悬停时显示，此处简化）
    }
    ctx.restore();
  }

  private renderWeakPoints(): void {
    const { ctx, viewport } = this;
    const size = 16 / viewport.zoom;

    for (const wp of this.weakPoints) {
      ctx.save();
      ctx.translate(wp.position.x, wp.position.y);

      // 井图标
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.moveTo(-size, -size);
      ctx.lineTo(size, -size);
      ctx.lineTo(size * 0.6, size);
      ctx.lineTo(-size * 0.6, size);
      ctx.closePath();
      ctx.fill();

      // 标签
      ctx.font = `${10 / viewport.zoom}px sans-serif`;
      ctx.fillStyle = '#1F2937';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(wp.name, 0, size + 4 / viewport.zoom);

      ctx.restore();
    }
  }

  private renderDevices(): void {
    const { ctx, viewport } = this;
    const iconSize = DEVICE_ICON_SIZE / viewport.zoom;

    for (const device of this.devices) {
      const isSelected = this.selectedDeviceIds.has(device.id);
      const isHovered = this.hoveredDeviceId === device.id;

      ctx.save();
      ctx.translate(device.position.x, device.position.y);
      ctx.rotate(device.rotation);

      // 1. 视野锥体（选中/悬停时显示）
      if (isSelected || isHovered) {
        const fov = this.fovs.get(device.id);
        if (fov) this.drawFov(fov, viewport.zoom);
      }

      // 2. 设备图标
      this.drawDeviceIcon(device, iconSize, isSelected, isHovered);

      // 3. 标签
      if (device.label) {
        ctx.font = `${10 / viewport.zoom}px sans-serif`;
        ctx.fillStyle = isSelected ? SELECTION_COLOR : '#1F2937';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(device.label, 0, iconSize / 2 + 4 / viewport.zoom);
      }

      // 4. 选中/悬停高亮
      if (isSelected) {
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(-iconSize / 2 - 2 / viewport.zoom, -iconSize / 2 - 2 / viewport.zoom, iconSize + 4 / viewport.zoom, iconSize + 4 / viewport.zoom);
      } else if (isHovered) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5 / viewport.zoom;
        ctx.strokeRect(-iconSize / 2 - 1 / viewport.zoom, -iconSize / 2 - 1 / viewport.zoom, iconSize + 2 / viewport.zoom, iconSize + 2 / viewport.zoom);
      }

      ctx.restore();
    }
  }

  private drawDeviceIcon(device: DeviceInstance, size: number, selected: boolean, hovered: boolean): void {
    const { ctx } = this;
    const half = size / 2;

    // 根据类别绘制不同形状
    // 实际项目中应使用 DeviceModel.icon 中的 SVG 路径
    ctx.fillStyle = selected ? SELECTION_COLOR : (hovered ? '#F59E0B' : '#3B82F6');
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5 / this.viewport.zoom;

    // 简化：半球=圆，枪机=矩形+三角形，球机=圆+方向指示
    // 这里统一画圆+方向箭头
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 朝向指示（小三角形）
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(half * 0.8, 0);
    ctx.lineTo(half * 0.3, -half * 0.3);
    ctx.lineTo(half * 0.3, half * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  private drawFov(fov: FieldOfView, zoom: number): void {
    const { ctx } = this;
    const { horizontalFOV, verticalFOV, maxDistance, mountHeight, tiltAngle, rotation } = fov;

    // 计算地面投影多边形
    // 简化：水平投影为等腰三角形/扇形
    const halfH = horizontalFOV / 2;
    const halfV = verticalFOV / 2;

    // 最大距离处的宽度
    const groundDist = maxDistance * Math.cos(tiltAngle);
    const width = 2 * groundDist * Math.tan(halfH);

    // 近端距离（盲区）
    const blindDist = mountHeight * Math.tan(tiltAngle - halfV);
    const nearWidth = blindDist > 0 ? 2 * blindDist * Math.tan(halfH) : 0;

    ctx.save();
    ctx.rotate(rotation);

    // 主视野扇形
    ctx.fillStyle = FOV_COLOR;
    ctx.strokeStyle = FOV_BORDER;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-width / 2, groundDist);
    ctx.lineTo(width / 2, groundDist);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 盲区
    if (blindDist > 0) {
      ctx.fillStyle = BLIND_ZONE_COLOR;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-nearWidth / 2, blindDist);
      ctx.lineTo(nearWidth / 2, blindDist);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderHighlights(): void {
    // 选中设备的额外高亮（脉冲动画等）
    // 此处简化，实际可用 requestAnimationFrame 循环实现脉冲
  }

  // ============ 拾取/命中测试 ============

  /**
   * 屏幕坐标转模型坐标
   */
  screenToModel(screenX: number, screenY: number): Point2D {
    const { transform, dpr } = this;
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left) * dpr;
    const y = (screenY - rect.top) * dpr;

    // 逆变换
    const { a, b, c, d, e, f } = transform;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) return { x: 0, y: 0 };

    const modelX = (d * (x - e) - b * (y - f)) / det;
    const modelY = (-c * (x - e) + a * (y - f)) / det;

    return { x: modelX, y: modelY };
  }

  /**
   * 拾取实体（返回最近的实体ID）
   */
  pickEntity(screenX: number, screenY: number): string | null {
    const modelPos = this.screenToModel(screenX, screenY);
    const tolerance = SELECTION_TOLERANCE / this.viewport.zoom;

    // 优先拾取业务对象（设备、线缆、井）
    const deviceId = this.pickDevice(modelPos, tolerance);
    if (deviceId) return `device:${deviceId}`;

    const cableId = this.pickCable(modelPos, tolerance);
    if (cableId) return `cable:${cableId}`;

    const wellId = this.pickWeakPoint(modelPos, tolerance);
    if (wellId) return `well:${wellId}`;

    // 再拾取 CAD 图元
    for (const entity of this.entities) {
      if (this.entityHitTest(entity, modelPos, tolerance)) {
        return `entity:${entity.id}`;
      }
    }

    return null;
  }

  private pickDevice(pos: Point2D, tol: number): string | null {
    const iconSize = DEVICE_ICON_SIZE / this.viewport.zoom;
    for (const device of this.devices) {
      const dx = pos.x - device.position.x;
      const dy = pos.y - device.position.y;
      if (dx * dx + dy * dy <= iconSize * iconSize) {
        return device.id;
      }
    }
    return null;
  }

  private pickCable(pos: Point2D, tol: number): string | null {
    for (const cable of this.cables) {
      if (this.pointToPolylineDistance(pos, cable.path) <= tol) {
        return cable.id;
      }
    }
    return null;
  }

  private pickWeakPoint(pos: Point2D, tol: number): string | null {
    const size = 16 / this.viewport.zoom;
    for (const wp of this.weakPoints) {
      const dx = pos.x - wp.position.x;
      const dy = pos.y - wp.position.y;
      if (dx * dx + dy * dy <= size * size) return wp.id;
    }
    return null;
  }

  private entityHitTest(entity: GraphicEntity, pos: Point2D, tol: number): boolean {
    // 快速包围盒检测
    if (pos.x < entity.bounds.minX - tol || pos.x > entity.bounds.maxX + tol ||
        pos.y < entity.bounds.minY - tol || pos.y > entity.bounds.maxY + tol) {
      return false;
    }

    const data = entity.data as any;
    switch (entity.type) {
      case 'LINE':
        return this.pointToLineDistance(pos, data.start, data.end) <= tol;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        return this.pointToPolylineDistance(pos, data.vertices) <= tol;
      case 'ARC':
      case 'CIRCLE':
        return Math.abs(Math.hypot(pos.x - data.center.x, pos.y - data.center.y) - data.radius) <= tol;
      case 'TEXT':
      case 'MTEXT':
        // 文本按包围盒
        return true;
      default:
        return false;
    }
  }

  private pointToLineDistance(p: Point2D, a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  private pointToPolylineDistance(p: Point2D, vertices: Point2D[]): number {
    let minDist = Infinity;
    for (let i = 1; i < vertices.length; i++) {
      const d = this.pointToLineDistance(p, vertices[i - 1], vertices[i]);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  // ============ 工具方法 ============

  private getViewBounds(): BBox {
    const { transform, center, zoom } = this.viewport;
    const canvasWidth = this.canvas.width / this.dpr / zoom;
    const canvasHeight = this.canvas.height / this.dpr / zoom;

    return {
      minX: center.x - canvasWidth / 2,
      maxX: center.x + canvasWidth / 2,
      minY: center.y - canvasHeight / 2,
      maxY: center.y + canvasHeight / 2,
      width: canvasWidth,
      height: canvasHeight,
    };
  }

  private buildLayerMap(entities: GraphicEntity[]): void {
    for (const entity of entities) {
      if (!this.layers.has(entity.layer)) {
        this.layers.set(entity.layer, {
          visible: true,
          color: this.getEntityColor(entity),
        });
      }
    }
  }

  private generateLod(entities: GraphicEntity[]): void {
    const structureKeywords = ['墙', '壁', 'WALL', 'DOOR', '门', 'WINDOW', '窗', '柱', 'COLUMN', '轴网', 'GRID', 'AXIS'];
    const outlineKeywords = ['外轮廓', 'OUTLINE', '建筑轮廓', 'BUILDING'];

    this.lodData.level0 = entities;
    this.lodData.level1 = entities.filter(e =>
      structureKeywords.some(k => e.layer.toUpperCase().includes(k.toUpperCase()))
    );
    this.lodData.level2 = entities.filter(e =>
      outlineKeywords.some(k => e.layer.toUpperCase().includes(k.toUpperCase()))
    );
  }

  // ============ 导出/截图 ============

  exportImage(format: 'png' | 'jpeg', quality = 0.9): string {
    return this.canvas.toDataURL(`image/${format}`, quality);
  }

  getRenderStats(): RenderStats {
    return { ...this.renderStats };
  }
}

// ============ 类型定义 ============

interface RenderStats {
  entities: number;
  culled: number;
  timeMs: number;
}

// ============ 导出 ============

export const createRenderer = (canvas: HTMLCanvasElement) => new CadRenderer(canvas);