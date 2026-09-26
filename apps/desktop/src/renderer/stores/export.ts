// 导出 Store —— 管理导出配置、任务执行、进度与历史
// 通过 IPC 调用主进程中的 @security-survey/exporter 真实导出引擎

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, CanvasSnapshotMeta } from '@security-survey/shared-types';

/** 'dxf' = CAD 标注 overlay（T3 新增能力） */
export type ExportTypeId = 'pointmap' | 'fov' | 'topology' | 'bom' | 'report' | 'dxf';

export interface ExportTaskFile {
  path: string;
  format: string;
  size: number;
  drawingId?: string;
  dataBase64?: string;
}

export interface ExportTaskResult {
  success: boolean;
  files: ExportTaskFile[];
  errors: string[];
}

export interface ExportHistoryItem {
  id: string;
  name: string;
  types: ExportTypeId[];
  format: string;
  time: string;
  fileCount: number;
  success: boolean;
}

const HISTORY_KEY = 'export-history-v2';

export const useExportStore = defineStore('export', () => {
  // ============ 状态 ============
  const exporting = ref(false);
  const progress = ref(0);
  const currentStep = ref('');
  const lastResult = ref<ExportTaskResult | null>(null);
  const history = ref<ExportHistoryItem[]>(loadHistory());

  const isIdle = computed(() => !exporting.value);

  // ============ 内部工具 ============

  function loadHistory(): ExportHistoryItem[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function persistHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value.slice(0, 50)));
  }

  function buildInclude(types: ExportTypeId[]) {
    return {
      pointMap: types.includes('pointmap'),
      fovMap: types.includes('fov'),
      topology: types.includes('topology'),
      deviceList: types.includes('bom'),
      cableList: types.includes('bom'), // BOM 含线缆清单
      report: types.includes('report'),
      // DXF overlay 扩展位：ExportInclude 类型不改（历史 .survey 里的 include 形状不能变），
      // exporter 侧以 (options.include as any).dxfOverlay 读取
      dxfOverlay: types.includes('dxf'),
    };
  }

  /**
   * 把 Vue 响应式代理还原成纯对象 —— 跨 IPC 的硬性前置条件。
   *
   * 实测（scripts/smoke/diag-clone.cjs，真实 Electron 进程内对照实验）：
   *   纯对象           → 正常进入主进程
   *   reactive Proxy   → "An object could not be cloned."
   *   JSON round-trip  → 正常进入主进程
   * 即 Electron 的 IPC 序列化拒绝 Vue 的 Proxy。而 ExportView 与点位图/导出 DXF 等
   * 通道送出去的 options.project 恰恰就是 store 里的响应式对象，故必须在此除代理。
   *
   * structuredClone 读不到 Proxy 的内部代理行为，产出的是纯对象副本；它可能因为
   * 载荷里存在别的不可克隆值而失败，那时退回 JSON round-trip（更慢但更宽容）。
   */
  function toPlain<T>(value: T): T {
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch {
      /* structuredClone 不支持该载荷（含不可克隆值），走 JSON 兜底 */
    }
    try {
      return JSON.parse(JSON.stringify(value ?? null));
    } catch {
      return value;
    }
  }

  /**
   * 跨 IPC 前剥离 Vue 响应式代理 —— 「对象 could not be cloned」的直接修复点。
   *
   * 快照原本是纯 dataURL **字符串**（原始值，塞进 ref 也不会被代理包装），
   * 尺寸标识需求把它升级成 { dataUrl, mmPerPx, ... } **对象**后，ref 读取出来
   * 的每个快照都变成了 Vue 的 reactive Proxy，Electron 的结构化克隆拒绝 Proxy
   * ⇒ ipcRenderer.invoke 直接抛 "An object could not be cloned"，整张点位图导出失败。
   *
   * 这里在 IPC 边界把每个快照摊平成纯对象（只抽原始值），代理不再随载荷出站。
   */
  function toPlainSnapshots(
    snaps?: Record<string, string | CanvasSnapshotMeta> | null
  ): Record<string, string | CanvasSnapshotMeta> {
    const out: Record<string, string | CanvasSnapshotMeta> = {};
    for (const [drawingId, snap] of Object.entries(snaps || {})) {
      if (typeof snap === 'string') {
        out[drawingId] = snap;
      } else if (snap && typeof snap === 'object') {
        out[drawingId] = {
          dataUrl: String(snap.dataUrl ?? ''),
          mmPerPx: Number(snap.mmPerPx) || 0,
          widthPx: Number(snap.widthPx) || 0,
          heightPx: Number(snap.heightPx) || 0,
        };
      }
    }
    return out;
  }

  function baseOptions(opts: {
    project: Project;
    types: ExportTypeId[];
    format: string;
    dpi?: number;
    canvasSnapshots?: Record<string, string | CanvasSnapshotMeta>;
  }) {
    const drawingIds = (opts.project.drawings || []).map((d) => d.id);
    const formats: string[] = [opts.format];
    // 勾选了 DXF 内容项就必须让 formats 含 'dxf'，否则 exporter 的
    // `formats.includes('dxf')` 前置条件会把产物静默丢掉（AC-7.3 禁静默缺失）
    if (opts.types.includes('dxf') && !formats.includes('dxf')) formats.push('dxf');
    return {
      // project 来自 store（深响应式），必须除代理后才能过 IPC
      project: toPlain(opts.project),
      drawingIds,
      formats,
      resolution: opts.dpi || 300,
      outputDir: '',
      include: buildInclude(opts.types),
      // 必须剥离响应式：不这么做，对象形态的快照会以 Proxy 出站并被 IPC 拒绝
      canvasSnapshots: toPlainSnapshots(opts.canvasSnapshots),
    };
  }

  // ============ 动作 ============

  /**
   * 执行导出任务
   * 逐项调用主进程导出引擎，聚合结果
   */
  async function runExport(opts: {
    project: Project;
    types: ExportTypeId[];
    format: string;
    dpi?: number;
    canvasSnapshots?: Record<string, string | CanvasSnapshotMeta>;
    projectName?: string;
  }): Promise<ExportTaskResult> {
    if (exporting.value) {
      return { success: false, files: [], errors: ['已有导出任务进行中'] };
    }

    exporting.value = true;
    progress.value = 0;

    const files: ExportTaskFile[] = [];
    const errors: string[] = [];
    const options = baseOptions(opts);
    const api = window.api.export;

    const steps: { id: ExportTypeId; label: string; call: () => Promise<ExportTaskResult> }[] = [];
    if (opts.types.includes('dxf')) {
      // DXF overlay：主进程直调（纯文本无需 canvas，不经 120s 渲染进程握手）
      steps.push({
        id: 'dxf',
        label: '导出 DXF',
        call: async () => {
          const res: any = await window.api.export.dxf({
            // 同 baseOptions：project 是响应式对象，必须除代理后再过 IPC
            project: toPlain(opts.project),
            drawingIds: (opts.project.drawings || []).map((d) => d.id),
            dxfLayers: (opts as any).dxfLayers || { devices: true, cables: true, trays: true, wells: true, texts: true },
            autoSave: false,
          });
          return {
            success: !!res?.success,
            files: (res?.files || []) as ExportTaskFile[],
            errors: (res?.errors || []) as string[],
          };
        },
      });
    }
    if (opts.types.includes('pointmap')) {
      steps.push({ id: 'pointmap', label: '点位图', call: () => api.pointMap(options) });
    }
    if (opts.types.includes('fov')) {
      steps.push({ id: 'fov', label: '视场分析', call: () => api.fovMap(options) });
    }
    if (opts.types.includes('topology')) {
      steps.push({ id: 'topology', label: '拓扑图', call: () => api.topology(options) });
    }
    if (opts.types.includes('bom')) {
      steps.push({
        id: 'bom',
        label: 'BOM清单',
        call: async () => {
          const deviceRes = await api.deviceList(options);
          const cableRes = await api.cableSchedule(options);
          return {
            success: deviceRes.success || cableRes.success,
            files: [...deviceRes.files, ...cableRes.files],
            errors: [...deviceRes.errors, ...cableRes.errors],
          };
        },
      });
    }
    if (opts.types.includes('report')) {
      steps.push({ id: 'report', label: '工程报告', call: () => api.report(options) });
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      currentStep.value = `正在生成 ${step.label} (${i + 1}/${steps.length})...`;
      try {
        const res = await step.call();
        files.push(...(res.files || []));
        if (res.errors?.length) errors.push(...res.errors);
        if (!res.success && !res.errors?.length) errors.push(`${step.label} 导出失败`);
      } catch (err: any) {
        errors.push(`${step.label}: ${err?.message || String(err)}`);
      }
      progress.value = Math.round(((i + 1) / steps.length) * 100);
    }

    const result: ExportTaskResult = { success: errors.length === 0, files, errors };
    lastResult.value = result;

    // 记录历史
    history.value.unshift({
      id: Date.now().toString(),
      name: opts.projectName || opts.project.name || '未命名导出',
      types: opts.types,
      format: opts.format,
      time: new Date().toISOString(),
      fileCount: files.length,
      success: result.success,
    });
    persistHistory();

    exporting.value = false;
    currentStep.value = '';
    return result;
  }

  /**
   * DXF overlay 导出（架构决策 2 / 5.4）
   * 走主进程直调路径 window.api.export.dxf —— 不经 delegateExportToRenderer，
   * 纯文本无需 canvas，也就没有 120s 往返超时。
   * 默认只输出点位/设备相关图层（AC-7.1：新手主流程不需要桥架/弱电井也能用）。
   */
  async function runDxfExport(opts: {
    project: Project;
    drawingIds?: string[];
    layers?: { devices?: boolean; cables?: boolean; trays?: boolean; wells?: boolean; texts?: boolean };
    projectName?: string;
  }): Promise<ExportTaskResult> {
    if (exporting.value) {
      return { success: false, files: [], errors: ['已有导出任务进行中'] };
    }
    exporting.value = true;
    currentStep.value = '正在生成 DXF…';
    const errors: string[] = [];
    const files: ExportTaskFile[] = [];
    try {
      const res: any = await window.api.export.dxf({
        // DXF 走的是主进程直调，同样要过 IPC ⇒ 同样必须除响应式代理
        project: toPlain(opts.project),
        drawingIds: opts.drawingIds?.length
          ? opts.drawingIds
          : (opts.project.drawings || []).map(d => d.id),
        // 五个图层开关默认全开；调用方只传部分键时，缺失键按 true 补齐（契约测试锁定）
        dxfLayers: {
          devices: true,
          cables: true,
          trays: true,
          wells: true,
          texts: true,
          ...(opts.layers || {}),
        },
        autoSave: false,            // 由渲染进程统一走 saveFiles 的保存框，避免双弹框
      });
      if (res?.errors?.length) errors.push(...res.errors);
      files.push(...(res?.files || []));
      if (!res?.files?.length && !res?.errors?.length) errors.push('DXF 导出未产出文件');
      if (files.length) {
        const saved = await saveFiles(files);
        if (!saved.length && !errors.length) errors.push('DXF 保存被取消');
      }
    } catch (err: any) {
      errors.push(`DXF: ${err?.message || String(err)}`);
    }

    const result: ExportTaskResult = { success: errors.length === 0, files, errors };
    lastResult.value = result;
    history.value.unshift({
      id: Date.now().toString(),
      name: opts.projectName || opts.project.name || 'DXF 导出',
      types: ['dxf'] as any,
      format: 'dxf',
      time: new Date().toISOString(),
      fileCount: files.length,
      success: result.success,
    });
    persistHistory();
    exporting.value = false;
    currentStep.value = '';
    return result;
  }

  /**
   * 把导出文件落盘（base64 -> 文件）
   * 返回实际保存路径列表
   */
  async function saveFiles(files: ExportTaskFile[]): Promise<string[]> {
    const saved: string[] = [];
    for (const file of files) {
      if (!file.dataBase64) continue;
      const target = await window.api.fs.showSaveDialog({
        defaultPath: file.path,
        filters: file.path.endsWith('.dxf')
          ? [{ name: 'DXF 图形交换格式', extensions: ['dxf'] }]
          : undefined,
      });
      if (!target || target.canceled) continue;
      const filePath = typeof target === 'string' ? target : target.filePath;
      if (!filePath) continue;
      await window.api.fs.writeFile(filePath, file.dataBase64, 'base64');
      saved.push(filePath);
    }
    return saved;
  }

  function clearHistory() {
    history.value = [];
    persistHistory();
  }

  function removeHistoryItem(id: string) {
    history.value = history.value.filter((h) => h.id !== id);
    persistHistory();
  }

  return {
    // state
    exporting,
    progress,
    currentStep,
    lastResult,
    history,
    // getters
    isIdle,
    // actions
    runExport,
    runDxfExport,
    saveFiles,
    clearHistory,
    removeHistoryItem,
  };
});
