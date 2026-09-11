/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Electron preload 桥接 API（src/preload/index.ts 暴露）
interface ExportFileResult {
  path: string;
  format: string;
  size: number;
  drawingId?: string;
  dataBase64?: string;
}

interface ExportResultPayload {
  success: boolean;
  files: ExportFileResult[];
  errors: string[];
}

interface FsGrantResult {
  granted: string[];
  rejected: Array<{ path: string; reason: string }>;
}

interface SecuritySurveyApi {
  project: {
    new: (name: string) => Promise<any>;
    open: () => Promise<any>;
    /** filePath 省略时由主进程弹保存对话框 */
    save: (data: any, filePath?: string) => Promise<{ success: boolean; path?: string; error?: string } | false | null>;
    saveAs: (data: any) => Promise<any>;
    recent: () => Promise<string[]>;
  };
  drawing: {
    import: (paths: string[]) => Promise<any[]>;
    calibrate: (drawingId: string, calibration: any) => Promise<any>;
  };
  cad: {
    parse: (filePath: string) => Promise<any>;
    convertDwg: (dwgPath: string) => Promise<any>;
  };
  export: {
    pointMap: (options: any) => Promise<ExportResultPayload>;
    fovMap: (options: any) => Promise<ExportResultPayload>;
    topology: (options: any) => Promise<ExportResultPayload>;
    deviceList: (options: any) => Promise<ExportResultPayload>;
    cableSchedule: (options: any) => Promise<ExportResultPayload>;
    report: (options: any) => Promise<ExportResultPayload>;
    dxf: (options: any) => Promise<ExportResultPayload>;
    saveFile: (fileName: string, dataBase64: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  };
  device: {
    getLibrary: () => Promise<any>;
    addCustom: (device: any) => Promise<any>;
    importLibrary: (json: string) => Promise<any>;
    exportLibrary: () => Promise<any>;
  };
  settings: Record<string, (...args: any[]) => Promise<any>>;
  window: Record<string, (...args: any[]) => Promise<any>>;
  fs: {
    readFile: (path: string) => Promise<string | null>;
    readFileBase64: (path: string) => Promise<string | null>;
    writeFile: (path: string, content: string, encoding?: 'utf8' | 'base64') => Promise<boolean>;
    showOpenDialog: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
    showSaveDialog: (options?: any) => Promise<{ canceled: boolean; filePath?: string }>;
    grantPaths: (paths: string[]) => Promise<FsGrantResult>;
  };
  shell: Record<string, (...args: any[]) => Promise<any>>;
  /** 返回取消订阅函数 */
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
}

interface Window {
  /** preload 暴露的主进程桥（D-1 修复后与 electronAPI 同源） */
  api: SecuritySurveyApi;
  electronAPI: SecuritySurveyApi;
}
