/**
 * 基线导入链（决策 3 / P0-2）
 *
 * 统一三条入口（工具栏按钮、右键菜单、拖拽、项目树）到同一条路径：
 *   1. 取得文件真实路径（原生对话框 / File.path / 拖拽后向主进程 fs:grantPaths 申请）
 *   2. 扩展名分流：
 *        dwg        → cad.convertDwg（20s Promise.race 兜底）→ 失败进 DwgFallbackDialog（US-02）
 *        dxf        → drawing.import（主进程 parseCadFile 填 entities/layers）
 *        png/jpg/…  → drawing.import 建记录；T2 仅提示"底图渲染开发中"，T5 接管栅格化
 *   3. 成功后 setCurrentDrawing + 适应视图（AC-1.4）+ markDirty
 *
 * 约束：
 *   - 不删除任何既有入口，只做汇聚；`importDrawing(file: File)` 签名保留（DrawingView 在调用）；
 *   - 桥不可用（纯浏览器 / 单测）时降级为 warning，不抛未捕获异常。
 */
import { ref, readonly } from 'vue';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/project';
import type { Drawing } from '@security-survey/shared-types';

/** CAD 矢量底图 */
export const CAD_EXTENSIONS = ['dwg', 'dxf'] as const;
/** 位图 / PDF 底图（T5 完整接管，T2 起可被选中并生成记录） */
export const BASEMAP_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf'] as const;
export const ALL_IMPORT_EXTENSIONS = [...CAD_EXTENSIONS, ...BASEMAP_EXTENSIONS] as const;

/** ODA 子进程无超时保护，renderer 侧兜底（PRD §5 风险"误判已安装导致空转"） */
export const DWG_CONVERT_TIMEOUT_MS = 20000;

export type ImportKind = 'cad' | 'basemap';

export interface ImportRejected {
  path: string;
  reason: string;
}

export interface ImportOutcome {
  imported: Drawing[];
  rejected: ImportRejected[];
  /** DWG 转换失败或超时，需用户在 DwgFallbackDialog 三选一中决策 */
  dwgFallback: string[];
  /** 已建记录但位图渲染未就绪（T2 阶段提示文案） */
  basemapPending: string[];
}

function extOf(pathOrName: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(pathOrName || '');
  return m ? m[1].toLowerCase() : '';
}

export function basenameOf(p: string): string {
  return (p || '').split(/[/\\]/).pop() || p;
}

/** 按扩展名判定导入分流（大小写无关） */
export function classifyByExtension(pathOrName: string): ImportKind | null {
  const e = extOf(pathOrName);
  if ((CAD_EXTENSIONS as readonly string[]).includes(e)) return 'cad';
  if ((BASEMAP_EXTENSIONS as readonly string[]).includes(e)) return 'basemap';
  return null;
}

/** 错误信息是否指向 ODA 转换器缺失（决策 3.2 的判定口径，不改主进程） */
export function isOdaMissing(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /ODA|File Converter|未找到 ODA/i.test(msg);
}

/** 给 promise 加超时，超时抛含 timeout 标记的错误以便进降级引导 */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${Math.round(ms / 1000)}s），视为未安装 ODA`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function useBaselineImport() {
  const projectStore = useProjectStore();
  const importing = ref(false);
  /** 待用户决策的 DWG 文件（驱动 DwgFallbackDialog；空数组即关闭） */
  const fallbackFiles = ref<string[]>([]);
  /** 注入的适应视图回调（由 DrawingView 提供，避免 composable 直接依赖画布 ref） */
  let fitHandler: (() => void) | null = null;

  function onFitViewport(handler: () => void) {
    fitHandler = handler;
  }

  /** 原生文件选择对话框（扩展名过滤含 CAD/位图/PDF，AC-2.1） */
  async function pickPaths(): Promise<string[]> {
    if (!projectStore.hasBridge()) {
      ElMessage.warning('当前环境不支持文件选择，请在桌面应用中操作');
      return [];
    }
    const result = await window.api.fs.showOpenDialog({
      title: '选择底图（DWG 需转换，推荐 DXF）',
      filters: [
        { name: '底图（CAD / 位图 / PDF）', extensions: [...ALL_IMPORT_EXTENSIONS] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    return (result?.filePaths || []).slice();
  }

  /** `<input type=file>` 兜底入口的 accept 字符串 */
  const fileInputAccept = ALL_IMPORT_EXTENSIONS.map(e => '.' + e).join(',');

  /** 拖拽 / File 对象入口：优先取真实路径，取不到回退对话框 */
  async function importFromFiles(files: File[]): Promise<ImportOutcome> {
    const paths = files
      .map(f => (f as any).path as string | undefined)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (!paths.length) return importPaths(await pickPaths());
    return importPaths(paths);
  }

  /** 完整流程：自行弹对话框 */
  async function runImport(): Promise<ImportOutcome> {
    return importPaths(await pickPaths());
  }

  /** 核心分流编排 */
  async function importPaths(paths: string[]): Promise<ImportOutcome> {
    const outcome: ImportOutcome = { imported: [], rejected: [], dwgFallback: [], basemapPending: [] };
    if (!paths.length) return outcome;

    importing.value = true;
    try {
      const cad: string[] = [];
      const basemap: string[] = [];
      for (const p of paths) {
        const kind = classifyByExtension(p);
        if (kind === 'cad') cad.push(p);
        else if (kind === 'basemap') basemap.push(p);
        else outcome.rejected.push({ path: p, reason: '不支持的文件类型' });
      }

      // --- CAD：DWG 先走转换（US-02），DXF 直接导入 ---
      const dwgPaths = cad.filter(p => extOf(p) === 'dwg');
      const dxfPaths = cad.filter(p => extOf(p) === 'dxf');

      for (const dwg of dwgPaths) {
        try {
          await withTimeout(window.api.cad.convertDwg(dwg), DWG_CONVERT_TIMEOUT_MS, 'DWG 转换');
          // 转换成功 → 该 DWG 可由 drawing.import 正常解析（主进程内部亦会转换）
          dxfPaths.push(dwg);
        } catch (e) {
          if (isOdaMissing(e) || /超时/.test(e instanceof Error ? e.message : String(e))) {
            outcome.dwgFallback.push(dwg);
          } else {
            outcome.rejected.push({ path: dwg, reason: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      const cadResult = await importViaMain(dxfPaths);
      outcome.imported.push(...cadResult.imported);
      outcome.rejected.push(...cadResult.rejected);

      // --- 位图 / PDF ---
      const bmResult = await importViaMain(basemap);
      outcome.imported.push(...bmResult.imported);
      outcome.rejected.push(...bmResult.rejected);
      outcome.basemapPending.push(...bmResult.imported.filter(d => isRasterFile(d)).map(d => d.file?.path || d.name));

      finishImport(outcome);
      if (outcome.dwgFallback.length) fallbackFiles.value = outcome.dwgFallback.slice();
    } finally {
      importing.value = false;
    }
    return outcome;
  }

  /** 经主进程 drawing:import 导入一批路径（含 grantPaths 授权） */
  async function importViaMain(paths: string[]): Promise<{ imported: Drawing[]; rejected: ImportRejected[] }> {
    const rejected: ImportRejected[] = [];
    if (!paths.length) return { imported: [], rejected };
    if (!projectStore.hasBridge()) {
      return { imported: [], rejected: paths.map(p => ({ path: p, reason: '桥接不可用（非桌面环境）' })) };
    }
    const granted = await grantOrFallback(paths, rejected);
    if (!granted.length) return { imported: [], rejected };

    try {
      const res = await window.api.drawing.import(granted);
      const list = Array.isArray(res) ? (res as Drawing[]) : [];
      if (!list.length) {
        return { imported: [], rejected: granted.map(p => ({ path: p, reason: '解析结果为空' })) };
      }
      return { imported: list, rejected };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { imported: [], rejected: granted.map(p => ({ path: p, reason: msg })) };
    }
  }

  /** 拖拽来源路径需先申请授权；主进程无该通道时按原路径继续（兼容旧版主进程） */
  async function grantOrFallback(paths: string[], rejected: ImportRejected[]): Promise<string[]> {
    try {
      const grant = await window.api.fs.grantPaths(paths);
      if (grant && Array.isArray(grant.granted)) {
        if (Array.isArray(grant.rejected)) rejected.push(...grant.rejected);
        return grant.granted.slice();
      }
    } catch {
      /* 旧主进程无 fs:grantPaths */
    }
    return paths.slice();
  }

  /** 收尾：并入 store、置当前图纸、适应视图、dirty、汇总提示 */
  function finishImport(outcome: ImportOutcome) {
    if (outcome.imported.length) {
      projectStore.applyImportedDrawings(outcome.imported);
      fitHandler?.();
      projectStore.markDirty();
    }
    reportOutcome(outcome);
  }

  function reportOutcome(outcome: ImportOutcome) {
    if (outcome.imported.length) {
      ElMessage.success(`已导入 ${outcome.imported.length} 个底图`);
    }
    if (outcome.basemapPending.length) {
      ElMessage.info('位图底图已登记，位图渲染开发中（下一里程碑开放）');
    }
    if (outcome.rejected.length) {
      const first = outcome.rejected[0];
      ElMessage.warning(
        outcome.rejected.length === 1
          ? `「${basenameOf(first.path)}」导入失败：${first.reason}`
          : `${outcome.rejected.length} 个文件导入失败，首个原因：${first.reason}`,
      );
    }
  }

  function dismissFallback() {
    fallbackFiles.value = [];
  }

  /**
   * DwgFallbackDialog「作为图片底图导入」兜底分支（AC-2.2 选项 2）。
   * 直接按位图链建记录，不触发 DWG 转换。
   */
  async function importDwgAsRaster(paths: string[]): Promise<ImportOutcome> {
    const outcome: ImportOutcome = { imported: [], rejected: [], dwgFallback: [], basemapPending: [] };
    const res = await importViaMain(paths);
    outcome.imported = res.imported;
    outcome.rejected = res.rejected;
    finishImport(outcome);
    dismissFallback();
    return outcome;
  }

  return {
    importing: readonly(importing),
    fallbackFiles,
    fileInputAccept,
    pickPaths,
    runImport,
    importPaths,
    importFromFiles,
    importDwgAsRaster,
    dismissFallback,
    onFitViewport,
  };
}

function isRasterFile(d: Drawing): boolean {
  const f = (d?.file?.format || '').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'pdf'].includes(f);
}
