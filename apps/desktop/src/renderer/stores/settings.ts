// 应用设置状态管理
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'light' | 'dark' | 'system'>('system');
  const language = ref<'zh-CN' | 'en-US'>('zh-CN');
  const autoSaveInterval = ref(30000);
  const snapEnabled = ref(true);
  const gridSize = ref(1000);
  const defaultScale = ref(100);
  const unit = ref<'mm' | 'cm' | 'm'>('m');
  const showGrid = ref(true);
  const showRuler = ref(true);
  const canvasBackground = ref('#FAFAFA');
  /**
   * 专家（高级）模式：默认关闭（决策 1）。
   * 关闭时只暴露基线闭环所需入口（导入图纸 / 比例校准 / 点位图导出），
   * 桥架·人井·标尺·多图纸页签·设置高级分类等进阶能力隐藏但功能代码保留。
   * 持久化走 localStorage —— 主进程 settings:get/set 目前是空桩，不可依赖。
   */
  const advancedMode = ref(false);
  const shortcuts = ref<Record<string, string>>({
    'select': 'V',
    'pan': 'Space',
    'zoomIn': '=',
    'zoomOut': '-',
    'placeDevice': 'D',
    'drawWire': 'W',
    'drawTray': 'T',
    'addWell': 'Shift+W',
    'undo': 'Ctrl+Z',
    'redo': 'Ctrl+Shift+Z',
    'delete': 'Delete',
    'copy': 'Ctrl+C',
    'paste': 'Ctrl+V',
    'escape': 'Escape',
  });

  function load() {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const refs: Record<string, any> = {
          theme, language, autoSaveInterval, snapEnabled,
          gridSize, defaultScale, unit, showGrid, showRuler,
          canvasBackground, shortcuts, advancedMode,
        };
        for (const key of Object.keys(refs)) {
          if (parsed[key] !== undefined) refs[key].value = parsed[key];
        }
      } catch { }
    }
  }

  function save() {
    localStorage.setItem('appSettings', JSON.stringify({
      theme: theme.value,
      language: language.value,
      autoSaveInterval: autoSaveInterval.value,
      snapEnabled: snapEnabled.value,
      gridSize: gridSize.value,
      defaultScale: defaultScale.value,
      unit: unit.value,
      showGrid: showGrid.value,
      showRuler: showRuler.value,
      canvasBackground: canvasBackground.value,
      shortcuts: shortcuts.value,
      advancedMode: advancedMode.value,
    }));
  }

  /** 切换专家模式（唯一写入点，便于 UI 统一调用并持久化） */
  function setAdvancedMode(enabled: boolean) {
    advancedMode.value = !!enabled;
    save();
  }

  function toggleAdvancedMode() {
    setAdvancedMode(!advancedMode.value);
    return advancedMode.value;
  }

  function setTheme(t: 'light' | 'dark' | 'system') {
    theme.value = t;
    save();
    applyTheme();
  }

  function applyTheme() {
    const root = document.documentElement;
    if (theme.value === 'dark' || (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  function updateShortcut(action: string, key: string) {
    shortcuts.value[action] = key;
    save();
  }

  load();
  applyTheme();

    // ============ 分组视图（供设置页使用）============

  const generalSettings = computed(() => ({
    theme: theme.value,
    language: language.value,
    autoSaveInterval: autoSaveInterval.value,
  }));

  const canvasSettings = computed(() => ({
    showGrid: showGrid.value,
    showRuler: showRuler.value,
    canvasBackground: canvasBackground.value,
    gridSize: gridSize.value,
  }));

  const drawingSettings = computed(() => ({
    snapEnabled: snapEnabled.value,
    defaultScale: defaultScale.value,
    unit: unit.value,
  }));

  const deviceLibrarySettings = computed(() => ({}));
  const wiringSettings = computed(() => ({}));
  const exportSettings = computed(() => ({}));
  const advancedSettings = computed(() => ({ advancedMode: advancedMode.value }));
  const shortcutSettings = computed(() => shortcuts.value);

  function updateSettings(category: string, value: any) {
    if (!value || typeof value !== 'object') return;
    const refMap: Record<string, any> = {
      theme, language, autoSaveInterval, snapEnabled, gridSize,
      defaultScale, unit, showGrid, showRuler, canvasBackground, advancedMode,
    };
    for (const key of Object.keys(value)) {
      if (category === 'shortcuts' && key === 'shortcuts') {
        shortcuts.value = { ...shortcuts.value, ...value[key] };
      } else if (refMap[key]) {
        refMap[key].value = value[key];
      }
    }
    save();
  }

  function loadSettings() { load(); }
  function saveSettings() { save(); }

  /** 最近项目（HomeView 使用；实际索引由 project store 维护，此处读同一存储） */
  const recentProjects = computed<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('projects-index') || '[]');
    } catch {
      return [];
    }
  });

  function clearRecentProjects() {
    localStorage.removeItem('projects-index');
  }
  function resetToDefaults() {
    theme.value = 'system';
    language.value = 'zh-CN';
    autoSaveInterval.value = 30000;
    snapEnabled.value = true;
    gridSize.value = 1000;
    defaultScale.value = 100;
    unit.value = 'm';
    showGrid.value = true;
    showRuler.value = true;
    canvasBackground.value = '#FAFAFA';
    save();
  }

  return {
    theme,
    language,
    autoSaveInterval,
    snapEnabled,
    gridSize,
    defaultScale,
    unit,
    showGrid,
    showRuler,
    canvasBackground,
    advancedMode,
    shortcuts,
    generalSettings,
    canvasSettings,
    drawingSettings,
    deviceLibrarySettings,
    wiringSettings,
    exportSettings,
    advancedSettings,
    shortcutSettings,
    setTheme,
    setAdvancedMode,
    toggleAdvancedMode,
    updateShortcut,
    updateSettings,
    loadSettings,
    saveSettings,
    recentProjects,
    clearRecentProjects,
    resetToDefaults,
    load,
    save,
  };
});