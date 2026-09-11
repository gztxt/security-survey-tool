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
    const project = JSON.parse(data) as Project;
    setProject(project);
    return project;
  }

  async function saveProject(project?: Project) {
    const p = project || currentProject.value;
    if (!p) return { success: false, path: '' };
    const data = JSON.stringify(p, null, 2);
    const filePath = (p as any).__filePath || `${p.name}.ssproj`;
    await window.api.fs.writeFile(filePath, data);
    markClean();
    return { success: true, path: filePath };
  }

  async function saveProjectAs(project?: Project) {
    const p = project || currentProject.value;
    if (!p) return null;
    const target = await window.api.fs.showSaveDialog({
      defaultPath: `${p.name}.ssproj`,
      filters: [{ name: '勘点项目', extensions: ['ssproj', 'json'] }],
    });
    const filePath = typeof target === 'string' ? target : target?.filePath;
    if (!filePath) return null;
    await window.api.fs.writeFile(filePath, JSON.stringify(p, null, 2));
    (p as any).__filePath = filePath;
    markClean();
    return { success: true, path: filePath };
  }

  /**
   * 导入图纸
   * 沙箱渲染进程拿不到拖入文件的真实路径：
   * - File.path 可用时直接走主进程导入
   * - 否则回退到原生文件对话框选择后由主进程导入
   */
  async function importDrawing(file: File) {
    let paths: string[] = [];
    const maybePath = (file as any).path as string | undefined;
    if (maybePath) {
      paths = [maybePath];
    } else {
      const result = await window.api.fs.showOpenDialog({
        title: '选择图纸文件',
        filters: [{ name: 'CAD 图纸', extensions: ['dwg', 'dxf'] }],
        properties: ['openFile'],
      });
      paths = result?.filePaths || [];
    }
    if (!paths.length) return null;

    const imported = await window.api.drawing.import(paths);
    if (Array.isArray(imported)) {
      for (const d of imported) addDrawing(d);
    }
    return imported;
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
    touchIndex(project);
  }

  function clearProject() {
    currentProject.value = null;
    currentDrawingId.value = null;
    drawings.value = [];
    isDirty.value = false;
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
    importDrawing,
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