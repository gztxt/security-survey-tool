// 侧边栏面板组件
<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <!-- 面板切换标签 -->
    <div class="sidebar-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
        :title="tab.title"
      >
        <component :is="tab.icon" class="tab-icon" />
        <span v-if="!isCollapsed" class="tab-label">{{ tab.title }}</span>
      </button>
    </div>

    <!-- 面板内容 -->
    <div class="sidebar-content">
      <component
        :is="activeComponent"
        :class="['tab-panel', activeTab]"
        ref="panelRef"
      />
    </div>

    <!-- 折叠按钮 -->
    <button class="collapse-btn" @click="toggleCollapse" :title="isCollapsed ? '展开' : '折叠'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ rotated: isCollapsed }">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import DeviceLibraryPanel from '@/components/device/DeviceLibraryPanel.vue';
import LayerManagerPanel from '@/components/project/LayerManagerPanel.vue';
import PropertyPanel from '@/components/project/PropertyPanel.vue';
import ProjectTreePanel from '@/components/project/ProjectTreePanel.vue';
import WiringPanel from '@/components/wiring/WiringPanel.vue';

const props = defineProps<{
  modelValue: string;
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  collapse: [collapsed: boolean];
}>();

const isCollapsed = ref(false);
const activeTab = ref(props.modelValue || 'devices');

const tabs = [
  { id: 'devices', title: '设备库', icon: 'DeviceIcon' },
  { id: 'project', title: '项目树', icon: 'ProjectIcon' },
  { id: 'layers', title: '图层', icon: 'LayersIcon' },
  { id: 'wiring', title: '布线', icon: 'WiringIcon' },
  { id: 'properties', title: '属性', icon: 'PropertiesIcon' },
];

const panelComponents = {
  devices: DeviceLibraryPanel,
  project: ProjectTreePanel,
  layers: LayerManagerPanel,
  wiring: WiringPanel,
  properties: PropertyPanel,
};

const activeComponent = computed(() => panelComponents[activeTab.value as keyof typeof panelComponents]);

const panelRef = ref<any>(null);

watch(() => props.modelValue, (val) => {
  if (val && val !== activeTab.value) {
    activeTab.value = val;
  }
});

watch(activeTab, (val) => {
  emit('update:modelValue', val);
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  emit('collapse', isCollapsed.value);
}

// 图标组件
const DeviceIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('path', { d: 'M12 8v8M8 12h8' }),
]);
const ProjectIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
  h('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }),
]);
const LayersIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
  h('polygon', { points: '12 2 2 7 12 12 22 7 12 2' }),
  h('polyline', { points: '2 17 12 22 22 17' }),
  h('polyline', { points: '2 12 12 17 22 12' }),
]);
const WiringIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
  h('path', { d: 'M4 12h16M12 4v16' }),
]);
const PropertiesIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
  h('rect', { x: 3, y: 3, width: 7, height: 7 }),
  h('rect', { x: 14, y: 3, width: 7, height: 7 }),
  h('rect', { x: 14, y: 14, width: 7, height: 7 }),
  h('rect', { x: 3, y: 14, width: 7, height: 7 }),
]);
</script>

<style scoped>
.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 280px;
  min-width: 48px;
  height: 100%;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  transition: width 0.2s ease, min-width 0.2s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-tabs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  overflow: hidden;
}

.tab-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab-btn.active {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.tab-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.tab-label {
  flex: 1;
  text-align: left;
  opacity: 1;
  transition: opacity 0.15s;
}

.sidebar.collapsed .tab-label {
  opacity: 0;
  width: 0;
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sidebar.collapsed .sidebar-content {
  display: none;
}

.tab-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.collapse-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  z-index: 10;
}

.collapse-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.collapse-btn svg.rotated {
  transform: translateX(-50%) rotate(180deg);
}

.sidebar.collapsed .collapse-btn {
  bottom: 12px;
}
</style>