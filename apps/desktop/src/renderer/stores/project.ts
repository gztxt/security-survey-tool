// 项目状态管理
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, Drawing, DeviceInstance, Cable, CableType, WeakPoint, CableTray, ViewportState, CalibrationData, Point2D } from '@security-survey/shared-types';

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
  const history = ref<any[]>([]);
  const historyIndex = ref(-1);
  const maxHistorySize = 50;
  /** 图纸画布快照缓存（drawingId -> dataURL），供主进程导出引擎使用 */
  const drawingSnapshots = ref<Record<string, string>>({});

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

  // 动作
  function setDrawingSnapshot(drawingId: string, dataUrl: string) {
    drawingSnapshots.value[drawingId] = dataUrl;
  }

  async function loadProject(projectId: string) {
    const data = await window.api.fs.readFile(projectId);
    if (!data) throw new Error('无法读取项目文件: ' + projectId);
    const project = JSON.parse(data) as Project;
    setProject(project);
    projectFilePath.value = projectId;
    persistPathMapping(project.id, projectId);
    return project;
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
        if (e && typeof e === 'object') delete (e as any).imageData;
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

  function touchIndex(project: Project) {
    const item: ProjectIndexItem = {
      id: project.id,
      name: project.name,
      drawingCount: project.drawings?.length || 0,
      deviceCount: (project.drawings || []).reduce((n, d) => n + (d.devices?.length || 0), 0),
      updatedAt: new Date().toISOString(),
    };
    projectIndex.value = [item, ...projectIndex.value.filter(p => p.id !== project.id)].slice(0, 20);
    persistIndex();
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

  function duplicateProject(projectId: string) {
    const src = projectIndex.value.find(p => p.id === projectId);
    if (!src) return;
    projectIndex.value = [
      { ...src, id: 'proj-' + Date.now(), name: src.name + ' (副本)', updatedAt: new Date().toISOString() },
      ...projectIndex.value,
    ];
    persistIndex();
  }

  function exportProject(projectId: string) {
    if (currentProject.value?.id === projectId) {
      const blob = new Blob([JSON.stringify(currentProject.value, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.value.name}.survey.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function deleteProject(projectId: string) {
    projectIndex.value = projectIndex.value.filter(p => p.id !== projectId);
    persistIndex();
  }

  function setProject(project: Project) {
    currentProject.value = project;
    drawings.value = project.drawings || [];
    if (drawings.value.length > 0 && !currentDrawingId.value) {
      currentDrawingId.value = drawings.value[0].id;
    }
    isDirty.value = false;
    history.value = [];
    historyIndex.value = -1;
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
    history.value = [];
    historyIndex.value = -1;
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
    drawings.value.push(drawing);
    if (currentProject.value) {
      currentProject.value.drawings = drawings.value;
      markDirty();
    }
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
      currentDrawing.value.devices = [...(currentDrawing.value.devices || []), device];
      markDirty();
    }
  }

  function updateDevice(deviceId: string, updates: Partial<DeviceInstance>) {
    if (currentDrawing.value) {
      const idx = currentDrawing.value.devices?.findIndex(d => d.id === deviceId) ?? -1;
      if (idx >= 0) {
        currentDrawing.value.devices![idx] = { ...currentDrawing.value.devices![idx], ...updates };
        markDirty();
      }
    }
  }

  function removeDevice(deviceId: string) {
    if (currentDrawing.value) {
      currentDrawing.value.devices = currentDrawing.value.devices?.filter(d => d.id !== deviceId) || [];
      markDirty();
    }
  }

  function addCable(cable: Cable) {
    if (currentDrawing.value) {
      const wiring = currentDrawing.value.wiring || { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] };
      wiring.cables = [...(wiring.cables || []), cable];
      currentDrawing.value.wiring = wiring;
      markDirty();
    }
  }

  function updateCable(cableId: string, updates: Partial<Cable>) {
    if (currentDrawing.value?.wiring?.cables) {
      const idx = currentDrawing.value.wiring.cables.findIndex(c => c.id === cableId);
      if (idx >= 0) {
        currentDrawing.value.wiring.cables[idx] = { ...currentDrawing.value.wiring.cables[idx], ...updates };
        markDirty();
      }
    }
  }

  /** 手动布线：在两个设备间创建线缆（经 CanvasViewport 交互式绘制调用） */
  function manualWire(startId: string, endId: string, path: Point2D[], type: CableType = 'cat6'): Cable {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    const scale = currentDrawing.value?.calibration?.scale || 1;
    const cable: Cable = {
      id: 'cable-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      type,
      path,
      length: length * scale,
      correctedLength: length * scale * 1.05,
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
      currentDrawing.value.wiring.cables = currentDrawing.value.wiring.cables.filter(c => c.id !== cableId);
      markDirty();
    }
  }

  function addWell(well: WeakPoint) {
    if (currentDrawing.value) {
      const wiring = currentDrawing.value.wiring || { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] };
      wiring.weakPoints = [...(wiring.weakPoints || []), well];
      currentDrawing.value.wiring = wiring;
      markDirty();
    }
  }

  function addTray(tray: CableTray) {
    if (currentDrawing.value) {
      const wiring = currentDrawing.value.wiring || { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] };
      wiring.trays = [...(wiring.trays || []), tray];
      currentDrawing.value.wiring = wiring;
      markDirty();
    }
  }

  // 撤销/重做
  function pushHistory(action: any) {
    history.value = history.value.slice(0, historyIndex.value + 1);
    history.value.push(action);
    if (history.value.length > maxHistorySize) {
      history.value.shift();
    } else {
      historyIndex.value = history.value.length - 1;
    }
  }

  function undo() {
    if (historyIndex.value >= 0) {
      const action = history.value[historyIndex.value];
      historyIndex.value--;
      // 执行反向操作（实际应用中需要完整的命令模式）
      return action;
    }
    return null;
  }

  function redo() {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++;
      const action = history.value[historyIndex.value];
      return action;
    }
    return null;
  }

  function canUndo() {
    return historyIndex.value >= 0;
  }

  function canRedo() {
    return historyIndex.value < history.value.length - 1;
  }

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
    history,
    historyIndex,
    drawingSnapshots,
    currentDrawing,
    projectDevices,
    projectCables,
    projectWells,
    projectTrays,
    setProject,
    clearProject,
    setDrawingSnapshot,
    loadProject,
    saveProject,
    saveProjectAs,
    hasBridge,
    importDrawing,
    importDrawingByPaths,
    applyImportedDrawings,
    setCurrentDrawing,
    addDrawing,
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
    exportProject,
    deleteProject,
    addWell,
    addTray,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    markDirty,
    markClean,
    startAutoSave,
    stopAutoSave,
  };
});