// 画布视图主组件
<template>
  <div class="canvas-view">
    <!-- 工具栏 -->
    <Toolbar
      :tool="tool"
      :viewport="viewport"
      :snap-enabled="snapEnabled"
      @tool-changed="setTool"
      @viewport-changed="onViewportChanged"
      @toggle-grid="toggleGrid"
      @toggle-ruler="toggleRuler"
      @toggle-snap="toggleSnap"
    />

    <div class="canvas-layout">
      <!-- 左侧边栏 -->
      <SidebarPanel
        v-model="activeTab"
        :collapsible="true"
        @collapse="onSidebarCollapse"
      />

      <!-- 中央画布区域 -->
      <div class="canvas-area" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <Canvas
          ref="canvasRef"
          :drawing-id="drawingId"
          @device-placed="onDevicePlaced"
          @device-moved="onDeviceMoved"
          @device-rotated="onDeviceRotated"
          @device-selected="onDeviceSelected"
          @cable-created="onCableCreated"
          @cable-updated="onCableUpdated"
          @well-created="onWellCreated"
          @tray-created="onTrayCreated"
          @viewport-changed="onCanvasViewportChanged"
        />

        <!-- 右侧浮动面板（属性/布线详情） -->
        <div v-if="selectedDeviceId || selectedCableId" class="floating-panel">
          <PropertyPanel
            v-if="selectedDeviceId"
            :device-id="selectedDeviceId"
            @close="clearSelection"
            @update="onDevicePropertyUpdate"
          />
          <WiringDetailPanel
            v-else-if="selectedCableId"
            :cable-id="selectedCableId"
            @close="clearSelection"
          />
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <StatusBar
      :viewport="viewport"
      :calibration="calibration"
      :selected-count="selectedCount"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import Toolbar from '@/components/common/Toolbar.vue';
import SidebarPanel from '@/components/layout/SidebarPanel.vue';
import Canvas from '@/components/canvas/Canvas.vue';
import PropertyPanel from '@/components/project/PropertyPanel.vue';
import WiringDetailPanel from '@/components/wiring/WiringDetailPanel.vue';
import StatusBar from '@/components/common/StatusBar.vue';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const drawingId = route.params.drawingId as string;
const canvasRef = ref<any>(null);

const tool = ref<'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well'>('select');
const activeTab = ref('devices');
const sidebarCollapsed = ref(false);
const selectedDeviceId = ref<string | null>(null);
const selectedCableId = ref<string | null>(null);
const selectedCount = ref(0);

const viewport = computed(() => projectStore.viewport);
const calibration = computed(() => projectStore.currentDrawing?.calibration || { isCalibrated: false, scale: 1 });
const snapEnabled = ref(settingsStore.snapEnabled);

onMounted(() => {
  // 同步项目存储的当前图纸
  if (drawingId) {
    projectStore.setCurrentDrawing(drawingId);
  }
});

function setTool(t: typeof tool.value) {
  tool.value = t;
  if (canvasRef.value) {
    canvasRef.value.setTool(t);
  }
}

function onSidebarCollapse(collapsed: boolean) {
  sidebarCollapsed.value = collapsed;
}

function onViewportChanged(vp: any) {
  projectStore.setViewport(vp);
}

function onCanvasViewportChanged(vp: any) {
  projectStore.setViewport(vp);
}

function onDevicePlaced(device: any) {
  projectStore.addDevice(device);
  selectedDeviceId.value = device.id;
  selectedCount.value = 1;
}

function onDeviceMoved(device: any) {
  projectStore.updateDevice(device.id, { position: device.position });
}

function onDeviceRotated(device: any) {
  projectStore.updateDevice(device.id, { rotation: device.rotation });
}

function onDeviceSelected(deviceIds: string[]) {
  selectedDeviceId.value = deviceIds[0] || null;
  selectedCableId.value = null;
  selectedCount.value = deviceIds.length;
}

function onCableCreated(cable: any) {
  selectedCableId.value = cable.id;
  selectedDeviceId.value = null;
  selectedCount.value = 1;
}

function onCableUpdated(cable: any) {
  projectStore.updateCable(cable.id, cable);
}

function onWellCreated(well: any) {
  // 已在 store 中添加
}

function onTrayCreated(tray: any) {
  // 已在 store 中添加
}

function onDevicePropertyUpdate(updates: any) {
  if (selectedDeviceId.value) {
    projectStore.updateDevice(selectedDeviceId.value, updates);
  }
}

function clearSelection() {
  selectedDeviceId.value = null;
  selectedCableId.value = null;
  selectedCount.value = 0;
}

function toggleGrid() {
  projectStore.setViewport({ showGrid: !viewport.value.showGrid });
}

function toggleRuler() {
  projectStore.setViewport({ showRuler: !viewport.value.showRuler });
}

function toggleSnap() {
  snapEnabled.value = !snapEnabled.value;
  settingsStore.snapEnabled = snapEnabled.value;
}
</script>

<style scoped>
.canvas-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.canvas-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: margin-left 0.2s;
}

.canvas-area.sidebar-collapsed {
  margin-left: -232px; /* 280 - 48 */
}

.floating-panel {
  position: absolute;
  top: 60px;
  right: 16px;
  width: 320px;
  max-height: calc(100% - 100px);
  z-index: 50;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (max-width: 1200px) {
  .floating-panel {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 50vh;
    border-radius: 16px 16px 0 0;
  }
}
</style>