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

interface SecuritySurveyApi {
  project: Record<string, (...args: any[]) => Promise<any>>;
  drawing: Record<string, (...args: any[]) => Promise<any>>;
  cad: Record<string, (...args: any[]) => Promise<any>>;
  export: {
    pointMap: (options: any) => Promise<ExportResultPayload>;
    fovMap: (options: any) => Promise<ExportResultPayload>;
    topology: (options: any) => Promise<ExportResultPayload>;
    deviceList: (options: any) => Promise<ExportResultPayload>;
    cableSchedule: (options: any) => Promise<ExportResultPayload>;
    report: (options: any) => Promise<ExportResultPayload>;
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
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string, encoding?: 'utf8' | 'base64') => Promise<any>;
    showOpenDialog: (options?: any) => Promise<any>;
    showSaveDialog: (options?: any) => Promise<any>;
  };
  shell: Record<string, (...args: any[]) => Promise<any>>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

interface Window {
  api: SecuritySurveyApi;
}
