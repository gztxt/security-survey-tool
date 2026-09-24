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
  const showRuler = ref(false);
  const canvasBackground = ref('#FAFAFA');
  /**
   * 专家（高级）模式：默认关闭（决策 1）。
   * 关闭时只暴露基线闭环所需入口（导入图纸 / 比例校准 / 点位图导出），
   * 桥架·人井·标尺·多图纸页签·设置高级分类等进阶能力隐藏但功能代码保留。
   * 持久化走 localStorage —— 主进程 settings:get/set 目前是空桩，不可依赖。
   */
  const advancedMode = ref(false);
  // 旧版这里有一张 shortcuts 键位表（V/Ctrl+Z/……），但全仓没有任何运行时
  // 代码读取它 —— 按键散落在各组件硬编码。P1 键位治理已把真相源迁到
  // src/renderer/keymap.ts（代码常量 + 静态一致性测试），设置页/帮助页均
  // 由它渲染。这张死表随之删除：留着它只会再次长出一个"改了没人听"的
  // 假配置面。

  function load() {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const refs: Record<string, any> = {
          theme, language, autoSaveInterval, snapEnabled,
          gridSize, defaultScale, unit, showGrid, showRuler,
          canvasBackground, advancedMode,
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

  function updateSettings(category: string, value: any) {
    if (!value || typeof value !== 'object') return;
    const refMap: Record<string, any> = {
      theme, language, autoSaveInterval, snapEnabled, gridSize,
      defaultScale, unit, showGrid, showRuler, canvasBackground, advancedMode,
    };
    for (const key of Object.keys(value)) {
      if (refMap[key]) {
        refMap[key].value = value[key];
      }
    }
    save();
  }

  function loadSettings() { load(); }
  function saveSettings() { save(); }

  function resetToDefaults() {
    theme.value = 'system';
    language.value = 'zh-CN';
    autoSaveInterval.value = 30000;
    snapEnabled.value = true;
    gridSize.value = 1000;
    defaultScale.value = 100;
    unit.value = 'm';
    showGrid.value = true;
    showRuler.value = false;
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
    generalSettings,
    canvasSettings,
    drawingSettings,
    deviceLibrarySettings,
    wiringSettings,
    exportSettings,
    advancedSettings,
    setTheme,
    setAdvancedMode,
    toggleAdvancedMode,
    updateSettings,
    loadSettings,
    saveSettings,
    resetToDefaults,
    load,
    save,
  };
});