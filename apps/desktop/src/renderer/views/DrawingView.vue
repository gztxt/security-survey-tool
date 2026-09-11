<template>
  <div class="drawing-view" ref="containerRef">
    <!-- 图纸标签栏 -->
    <DrawingTabs
      ref="tabsRef"
      @drawing-add="onAddDrawing"
      @drawing-switch="onSwitchDrawing"
      @drawing-close="onCloseDrawing"
    />

    <!-- 画布区域 -->
    <div class="canvas-area" ref="canvasAreaRef">
      <CanvasViewport
        v-if="activeDrawing"
        ref="viewportRef"
        :drawing="activeDrawing"
        :entities="entities"
        :devices="devices"
        :wires="wires"
        :view-mode="viewMode"
        :snap-enabled="snapEnabled"
        :grid-enabled="gridEnabled"
        @entity-select="onEntitySelect"
        @device-place="onDevicePlace"
        @wire-start="onWireStart"
        @wire-end="onWireEnd"
        @viewport-change="onViewportChange"
        @context-menu="onCanvasContextMenu"
      />

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h3>暂无图纸</h3>
        <p>点击上方「+」新建图纸，或拖拽 DWG/DXF 文件至此导入</p>
        <button class="btn-primary" @click="onAddDrawing">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          新建图纸
        </button>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span class="coord-display">
          <span v-if="activeDrawing && viewport">X: {{ viewport.worldX.toFixed(1) }}  Y: {{ viewport.worldY.toFixed(1) }}</span>
          <span v-else>X: 0.0  Y: 0.0</span>
        </span>
        <span class="divider">|</span>
        <span class="zoom-display">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span v-if="viewport">{{ (viewport.zoom * 100).toFixed(0) }}%</span>
          <span v-else>100%</span>
        </span>
        <span class="divider">|</span>
        <span class="entity-count">
          实体: {{ entities?.length || 0 }} | 设备: {{ devices?.length || 0 }} | 线路: {{ wires?.length || 0 }}
        </span>
      </div>
      <div class="status-center">
        <span class="snap-status" :class="{ active: snapEnabled }" title="吸附 (S)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          吸附
        </span>
        <span class="divider">|</span>
        <span class="grid-status" :class="{ active: gridEnabled }" title="网格 (G)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
          </svg>
          网格
        </span>
        <span class="divider">|</span>
        <span class="unit-display">
          单位: {{ activeDrawing?.calibration?.unit || 'mm' }} ({{ (activeDrawing?.calibration?.scale || 1).toFixed(3) }}:1)
        </span>
      </div>
      <div class="status-right">
        <span class="view-mode" :title="getViewModeTitle(viewMode)">
          <svg v-if="viewMode === 'design'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          <svg v-else-if="viewMode === 'fov'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          {{ getViewModeLabel(viewMode) }}
        </span>
      </div>
    </div>

    <!-- 画布右键菜单 -->
    <ContextMenu
      v-model:visible="canvasMenu.visible"
      :position="canvasMenu.position"
      :items="canvasMenu.items"
      @select="onCanvasMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';
import { useDeviceStore } from '@/stores/deviceLibrary';
import { useSettingsStore } from '@/stores/settings';
import DrawingTabs from '@/components/layout/DrawingTabs.vue';
import CanvasViewport from '@/components/canvas/CanvasViewport.vue';
import ContextMenu from '@/components/common/ContextMenu.vue';

const projectStore = useProjectStore();
const deviceStore = useDeviceStore();
const settingsStore = useSettingsStore();

const props = defineProps<{
  projectId?: string;
}>();

const emit = defineEmits<{
  'device-selected': [device: any | null];
  'wire-selected': [wire: any | null];
  'entity-selected': [entity: any | null];
}>();

const containerRef = ref<HTMLElement>();
const canvasAreaRef = ref<HTMLElement>();
const tabsRef = ref<any>(null);
const viewportRef = ref<any>(null);

/** 捕获当前图纸画布快照存入 store，供主进程导出引擎使用 */
function captureSnapshotToStore() {
  const drawing = activeDrawing.value;
  if (!drawing) return;
  const dataUrl = viewportRef.value?.captureSnapshot?.();
  if (dataUrl) {
    projectStore.setDrawingSnapshot(drawing.id, dataUrl);
  }
}

const activeDrawing = computed(() => projectStore.currentDrawing);
const entities = computed(() => activeDrawing.value?.entities || []);
const devices = computed(() => activeDrawing.value?.devices || []);
const wires = computed(() => activeDrawing.value?.wires || []);
const viewport = computed(() => activeDrawing.value?.viewport);

const viewMode = ref<'design' | 'fov' | 'wiring'>('design');
const snapEnabled = ref(true);
const gridEnabled = ref(true);

const canvasMenu = ref({ visible: false, position: { x: 0, y: 0 }, items: [] as any[] });

// 拖拽导入
const dragOver = ref(false);

onMounted(() => {
  containerRef.value?.addEventListener('dragover', onDragOver);
  containerRef.value?.addEventListener('dragleave', onDragLeave);
  containerRef.value?.addEventListener('drop', onDrop);
  containerRef.value?.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // 离开画布前保留快照，供导出页面使用
  captureSnapshotToStore();
  containerRef.value?.removeEventListener('dragover', onDragOver);
  containerRef.value?.removeEventListener('dragleave', onDragLeave);
  containerRef.value?.removeEventListener('drop', onDrop);
  containerRef.value?.removeEventListener('contextmenu', onContextMenu);
  window.removeEventListener('keydown', handleKeydown);
});

// 图纸内容变化时更新快照（防抖：仅在选中/修改后延迟捕获）
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
watch([devices, wires], () => {
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(captureSnapshotToStore, 800);
});

function onDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = true;
}

function onDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!containerRef.value?.contains(e.relatedTarget as Node)) {
    dragOver.value = false;
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = false;

  const files = Array.from(e.dataTransfer?.files || []);
  const cadFiles = files.filter(f => /\.(dwg|dxf)$/i.test(f.name));

  if (cadFiles.length > 0) {
    importDrawings(cadFiles);
  }
}

async function importDrawings(files: File[]) {
  for (const file of files) {
    await projectStore.importDrawing(file);
  }
}

function onAddDrawing() {
  projectStore.addDrawing({ name: '新建图纸' } as any);
}

function onSwitchDrawing(drawingId: string) {
  projectStore.setCurrentDrawing(drawingId);
  emit('device-selected', null);
  emit('wire-selected', null);
  emit('entity-selected', null);
}

function onCloseDrawing(drawingId: string) {
  projectStore.removeDrawing(drawingId);
}

function onEntitySelect(entity: any | null) {
  emit('entity-selected', entity);
}

function onDevicePlace(payload: { deviceType: string; x: number; y: number }) {
  const device = deviceStore.createDeviceFromTemplate(payload.deviceType, {
    x: payload.x,
    y: payload.y,
    drawingId: activeDrawing.value?.id,
  });
  if (device) {
    projectStore.addDevice(device);
    emit('device-selected', device);
  }
}

function onWireStart(point: { x: number; y: number }) {
  projectStore.startWire(point.x, point.y);
}

function onWireEnd(point: { x: number; y: number }) {
  projectStore.endWire(point.x, point.y);
}

function onViewportChange(vp: any) {
  if (activeDrawing.value) {
    projectStore.updateViewport(vp);
  }
}

/** 画布组件上报的右键菜单事件，复用本组件的上下文菜单逻辑 */
function onCanvasContextMenu(e: MouseEvent) {
  onContextMenu(e);
}

function onContextMenu(e: MouseEvent) {
  if (!activeDrawing.value) return;
  e.preventDefault();

  canvasMenu.value = {
    visible: true,
    position: { x: e.clientX, y: e.clientY },
    items: [
      { label: '导入图纸...', action: 'import', icon: 'import' },
      { label: '新建图纸', action: 'new', icon: 'plus' },
      { type: 'separator' },
      { label: '缩放适应', action: 'zoom-fit', shortcut: 'Shift+1', icon: 'zoom-fit' },
      { label: '实际大小 (100%)', action: 'zoom-100', shortcut: '1', icon: 'zoom-100' },
      { label: '缩放选中', action: 'zoom-selection', shortcut: 'Shift+2', icon: 'zoom-selection' },
      { type: 'separator' },
      { label: '网格显示/隐藏', action: 'toggle-grid', checked: gridEnabled.value, shortcut: 'G' },
      { label: '吸附开启/关闭', action: 'toggle-snap', checked: snapEnabled.value, shortcut: 'S' },
      { type: 'separator' },
      { label: '图纸属性...', action: 'properties', icon: 'settings' },
    ],
  };
}

function onCanvasMenuSelect(action: string) {
  canvasMenu.value.visible = false;
  switch (action) {
    case 'import':
      triggerFileImport();
      break;
    case 'new':
      onAddDrawing();
      break;
    case 'zoom-fit':
      zoomFit();
      break;
    case 'zoom-100':
      zoomTo(1);
      break;
    case 'zoom-selection':
      zoomToSelection();
      break;
    case 'toggle-grid':
      gridEnabled.value = !gridEnabled.value;
      break;
    case 'toggle-snap':
      snapEnabled.value = !snapEnabled.value;
      break;
    case 'properties':
      openDrawingProperties();
      break;
  }
}

function triggerFileImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.dwg,.dxf';
  input.multiple = true;
  input.onchange = (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (files.length) importDrawings(files);
  };
  input.click();
}

function zoomFit() {
  // 通过 CanvasViewport 实例调用
  // TODO: 通过 ref 调用 canvasViewport.zoomFit()
}

function zoomTo(zoom: number) {
  // TODO
}

function zoomToSelection() {
  // TODO
}

function openDrawingProperties() {
  // TODO: 打开图纸属性对话框
}

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  // 全局快捷键
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'o':
        e.preventDefault();
        triggerFileImport();
        break;
      case 's':
        e.preventDefault();
        projectStore.saveProject();
        break;
      case 'n':
        e.preventDefault();
        onAddDrawing();
        break;
    }
  }

  // 视图模式切换
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    switch (e.key.toLowerCase()) {
      case '1':
        if (!e.shiftKey) { viewMode.value = 'design'; zoomTo(1); }
        else { zoomFit(); }
        break;
      case '2':
        if (e.shiftKey) { zoomToSelection(); }
        break;
      case 'v':
        viewMode.value = viewMode.value === 'fov' ? 'design' : 'fov';
        break;
      case 'w':
        viewMode.value = viewMode.value === 'wiring' ? 'design' : 'wiring';
        break;
      case 'g':
        gridEnabled.value = !gridEnabled.value;
        break;
      case 's':
        snapEnabled.value = !snapEnabled.value;
        break;
      case 'escape':
        projectStore.cancelWire();
        emit('device-selected', null);
        emit('wire-selected', null);
        emit('entity-selected', null);
        break;
    }
  }
}

function getViewModeLabel(mode: string) {
  const labels: Record<string, string> = {
    design: '设计',
    fov: '视场',
    wiring: '布线',
  };
  return labels[mode] || mode;
}

function getViewModeTitle(mode: string) {
  const titles: Record<string, string> = {
    design: '设计模式 (1: 100%, Shift+1: 缩放适应)',
    fov: '视场分析模式 (V: 切换)',
    wiring: '布线模式 (W: 切换)',
  };
  return titles[mode] || '';
}

// 监听活动图纸变化，确保标签可见
watch(() => projectStore.currentDrawingId, async (newId) => {
  await nextTick();
  tabsRef.value?.ensureTabVisible?.(newId);
});
</script>

<style scoped>
.drawing-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-secondary);
}

.canvas-area:has(.empty-state) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 40px;
}

.empty-state svg {
  opacity: 0.3;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}

.empty-state p {
  font-size: 13px;
  margin: 0;
  max-width: 300px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

.canvas-area.drag-over {
  background: rgba(59, 130, 246, 0.05);
  border: 2px dashed #3b82f6;
  border-radius: 8px;
}

.status-bar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-left { flex: 1; }
.status-center { flex: 1; justify-content: center; }
.status-right { flex: 1; justify-content: flex-end; }

.divider {
  color: var(--border-color);
}

.coord-display,
.zoom-display,
.entity-count,
.snap-status,
.grid-status,
.unit-display,
.view-mode {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
}

.snap-status.active,
.grid-status.active,
.view-mode.active {
  color: #3b82f6;
}

.snap-status:hover,
.grid-status:hover,
.view-mode:hover {
  color: var(--text-primary);
  cursor: pointer;
}
</style>