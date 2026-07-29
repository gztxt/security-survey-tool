// 项目状态管理
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, Drawing, DeviceInstance, Cable, WeakPoint, CableTray, ViewportState, CalibrationData } from '@security-survey/shared-types';

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
  function setProject(project: Project) {
    currentProject.value = project;
    drawings.value = project.drawings || [];
    if (drawings.value.length > 0 && !currentDrawingId.value) {
      currentDrawingId.value = drawings.value[0].id;
    }
    isDirty.value = false;
    history.value = [];
    historyIndex.value = -1;
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
    currentDrawing,
    projectDevices,
    projectCables,
    projectWells,
    projectTrays,
    setProject,
    clearProject,
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