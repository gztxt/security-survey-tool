<template>
  <header class="project-header">
    <div class="header-left">
      <button class="icon-btn" @click="$router.push({ name: 'home' })" title="返回首页 (Ctrl+Shift+H)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>

      <div class="project-title">
        <h1>{{ project?.name || '未命名项目' }}</h1>
        <span class="project-status" v-if="dirty">● 未保存</span>
      </div>

      <nav class="breadcrumb" v-if="currentDrawing">
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-item" @click="goToDashboard">{{ project?.name }}</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-item active">{{ currentDrawing.name }}</span>
      </nav>
    </div>

    <div class="header-center">
      <DrawingTabs
        :drawings="drawings"
        :active-drawing="currentDrawing?.id"
        @switch="switchDrawing"
        @close="closeDrawing"
        @new="importDrawing"
      />
    </div>

    <div class="header-right">
      <div class="header-actions">
        <button class="icon-btn" @click="saveProject" :disabled="!dirty" title="保存 (Ctrl+S)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>

        <button class="icon-btn" @click="saveProjectAs" title="另存为 (Ctrl+Shift+S)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </button>

        <div class="action-divider"></div>

        <button class="icon-btn" @click="importDrawing" title="导入图纸 (Ctrl+I)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>

        <button class="icon-btn" @click="exportProject" title="导出方案 (Ctrl+E)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>

        <div class="action-divider"></div>

        <button class="icon-btn" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline :class="{ rotated: sidebarCollapsed }" points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <button class="icon-btn" @click="openSettings" title="设置">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 1 4.6 9a1.65 1.65 0 0 1 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 1-.33 1.82V15a2 2 0 0 1 2 2 2 2 0 0 1-2 2h.09a1.65 1.65 0 0 1 1 1.51 1.65 1.65 0 0 1 1.82.33l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 1-.33-1.82V9a2 2 0 0 1 2-2 2 2 0 0 1 2 2h.09a1.65 1.65 0 0 1 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 1 .33-1.82 1.65 1.65 0 0 1 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1 1.51 1.65 1.65 0 0 1-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 1 .33-1.82 1.65 1.65 0 0 1 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2z"></path>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import DrawingTabs from './DrawingTabs.vue';

const projectStore = useProjectStore();
const router = useRouter();
const route = useRoute();

const props = defineProps<{
  project: any;
  dirty: boolean;
}>();

const emit = defineEmits<{
  save: [];
  'save-as': [];
  export: [];
  import: [];
}>();

const drawings = computed(() => projectStore.drawings);
const currentDrawing = computed(() => projectStore.currentDrawing);
const sidebarCollapsed = ref(false);

function goToDashboard() {
  router.push({ name: 'project-dashboard', params: { id: props.project?.id } });
}

function switchDrawing(drawingId: string) {
  projectStore.setCurrentDrawing(drawingId);
}

function closeDrawing(drawingId: string) {
  projectStore.removeDrawing(drawingId);
}

function importDrawing() {
  emit('import');
}

function saveProject() {
  emit('save');
}

function saveProjectAs() {
  emit('save-as');
}

function exportProject() {
  emit('export');
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function openSettings() {
  router.push({ name: 'settings' });
}
</script>

<style scoped>
.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 24px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-left h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.project-status {
  font-size: 11px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.breadcrumb-item {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}

.breadcrumb-item:hover:not(.active) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.breadcrumb-item.active {
  color: var(--text-primary);
  font-weight: 500;
  cursor: default;
}

.breadcrumb-sep {
  color: var(--border-color);
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
}

.rotated {
  transform: rotate(180deg);
}
</style>