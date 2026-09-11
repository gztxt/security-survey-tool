<template>
  <div class="settings-view" ref="containerRef">
    <div class="settings-header">
      <h1 class="page-title">设置</h1>
      <p class="page-subtitle">管理应用程序偏好设置、快捷键、导入导出等</p>
    </div>

    <div class="settings-layout">
      <!-- 侧边分类导航 -->
      <nav class="settings-nav" aria-label="设置分类">
        <div
          v-for="category in visibleCategories"
          :key="category.id"
          class="nav-category"
        >
          <div
            v-if="category.id !== 'divider' && category.id !== 'divider2'"
            class="nav-item"
            :class="{ active: activeCategory === category.id }"
            @click="activeCategory = category.id"
          >
            <component :is="category.icon" class="nav-icon" />
            <span class="nav-label">{{ category.label }}</span>
            <span v-if="category.badge" class="nav-badge">{{ category.badge }}</span>
          </div>
          <div v-else class="nav-divider" />
        </div>

        <div class="nav-footer">
          <button class="btn-reset" @click="resetAllSettings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            恢复默认设置
          </button>
        </div>
      </nav>

      <!-- 设置内容区 -->
      <div class="settings-content">
        <!-- 通用设置 -->
        <SettingsGeneral v-if="activeCategory === 'general'" :modelValue="settings.general" @update:modelValue="updateSettings('general', $event)" />

        <!-- 画布设置 -->
        <SettingsCanvas v-if="activeCategory === 'canvas'" :modelValue="settings.canvas" @update:modelValue="updateSettings('canvas', $event)" />

        <!-- 图纸设置 -->
        <SettingsDrawing v-if="activeCategory === 'drawing'" :modelValue="settings.drawing" @update:modelValue="updateSettings('drawing', $event)" />

        <!-- 设备库设置 -->
        <SettingsDeviceLibrary v-if="activeCategory === 'device-library'" :modelValue="settings.deviceLibrary" @update:modelValue="updateSettings('deviceLibrary', $event)" />

        <!-- 布线设置 -->
        <SettingsWiring v-if="activeCategory === 'wiring'" :modelValue="settings.wiring" @update:modelValue="updateSettings('wiring', $event)" />

        <!-- 导出设置 -->
        <SettingsExport v-if="activeCategory === 'export'" :modelValue="settings.export" @update:modelValue="updateSettings('export', $event)" />

        <!-- 快捷键设置 -->
        <SettingsShortcuts v-if="activeCategory === 'shortcuts'" :modelValue="settings.shortcuts" @update:modelValue="updateSettings('shortcuts', $event)" />

        <!-- 高级设置 -->
        <SettingsAdvanced v-if="activeCategory === 'advanced'" :modelValue="settings.advanced" @update:modelValue="updateSettings('advanced', $event)" />

        <!-- 关于 -->
        <SettingsAbout v-if="activeCategory === 'about'" />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="settings-footer">
      <button class="btn-secondary" @click="cancelChanges">取消</button>
      <button class="btn-primary" @click="saveSettings" :disabled="!hasChanges">保存设置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useVisibility, type SettingsCategoryId } from '@/composables/useVisibility';
import { ElMessage, ElMessageBox } from 'element-plus';

import SettingsGeneral from './settings/SettingsGeneral.vue';
import SettingsCanvas from './settings/SettingsCanvas.vue';
import SettingsDrawing from './settings/SettingsDrawing.vue';
import SettingsDeviceLibrary from './settings/SettingsDeviceLibrary.vue';
import SettingsWiring from './settings/SettingsWiring.vue';
import SettingsExport from './settings/SettingsExport.vue';
import SettingsShortcuts from './settings/SettingsShortcuts.vue';
import SettingsAdvanced from './settings/SettingsAdvanced.vue';
import SettingsAbout from './settings/SettingsAbout.vue';

const settingsStore = useSettingsStore();
const route = useRoute();
const { showSettingsCategory } = useVisibility();

const props = defineProps<{}>();
const emit = defineEmits<{ close: [] }>();

const containerRef = ref<HTMLElement>();

const activeCategory = ref('general');
const hasChanges = ref(false);
const originalSettings = ref<any>(null);

const categories = [
  { id: 'general', label: '通用', icon: 'SettingsGeneralIcon' },
  { id: 'canvas', label: '画布', icon: 'SettingsCanvasIcon' },
  { id: 'drawing', label: '图纸', icon: 'SettingsDrawingIcon' },
  { id: 'device-library', label: '设备库', icon: 'SettingsDeviceIcon' },
  { id: 'wiring', label: '布线', icon: 'SettingsWiringIcon' },
  { id: 'divider', label: '' },
  { id: 'export', label: '导出', icon: 'SettingsExportIcon' },
  { id: 'shortcuts', label: '快捷键', icon: 'SettingsShortcutsIcon', badge: 'Beta' },
  { id: 'divider2', label: '' },
  { id: 'advanced', label: '高级', icon: 'SettingsAdvancedIcon' },
  { id: 'about', label: '关于', icon: 'SettingsAboutIcon' },
];

// 精简态只露「通用 / 高级 / 关于」（useVisibility 单一事实源，决策 5.4）
const visibleCategories = computed(() =>
  categories.filter(c => showSettingsCategory(c.id as SettingsCategoryId)),
);

const settings = computed(() => ({
  general: settingsStore.generalSettings,
  canvas: settingsStore.canvasSettings,
  drawing: settingsStore.drawingSettings,
  deviceLibrary: settingsStore.deviceLibrarySettings,
  wiring: settingsStore.wiringSettings,
  export: settingsStore.exportSettings,
  shortcuts: settingsStore.shortcutSettings,
  advanced: settingsStore.advancedSettings,
}));

const generalSettings = computed(() => settingsStore.generalSettings);
const canvasSettings = computed(() => settingsStore.canvasSettings);
const drawingSettings = computed(() => settingsStore.drawingSettings);
const deviceLibrarySettings = computed(() => settingsStore.deviceLibrarySettings);
const wiringSettings = computed(() => settingsStore.wiringSettings);
const exportSettings = computed(() => settingsStore.exportSettings);
const shortcutSettings = computed(() => settingsStore.shortcutSettings);
const advancedSettings = computed(() => settingsStore.advancedSettings);

// 图标组件
const SettingsGeneralIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`
};
const SettingsCanvasIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><path d="M16 2v20"></path><path d="M2 16h20"></path>`
};
const SettingsDrawingIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>`
};
const SettingsDeviceIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path>`
};
const SettingsWiringIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"></path><path d="M17 7H7"></path><path d="M17 17H7"></path>`
};
const SettingsExportIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>`
};
const SettingsShortcutsIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.01"></path><path d="M10 8h.01"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M8 12h.01"></path><path d="M12 12h.01"></path><path d="M16 12h.01"></path>`
};
const SettingsAdvancedIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`
};
const SettingsAboutIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>`
};

onMounted(() => {
  // 保存原始设置用于取消
  originalSettings.value = JSON.parse(JSON.stringify(settings.value));
  // 优先：?cat= 直达（「高级功能 → 专业设置」跳转）
  const qCat = route.query.cat as string | undefined;
  if (qCat && visibleCategories.value.some(c => c.id === qCat)) {
    activeCategory.value = qCat;
  } else {
    // 恢复上次选中的分类（仅在当前可见范围内）
    const lastCategory = localStorage.getItem('settings-last-category');
    if (lastCategory && visibleCategories.value.some(c => c.id === lastCategory)) {
      activeCategory.value = lastCategory;
    } else if (!visibleCategories.value.some(c => c.id === activeCategory.value)) {
      // 上次选中的分类在精简态被隐藏 → 回退到「通用」
      activeCategory.value = 'general';
    }
  }
  // 键盘导航
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

function updateSettings(category: string, value: any) {
  hasChanges.value = true;
  settingsStore.updateSettings(category, value);
}

function saveSettings() {
  settingsStore.saveSettings();
  localStorage.setItem('settings-last-category', activeCategory.value);
  hasChanges.value = false;
  originalSettings.value = JSON.parse(JSON.stringify(settings.value));
  ElMessage.success('设置已保存');
}

function cancelChanges() {
  if (hasChanges.value) {
    ElMessageBox.confirm('有未保存的更改，确定要放弃吗？', '确认取消', {
      confirmButtonText: '放弃更改',
      cancelButtonText: '继续编辑',
      type: 'warning',
    }).then(() => {
      settingsStore.loadSettings(); // 重新加载原始设置
      hasChanges.value = false;
    }).catch(() => {});
  }
}

function resetAllSettings() {
  ElMessageBox.confirm('确定要恢复所有设置为默认值吗？此操作不可撤销。', '确认重置', {
    confirmButtonText: '重置',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    settingsStore.resetToDefaults();
    hasChanges.value = true;
    ElMessage.success('已恢复默认设置');
  }).catch(() => {});
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) return;

  const categoryIds = visibleCategories.value.filter(c => c.id !== 'divider' && c.id !== 'divider2').map(c => c.id);
  const currentIndex = categoryIds.indexOf(activeCategory.value);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (currentIndex < categoryIds.length - 1) {
        activeCategory.value = categoryIds[currentIndex + 1];
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (currentIndex > 0) {
        activeCategory.value = categoryIds[currentIndex - 1];
      }
      break;
    case 'Escape':
      cancelChanges();
      break;
    case 's':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        saveSettings();
      }
      break;
  }
}

// 监听分类变化，滚动到视图
watch(activeCategory, (newVal) => {
  localStorage.setItem('settings-last-category', newVal);
  nextTick(() => {
    const el = document.querySelector(`.nav-item[data-category="${newVal}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.settings-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  overflow-y: auto;
  padding: 16px 8px;
}

.nav-category {
  margin-bottom: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: #3b82f6;
  border-radius: 0 3px 3px 0;
}

.nav-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-label {
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-radius: 10px;
  font-weight: 500;
}

.nav-divider {
  height: 1px;
  background: var(--border-color);
  margin: 8px 12px;
}

.nav-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.btn-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-reset:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  min-width: 0;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

/* 滚动条样式 */
.settings-nav::-webkit-scrollbar,
.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-nav::-webkit-scrollbar-track,
.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-nav::-webkit-scrollbar-thumb,
.settings-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.settings-nav::-webkit-scrollbar-thumb:hover,
.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* 响应式 */
@media (max-width: 1024px) {
  .settings-layout {
    flex-direction: column;
  }

  .settings-nav {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding: 8px;
    max-height: 200px;
  }

  .nav-item {
    padding: 8px 12px;
  }

  .nav-footer {
    display: none;
  }

  .settings-content {
    padding: 16px;
  }
}
</style>