// Preload 脚本 - 安全暴露 API 给渲染进程
import { contextBridge, ipcRenderer } from 'electron';

// ============ 类型定义 ============

interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  drawings: Drawing[];
  settings: ProjectSettings;
}

interface ProjectSettings {
  defaultScale: number;
  unit: 'mm' | 'cm' | 'm';
  gridSize: number;
  snapEnabled: boolean;
  autoSaveInterval: number;
}

interface Drawing {
  id: string;
  name: string;
  floor: string;
  order: number;
  file: DrawingFile;
  calibration: CalibrationData;
  layers: CadLayer[];
  entities: GraphicEntity[];
  viewport: ViewportState;
  devices: DeviceInstance[];
  wiring: WiringNetwork;
}

interface DrawingFile {
  originalName: string;
  format: 'dwg' | 'dxf' | 'pdf' | 'jpg' | 'png';
  size: number;
  path: string;
  dxfPath?: string;
  thumbnailPath?: string;
}

interface CalibrationData {
  isCalibrated: boolean;
  point1: Point2D;
  point2: Point2D;
  realDistance: number;
  scale: number;
  unit: 'mm' | 'cm' | 'm';
}

interface CadLayer {
  name: string;
  color: number;
  visible: boolean;
  locked: boolean;
  lineType: string;
  lineWeight: number;
}

interface GraphicEntity {
  id: string;
  type: string;
  layer: string;
  color: number;
  lineType: string;
  lineWeight: number;
  visible: boolean;
  data: any;
  bounds: BBox;
}

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface ViewportState {
  transform: TransformMatrix;
  center: Point2D;
  zoom: number;
  showGrid: boolean;
  showRuler: boolean;
}

interface TransformMatrix {
  a: number; b: number; c: number; d: number; e: number; f: number;
}

interface Point2D { x: number; y: number; }

interface DeviceInstance {
  id: string;
  drawingId: string;
  modelId: string;
  position: Point2D;
  rotation: number;
  label: string;
  remarks: string;
  customSpecs?: any;
  createdAt: number;
  updatedAt: number;
}

interface WiringNetwork {
  id: string;
  drawingId: string;
  weakPoints: WeakPoint[];
  trays: CableTray[];
  cables: Cable[];
  topology: TopologyNode[];
}

interface WeakPoint {
  id: string;
  position: Point2D;
  name: string;
  type: 'main' | 'floor' | 'roof' | 'custom';
  devices: string[];
  notes: string;
}

interface CableTray {
  id: string;
  path: Point2D[];
  width: number;
  height: number;
  type: 'ladder' | 'trough' | 'wire_mesh';
  layers: number;
  startPointId?: string;
  endPointId?: string;
}

interface Cable {
  id: string;
  type: string;
  path: Point2D[];
  length: number;
  correctedLength: number;
  startDeviceId: string;
  endDeviceId: string;
  trayIds: string[];
  status: 'auto' | 'manual' | 'modified';
  color: string;
  label?: string;
}

interface TopologyNode {
  id: string;
  type: 'device' | 'switch' | 'nvr' | 'core' | 'weak_point';
  refId: string;
  position: Point2D;
  children: string[];
  metadata: Record<string, any>;
}

interface DeviceModel {
  id: string;
  name: string;
  vendor: string;
  category: string;
  type: string;
  specs: any;
  icon: any;
  price?: number;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

interface ExportOptions {
  drawingIds: string[];
  formats: string[];
  include: {
    pointMap: boolean;
    fovMap: boolean;
    topology: boolean;
    deviceList: boolean;
    cableList: boolean;
    report: boolean;
  };
  resolution?: number;
  template?: string;
  outputDir: string;
}

interface ExportResult {
  success: boolean;
  files: ExportFile[];
  errors: string[];
}

interface ExportFile {
  path: string;
  format: string;
  size: number;
  drawingId?: string;
}

// ============ API 暴露 ============

const api = {
  // 项目管理
  project: {
    new: (name: string) => ipcRenderer.invoke('project:new', name),
    open: () => ipcRenderer.invoke('project:open'),
    // 第二参 filePath 可选：传入则主进程直写该路径，不传则弹保存对话框
    save: (data: any, filePath?: string) => ipcRenderer.invoke('project:save', data, filePath),
    saveAs: (data: any) => ipcRenderer.invoke('project:saveAs', data),
    recent: () => ipcRenderer.invoke('project:recent'),
  },

  // 图纸管理
  drawing: {
    import: (paths: string[]) => ipcRenderer.invoke('drawing:import', paths),
    calibrate: (drawingId: string, calibration: any) => ipcRenderer.invoke('drawing:calibrate', drawingId, calibration),
  },

  // CAD 解析
  cad: {
    parse: (filePath: string) => ipcRenderer.invoke('cad:parse', filePath),
    convertDwg: (dwgPath: string) => ipcRenderer.invoke('cad:convertDwg', dwgPath),
  },

  // 导出
  export: {
    pointMap: (options: any) => ipcRenderer.invoke('export:pointMap', options),
    fovMap: (options: any) => ipcRenderer.invoke('export:fovMap', options),
    topology: (options: any) => ipcRenderer.invoke('export:topology', options),
    deviceList: (options: any) => ipcRenderer.invoke('export:deviceList', options),
    cableSchedule: (options: any) => ipcRenderer.invoke('export:cableSchedule', options),
    report: (options: any) => ipcRenderer.invoke('export:report', options),
    // DXF overlay 由主进程直接生成（不经渲染进程委托），见决策 2
    dxf: (options: any) => ipcRenderer.invoke('export:dxf', options),
    saveFile: (fileName: string, dataBase64: string) => ipcRenderer.invoke('export:saveFile', fileName, dataBase64),
  },

  // 设备库
  device: {
    getLibrary: () => ipcRenderer.invoke('device:getLibrary'),
    addCustom: (device: any) => ipcRenderer.invoke('device:addCustom', device),
    importLibrary: (json: string) => ipcRenderer.invoke('device:importLibrary', json),
    exportLibrary: () => ipcRenderer.invoke('device:exportLibrary'),
  },

  // 设置
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // 文件系统
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    readFileBase64: (path: string) => ipcRenderer.invoke('fs:readFileBase64', path),
    writeFile: (path: string, content: string, encoding?: 'utf8' | 'base64') => ipcRenderer.invoke('fs:writeFile', path, content, encoding),
    showOpenDialog: (options: any) => ipcRenderer.invoke('fs:showOpenDialog', options),
    showSaveDialog: (options: any) => ipcRenderer.invoke('fs:showSaveDialog', options),
    // 拖拽/输入等非对话框来源的文件路径需显式申请，主进程校验扩展名白名单后放行
    grantPaths: (paths: string[]) => ipcRenderer.invoke('fs:grantPaths', paths),
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },

  // 事件监听（返回取消订阅函数，便于组件卸载时清理）
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['project:updated', 'drawing:imported', 'export:progress', 'cad:progress', 'export:request', 'export:response'];
    if (!validChannels.includes(channel)) return () => {};
    const listener = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // 发送事件到主进程（仅限特定安全通道）
  send: (channel: string, ...args: any[]) => {
    const validSendChannels = ['export:response'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
};

// ============ 暴露给渲染进程（D-1 根因修复）============
//
// 历史现状：renderer 侧全部按 `window.api.*` 调用（stores / views / components 共几十处），
// 而 preload 只 exposeInMainWorld('electronAPI', ...)，导致所有桥接调用在运行期
// 抛 "Cannot read properties of undefined (reading 'xxx')" —— 表现为"保存成功"但文件
// 从未落盘、导入点击无反应等一类假成功故障。
//
// 收敛策略：以 renderer 实际使用的 `api` 为准，同时保留 `electronAPI` 别名
// （_archive 中的历史备份与部分第三方片段按 electronAPI 书写），两个名字指向同一份
// 能力，避免任何一侧回归失败。
contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electronAPI', api);
// 注：Window.api / Window.electronAPI 的全局类型已在 src/env.d.ts 声明（SecuritySurveyApi），
// 此处不再重复 declare global，避免与 env.d.ts 的接口合并产生类型冲突。