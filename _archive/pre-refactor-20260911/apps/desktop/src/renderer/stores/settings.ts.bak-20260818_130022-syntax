// 应用设置状态管理
import { defineStore } from 'pinia';
import { ref } from 'vue';

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
  const shortcuts = ref<Record<string, string>>({
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
        Object.assign({
          theme, language, autoSaveInterval, snapEnabled,
          gridSize, defaultScale, unit, showGrid, showRuler,
          canvasBackground, shortcuts,
        }, parsed);
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
    }));
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
    shortcuts,
    setTheme,
    updateShortcut,
    load,
    save,
  };
});