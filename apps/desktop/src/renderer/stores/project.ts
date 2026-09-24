// 项目状态管理
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, Drawing, DeviceInstance, Cable, CableType, WeakPoint, CableTray, WiringNetwork, ViewportState, CalibrationData, Point2D } from '@security-survey/shared-types';
import { modelUnitsToMeters } from '@security-survey/shared-types';
import { rehydrateBasemapEntity } from '@/services/basemapService';

export const useProjectStore = defineStore('project', () => {
  // 状态
  const currentProject = ref<Project | null>(null);
  const currentDrawingId = ref<string | null>(null);
  const drawings = ref<Drawing[]>([]);
  const viewport = ref<ViewportState>({
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    center: { x: 0, y: 0 },
    zoom: 1,
    showGrid: true,
    showRuler: true,
  });
  const isDirty = ref(false);
  /**
   * 当前项目的落盘路径（决策 4）。仅存在于运行期内存与 localStorage 索引中，
   * 绝不写进 .survey 载荷 —— 见 buildSavePayload()。
   */
  const projectFilePath = ref<string | null>(null);
  /** 保存进行中标志，供 UI 三态（未保存/保存中/已保存）与防重入使用 */
  const saving = ref(false);
  const lastSavedAt = ref<number | null>(null);
  const lastSaveError = ref<string | null>(null);
  /** 图纸画布快照缓存（drawingId -> dataURL），供主进程导出引擎使用 */
  const drawingSnapshots = ref<Record<string, string>>({});
  /** 打开项目时重水合失败的底图源文件路径（"底图文件已移动"提示用） */
  const basemapMissing = ref<string[]>([]);
  // 计算属性
  const currentDrawing = computed(() => {
    if (!currentDrawingId.value) return null;
    return drawings.value.find(d => d.id === currentDrawingId.value) || null;
  });

  const projectDevices = computed(() => {
    if (!currentDrawing.value) return [];
    return currentDrawing.value.devices || [];
  });

  const projectCables = computed(() => {
    if (!currentDrawing.value) return [];
    return currentDrawing.value.wiring?.cables || [];
  });

  const projectWells = computed(() => {
    if (!currentDrawing.value) return [];
    return currentDrawing.value.wiring?.weakPoints || [];
  });

  const projectTrays = computed(() => {
    if (!currentDrawing.value) return [];
    return currentDrawing.value.wiring?.trays || [];
  });

  // ============ 工作流步骤派生状态（WorkflowStepper / 引导空态共用）============

  /** 当前图纸是否已有底图：导入过文件，或存在任何图元（CAD 矢量 / BASEMAP 位图） */
  const hasBasemap = computed(() => {
    const d = currentDrawing.value as any;
    if (!d) return false;
    return !!d.file || (d.entities?.length || 0) > 0;
  });
  /** 当前图纸是否已布点 */
  const hasDevices = computed(() => (currentDrawing.value?.devices?.length || 0) > 0);
  /** 当前图纸是否已画线路 */
  const hasCables = computed(() => (currentDrawing.value?.wiring?.cables?.length || 0) > 0);
  /**
   * 当前应做的工作流步骤（唯一定义处）。
   * 步骤条高亮、侧栏面板取舍、引导文案都读它，避免三处各自 if 判断漂移。
   * 口径：
   *  - 底图步骤要求"已导入且已校准"：未校准的底图给不出可信长度，线长与材料表都会错。
   *  - 布点步骤要求"至少 2 台设备"：只有 1 台时根本无法连线，此时提示"去标注线路"
   *    等于把用户推向一个做不了的动作。
   */
  const workflowStep = computed<'basemap' | 'devices' | 'wiring' | 'export'>(() => {
    if (!hasBasemap.value || !currentDrawing.value?.calibration?.isCalibrated) return 'basemap';
    if ((currentDrawing.value?.devices?.length || 0) < 2) return 'devices';
    if (!hasCables.value) return 'wiring';
    return 'export';
  });
  /** 项目内全部图纸是否都完成"底图 + 布点 + 布线"（导出前完整性检查用） */
  const drawingsProgress = computed(() =>
    (drawings.value || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      hasBasemap: !!d.file || (d.entities?.length || 0) > 0,
      hasDevices: (d.devices?.length || 0) > 0,
      hasCables: (d.wiring?.cables?.length || 0) > 0,
    }))
  );

  // 动作
  function setDrawingSnapshot(drawingId: string, dataUrl: string) {
    drawingSnapshots.value[drawingId] = dataUrl;
  }


  // ============ 撤销 / 重做（结构性快照）============
  //
  // 旧实现只记 { type, id } 且 undo/redo 仅移动下标，不反向执行任何动作 ——
  // 按 Ctrl+Z 什么都不发生，用户会误以为误删能恢复。改为对"当前图纸的布点 +
  // 布线"做快照：变更前压栈，undo 时整体回填，语义与用户预期一致。
  // 视口/校准/图层显隐不进历史（高频且非破坏性）。

  interface StructuralSnapshot {
    drawingId: string;
    label: string;
    devices: DeviceInstance[];
    wiring: WiringNetwork;
  }

  const undoStack = ref<StructuralSnapshot[]>([]);
  const redoStack = ref<StructuralSnapshot[]>([]);
  const maxHistorySize = 50;
  /** >0 表示处于批量操作内：整批只捕获一步历史 */
  let historyBatchDepth = 0;
  let batchSnapshot: StructuralSnapshot | null = null;

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);
  /** 下一步 undo/redo 的对象描述，供按钮 title 显示 */
  const undoLabel = computed(() => undoStack.value[undoStack.value.length - 1]?.label ?? '');
  const redoLabel = computed(() => redoStack.value[redoStack.value.length - 1]?.label ?? '');

  function deepClone<T>(value: T): T {
    return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)) as T;
  }

  function emptyWiring(drawing: Drawing): WiringNetwork {
    return {
      id: `${drawing.id}-wiring`,
      drawingId: drawing.id,
      weakPoints: [],
      trays: [],
      cables: [],
      topology: [],
    };
  }

  function takeSnapshot(label: string): StructuralSnapshot | null {
    const d = currentDrawing.value;
    if (!d) return null;
    return {
      drawingId: d.id,
      label,
      devices: deepClone(d.devices ?? []),
      wiring: deepClone(d.wiring ?? emptyWiring(d)),
    };
  }

  function pushSnapshot(snapshot: StructuralSnapshot | null) {
    if (!snapshot) return;
    undoStack.value.push(snapshot);
    if (undoStack.value.length > maxHistorySize) undoStack.value.shift();
    redoStack.value = [];
  }

  /** 包裹一次结构性变更：变更前捕获快照；处于批量内时交由 runBatched 捕获 */
  function withHistory<T>(label: string, fn: () => T): T {
    if (historyBatchDepth > 0) return fn();
    pushSnapshot(takeSnapshot(label));
    return fn();
  }

  /** 把多个变更合并成一步历史（如批量删除选中项、自动布线批量落盘） */
  function runBatched<T>(label: string, fn: () => T): T {
    const outermost = historyBatchDepth === 0;
    if (outermost) batchSnapshot = takeSnapshot(label);
    historyBatchDepth += 1;
    try {
      return fn();
    } finally {
      historyBatchDepth -= 1;
      if (outermost) {
        pushSnapshot(batchSnapshot);
        batchSnapshot = null;
      }
    }
  }

  function restoreSnapshot(snapshot: StructuralSnapshot): boolean {
    const d = drawings.value.find(item => item.id === snapshot.drawingId);
    if (!d) return false;
    d.devices = deepClone(snapshot.devices);
    d.wiring = deepClone(snapshot.wiring);
    d.updatedAt = Date.now();
    markDirty();
    return true;
  }

  /** 撤销最近一次结构性变更，返回是否真的撤销了 */
  function undo(): boolean {
    const snapshot = undoStack.value[undoStack.value.length - 1];
    if (!snapshot) return false;
    // 历史按图纸隔离：图纸不匹配（已切换或已删除）时不跨图纸回滚
    if (currentDrawingId.value !== snapshot.drawingId) return false;
    const current = takeSnapshot(snapshot.label);
    const target = drawings.value.find(item => item.id === snapshot.drawingId);
    if (!target) { undoStack.value.pop(); return false; }
    undoStack.value.pop();
    if (current) redoStack.value.push(current);
    return restoreSnapshot(snapshot);
  }

  /** 重做：把最近一次 undo 掉的状态再放回去 */
  function redo(): boolean {
    const snapshot = redoStack.value[redoStack.value.length - 1];
    if (!snapshot) return false;
    if (currentDrawingId.value !== snapshot.drawingId) return false;
    const target = drawings.value.find(item => item.id === snapshot.drawingId);
    if (!target) { redoStack.value.pop(); return false; }
    const current = takeSnapshot(snapshot.label);
    redoStack.value.pop();
    if (current) undoStack.value.push(current);
    return restoreSnapshot(snapshot);
  }

  function clearHistory() {
    undoStack.value = [];
    redoStack.value = [];
    batchSnapshot = null;
    historyBatchDepth = 0;
  }


  async function loadProject(projectId: string) {
    const data = await window.api.fs.readFile(projectId);
    if (!data) throw new Error('无法读取项目文件: ' + projectId);
    const project = JSON.parse(data) as Project;
    // 打开前先重水合被剥离的位图底图（AC-5：dataURL 不落 .survey，按 sourcePath 重新栅格化）
    basemapMissing.value = await rehydrateBasemaps(project);
    setProject(project);
    projectFilePath.value = projectId;
    persistPathMapping(project.id, projectId);
    markProjectOpened(project.id);
    syncIndexPath(project.id, projectId);
    return project;
  }

  /**
   * 重水合项目内所有底图图元（imagePath 为空、但有 sourcePath 的 IMAGE）。
   * 返回源文件缺失/栅格化失败的路径列表（供 UI 提示"底图文件已移动"）。
   */
  async function rehydrateBasemaps(project: Project): Promise<string[]> {
    const missing: string[] = [];
    for (const d of project.drawings || []) {
      for (const e of d.entities || []) {
        const entity = e as any;
        if (!entity || entity.type !== 'IMAGE') continue;
        const data = entity.data || {};
        if (data.imagePath) continue; // 已内联，无需重水合
        const src = data.sourcePath as string | undefined;
        if (!src) continue;
        try {
          await rehydrateBasemapEntity(entity);
        } catch {
          missing.push(src);
        }
      }
    }
    return missing;
  }

  /** 桥可用性探测（纯浏览器 / 单元测试环境为 false，保存链应降级而不是抛错） */
  function hasBridge(): boolean {
    return typeof window !== 'undefined' && !!window.api && !!window.api.project;
  }

  /**
   * 构造 .survey 落盘载荷。
   * 铁律：向后兼容 —— 不新增必填字段，且运行期附加信息（落盘路径、base64 底图内容等）
   * 一律剔除，绝不进入载荷。
   */
  function buildSavePayload(p: Project): Project {
    const clone = JSON.parse(JSON.stringify(p)) as any;
    delete clone.__filePath;
    delete clone.knownPath;
    for (const d of clone.drawings || []) {
      if (d.file) delete d.file.dataBase64;
      for (const e of d.entities || []) {
        if (e && typeof e === 'object') {
          delete (e as any).imageData;
          // 位图底图：剥离 dataURL（决策 3.3 体积治理），仅保留 sourcePath/pageIndex/size 引用，
          // 打开项目时按 sourcePath 重新栅格化（AC-5）。
          if ((e as any).type === 'IMAGE' && (e as any).data) {
            (e as any).data.imagePath = '';
          }
        }
      }
    }
    return clone as Project;
  }

  /** 记录"项目 -> 落盘路径"映射，便于下次打开时无需重新指定路径 */
  const PATH_INDEX_KEY = 'project-paths';
  function persistPathMapping(projectId: string, filePath: string) {
    try {
      const map = JSON.parse(localStorage.getItem(PATH_INDEX_KEY) || '{}');
      map[projectId] = filePath;
      localStorage.setItem(PATH_INDEX_KEY, JSON.stringify(map));
    } catch {
      /* localStorage 不可用时忽略，不影响保存结果 */
    }
  }

  function loadPathMapping(projectId: string): string | null {
    try {
      return JSON.parse(localStorage.getItem(PATH_INDEX_KEY) || '{}')[projectId] || null;
    } catch {
      return null;
    }
  }

  /**
   * 保存项目（决策 4：委托主进程 project:save 落盘）。
   * 主进程负责对话框、updatedAt、最近项目索引与安全校验；渲染进程只在成功后 markClean。
   */
  async function saveProject(project?: Project) {
    const p = project || currentProject.value;
    if (!p) return { success: false as const, path: '', error: '没有打开的项目' };
    if (!hasBridge()) {
      // 非 Electron 环境：保留旧的"假成功"会掩盖故障，明确报错
      lastSaveError.value = '当前环境不支持保存到磁盘';
      return { success: false as const, path: '', error: lastSaveError.value };
    }
    if (saving.value) return { success: false as const, path: projectFilePath.value || '', error: '保存进行中' };

    saving.value = true;
    lastSaveError.value = null;
    try {
      const data = buildSavePayload(p);
      const target = projectFilePath.value || loadPathMapping(p.id) || undefined;
      const res: any = await window.api.project.save(data, target);
      if (!res || res.success === false) {
        const msg = (res && (res.error as string)) || '保存被取消或失败';
        // 用户取消对话框不算异常状态，保持 dirty 以便再次保存
        lastSaveError.value = msg;
        return { success: false as const, path: target || '', error: msg };
      }
      const savedPath = (res.path as string) || target || '';
      if (savedPath) {
        projectFilePath.value = savedPath;
        persistPathMapping(p.id, savedPath);
      }
      markClean();
      lastSavedAt.value = Date.now();
      touchIndex(p);
      return { success: true as const, path: savedPath };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastSaveError.value = msg;
      return { success: false as const, path: '', error: msg };
    } finally {
      saving.value = false;
    }
  }

  /** 另存为：强制走对话框（传 undefined 路径），成功后切换当前落盘路径 */
  async function saveProjectAs(project?: Project) {
    const p = project || currentProject.value;
    if (!p) return null;
    if (!hasBridge()) return null;
    saving.value = true;
    try {
      const data = buildSavePayload(p);
      const res: any = await window.api.project.saveAs(data);
      if (!res || res.success === false) return null;
      const savedPath = (res.path as string) || '';
      if (savedPath) {
        projectFilePath.value = savedPath;
        persistPathMapping(p.id, savedPath);
      }
      markClean();
      lastSavedAt.value = Date.now();
      touchIndex(p);
      return { success: true, path: savedPath };
    } catch (e) {
      lastSaveError.value = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /**
   * 导入图纸
   * 沙箱渲染进程拿不到拖入文件的真实路径：
   * - File.path 可用时直接走主进程导入
   * - 否则回退到原生文件对话框选择后由主进程导入
   */
  async function importDrawing(file: File | File[]) {
    const files = Array.isArray(file) ? file : [file];
    // Electron 32 前 File.path 仍可用；新版需走 webUtils，因此优先向主进程申请授权。
    const candidatePaths = files.map(f => (f as any).path as string | undefined).filter((p): p is string => !!p);
    if (candidatePaths.length) {
      const imported = await importDrawingByPaths(candidatePaths);
      // 沙箱下拿不到路径的文件被拒时回退到对话框，保持旧行为可用
      if (imported && imported.length) return imported;
    }
    const result = await window.api.fs.showOpenDialog({
      title: '选择图纸文件',
      filters: [
        { name: '图纸（CAD / 位图 / PDF）', extensions: ['dwg', 'dxf', 'png', 'jpg', 'jpeg', 'pdf'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    const paths = (result?.filePaths || []).slice();
    if (!paths.length) return null;
    return await importDrawingByPaths(paths);
  }

  /**
   * 按真实路径导入图纸（拖拽 / 对话框两条入口共用）。
   * 拖拽来源的路径主进程不认识，必须先 fs:grantPaths 申请；
   * 授权被拒（如不支持的扩展名）时过滤掉，不阻断其余文件。
   */
  async function importDrawingByPaths(paths: string[]): Promise<Drawing[] | null> {
    if (!hasBridge() || !paths.length) return null;
    let approved = paths;
    try {
      const grant = await window.api.fs.grantPaths(paths);
      if (grant && Array.isArray(grant.granted)) {
        if (grant.rejected?.length) {
          console.warn('以下文件未被授权读取:', grant.rejected);
        }
        approved = grant.granted;
      }
    } catch (e) {
      // 主进程尚未提供 grantPaths（旧版主进程）时退化为直接导入
      console.warn('fs:grantPaths 不可用，按原路径导入:', e instanceof Error ? e.message : e);
    }
    if (!approved.length) return null;

    const imported = await window.api.drawing.import(approved);
    if (!Array.isArray(imported) || !imported.length) return null;
    for (const d of imported) addDrawing(d);
    if (!currentDrawingId.value) currentDrawingId.value = imported[0].id;
    markDirty();
    return imported as Drawing[];
  }

  /** 把已构造好的 Drawing 列表并入当前项目（DWG 降级、底图合成等旁路入口复用） */
  function applyImportedDrawings(imported: Drawing[]): Drawing[] {
    const list = Array.isArray(imported) ? imported : [];
    for (const d of list) addDrawing(d);
    if (list.length && !currentDrawingId.value) currentDrawingId.value = list[0].id;
    if (list.length) markDirty();
    return list;
  }

  // ============ 项目索引（本地元数据，供仪表盘/最近项目使用）============

  interface ProjectIndexItem {
    id: string;
    name: string;
    drawingCount: number;
    deviceCount: number;
    /** 全项目线缆总数（含井道/桥架不计入） */
    cableCount: number;
    /** 已导入底图且已校准的图纸张数：用于列出"这个项目走到哪一步"，不靠猜 */
    calibratedDrawingCount: number;
    /** 最近一次成功落盘的绝对路径；无此路径则无法从列表重开项目 */
    path?: string;
    /** 台账字段快照，来自 project.meta，供项目列表展示与筛选 */
    code?: string;
    type?: string;
    description?: string;
    location?: string;
    designer?: string;
    createdAt?: number;
    /** 归档态。刻意只有 true/false 两态：数据模型里不存在"已完成"的真相源，故不提供该筛选项 */
    archived?: boolean;
    /** 最近一次从磁盘载入的时间戳；从未打开过则回退到 updatedAt */
    lastOpened?: number;
    updatedAt: string;
  }

  function loadProjectIndex(): ProjectIndexItem[] {
    try {
      return JSON.parse(localStorage.getItem('projects-index') || '[]');
    } catch {
      return [];
    }
  }

  const projectIndex = ref<ProjectIndexItem[]>(loadProjectIndex());

  function persistIndex() {
    localStorage.setItem('projects-index', JSON.stringify(projectIndex.value));
  }

  /**
   * 写入/更新索引项。
   * 合并而非覆盖：归档态等只在索引里存在的信息，若被 touchIndex 抹掉，
   * 项目保存一次就"自动取消归档"，属于隐蔽的行为倒退。
   */
  function touchIndex(project: Project) {
    const prev = projectIndex.value.find(p => p.id === project.id);
    const meta = (project as any).meta || {};
    const item: ProjectIndexItem = {
      id: project.id,
      name: project.name,
      drawingCount: project.drawings?.length || 0,
      deviceCount: (project.drawings || []).reduce((n, d) => n + (d.devices?.length || 0), 0),
      cableCount: (project.drawings || []).reduce((n, d) => n + (d.wiring?.cables?.length || 0), 0),
      calibratedDrawingCount: (project.drawings || []).filter((d: any) => d.calibration?.isCalibrated).length,
      // path 是"能否重开这个项目"的关键：没有它，项目列表点进去只能是空画布
      path: projectFilePath.value || loadPathMapping(project.id) || prev?.path,
      code: meta.code,
      type: meta.type,
      description: meta.description,
      location: meta.location,
      designer: meta.designer,
      createdAt: project.createdAt,
      archived: prev?.archived,
      lastOpened: prev?.lastOpened,
      updatedAt: new Date().toISOString(),
    };
    projectIndex.value = [item, ...projectIndex.value.filter(p => p.id !== project.id)].slice(0, 50);
    persistIndex();
  }

  /** 让索引项的 path 与刚成功的落盘路径一致（loadProject/save 之后调用）。 */
  function syncIndexPath(projectId: string, filePath: string) {
    const idx = projectIndex.value.findIndex(p => p.id === projectId);
    if (idx < 0 || projectIndex.value[idx].path === filePath) return;
    projectIndex.value = projectIndex.value.map((p, i) => (i === idx ? { ...p, path: filePath } : p));
    persistIndex();
  }

  /** 记一次"打开过"，供首页最近项目排序与展示。失败不影响载入流程。 */
  function markProjectOpened(projectId: string) {
    const idx = projectIndex.value.findIndex(p => p.id === projectId);
    if (idx < 0) return;
    const ts = Date.now();
    projectIndex.value = projectIndex.value.map((p, i) => (i === idx ? { ...p, lastOpened: ts } : p));
    persistIndex();
  }

  /** 只清"最近打开"标记，保留项目本身。旧实现是 settingsStore.clearRecentProjects()
   *  —— 它 removeItem('projects-index')，也就是把整个项目列表清空，名不副实且危险。*/
  function clearRecentOpens() {
    if (!projectIndex.value.some(p => p.lastOpened)) return false;
    projectIndex.value = projectIndex.value.map((p: any) => ({ ...p, lastOpened: undefined }));
    persistIndex();
    return true;
  }

  /** 归档/取消归档。归档是索引层属性：不改项目文件内容，避免为元信息重写整份图纸 JSON */
  function setProjectArchived(projectId: string, archived: boolean) {
    const idx = projectIndex.value.findIndex(p => p.id === projectId);
    if (idx < 0) return false;
    projectIndex.value = projectIndex.value.map((p, i) => (i === idx ? { ...p, archived } : p));
    persistIndex();
    return true;
  }

  const recentProjects = computed(() => projectIndex.value);

  const recentActivity = computed<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('activity-log') || '[]');
    } catch {
      return [];
    }
  });

  function getProjectStats() {
    return {
      projects: projectIndex.value.length,
      drawings: projectIndex.value.reduce((n, p) => n + p.drawingCount, 0),
      devices: projectIndex.value.reduce((n, p) => n + p.deviceCount, 0),
      wiringLength: 0,
    };
  }

  async function importProject(file: File) {
    const text = await file.text();
    const project = JSON.parse(text) as Project;
    if (!project.id) project.id = 'proj-' + Date.now();
    touchIndex(project);
    setProject(project);
  }

  /**
   * 复制索引项。刻意剥掉 path：副本与原项目共享同一路径的话，
   * 第一次保存副本就会覆盖掉原项目的文件。无 path ⇒ 保存时必然弹对话框另存。
   */
  /**
   * 复制项目：生成一份完整图纸内容的新项目并立即打开它。
   *
   * 旧实现只往索引里塞了一条"看起来像项目"的记录（没有 drawings），
   * 用户以为复制成功，点进去是空项目 —— 假成功。
   *
   * 副本刻意不带 path：与原项目共享路径的话，第一次保存就会覆盖原文件。
   * path 为空 ⇒ 保存时必然弹"另存为"，符合预期。
   * 图纸 id 保持不变：项目内自洽引用，跨项目不冲突，重键反而牵连 wiring 端点。
   */
  async function duplicateProject(projectId: string): Promise<{ ok: boolean; error?: string; newId?: string }> {
    const src = projectIndex.value.find(p => p.id === projectId);
    if (!src) return { ok: false, error: '项目不在列表中' };

    let source: Project | null = null;
    if (currentProject.value?.id === projectId) {
      // 不能走 buildSavePayload：那会剥离内嵌底图（imageData），
      // 复制出来的项目就没有底图了 —— 用户会得到一个"图纸背景消失"的副本。
      source = JSON.parse(JSON.stringify(currentProject.value)) as Project;
    } else if (src.path) {
      try {
        const text = await window.api.fs.readFile(src.path);
        if (!text) return { ok: false, error: '读取原项目文件失败' };
        source = JSON.parse(text) as Project;
        // 磁盘上的 .survey 刻意不存内嵌底图（体积治理），复制前按 sourcePath 重新栅格化，
        // 否则副本同样是"没有底图"的项目。
        basemapMissing.value = await rehydrateBasemaps(source);
      } catch (e: any) {
        return { ok: false, error: `读取原项目文件失败：${e?.message || e}` };
      }
    } else {
      return { ok: false, error: '原项目尚未保存到磁盘，无法复制其内容' };
    }

    const now = Date.now();
    const newId = 'proj-' + now;
    const copy: Project = {
      ...source,
      id: newId,
      name: `${source.name} (副本)`.slice(0, 100),
      createdAt: now,
      updatedAt: now,
      drawings: (source.drawings || []).map((d: any) => ({ ...d, projectId: newId })),
    } as Project;
    (copy as any).meta = { ...((source as any).meta || {}), code: ((source as any).meta?.code ? (source as any).meta.code + '-COPY' : '') };

    if (isDirty.value) {
      // 复制会切换当前项目，未保存改动会随之丢失，必须先提示，不能静默覆盖
      return { ok: false, error: '当前项目有未保存的修改，请先保存后再复制' };
    }

    // setProject 已把 projectFilePath 重置为该 id 的落盘路径（副本没有 ⇒ null）
    setProject(copy);
    return { ok: true, newId };
  }

  /**
   * 导出一份项目（浏览器下载通道，非工程图纸导出）。
   * 旧实现只在"该项目正好是当前打开项目"时才动作，且失败时静默返回，
   * 项目列表里对未打开的项目点导出 = 毫无反应。改为按索引路径读取后下载。
   */
  async function exportProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
    const item = projectIndex.value.find(p => p.id === projectId);
    if (!item) return { ok: false, error: '项目不在列表中' };

    let text: string;
    if (currentProject.value?.id === projectId) {
      text = JSON.stringify(buildSavePayload(currentProject.value), null, 2);
    } else {
      if (!item.path) return { ok: false, error: '该项目尚未保存到磁盘，无可导出内容' };
      try {
        const data = await window.api.fs.readFile(item.path);
        if (!data) return { ok: false, error: '读取项目文件失败' };
        text = data;
      } catch (e: any) {
        return { ok: false, error: `读取项目文件失败：${e?.message || e}` };
      }
    }

    const safeName = item.name.replace(/[\\/:*?"<>|]/g, '_');
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.survey.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  }

  function deleteProject(projectId: string) {
    projectIndex.value = projectIndex.value.filter(p => p.id !== projectId);
    persistIndex();
  }

  /**
   * 从项目列表重开一个项目（按索引 id）。这是"打开项目"的唯一真相路径：
   * 列表页、首页最近项目、仪表盘都走它，避免各处自己拼 loadProject 参数。
   *
   * 三种失败原因必须分开报，因为用户下一步动作完全不同：
   * 未落盘 → 去保存；文件没了 → 去找/重新导入；当前有未保存改动 → 先处理。
   */
  async function openProjectById(projectId: string): Promise<{ ok: boolean; error?: string }> {
    const item = projectIndex.value.find(p => p.id === projectId);
    if (!item) return { ok: false, error: '项目不在列表中，可能已被删除' };
    const path = item.path || loadPathMapping(projectId);
    if (!path) return { ok: false, error: '该项目尚未保存到磁盘，请先在项目内保存' };
    if (isDirty.value && currentProject.value?.id !== projectId) {
      return { ok: false, error: '当前项目有未保存的修改，请先保存或撤销' };
    }
    try {
      await loadProject(path);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: `读取项目文件失败：${e?.message || e}（文件可能已被移动或删除）` };
    }
  }

  function setProject(project: Project) {
    currentProject.value = project;
    drawings.value = project.drawings || [];
    // 切换项目时旧的 currentDrawingId 不属于新项目，必须校验后再复用，
    // 否则画布会指向一张不存在的图纸（表现为空白 + 各种"当前图纸"取值为空）。
    const stillExists = !!currentDrawingId.value && drawings.value.some(d => d.id === currentDrawingId.value);
    if (!stillExists) currentDrawingId.value = drawings.value[0]?.id || null;
    isDirty.value = false;
    clearHistory();
    // 恢复上次落盘路径（若有），使"保存"无需再次弹对话框
    projectFilePath.value = loadPathMapping(project.id);
    lastSaveError.value = null;
    touchIndex(project);
  }

  function clearProject() {
    currentProject.value = null;
    currentDrawingId.value = null;
    drawings.value = [];
    isDirty.value = false;
    projectFilePath.value = null;
    lastSaveError.value = null;
    basemapMissing.value = [];
    clearHistory();
  }

  function setCurrentDrawing(drawingId: string) {
    const drawing = drawings.value.find(d => d.id === drawingId);
    if (drawing) {
      currentDrawingId.value = drawingId;
      // 恢复该图纸的视口状态
      viewport.value = drawing.viewport || viewport.value;
    }
  }

  function addDrawing(drawing: Drawing) {
    // 入口归一化：页签键、当前图纸、磁盘契约全都以 drawing.id 为锚。
    // 此前调用方可以塞进一张没有 id 的图纸（Ctrl+T「新建图纸」正是如此），
    // 结果是那张页签点不动（setCurrentDrawing 找不到它），保存后还会往
    // .survey 里落一张无 id 的图纸。宁可在这里补齐，也不让半张图纸流到下游。
    if (!drawing.id) drawing.id = `drawing-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    if (!drawing.name) drawing.name = '未命名图纸';
    if (typeof drawing.order !== 'number') drawing.order = drawings.value.length;
    drawings.value.push(drawing);
    if (currentProject.value) {
      currentProject.value.drawings = drawings.value;
      markDirty();
    }
  }

  /**
   * 新建一张可用的空白图纸并立即进入。
   * 与裸 addDrawing 的区别：补齐 shared-types 要求的全部字段（缺一个就可能
   * 在渲染或保存时炸），并把当前页签切过去 —— 「新建图纸」若只是尾部多出
   * 一张无人停留的页签，用户看到的仍是旧图纸。
   */
  function createBlankDrawing(name = '新建图纸'): string {
    const id = `drawing-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const now = Date.now();
    const drawing = {
      id,
      projectId: currentProject.value?.id || '',
      name,
      floor: name.match(/^\d+|^[A-Za-z]+\d*/)?.[0] || '',
      order: drawings.value.length,
      file: null,
      calibration: { isCalibrated: false, point1: { x: 0, y: 0 }, point2: { x: 0, y: 0 }, realDistance: 0, scale: 1, unit: 'm' },
      layers: [],
      entities: [],
      viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
      devices: [],
      wiring: { id: `${id}-wiring`, drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
      createdAt: now,
      updatedAt: now,
    } as unknown as Drawing;
    addDrawing(drawing);
    setCurrentDrawing(id);
    return id;
  }

  function removeDrawing(drawingId: string) {
    const idx = drawings.value.findIndex(d => d.id === drawingId);
    if (idx >= 0) {
      drawings.value.splice(idx, 1);
      if (currentDrawingId.value === drawingId) {
        currentDrawingId.value = drawings.value[0]?.id || null;
      }
      if (currentProject.value) {
        currentProject.value.drawings = drawings.value;
        markDirty();
      }
    }
  }

  function updateDrawing(drawingId: string, updates: Partial<Drawing>) {
    const drawing = drawings.value.find(d => d.id === drawingId);
    if (drawing) {
      Object.assign(drawing, updates);
      if (currentProject.value) markDirty();
    }
  }

  function setViewport(v: Partial<ViewportState>) {
    viewport.value = { ...viewport.value, ...v };
    if (currentDrawing.value) {
      currentDrawing.value.viewport = viewport.value;
      markDirty();
    }
  }

  function setCalibration(drawingId: string, calibration: CalibrationData) {
    const drawing = drawings.value.find(d => d.id === drawingId);
    if (drawing) {
      drawing.calibration = calibration;
      markDirty();
    }
  }

  function addDevice(device: DeviceInstance) {
    if (currentDrawing.value) {
      withHistory(`添加设备 ${device.label || device.id}`, () => {
        currentDrawing.value!.devices = [...(currentDrawing.value!.devices || []), device];
        markDirty();
      });
    }
  }

  /** 属性面板编辑：位置/名称/型号等一次性提交，纳入历史 */
  function updateDevice(deviceId: string, updates: Partial<DeviceInstance>) {
    if (!currentDrawing.value) return;
    const idx = currentDrawing.value.devices?.findIndex(d => d.id === deviceId) ?? -1;
    if (idx < 0) return;
    withHistory('修改设备属性', () => {
      currentDrawing.value!.devices![idx] = { ...currentDrawing.value!.devices![idx], ...updates };
      markDirty();
    });
  }

  /** 画布拖拽中的高频位置更新：不进历史，由拖拽结束时 commitDevicePositions 收一步 */
  function updateDevicePosition(deviceId: string, position: Point2D) {
    const idx = currentDrawing.value?.devices?.findIndex(d => d.id === deviceId) ?? -1;
    if (idx < 0 || !currentDrawing.value) return;
    currentDrawing.value.devices![idx] = { ...currentDrawing.value.devices![idx], position };
    markDirty();
  }

  /** 拖拽/批量移动结束后调用，把"移动前"状态压入历史 */
  function commitDevicePositions(label: string, before: Record<string, Point2D>) {
    const d = currentDrawing.value;
    if (!d) return;
    pushSnapshot({
      drawingId: d.id,
      label,
      devices: (d.devices || []).map(dev => ({ ...dev, position: { ...(before[dev.id] ?? dev.position) } })),
      wiring: deepClone(d.wiring ?? emptyWiring(d)),
    });
  }

  function removeDevice(deviceId: string) {
    if (currentDrawing.value) {
      const name = currentDrawing.value.devices?.find(d => d.id === deviceId)?.label || deviceId;
      withHistory(`删除设备 ${name}`, () => {
        currentDrawing.value!.devices = currentDrawing.value!.devices?.filter(d => d.id !== deviceId) || [];
        markDirty();
      });
    }
  }

  function addCable(cable: Cable) {
    if (currentDrawing.value) {
      withHistory('添加线路', () => {
        const wiring = currentDrawing.value!.wiring || { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] };
        wiring.cables = [...(wiring.cables || []), cable];
        currentDrawing.value!.wiring = wiring;
        markDirty();
      });
    }
  }

  function updateCable(cableId: string, updates: Partial<Cable>) {
    if (currentDrawing.value?.wiring?.cables) {
      const idx = currentDrawing.value.wiring.cables.findIndex(c => c.id === cableId);
      if (idx >= 0) {
        withHistory('修改线路', () => {
          currentDrawing.value!.wiring!.cables[idx] = { ...currentDrawing.value!.wiring!.cables[idx], ...updates };
          markDirty();
        });
      }
    }
  }

  /** 手动布线：在两个设备间创建线缆（经 CanvasViewport 交互式绘制调用） */
  function manualWire(startId: string, endId: string, path: Point2D[], type: CableType = 'cat6'): Cable {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    // 统一经 modelUnitsToMeters 换算（scale 为无量纲的 模型单位/实际毫米）。
    // 旧实现写作 length * scale，把线长放大 scale² 倍，材料表与报价随之全错。
    const lengthMeters = modelUnitsToMeters(length, currentDrawing.value?.calibration?.scale);
    const cable: Cable = {
      id: 'cable-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      type,
      path,
      length: lengthMeters,
      correctedLength: lengthMeters * 1.05,
      startDeviceId: startId,
      endDeviceId: endId,
      trayIds: [],
      status: 'manual',
      color: '#3b82f6',
    };
    addCable(cable);
    return cable;
  }

  /** 视口更新别名 */
  function updateViewport(vp: Partial<ViewportState>) {
    setViewport(vp);
  }

  /** 布线交互模式开关（兼容旧视图调用；实际绘制在画布组件内部处理） */
  function startWire(..._args: any[]) { /* 由画布工具状态接管 */ }
  function endWire(..._args: any[]) { /* 由画布工具状态接管 */ }
  function cancelWire(..._args: any[]) { /* 由画布工具状态接管 */ }

  function removeCable(cableId: string) {
    if (currentDrawing.value?.wiring?.cables) {
      withHistory('删除线路', () => {
        currentDrawing.value!.wiring!.cables = currentDrawing.value!.wiring!.cables.filter(c => c.id !== cableId);
        markDirty();
      });
    }
  }

  function addWell(well: WeakPoint) {
    if (currentDrawing.value) {
      withHistory(`添加弱电井 ${well.name || well.id}`, () => {
        const wiring = currentDrawing.value!.wiring || { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] };
        wiring.weakPoints = [...(wiring.weakPoints || []), well];
        currentDrawing.value!.wiring = wiring;
        markDirty();
      });
    }
  }

  function removeWell(wellId: string) {
    if (!currentDrawing.value?.wiring) return;
    const name = currentDrawing.value.wiring.weakPoints?.find(w => w.id === wellId)?.name || wellId;
    withHistory(`删除弱电井 ${name}`, () => {
      currentDrawing.value!.wiring!.weakPoints = currentDrawing.value!.wiring!.weakPoints?.filter(w => w.id !== wellId) || [];
      markDirty();
    });
  }

  function addTray(tray: CableTray) {
    if (currentDrawing.value) {
      withHistory('添加桥架', () => {
        const wiring = currentDrawing.value!.wiring || { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] };
        wiring.trays = [...(wiring.trays || []), tray];
        currentDrawing.value!.wiring = wiring;
        markDirty();
      });
    }
  }

  function removeTray(trayId: string) {
    if (!currentDrawing.value?.wiring) return;
    withHistory('删除桥架', () => {
      currentDrawing.value!.wiring!.trays = currentDrawing.value!.wiring!.trays?.filter(t => t.id !== trayId) || [];
      markDirty();
    });
  }

  // 撤销/重做：见上文"结构性快照"实现（withHistory / runBatched / undo / redo）

  function markDirty() {
    isDirty.value = true;
    if (currentProject.value) {
      currentProject.value.updatedAt = Date.now();
    }
  }

  function markClean() {
    isDirty.value = false;
  }

  // 自动保存
  let autoSaveTimer: number | null = null;
  function startAutoSave(interval: number, saveFn: () => Promise<void>) {
    stopAutoSave();
    autoSaveTimer = window.setInterval(async () => {
      if (isDirty.value && currentProject.value) {
        await saveFn();
      }
    }, interval);
  }

  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  return {
    currentProject,
    currentDrawingId,
    drawings,
    viewport,
    isDirty,
    projectFilePath,
    saving,
    lastSavedAt,
    lastSaveError,
    drawingSnapshots,
    basemapMissing,
    currentDrawing,
    projectDevices,
    projectCables,
    projectWells,
    projectTrays,
    hasBasemap,
    hasDevices,
    hasCables,
    workflowStep,
    drawingsProgress,
    setProject,
    clearProject,
    setDrawingSnapshot,
    loadProject,
    openProjectById,
    rehydrateBasemaps,
    saveProject,
    saveProjectAs,
    hasBridge,
    importDrawing,
    importDrawingByPaths,
    applyImportedDrawings,
    setCurrentDrawing,
    addDrawing,
    createBlankDrawing,
    removeDrawing,
    updateDrawing,
    setViewport,
    setCalibration,
    addDevice,
    updateDevice,
    removeDevice,
    addCable,
    updateCable,
    removeCable,
    manualWire,
    updateViewport,
    startWire,
    endWire,
    cancelWire,
    recentProjects,
    recentActivity,
    getProjectStats,
    importProject,
    duplicateProject,
    setProjectArchived,
    clearRecentOpens,
    projectIndex,
    exportProject,
    deleteProject,
    addWell,
    addTray,
    withHistory,
    runBatched,
    clearHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    removeWell,
    removeTray,
    updateDevicePosition,
    commitDevicePositions,
    markDirty,
    markClean,
    startAutoSave,
    stopAutoSave,
  };
});
