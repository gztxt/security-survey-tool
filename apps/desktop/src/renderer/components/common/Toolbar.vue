// 工具栏组件
<template>
  <div class="toolbar" role="toolbar" aria-label="主工具栏">
    <div class="toolbar-group">
      <button class="toolbar-btn" @click="newProject" title="新建项目 (Ctrl+N)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
      </button>
      <button class="toolbar-btn" @click="openProject" title="打开项目 (Ctrl+O)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
      <button class="toolbar-btn" @click="saveProject" title="保存项目 (Ctrl+S)" :disabled="!projectStore.isDirty || projectStore.saving">
        <svg v-if="!projectStore.saving" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <svg v-else class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.2-8.6"></path>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button class="toolbar-btn" @click="importDrawing" title="导入底图（DXF/DWG/图片/PDF）">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </button>
      <button class="toolbar-btn" @click="calibrateScale" title="校准比例尺 (Ctrl+K)" :disabled="!projectStore.currentDrawing">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="6" x2="12" y2="12"></line>
          <line x1="12" y1="12" x2="12.01" y2="12.01"></line>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button class="toolbar-btn" @click="setTool('select')" :class="{ active: tool === 'select' }" title="选择 (V)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
          <path d="M13 13l6 6"></path>
        </svg>
      </button>
      <button class="toolbar-btn" @click="setTool('pan')" :class="{ active: tool === 'pan' }" title="平移 (Space)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v0"></path>
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path>
          <path d="M10 10.5a1.5 1.5 0 0 1-3 0"></path>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.02 3.02a1 1 0 0 1-1.41 0l-1.58-1.58a1 1 0 0 1 0-1.41l3.02-3.02A8 8 0 1 1 18 8z"></path>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button class="toolbar-btn" @click="setTool('device')" :class="{ active: tool === 'device' }" title="布点 (D)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v8M8 12h8"></path>
        </svg>
      </button>
      <button class="toolbar-btn" @click="setTool('wire')" :class="{ active: tool === 'wire' }" title="布线 (W)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12h16"></path>
          <path d="M12 4v16"></path>
        </svg>
      </button>
      <button class="toolbar-btn" @click="setTool('tray')" :class="{ active: tool === 'tray' }" title="桥架 (T)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12h16M4 8h16M4 16h16"></path>
        </svg>
      </button>
      <button class="toolbar-btn" @click="setTool('well')" :class="{ active: tool === 'well' }" title="弱电井 (Shift+W)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H7a2 2 0 0 1-2 2v10a2 2 0 0 1 2 2h10"></path>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button class="toolbar-btn" @click="undo" title="撤销 (Ctrl+Z)" :disabled="!projectStore.canUndo()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"></path>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
        </svg>
      </button>
      <button class="toolbar-btn" @click="redo" title="重做 (Ctrl+Shift+Z)" :disabled="!projectStore.canRedo()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 7v6h-6"></path>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button class="toolbar-btn" @click="zoomOut" title="缩小 (-)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </button>
      <span class="zoom-display">{{ (viewport.zoom * 100).toFixed(0) }}%</span>
      <button class="toolbar-btn" @click="zoomIn" title="放大 (=)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </button>
      <button class="toolbar-btn" @click="resetView" title="适应视图 (0)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button class="toolbar-btn" @click="toggleGrid" :class="{ active: viewport.showGrid }" title="显示网格 (G)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      </button>
      <button class="toolbar-btn" @click="toggleRuler" :class="{ active: viewport.showRuler }" title="显示标尺 (R)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="3" y2="18"></line>
          <line x1="21" y1="6" x2="21" y2="18"></line>
          <line x1="12" y1="3" x2="12" y2="21"></line>
        </svg>
      </button>
      <button class="toolbar-btn" @click="toggleSnap" :class="{ active: snapEnabled }" title="吸附 (S)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2"></path>
        </svg>
      </button>
    </div>

    <div class="toolbar-spacer"></div>

    <div class="toolbar-group">
      <div class="scale-display" v-if="projectStore.currentDrawing?.calibration?.isCalibrated">
        <span>比例尺 1:{{ (1/projectStore.currentDrawing.calibration.scale).toFixed(0) }}</span>
      </div>
      <button class="toolbar-btn" @click="showExport" title="导出方案 (Ctrl+E)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
      <button class="toolbar-btn" @click="showSettings" title="设置">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 1 4.6 9a1.65 1.65 0 0 1 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 1-.33 1.82V15a2 2 0 0 1 2 2 2 2 0 0 1-2 2h.09a1.65 1.65 0 0 1 1 1.51 1.65 1.65 0 0 1 1.82.33l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 1-.33-1.82V9a2 2 0 0 1 2-2 2 2 0 0 1 2 2h.09a1.65 1.65 0 0 1 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 1-.33-1.82 1.65 1.65 0 0 1 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1 1.51 1.65 1.65 0 0 1-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l.06.06a1.65 1.65 0 0 1 .33 1.82V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 1-1.51-1 1.65 1.65 0 0 1-1.82-.33l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06-.06a1.65 1.65 0 0 1 1.82-.33H15a2 2 0 0 1 2-2 2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useRouter } from 'vue-router';

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const router = useRouter();

const tool = ref<'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well'>('select');
const viewport = ref(projectStore.viewport);
const snapEnabled = ref(settingsStore.snapEnabled);

const emit = defineEmits<{
  'tool-changed': [tool: typeof tool.value];
  'viewport-changed': [viewport: any];
  /** 导入底图（由宿主视图转交 useBaselineImport，避免工具栏持有文件/桥逻辑） */
  'import': [];
  /** 进入/退出比例尺校准（宿主视图切换 CalibrationOverlay） */
  'calibrate': [];
  /** 保存项目（宿主视图调 projectStore.saveProject） */
  'save': [];
}>();

watch(() => projectStore.viewport, (v) => { viewport.value = v; });
watch(() => settingsStore.snapEnabled, (v) => { snapEnabled.value = v; });

function setTool(t: typeof tool.value) {
  tool.value = t;
  emit('tool-changed', t);
}

function newProject() {
  router.push({ name: 'project-new' });
}

function openProject() {
  router.push({ name: 'home' }); // 打开项目选择器
}

/** 保存：委托 store（内部走主进程 project:save，见决策 4）。不再伪造 markClean */
async function saveProject() {
  if (!projectStore.currentProject) return;
  if (projectStore.saving) return;
  await projectStore.saveProject();
}

/** 导入底图：宿主视图（DrawingView）持有 useBaselineImport，这里只发意图 */
function importDrawing() {
  emit('import');
}

/** 比例尺校准：同上，浮层与取点在宿主侧编排 */
function calibrateScale() {
  emit('calibrate');
}

function undo() {
  projectStore.undo();
}

function redo() {
  projectStore.redo();
}

function zoomIn() {
  const factor = 1.2;
  zoomAt(viewport.value.center, factor);
}

function zoomOut() {
  const factor = 1/1.2;
  zoomAt(viewport.value.center, factor);
}

function zoomAt(center: any, factor: number) {
  viewport.value.transform.a *= factor;
  viewport.value.transform.d *= factor;
  viewport.value.zoom *= factor;
  emit('viewport-changed', viewport.value);
}

function resetView() {
  viewport.value = {
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    center: { x: 0, y: 0 },
    zoom: 1,
    showGrid: true,
    showRuler: true,
  };
  emit('viewport-changed', viewport.value);
}

function toggleGrid() {
  viewport.value.showGrid = !viewport.value.showGrid;
  emit('viewport-changed', viewport.value);
}

function toggleRuler() {
  viewport.value.showRuler = !viewport.value.showRuler;
  emit('viewport-changed', viewport.value);
}

function toggleSnap() {
  snapEnabled.value = !snapEnabled.value;
  settingsStore.snapEnabled = snapEnabled.value;
}

function showExport() {
  router.push({ name: 'project-export', params: { id: projectStore.currentProject?.id } });
}

function showSettings() {
  router.push({ name: 'settings' });
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn.active {
  background: #3b82f6;
  color: white;
}

.toolbar-btn.active:hover {
  background: #2563eb;
}

.toolbar-btn svg {
  width: 20px;
  height: 20px;
}

.zoom-display {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 50px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.toolbar-spacer {
  flex: 1;
}

.scale-display {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 0 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1024px) {
  .toolbar {
    height: auto;
    padding: 8px;
    flex-wrap: wrap;
  }
  .toolbar-divider {
    width: 100%;
    height: 1px;
    margin: 8px 0;
  }
}
</style>