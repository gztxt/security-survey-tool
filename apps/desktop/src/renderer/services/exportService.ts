// 渲染进程导出服务 - 在有 DOM/Canvas 环境的渲染进程中运行
//
// 注意：这里**只允许 `import type` electron，**绝不能 `import` 实际值**。
// 渲染进程里没有 `require`，vite-plugin-electron-renderer 注入的 shim 在检测到
// `require` 缺失时只 console.error 一句就返回 `undefined`，下面立刻的解构
// （xt.ipcRenderer / xt.webFrame / ...）会抛 TypeError，**chunk 求值失败直接
// 拖垮整个动态 import 链路**。所有运行时访问必须改走 `window.electronAPI`
// （preload 暴露的上下文桥）或 `window.webFrame`。
import type { WebFrame as WebFrameType } from 'electron';
import { Exporter } from '@security-survey/exporter';
import type { Project, DeviceModel, ExportOptions, ExportResult, ExportFormat, ExportInclude } from '@security-survey/shared-types';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import { useProjectStore } from '@/stores/project';

// electronAPI 类型通过 preload 的 declare global 暴露，这里使用类型断言访问
function getElectronAPI(): Window['electronAPI'] | undefined {
  return (window as any).electronAPI;
}

// ============ 导出服务类 ============

class ExportService {
  constructor() {
    // 监听主进程发来的导出请求（通过 preload 暴露的 electronAPI.on）
    const api = getElectronAPI();
    if (api) {
      api.on('export:request', (_event: any, payload: { requestId: string; channel: string; options: ExportOptions }) => {
        this.handleExportRequest(payload.requestId, payload.channel, payload.options);
      });
    }
  }

  private async handleExportRequest(requestId: string, channel: string, options: ExportOptions): Promise<void> {
    try {
      // 从 store 获取项目和设备数据
      const projectStore = useProjectStore();
      const deviceStore = useDeviceLibraryStore();

      const project = projectStore.currentProject;
      if (!project) {
        throw new Error('未找到项目数据');
      }

      const deviceModels = deviceStore.allDevices;

      // 如果 options 中没有 canvasSnapshots，尝试从 Canvas 组件获取
      if (!options.canvasSnapshots) {
        options.canvasSnapshots = await this.captureCanvasSnapshots(project);
      }

      // 根据 channel 确定导出类型
      const include = this.channelToInclude(channel);
      const formats = options.formats || ['pdf'];

      // 实例化 Exporter 并执行导出
      const exporter = new Exporter(project, deviceModels);
      const result = await exporter.export({
        ...options,
        formats,
        include,
      });

      // 发送结果回主进程
      this.sendResponse(requestId, { success: true, data: result });
    } catch (error) {
      this.sendResponse(requestId, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private channelToInclude(channel: string): ExportInclude {
    const baseInclude: ExportInclude = {
      pointMap: false,
      fovMap: false,
      topology: false,
      deviceList: false,
      cableList: false,
      report: false,
    };

    switch (channel) {
      case 'export:pointMap':
        return { ...baseInclude, pointMap: true };
      case 'export:fovMap':
        return { ...baseInclude, fovMap: true };
      case 'export:topology':
        return { ...baseInclude, topology: true };
      case 'export:deviceList':
        return { ...baseInclude, deviceList: true };
      case 'export:cableSchedule':
        return { ...baseInclude, cableList: true };
      case 'export:report':
        return { ...baseInclude, report: true };
      default:
        return baseInclude;
    }
  }

  private async captureCanvasSnapshots(project: Project): Promise<Record<string, string>> {
    const snapshots: Record<string, string> = {};

    // webFrame 在渲染进程里是 `window.webFrame`（preload 注入或 Electron 自身暴露），
    // 不再 `import from 'electron'` —— 见文件顶部的注释，原因与 vite-plugin-electron-renderer
    // shim 在没有 require 时的 fallback 行为有关。
    const webFrame = (window as any).webFrame as WebFrameType | undefined;

    // 尝试获取当前激活的 Canvas 组件
    try {
      if (!webFrame) throw new Error('webFrame 不可用（预期外环境）');
      // 通过 webFrame 执行 JavaScript 获取 canvas
      const canvasDataUrls = await webFrame.executeJavaScript(`
        (() => {
          const canvases = document.querySelectorAll('canvas[data-drawing-id]');
          const result: Record<string, string> = {};
          canvases.forEach(canvas => {
            const drawingId = canvas.getAttribute('data-drawing-id');
            if (drawingId) {
              result[drawingId] = canvas.toDataURL('image/png');
            }
          });
          return result;
        })()
      `);

      if (canvasDataUrls && typeof canvasDataUrls === 'object') {
        Object.assign(snapshots, canvasDataUrls);
      }
    } catch (e) {
      console.warn('捕获画布快照失败:', e);
    }

    // 也尝试从 project store 的 drawingSnapshots 获取
    try {
      const projectStore = useProjectStore();
      Object.assign(snapshots, projectStore.drawingSnapshots);
    } catch {}

    return snapshots;
  }

  private sendResponse(requestId: string, response: any): void {
    response.requestId = requestId;
    const api = getElectronAPI();
    if (api?.send) {
      api.send('export:response', response);
    }
  }

  // 供渲染进程直接调用的导出方法（用于 UI 交互）
  async export(channel: string, options: ExportOptions): Promise<ExportResult> {
    const projectStore = useProjectStore();
    const deviceStore = useDeviceLibraryStore();

    const project = projectStore.currentProject;
    if (!project) {
      return { success: false, files: [], errors: ['未找到项目数据'] };
    }

    const deviceModels = deviceStore.allDevices;

    if (!options.canvasSnapshots) {
      options.canvasSnapshots = await this.captureCanvasSnapshots(project);
    }

    const include = this.channelToInclude(channel);
    const formats = options.formats || ['pdf'];

    const exporter = new Exporter(project, deviceModels);
    return exporter.export({
      ...options,
      formats,
      include,
    });
  }

  // 请求主进程保存文件（通过 preload 暴露的 electronAPI.export.saveFile）
  async saveFile(fileName: string, dataBase64: string): Promise<{ success: boolean; path?: string; error?: string }> {
    const api = getElectronAPI();
    if (api?.export?.saveFile) {
      return api.export.saveFile(fileName, dataBase64);
    }
    // 没有走 `await import('electron')` 的兜底 —— 见文件顶部注释，
    // 渲染进程里那一行会触发 shim 抛 TypeError。preload 必然导出
    // electronAPI.export.saveFile，没导出就是 preload 异常，直接抛出可见错误。
    throw new Error('无法保存文件：preload 未导出 export.saveFile（preload 异常？）');
  }
}

// 导出单例
export const exportService = new ExportService();