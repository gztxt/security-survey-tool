<template>
  <el-dropdown
    trigger="click"
    :show-timeout="0"
    :hide-timeout="120"
    placement="bottom-end"
    popper-class="advanced-menu-popper"
    @command="onCommand"
    @visible-change="onVisibleChange"
  >
    <button class="advanced-trigger" :class="{ active: advancedMode }" title="高级功能">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="5" cy="12" r="2"></circle>
        <circle cx="12" cy="5" r="2"></circle>
        <circle cx="12" cy="19" r="2"></circle>
        <circle cx="19" cy="12" r="2"></circle>
        <line x1="7" y1="12" x2="10" y2="12"></line>
        <line x1="12" y1="7" x2="12" y2="10"></line>
        <line x1="12" y1="14" x2="12" y2="17"></line>
        <line x1="14" y1="12" x2="17" y2="12"></line>
      </svg>
      <span class="advanced-label">高级功能</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <template #dropdown>
      <div class="advanced-menu">
        <!-- 经典模式总开关 -->
        <div class="advanced-mode-row">
          <div class="mode-text">
            <span class="mode-title">经典模式</span>
            <span class="mode-desc">显示全部工具、面板与专业设置</span>
          </div>
          <el-switch :model-value="advancedMode" @change="toggleAdvancedMode" />
        </div>

        <div class="advanced-divider"></div>

        <!-- 六个分组 -->
        <div class="advanced-scroll">
          <div v-for="group in groups" :key="group.id" class="advanced-group">
            <div class="group-label">{{ group.label }}</div>
            <button
              v-for="item in group.items"
              :key="item.label"
              class="advanced-item"
              @click="run(item)"
            >
              <span>{{ item.label }}</span>
              <svg v-if="item.hint === 'nav'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useProjectStore } from '@/stores/project';

const router = useRouter();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const projectStore = useProjectStore();

const advancedMode = computed(() => settingsStore.advancedMode);

function toggleAdvancedMode(val: string | number | boolean) {
  settingsStore.setAdvancedMode(!!val);
}

/** 每项动作：nav=路由跳转；tool=切工具；panel=切侧栏；toggle-ruler=标尺；tour=回放引导 */
type ActionKind = 'nav' | 'tool' | 'panel' | 'toggle-ruler' | 'tour';
interface MenuItem {
  label: string;
  hint?: ActionKind;
  /** nav：路由 name；tool：工具名；panel：侧栏 Tab id */
  target?: string;
}

interface Group {
  id: string;
  label: string;
  items: MenuItem[];
}

const groups = computed<Group[]>(() => [
  {
    id: 'tools',
    label: '专业工具',
    items: [
      { label: '桥架标注', hint: 'tool', target: 'tray' },
      { label: '弱电井标注', hint: 'tool', target: 'well' },
      { label: '显示标尺', hint: 'toggle-ruler' },
    ],
  },
  {
    id: 'panels',
    label: '面板',
    items: [
      { label: '项目树', hint: 'panel', target: 'project' },
      { label: '图层', hint: 'panel', target: 'layers' },
      { label: '布线', hint: 'panel', target: 'wiring' },
      { label: '属性', hint: 'panel', target: 'properties' },
    ],
  },
  {
    id: 'pages',
    label: '管理页',
    items: [
      { label: '项目列表', hint: 'nav', target: 'Projects' },
      { label: '项目概览', hint: 'nav', target: 'Dashboard' },
      { label: '设备库管理', hint: 'nav', target: 'DeviceLibrary' },
    ],
  },
  {
    id: 'exports',
    label: '高级导出',
    items: [
      { label: '拓扑图', hint: 'nav', target: 'project-export' },
      { label: '视场分析', hint: 'nav', target: 'project-export' },
      { label: 'BOM 清单', hint: 'nav', target: 'project-export' },
      { label: '工程报告', hint: 'nav', target: 'project-export' },
    ],
  },
  {
    id: 'settings',
    label: '专业设置',
    items: [
      { label: '画布', hint: 'nav', target: 'settings' },
      { label: '图纸', hint: 'nav', target: 'settings' },
      { label: '设备库', hint: 'nav', target: 'settings' },
      { label: '布线', hint: 'nav', target: 'settings' },
      { label: '导出', hint: 'nav', target: 'settings' },
      { label: '快捷键', hint: 'nav', target: 'settings' },
    ],
  },
  {
    id: 'misc',
    label: '其他',
    items: [
      { label: '帮助文档', hint: 'nav', target: 'help' },
      { label: '重播新手引导', hint: 'tour' },
    ],
  },
]);

/** 设置分类跳转：直接进设置页，并预选对应分类（?cat=） */
const SETTINGS_CAT: Record<string, string> = {
  画布: 'canvas',
  图纸: 'drawing',
  设备库: 'device-library',
  布线: 'wiring',
  导出: 'export',
  快捷键: 'shortcuts',
};

function onCommand() {
  /* el-dropdown command 回调占位（实际动作在 @click 里执行） */
}

function onVisibleChange() {
  /* 占位 */
}

function run(item: MenuItem) {
  switch (item.hint) {
    case 'nav': {
      const name = item.target as string;
      if (name === 'project-export') {
        const id = projectStore.currentProject?.id;
        router.push({ name: 'project-export', params: id ? { id } : {} });
      } else if (name === 'settings') {
        const cat = SETTINGS_CAT[item.label] || 'general';
        router.push({ name: 'settings', query: { cat } });
      } else if (name === 'Dashboard') {
        const id = projectStore.currentProject?.id;
        router.push({ name: 'Dashboard', params: id ? { id } : {} });
      } else {
        router.push({ name });
      }
      break;
    }
    case 'tool':
      uiStore.setTool(item.target as any);
      break;
    case 'panel':
      uiStore.setSidebarTab(item.target as string);
      break;
    case 'toggle-ruler':
      settingsStore.showRuler = !settingsStore.showRuler;
      settingsStore.save();
      break;
    case 'tour':
      uiStore.replayTour();
      break;
  }
}
</script>

<style scoped>
.advanced-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  outline: none;
}

.advanced-trigger:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.advanced-trigger.active {
  border-color: #3b82f6;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.advanced-label {
  white-space: nowrap;
}
</style>

<style>
.advanced-menu-popper {
  min-width: 240px !important;
}

.advanced-menu {
  padding: 6px 0;
}

.advanced-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
}

.mode-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.mode-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.advanced-divider {
  height: 1px;
  background: var(--border-color);
  margin: 6px 0;
}

.advanced-scroll {
  max-height: 420px;
  overflow-y: auto;
}

.advanced-group {
  padding: 6px 8px;
}

.group-label {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.advanced-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s;
}

.advanced-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
</style>
