/**
 * 核心领域模型类型定义
 * 所有包共享的类型，避免循环依赖
 */

// ============ 基础几何类型 ============

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 包围盒（模型坐标）—— 代码库各模块实际使用的形状 */
export interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TransformMatrix {
  a: number; // scaleX
  b: number; // shearY
  c: number; // shearX
  d: number; // scaleY
  e: number; // translateX
  f: number; // translateY
}

// ============ 项目/图纸模型 ============

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  drawings: Drawing[];
  settings: ProjectSettings;
}

export interface ProjectSettings {
  defaultScale: number;      // 默认比例尺 1:100
  unit: 'mm' | 'cm' | 'm';   // 单位
  gridSize: number;          // 网格大小(模型单位)
  snapEnabled: boolean;      // 吸附开关
  autoSaveInterval: number;  // 自动保存间隔(ms)
}

export interface Drawing {
  id: string;
  projectId: string;
  name: string;              // 如 "1F平面图"
  floor: string;             // 楼层标识 "1F", "B1"
  order: number;             // 标签页顺序
  file: DrawingFile;
  calibration: CalibrationData;
  layers: CadLayer[];
  entities: CadEntity[];     // CAD 解析出的图元
  viewport: ViewportState;
  devices: DeviceInstance[]; // 布点实例
  wiring: WiringNetwork;     // 布线网络
  wires?: Cable[];           // 兼容旧视图的线缆别名
  currentLayer?: string;     // 当前活动图层
  dirty?: boolean;           // 未保存修改标记（UI 层）
  createdAt: number;
  updatedAt: number;
}

export interface DrawingFile {
  originalName: string;
  format: 'dwg' | 'dxf' | 'pdf' | 'jpg' | 'png';
  size: number;
  path: string;              // 本地存储路径
  dxfPath?: string;          // 转换后的 DXF 路径
  thumbnailPath?: string;    // 缩略图路径
}

export interface CalibrationData {
  isCalibrated: boolean;
  point1: Point2D;           // 图纸上点1
  point2: Point2D;           // 图纸上点2
  realDistance: number;      // 实测距离(米)
  scale: number;             // 计算出的比例尺 (模型单位/米)
  unit: 'mm' | 'cm' | 'm';
}

export interface CadLayer {
  name: string;
  color: number;             // ACI 颜色索引
  visible: boolean;
  locked: boolean;
  lineType: string;
  lineWeight: number;
  entityCount?: number;      // 实体统计（UI 层计算填充）
  plottable?: boolean;       // 是否参与打印（UI 层）
  frozen?: boolean;          // 冻结状态（UI 层）
}

export interface ViewportState {
  transform: TransformMatrix; // 画布变换矩阵
  center: Point2D;            // 视口中心(模型坐标)
  zoom: number;               // 缩放级别
  showGrid: boolean;
  showRuler: boolean;
  worldX?: number;            // 光标世界坐标(由画布组件回填)
  worldY?: number;
}

// ============ CAD 图元模型 ============

export type CadEntityType =
  | 'LINE' | 'LWPOLYLINE' | 'POLYLINE'
  | 'ARC' | 'CIRCLE' | 'ELLIPSE'
  | 'TEXT' | 'MTEXT'
  | 'INSERT' | 'BLOCK'
  | 'HATCH' | 'DIMENSION'
  | 'POINT' | 'RAY' | 'XLINE'
  | 'SPLINE' | 'HELIX'
  | 'IMAGE' | 'WIPEOUT';

export interface CadEntity {
  id: string;                // 图元唯一ID
  type: CadEntityType;
  layer: string;
  color: number;             // ACI 色号，0=ByLayer, 256=ByBlock
  lineType: string;
  lineWeight: number;
  visible: boolean;
  data: CadEntityData;       // 类型特定数据
  bounds: BBox;              // 包围盒(模型坐标)
}

export type CadEntityData =
  | LineData
  | PolylineData
  | ArcData
  | CircleData
  | TextData
  | MTextData
  | InsertData
  | HatchData
  | DimensionData
  | PointData
  | SplineData
  | ImageData;

export interface LineData {
  start: Point2D;
  end: Point2D;
}

export interface PolylineData {
  vertices: Point2D[];
  bulges: number[];          // 每段圆弧凸度
  closed: boolean;
  width: number;             // 全局宽度
  vertexWidths?: [number, number][]; // 起止宽度
}

export interface ArcData {
  center: Point2D;
  radius: number;
  startAngle: number;        // 弧度
  endAngle: number;
}

export interface CircleData {
  center: Point2D;
  radius: number;
}

export interface TextData {
  position: Point2D;
  text: string;
  height: number;
  rotation: number;
  hAlign: 'left' | 'center' | 'right';
  vAlign: 'baseline' | 'bottom' | 'middle' | 'top';
  style: string;
}

export interface MTextData {
  position: Point2D;
  text: string;
  width: number;
  height: number;
  rotation: number;
  attachmentPoint: number;
  lineSpacing: number;
}

export interface InsertData {
  blockName: string;
  position: Point2D;
  scale: Point2D;            // x, y, z 缩放
  rotation: number;
  attributes: Record<string, string>; // 块属性
}

export interface HatchData {
  patternName: string;
  scale: number;
  angle: number;
  loops: Point2D[][];        // 外部/内部轮廓
  solidFill: boolean;
}

export interface DimensionData {
  dimType: 'linear' | 'aligned' | 'angular' | 'radius' | 'diameter';
  defPoints: Point2D[];      // 定义点
  textPosition: Point2D;
  dimensionText: string;
  style: string;
}

export interface PointData {
  position: Point2D;
}

export interface SplineData {
  controlPoints: Point2D[];
  knots: number[];
  degree: number;
  closed: boolean;
}

export interface ImageData {
  position: Point2D;
  size: { width: number; height: number };
  rotation: number;
  imagePath: string;
}

// ============ 设备模型 ============

export interface DeviceModel {
  id: string;
  name: string;              // 显示名称 "海康威视 DS-2CD3T45WD-I5"
  vendor: string;            // 厂商
  category: DeviceCategory;
  type: DeviceType;          // 具体型号代码
  specs: DeviceSpecs;
  icon: DeviceIcon;
  price?: number;            // 参考价(元)
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export type DeviceCategory =
  | 'dome'       // 半球
  | 'bullet'     // 枪机
  | 'ptz'        // 球机
  | 'panoramic'  // 全景
  | 'thermal'    // 热成像
  | 'multi'      // 多目
  | 'fisheye'    // 鱼眼
  | 'door_station' // 门口机
  | 'nvr'        // 录像机
  | 'switch'     // 交换机
  | 'other';

export type DeviceType =
  | 'fixed_dome' | 'varifocal_dome' | 'motorized_dome'
  | 'fixed_bullet' | 'varifocal_bullet' | 'motorized_bullet'
  | 'indoor_ptz' | 'outdoor_ptz' | 'speed_dome'
  | 'single_pano' | 'multi_pano' | 'dual_pano'
  | 'thermal_bullet' | 'thermal_ptz' | 'bi_spectrum'
  | 'dual_lens' | 'triple_lens'
  | 'fisheye_360' | 'fisheye_180'
  | 'ip_door' | 'video_door'
  | 'nvr_4ch' | 'nvr_8ch' | 'nvr_16ch' | 'nvr_32ch' | 'nvr_64ch' | 'nvr_128ch'
  | 'poe_switch_4' | 'poe_switch_8' | 'poe_switch_16' | 'poe_switch_24' | 'core_switch'
  | 'custom';

export interface DeviceSpecs {
  // 光学参数
  focalLength?: number | [number, number]; // 定焦/变焦范围(mm)
  horizontalFOV?: number;                  // 水平视场角(度)
  verticalFOV?: number;                    // 垂直视场角(度)
  maxDistance?: number;                    // 最远识别距离(米)
  minIllumination?: number;                // 最低照度(lux)

  // 物理参数
  powerConsumption?: number;               // 功耗(W)
  voltage?: 'DC12V' | 'AC24V' | 'AC220V' | 'DC24V' | 'PoE' | 'PoE+' | 'Hi-PoE' | 'DC12V/PoE' | 'PoE/DC12V';
  mountHeight?: number;                    // 推荐安装高度(米)
  dimensions?: { w: number; h: number; d: number }; // mm
  weight?: number;                         // 克
  ipRating?: string;                       // IP67, IP66
  ikRating?: string;                       // IK10

  // 网络参数
  resolution?: string;                     // 4MP, 8MP, 4K
  compression?: string[];                  // H.265, H.264, MJPEG
  maxFrameRate?: number;
  audioIn?: boolean;
  audioOut?: boolean;
  alarmIn?: number;
  alarmOut?: number;
  sdCardSlot?: boolean;
  wifi?: boolean;
}

export interface DeviceIcon {
  type: 'svg' | 'png' | 'builtin' | 'lucide';
  path?: string;           // 文件路径或内置图标名
  svg?: string;            // 内联 SVG 字符串（UI 层）
  lucide?: string;         // Lucide 图标名（UI 层）
  color?: string;          // 图标主色（UI 层）
  width: number;           // 图标显示宽度(像素)
  height: number;
  anchor: Point2D;         // 锚点相对位置(0-1)
  rotationOffset: number;  // 图标默认朝向偏移(弧度)
}

export interface DeviceInstance {
  id: string;
  drawingId: string;
  modelId: string;         // 引用 DeviceModel
  position: Point2D;       // 模型坐标
  rotation: number;        // 朝向(弧度，0=向右，顺时针)
  label: string;           // 点位编号 "C001"
  remarks: string;         // 备注
  customSpecs?: Partial<DeviceSpecs>; // 覆盖默认规格
  mountHeight?: number;        // 实际安装高度(米)，覆盖规格默认值
  createdAt: number;
  updatedAt: number;
  selected?: boolean;      // UI 状态
  visible?: boolean;
}

// ============ 视野仿真 ============

export interface FieldOfView {
  deviceId: string;
  horizontalFOV: number;   // 弧度
  verticalFOV: number;
  maxDistance: number;     // 模型单位
  mountHeight: number;     // 安装高度(米)
  tiltAngle: number;       // 俯仰角(弧度，向下为正)
  rotation: number;        // 水平旋转(弧度)
  blindZone?: BlindZone;   // 盲区(近距离)
}

export interface BlindZone {
  minDistance: number;     // 最近识别距离
  shape: 'cone' | 'cylinder';
}

// ============ 布线模型 ============

export interface WiringNetwork {
  id: string;
  drawingId: string;
  weakPoints: WeakPoint[];      // 弱电井
  trays: CableTray[];           // 桥架
  cables: Cable[];              // 线缆
  topology: TopologyNode[];     // 拓扑节点(用于拓扑图)
}

export interface WeakPoint {
  id: string;
  position: Point2D;
  name: string;                // "1#弱电井"
  type: 'main' | 'floor' | 'roof' | 'custom';
  devices: string[];           // 接入的设备ID
  notes: string;
}

export interface CableTray {
  id: string;
  path: Point2D[];             // 多段线路径
  width: number;               // 桥架宽度(mm)
  height: number;              // 桥架高度(mm)
  type: 'ladder' | 'trough' | 'wire_mesh';
  layers: number;              // 层数
  length?: number;             // 总长度（UI 计算，mm）
  startPointId?: string;       // 关联弱电井
  endPointId?: string;
}

export interface Cable {
  id: string;
  type: CableType;
  path: Point2D[];             // 走线路径(正交或直线)
  length: number;              // 计算长度(米)
  correctedLength: number;     // 含盘留长度
  startDeviceId: string;       // 起点设备/井
  endDeviceId: string;         // 终点设备/井/交换机
  trayIds: string[];           // 经过的桥架段
  status: 'auto' | 'manual' | 'modified';
  color: string;               // 显示颜色
  label?: string;              // 线缆标签
  slackRatio?: number;         // 富余系数（UI 显示）
}

export type CableType = 'cat6' | 'cat6a' | 'cat7' | 'fiber_sm' | 'fiber_mm' | 'power' | 'custom';

export interface TopologyNode {
  id: string;
  type: 'device' | 'switch' | 'nvr' | 'core' | 'weak_point';
  refId: string;               // 引用设备/井ID
  position: Point2D;           // 拓扑图坐标(独立于模型坐标)
  children: string[];          // 子节点ID
  metadata: Record<string, any>;
}

// ============ 导出模型 ============

export interface ExportOptions {
  drawingIds: string[];
  formats: ExportFormat[];
  include: ExportInclude;
  resolution?: number;         // DPI for images
  template?: string;           // 报告模板名
  outputDir: string;
  /** 可选：渲染进程提供的画布快照（drawingId -> PNG dataURL），
   *  用于主进程导出点位图/视野图时替代离屏绘制 */
  canvasSnapshots?: Record<string, string>;
}

export type ExportFormat = 'png' | 'jpg' | 'pdf' | 'xlsx' | 'docx' | 'dwg' | 'dxf' | 'csv' | 'svg' | 'zip';

export interface ExportInclude {
  pointMap: boolean;           // 点位图
  fovMap: boolean;             // 视野覆盖图
  topology: boolean;           // 拓扑图
  deviceList: boolean;         // 设备清单
  cableList: boolean;          // 线缆清单
  report: boolean;             // 方案报告
}

export interface ExportResult {
  success: boolean;
  files: ExportFile[];
  errors: string[];
}

export interface ExportFile {
  path: string;
  format: ExportFormat;
  size: number;
  drawingId?: string;
  /** 文件内容的 base64 编码（导出引擎产出时携带，落盘后可省略） */
  dataBase64?: string;
}

// ============ 应用状态 ============

export interface AppState {
  currentProjectId: string | null;
  currentDrawingId: string | null;
  recentProjects: RecentProject[];
  ui: UIState;
}

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
  thumbnail?: string;
}

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US';
  sidebarOpen: boolean;
  panelSizes: Record<string, number>;
  shortcuts: Record<string, string>;
}

// ============ 事件/命令 ============

export type AppCommand =
  | { type: 'NEW_PROJECT'; payload: { name: string } }
  | { type: 'OPEN_PROJECT'; payload: { path: string } }
  | { type: 'SAVE_PROJECT' }
  | { type: 'IMPORT_DRAWING'; payload: { files: File[] } }
  | { type: 'CALIBRATE'; payload: CalibrationData }
  | { type: 'ADD_DEVICE'; payload: { modelId: string; position: Point2D } }
  | { type: 'MOVE_DEVICE'; payload: { deviceId: string; position: Point2D } }
  | { type: 'ROTATE_DEVICE'; payload: { deviceId: string; rotation: number } }
  | { type: 'DELETE_DEVICE'; payload: { deviceId: string } }
  | { type: 'AUTO_WIRING' }
  | { type: 'MANUAL_WIRING'; payload: { startId: string; endId: string } }
  | { type: 'EXPORT'; payload: ExportOptions }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// ============ 常量 ============

export const CABLE_COLORS: Record<CableType, string> = {
  cat6: '#3B82F6',      // 蓝
  cat6a: '#2563EB',
  cat7: '#1D4ED8',
  fiber_sm: '#F59E0B',  // 琥珀
  fiber_mm: '#FBBF24',
  power: '#EF4444',     // 红
  custom: '#8B5CF6',    // 紫
};

export const DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string> = {
  dome: '半球机',
  bullet: '枪机',
  ptz: '球机',
  panoramic: '全景机',
  thermal: '热成像',
  multi: '多目相机',
  fisheye: '鱼眼',
  door_station: '门口机',
  nvr: '录像机',
  switch: '交换机',
  other: '其他',
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  defaultScale: 100,
  unit: 'm',
  gridSize: 1000, // 1米网格(毫米单位)
  snapEnabled: true,
  autoSaveInterval: 30000,
};

export const VIEWPORT_DEFAULTS: ViewportState = {
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  center: { x: 0, y: 0 },
  zoom: 1,
  showGrid: true,
  showRuler: true,
};
// ============ 兼容别名（代码库历史命名）============

/** GraphicEntity 为 CadEntity 的历史命名别名，供渲染层/导出引擎引用 */
export type GraphicEntity = CadEntity;
/** Layer 为 CadLayer 的历史命名别名 */
export type Layer = CadLayer;
