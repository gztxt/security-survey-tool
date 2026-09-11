// Canvas 画布核心组件 - 负责渲染、交互、事件处理
<template>
  <div class="canvas-container" ref="container">
    <!-- 主 Canvas -->
    <canvas
      ref="mainCanvas"
      class="main-canvas"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @wheel.prevent="onWheel"
      @dblclick="onDblClick"
      @contextmenu.prevent="onContextMenu"
    ></canvas>

    <!-- 覆盖层 Canvas（用于悬停高亮、临时绘制） -->
    <canvas
      ref="overlayCanvas"
      class="overlay-canvas"
      @mousemove="onOverlayMouseMove"
      @mouseleave="onOverlayMouseLeave"
    ></canvas>

    <!-- 标尺 -->
    <div v-if="viewport.showRuler" class="ruler ruler-top" ref="rulerTop"></div>
    <div v-if="viewport.showRuler" class="ruler ruler-left" ref="rulerLeft"></div>

    <!-- 右键菜单 -->
    <ContextMenu
      v-model:visible="contextMenu.visible"
      :position="contextMenu.position"
      :items="contextMenu.items"
      @select="onContextMenuSelect"
    />

    <!-- 浮动工具栏 -->
    <div v-if="showFloatingToolbar" class="floating-toolbar" :style="floatingToolbarStyle">
      <button @click="setTool('select')" :class="{ active: tool === 'select' }" title="选择 (V)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          <path d="M13 13l6 6"/>
        </svg>
      </button>
      <button @click="setTool('pan')" :class="{ active: tool === 'pan' }" title="平移 (Space)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v0"/>
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/>
          <path d="M10 10.5a1.5 1.5 0 0 1-3 0"/>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.02 3.02a1 1 0 0 1-1.41 0l-1.58-1.58a1 1 0 0 1 0-1.41l3.02-3.02A8 8 0 1 1 18 8z"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <button @click="startDevicePlacement()" :class="{ active: tool === 'device' }" title="布点 (D)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      </button>
      <button @click="setTool('wire')" :class="{ active: tool === 'wire' }" title="布线 (W)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12h16"/>
          <path d="M12 4v16"/>
        </svg>
      </button>
      <button @click="setTool('tray')" :class="{ active: tool === 'tray' }" title="桥架 (T)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12h16M4 8h16M4 16h16"/>
        </svg>
      </button>
      <button @click="setTool('well')" :class="{ active: tool === 'well' }" title="弱电井 (Shift+W)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H7a2 2 0 0 1-2 2v10a2 2 0 0 1 2 2h10"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <button @click="zoomIn()" title="放大 (=)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
        </svg>
      </button>
      <button @click="zoomOut()" title="缩小 (-)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35M8 11h6"/>
        </svg>
      </button>
      <button @click="resetView()" title="重置视图 (0)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </button>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span>{{ formatCoordinate(hoverPosition) }}</span>
      </div>
      <div class="status-item">
        <span>{{ (viewport.zoom * 100).toFixed(0) }}%</span>
      </div>
      <div class="status-item" v-if="calibration.scale">
        <span>比例尺 1:{{ (1/calibration.scale).toFixed(0) }}</span>
      </div>
      <div class="status-item" v-if="selectedEntities.length">
        <span>{{ selectedEntities.length }} 个图元选中</span>
      </div>
      <div class="status-item" v-if="selectedDevices.length">
        <span>{{ selectedDevices.length }} 个设备选中</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import { useSettingsStore } from '@/stores/settings';
import ContextMenu from '@/components/common/ContextMenu.vue';
import { CadRenderer, createRenderer } from '@security-survey/cad-renderer';
import type { GraphicEntity, DeviceInstance, Cable, WeakPoint, CableTray, Point2D, ViewportState, CalibrationData } from '@security-survey/shared-types';

// Props
const props = defineProps<{
  drawingId?: string;
  drawing?: any;
  entities?: any[];
  devices?: any[];
  wires?: any[];
  viewMode?: 'design' | 'fov' | 'wiring';
  snapEnabled?: boolean;
  gridEnabled?: boolean;
}>();

const emit = defineEmits<{
  'device-placed': [device: DeviceInstance];
  'device-moved': [device: DeviceInstance];
  'device-rotated': [device: DeviceInstance];
  'device-selected': [deviceIds: string[]];
  'device-place': [device: any];
  'entity-select': [entity: any];
  'cable-created': [cable: Cable];
  'cable-updated': [cable: Cable];
  'well-created': [well: WeakPoint];
  'tray-created': [tray: CableTray];
  'viewport-changed': [viewport: ViewportState];
  'viewport-change': [viewport: ViewportState];
  'wire-start': [point: Point2D];
  'wire-end': [point: Point2D];
  'context-menu': [event: MouseEvent];
}>();

// Refs
const container = ref<HTMLDivElement>();
const mainCanvas = ref<HTMLCanvasElement>();
const overlayCanvas = ref<HTMLCanvasElement>();
const rulerTop = ref<HTMLDivElement>();
const rulerLeft = ref<HTMLDivElement>();

// Stores
const projectStore = useProjectStore();
const deviceLibraryStore = useDeviceLibraryStore();
const settingsStore = useSettingsStore();

// State
const renderer = ref<CadRenderer | null>(null);
const tool = ref<'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well' | 'zoom'>('select');
const viewport = ref<ViewportState>({
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  center: { x: 0, y: 0 },
  zoom: 1,
  showGrid: true,
  showRuler: true,
});

const calibration = ref<CalibrationData>({
  isCalibrated: false,
  point1: { x: 0, y: 0 },
  point2: { x: 0, y: 0 },
  realDistance: 0,
  scale: 1,
  unit: 'm',
});

const hoverPosition = ref<Point2D>({ x: 0, y: 0 });
const isPanning = ref(false);
const panStart = ref<Point2D>({ x: 0, y: 0 });
const selectionBox = ref<{ start: Point2D; end: Point2D } | null>(null);
const selectedEntities = ref<string[]>([]);
const selectedDevices = ref<string[]>([]);
const hoveredEntityId = ref<string | null>(null);
const hoveredDeviceId = ref<string | null>(null);
const contextMenu = ref({ visible: false, position: { x: 0, y: 0 }, items: [] as any[] });
const showFloatingToolbar = ref(true);
const floatingToolbarStyle = ref<Record<string, string>>({});

// 派生状态
const currentDrawing = computed(() => projectStore.currentDrawing);
const entities = computed(() => currentDrawing.value?.entities || []);
const devices = computed(() => currentDrawing.value?.devices || []);
const cables = computed(() => currentDrawing.value?.wiring?.cables || []);
const wells = computed(() => currentDrawing.value?.wiring?.weakPoints || []);
const trays = computed(() => currentDrawing.value?.wiring?.trays || []);
const layers = computed(() => currentDrawing.value?.layers || []);

// 临时绘制状态
const tempWirePath = ref<Point2D[]>([]);
const tempTrayPath = ref<Point2D[]>([]);
const wireStartId = ref<string | null>(null);

// 初始化
onMounted(async () => {
  await nextTick();

  if (mainCanvas.value) {
    renderer.value = createRenderer(mainCanvas.value);
    setupRenderer();
    syncViewport();
    startRenderLoop();
  }

  // 窗口大小变化
  window.addEventListener('resize', handleResize);

  // 键盘快捷键
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  stopRenderLoop();
});

// 渲染循环
let animationFrame: number;
function startRenderLoop() {
  const loop = () => {
    if (renderer.value) {
      renderer.value.render();
    }
    animationFrame = requestAnimationFrame(loop);
  };
  loop();
}

function stopRenderLoop() {
  cancelAnimationFrame(animationFrame);
}

function setupRenderer() {
  if (!renderer.value || !currentDrawing.value) return;

  renderer.value.setEntities(entities.value);
  renderer.value.setDevices(devices.value);
  renderer.value.setCables(cables.value);
  renderer.value.setWeakPoints(wells.value);
  renderer.value.setCableTrays(trays.value);

  // 图层可见性
  for (const layer of layers.value) {
    renderer.value!.setLayerVisibility(layer.name, layer.visible);
  }
}

function syncViewport() {
  if (currentDrawing.value?.viewport) {
    viewport.value = { ...currentDrawing.value.viewport };
  }
  if (currentDrawing.value?.calibration) {
    calibration.value = { ...currentDrawing.value.calibration };
  }
}

// 事件处理
function handleResize() {
  if (renderer.value) {
    renderer.value.resize();
  }
  updateRulers();
}

function onKeyDown(e: KeyboardEvent) {
  // 忽略输入框中的按键
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  switch (e.code) {
    case 'Space':
      if (tool.value !== 'pan') {
        tool.value = 'pan';
        document.body.style.cursor = 'grab';
      }
      break;
    case 'KeyV': tool.value = 'select'; break;
    case 'KeyD': if (!e.ctrlKey) tool.value = 'device'; break;
    case 'KeyW': if (!e.ctrlKey && !e.shiftKey) tool.value = 'wire'; break;
    case 'KeyT': tool.value = 'tray'; break;
    case 'KeyZ': if (e.ctrlKey) return; tool.value = 'zoom'; break;
    case 'Escape': stopPlacement(); break;
    case 'Delete': deleteSelected(); break;
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space' && tool.value === 'pan') {
    tool.value = 'select';
    document.body.style.cursor = 'default';
  }
}

function onMouseDown(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  const modelPos = screenToModel(pos);

  switch (tool.value) {
    case 'select':
      handleSelect(pos, modelPos, e);
      break;
    case 'pan':
      isPanning.value = true;
      panStart.value = pos;
      document.body.style.cursor = 'grabbing';
      break;
    case 'device':
      placeDevice(modelPos);
      break;
    case 'wire':
      startWire(modelPos);
      break;
    case 'tray':
      startTray(modelPos);
      break;
    case 'well':
      createWell(modelPos);
      break;
  }
}

function onMouseMove(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  hoverPosition.value = screenToModel(pos);

  if (isPanning.value) {
    const dx = pos.x - panStart.value.x;
    const dy = pos.y - panStart.value.y;
    panViewport(dx, dy);
    panStart.value = pos;
  } else if (tool.value === 'wire' && tempWirePath.value.length > 0) {
    // 更新临时线缆路径
    const lastPoint = tempWirePath.value[tempWirePath.value.length - 1];
    if (Math.hypot(hoverPosition.value.x - lastPoint.x, hoverPosition.value.y - lastPoint.y) > 5) {
      tempWirePath.value.push({ ...hoverPosition.value });
      renderOverlay();
    }
  } else if (tool.value === 'tray' && tempTrayPath.value.length > 0) {
    const lastPoint = tempTrayPath.value[tempTrayPath.value.length - 1];
    if (Math.hypot(hoverPosition.value.x - lastPoint.x, hoverPosition.value.y - lastPoint.y) > 5) {
      tempTrayPath.value.push({ ...hoverPosition.value });
      renderOverlay();
    }
  } else if (tool.value === 'select' && e.buttons === 1 && !selectionBox.value) {
    // 框选开始
    selectionBox.value = { start: pos, end: pos };
  } else if (selectionBox.value) {
    selectionBox.value.end = pos;
    renderOverlay();
  }
}

function onMouseUp(e: MouseEvent) {
  isPanning.value = false;
  document.body.style.cursor = 'default';

  if (selectionBox.value) {
    handleBoxSelection(selectionBox.value);
    selectionBox.value = null;
    renderOverlay();
  }
}

function onWheel(e: WheelEvent) {
  const pos = getCanvasPosition(e);
  const modelPos = screenToModel(pos);
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomAt(modelPos, factor);
}

function onDblClick(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  const modelPos = screenToModel(pos);
  const picked = pickEntity(pos);

  if (picked?.startsWith('device:')) {
    const deviceId = picked.split(':')[1];
    // 双击设备：编辑属性
    emit('device-selected', [deviceId]);
  } else if (picked?.startsWith('cable:')) {
    // 双击线缆：编辑折点
  }
}

function onContextMenu(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  const modelPos = screenToModel(pos);
  const picked = pickEntity(pos);

  const items: any[] = [];

  if (picked) {
    if (picked.startsWith('device:')) {
      const deviceId = picked.split(':')[1];
      items.push(
        { label: '编辑属性', action: 'edit-device', data: deviceId },
        { label: '替换型号', action: 'replace-device', data: deviceId },
        { label: '复制', action: 'copy-device', data: deviceId },
        { label: '删除', action: 'delete-device', data: deviceId, danger: true },
        { type: 'separator' },
        { label: '显示视野', action: 'toggle-fov', data: deviceId },
      );
    } else if (picked.startsWith('cable:')) {
      items.push(
        { label: '编辑路径', action: 'edit-cable', data: picked.split(':')[1] },
        { label: '修改类型', action: 'change-cable-type', data: picked.split(':')[1] },
        { label: '删除', action: 'delete-cable', data: picked.split(':')[1], danger: true },
      );
    } else if (picked.startsWith('well:')) {
      items.push(
        { label: '编辑', action: 'edit-well', data: picked.split(':')[1] },
        { label: '删除', action: 'delete-well', data: picked.split(':')[1], danger: true },
      );
    } else if (picked.startsWith('entity:')) {
      items.push(
        { label: '图元信息', action: 'entity-info', data: picked.split(':')[1] },
      );
    }
  } else {
    // 空白处右键
    items.push(
      { label: '粘贴', action: 'paste', disabled: !clipboardHasContent() },
      { type: 'separator' },
      { label: '校准比例尺', action: 'calibrate' },
      { label: '图层管理', action: 'layers' },
      { label: '视图设置', action: 'view-settings' },
    );
  }

  contextMenu.value = {
    visible: true,
    position: { x: e.clientX, y: e.clientY },
    items,
  };
}

function onContextMenuSelect(action: string, data: any) {
  contextMenu.value.visible = false;
  handleContextAction(action, data);
}

function onOverlayMouseMove(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  hoverPosition.value = screenToModel(pos);
}

function onOverlayMouseLeave() {
  // 清除悬停高亮
  renderer.value?.setHoveredEntity(null);
  renderer.value?.setHoveredDevice(null);
}

// 工具动作
function setTool(t: typeof tool.value) {
  tool.value = t;
  stopPlacement();
}

function startDevicePlacement() {
  if (deviceLibraryStore.selectedDeviceId) {
    tool.value = 'device';
  } else {
    // 打开设备库面板
  }
}

function stopPlacement() {
  tool.value = 'select';
  tempWirePath.value = [];
  tempTrayPath.value = [];
  wireStartId.value = null;
  renderOverlay();
}

function placeDevice(modelPos: Point2D) {
  if (!deviceLibraryStore.selectedDeviceId || !currentDrawing.value) return;

  const model = deviceLibraryStore.allDevices.find(d => d.id === deviceLibraryStore.selectedDeviceId);
  if (!model) return;

  const device: DeviceInstance = {
    id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    drawingId: currentDrawing.value.id,
    modelId: model.id,
    position: snapPoint(modelPos),
    rotation: 0,
    label: `${model.category.charAt(0).toUpperCase()}${(devices.value.filter(d => d.modelId === model.id).length + 1).toString().padStart(3, '0')}`,
    remarks: '',
    customSpecs: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  projectStore.addDevice(device);
  emit('device-placed', device);
  projectStore.pushHistory({ type: 'add-device', deviceId: device.id });
}

function startWire(modelPos: Point2D) {
  const picked = pickEntity(getCanvasPositionFromModel(modelPos));
  if (picked?.startsWith('device:') || picked?.startsWith('well:')) {
    const startId = picked.split(':')[1];
    wireStartId.value = startId;
    tempWirePath.value = [modelPos];
    tool.value = 'wire';
  }
}

function finishWire(modelPos: Point2D) {
  if (!wireStartId.value || tempWirePath.value.length === 0) return;

  const picked = pickEntity(getCanvasPositionFromModel(modelPos));
  let endId = wireStartId.value;

  if (picked?.startsWith('device:') || picked?.startsWith('well:')) {
    endId = picked.split(':')[1];
  }

  if (endId !== wireStartId.value) {
    const cable = projectStore.manualWire(wireStartId.value, endId, tempWirePath.value.slice(1), 'cat6');
    if (cable) {
      emit('cable-created', cable);
      projectStore.pushHistory({ type: 'add-cable', cableId: cable.id });
    }
  }

  stopPlacement();
}

function startTray(modelPos: Point2D) {
  tempTrayPath.value = [modelPos];
  tool.value = 'tray';
}

function finishTray(modelPos: Point2D) {
  if (tempTrayPath.value.length < 2) return;

  const tray: CableTray = {
    id: `tray-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    path: [...tempTrayPath.value, modelPos],
    width: 200,
    height: 100,
    type: 'ladder',
    layers: 1,
  };

  projectStore.addTray(tray);
  emit('tray-created', tray);
  projectStore.pushHistory({ type: 'add-tray', trayId: tray.id });
  stopPlacement();
}

function createWell(modelPos: Point2D) {
  const well: WeakPoint = {
    id: `well-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    position: snapPoint(modelPos),
    name: `${wells.value.length + 1}#弱电井`,
    type: 'floor',
    devices: [],
    notes: '',
  };

  projectStore.addWell(well);
  emit('well-created', well);
  projectStore.pushHistory({ type: 'add-well', wellId: well.id });
  stopPlacement();
}

// 选择处理
function handleSelect(pos: Point2D, modelPos: Point2D, e: MouseEvent) {
  const picked = pickEntity(pos);

  if (e.ctrlKey || e.metaKey) {
    // 多选
    if (picked) {
      if (picked.startsWith('device:')) {
        const id = picked.split(':')[1];
        if (selectedDevices.value.includes(id)) {
          selectedDevices.value = selectedDevices.value.filter(d => d !== id);
        } else {
          selectedDevices.value.push(id);
        }
      } else if (picked.startsWith('entity:')) {
        const id = picked.split(':')[1];
        if (selectedEntities.value.includes(id)) {
          selectedEntities.value = selectedEntities.value.filter(d => d !== id);
        } else {
          selectedEntities.value.push(id);
        }
      }
    }
  } else {
    // 单选
    selectedEntities.value = [];
    selectedDevices.value = [];

    if (picked) {
      if (picked.startsWith('device:')) {
        selectedDevices.value = [picked.split(':')[1]];
        emit('device-selected', selectedDevices.value);
      } else if (picked.startsWith('entity:')) {
        selectedEntities.value = [picked.split(':')[1]];
      }
    }
  }

  renderer.value?.setSelectedEntities(new Set(selectedEntities.value));
  renderer.value?.setSelectedDevices(new Set(selectedDevices.value));
  renderer.value?.setHoveredEntity(hoveredEntityId.value);
  renderer.value?.setHoveredDevice(hoveredDeviceId.value);
}

function handleBoxSelection(box: { start: Point2D; end: Point2D }) {
  const minX = Math.min(box.start.x, box.end.x);
  const maxX = Math.max(box.start.x, box.end.x);
  const minY = Math.min(box.start.y, box.end.y);
  const maxY = Math.max(box.start.y, box.end.y);

  // 转换为模型坐标
  const modelStart = screenToModel({ x: minX, y: minY });
  const modelEnd = screenToModel({ x: maxX, y: maxY });

  const bbox = {
    minX: Math.min(modelStart.x, modelEnd.x),
    maxX: Math.max(modelStart.x, modelEnd.x),
    minY: Math.min(modelStart.y, modelEnd.y),
    maxY: Math.max(modelStart.y, modelEnd.y),
  };

  // 选中范围内的设备
  const newSelectedDevices = devices.value
    .filter(d => d.position.x >= bbox.minX && d.position.x <= bbox.maxX &&
                 d.position.y >= bbox.minY && d.position.y <= bbox.maxY)
    .map(d => d.id);

  selectedDevices.value = newSelectedDevices;
  emit('device-selected', selectedDevices.value);

  renderer.value?.setSelectedDevices(new Set(selectedDevices.value));
}

function deleteSelected() {
  for (const id of selectedDevices.value) {
    projectStore.removeDevice(id);
    projectStore.pushHistory({ type: 'delete-device', deviceId: id });
  }
  for (const id of selectedEntities.value) {
    // 删除图元（如果支持）
  }
  selectedDevices.value = [];
  selectedEntities.value = [];
  emit('device-selected', []);
  renderer.value?.setSelectedDevices(new Set());
  renderer.value?.setSelectedEntities(new Set());
}

// 视口操作
function panViewport(dx: number, dy: number) {
  viewport.value.transform.e -= dx / viewport.value.zoom;
  viewport.value.transform.f -= dy / viewport.value.zoom;
  viewport.value.center.x += dx / viewport.value.zoom;
  viewport.value.center.y += dy / viewport.value.zoom;
  renderer.value?.setViewport(viewport.value);
  emit('viewport-changed', viewport.value);
}

function zoomAt(modelPos: Point2D, factor: number) {
  const newZoom = Math.max(0.01, Math.min(100, viewport.value.zoom * factor));

  // 以鼠标位置为中心缩放
  const screenPos = modelToScreen(modelPos);
  const center = viewport.value.center;

  viewport.value.transform.a *= factor;
  viewport.value.transform.d *= factor;
  viewport.value.zoom = newZoom;

  // 调整平移以保持鼠标位置不变
  const newScreenPos = modelToScreen(modelPos);
  viewport.value.transform.e += (screenPos.x - newScreenPos.x);
  viewport.value.transform.f += (screenPos.y - newScreenPos.y);

  renderer.value?.setViewport(viewport.value);
  emit('viewport-changed', viewport.value);
  updateRulers();
}

function zoomIn() { zoomAt(viewport.value.center, 1.2); }
function zoomOut() { zoomAt(viewport.value.center, 1/1.2); }
function resetView() {
  viewport.value = {
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    center: { x: 0, y: 0 },
    zoom: 1,
    showGrid: true,
    showRuler: true,
  };
  if (currentDrawing.value) {
    const bounds = calculateDrawingBounds();
    viewport.value.center = { x: bounds.minX + bounds.width/2, y: bounds.minY + bounds.height/2 };
  }
  renderer.value?.setViewport(viewport.value);
  emit('viewport-changed', viewport.value);
  updateRulers();
}

// 坐标转换
function getCanvasPosition(e: MouseEvent): Point2D {
  const rect = mainCanvas.value!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getCanvasPositionFromModel(modelPos: Point2D): Point2D {
  return modelToScreen(modelPos);
}

function screenToModel(screen: Point2D): Point2D {
  const { transform } = viewport.value;
  const det = transform.a * transform.d - transform.b * transform.c;
  if (Math.abs(det) < 1e-10) return { x: 0, y: 0 };
  return {
    x: (transform.d * (screen.x - transform.e) - transform.b * (screen.y - transform.f)) / det,
    y: (-transform.c * (screen.x - transform.e) + transform.a * (screen.y - transform.f)) / det,
  };
}

function modelToScreen(model: Point2D): Point2D {
  const { transform } = viewport.value;
  return {
    x: transform.a * model.x + transform.c * model.y + transform.e,
    y: transform.b * model.x + transform.d * model.y + transform.f,
  };
}

// 吸附
function snapPoint(pos: Point2D): Point2D {
  if (!settingsStore.snapEnabled) return pos;
  const size = settingsStore.gridSize;
  return {
    x: Math.round(pos.x / size) * size,
    y: Math.round(pos.y / size) * size,
  };
}

// 拾取
function pickEntity(screenPos: Point2D): string | null {
  // 优先拾取业务对象
  for (const device of devices.value) {
    const screen = modelToScreen(device.position);
    const dist = Math.hypot(screen.x - screenPos.x, screen.y - screenPos.y);
    if (dist < 20 / viewport.value.zoom) return `device:${device.id}`;
  }

  for (const cable of cables.value) {
    for (let i = 1; i < cable.path.length; i++) {
      const screen1 = modelToScreen(cable.path[i-1]);
      const screen2 = modelToScreen(cable.path[i]);
      if (pointToSegmentDistance(screenPos, screen1, screen2) < 10 / viewport.value.zoom) {
        return `cable:${cable.id}`;
      }
    }
  }

  for (const well of wells.value) {
    const screen = modelToScreen(well.position);
    const dist = Math.hypot(screen.x - screenPos.x, screen.y - screenPos.y);
    if (dist < 20 / viewport.value.zoom) return `well:${well.id}`;
  }

  // 拾取 CAD 图元
  if (renderer.value) {
    const entityId = renderer.value.pickEntity(screenPos.x, screenPos.y);
    if (entityId) return `entity:${entityId}`;
  }

  return null;
}

function pointToSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

// 覆盖层渲染
function renderOverlay() {
  if (!overlayCanvas.value) return;
  const ctx = overlayCanvas.value.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = overlayCanvas.value.getBoundingClientRect();
  overlayCanvas.value.width = rect.width * dpr;
  overlayCanvas.value.height = rect.height * dpr;
  overlayCanvas.value.style.width = `${rect.width}px`;
  overlayCanvas.value.style.height = `${rect.height}px`;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, rect.width, rect.height);

  // 绘制选择框
  if (selectionBox.value) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      selectionBox.value.start.x,
      selectionBox.value.start.y,
      selectionBox.value.end.x - selectionBox.value.start.x,
      selectionBox.value.end.y - selectionBox.value.start.y
    );
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(
      selectionBox.value.start.x,
      selectionBox.value.start.y,
      selectionBox.value.end.x - selectionBox.value.start.x,
      selectionBox.value.end.y - selectionBox.value.start.y
    );
    ctx.setLineDash([]);
  }

  // 绘制临时线缆
  if (tempWirePath.value.length > 0) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const screenStart = modelToScreen(tempWirePath.value[0]);
    ctx.moveTo(screenStart.x, screenStart.y);
    for (let i = 1; i < tempWirePath.value.length; i++) {
      const s = modelToScreen(tempWirePath.value[i]);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 绘制临时桥架
  if (tempTrayPath.value.length > 0) {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    const screenStart = modelToScreen(tempTrayPath.value[0]);
    ctx.moveTo(screenStart.x, screenStart.y);
    for (let i = 1; i < tempTrayPath.value.length; i++) {
      const s = modelToScreen(tempTrayPath.value[i]);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// 标尺更新
function updateRulers() {
  if (!rulerTop.value || !rulerLeft.value || !currentDrawing.value?.calibration?.isCalibrated) return;

  const scale = currentDrawing.value.calibration.scale;
  const viewportBounds = getViewportBounds();

  // 顶部标尺
  rulerTop.value.innerHTML = '';
  const startX = Math.floor(viewportBounds.minX / 1000) * 1000;
  for (let x = startX; x <= viewportBounds.maxX; x += 1000) {
    const screenX = modelToScreen({ x, y: 0 }).x;
    if (screenX >= 0 && screenX <= rulerTop.value.clientWidth) {
      const mark = document.createElement('div');
      mark.className = 'ruler-mark';
      mark.style.left = `${screenX}px`;
      mark.textContent = `${(x * scale).toFixed(0)}`;
      rulerTop.value.appendChild(mark);
    }
  }

  // 左侧标尺
  rulerLeft.value.innerHTML = '';
  const startY = Math.floor(viewportBounds.minY / 1000) * 1000;
  for (let y = startY; y <= viewportBounds.maxY; y += 1000) {
    const screenY = modelToScreen({ x: 0, y }).y;
    if (screenY >= 0 && screenY <= rulerLeft.value.clientHeight) {
      const mark = document.createElement('div');
      mark.className = 'ruler-mark';
      mark.style.top = `${screenY}px`;
      mark.textContent = `${(y * scale).toFixed(0)}`;
      rulerLeft.value.appendChild(mark);
    }
  }
}

function getViewportBounds() {
  const { transform, center, zoom } = viewport.value;
  const canvasWidth = mainCanvas.value?.width / (window.devicePixelRatio || 1) / zoom || 1400;
  const canvasHeight = mainCanvas.value?.height / (window.devicePixelRatio || 1) / zoom || 900;
  return {
    minX: center.x - canvasWidth / 2,
    maxX: center.x + canvasWidth / 2,
    minY: center.y - canvasHeight / 2,
    maxY: center.y + canvasHeight / 2,
  };
}

function calculateDrawingBounds() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const entity of entities.value) {
    minX = Math.min(minX, entity.bounds.minX);
    maxX = Math.max(maxX, entity.bounds.maxX);
    minY = Math.min(minY, entity.bounds.minY);
    maxY = Math.max(maxY, entity.bounds.maxY);
  }
  if (minX === Infinity) return { minX: 0, maxX: 10000, minY: 0, maxY: 10000, width: 10000, height: 10000 };
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

// 右键菜单动作
function handleContextAction(action: string, data: any) {
  switch (action) {
    case 'edit-device':
      // 打开设备属性编辑弹窗
      break;
    case 'replace-device':
      // 打开替换型号对话框
      break;
    case 'copy-device':
      copyDevice(data);
      break;
    case 'delete-device':
      projectStore.removeDevice(data);
      projectStore.pushHistory({ type: 'delete-device', deviceId: data });
      selectedDevices.value = [];
      emit('device-selected', []);
      break;
    case 'toggle-fov':
      // 切换视野显示
      break;
    case 'edit-cable':
      // 进入线缆编辑模式
      break;
    case 'change-cable-type':
      // 修改线缆类型
      break;
    case 'delete-cable':
      projectStore.removeCable(data);
      projectStore.pushHistory({ type: 'delete-cable', cableId: data });
      break;
    case 'edit-well':
      break;
    case 'delete-well':
      // 删除弱电井
      break;
    case 'calibrate':
      // 打开校准对话框
      break;
    case 'layers':
      // 打开图层管理
      break;
    case 'view-settings':
      break;
    case 'paste':
      pasteFromClipboard();
      break;
    case 'entity-info':
      break;
  }
}

function copyDevice(deviceId: string) {
  const device = devices.value.find(d => d.id === deviceId);
  if (device) {
    // 存入剪贴板
    navigator.clipboard.writeText(JSON.stringify(device));
  }
}

function pasteFromClipboard() {
  navigator.clipboard.readText().then(text => {
    try {
      const device = JSON.parse(text);
      const newDevice: DeviceInstance = {
        ...device,
        id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        position: { x: device.position.x + 500, y: device.position.y + 500 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      projectStore.addDevice(newDevice);
      projectStore.pushHistory({ type: 'add-device', deviceId: newDevice.id });
    } catch { }
  });
}

function clipboardHasContent(): boolean {
  return true; // 简化
}

// 格式化坐标显示
function formatCoordinate(pos: Point2D): string {
  if (!calibration.value.isCalibrated) {
    return `X: ${pos.x.toFixed(0)}, Y: ${pos.y.toFixed(0)}`;
  }
  const scale = calibration.value.scale;
  const unit = calibration.value.unit;
  const realX = pos.x * scale;
  const realY = pos.y * scale;
  return `${unit.toUpperCase()}: X=${realX.toFixed(2)}, Y=${realY.toFixed(2)}`;
}

// 监听绘图变化
watch(() => currentDrawing.value, (newDrawing) => {
  if (newDrawing) {
    setupRenderer();
    syncViewport();
  }
}, { deep: true });

watch(() => devices.value, () => {
  renderer.value?.setDevices(devices.value);
}, { deep: true });

watch(() => cables.value, () => {
  renderer.value?.setCables(cables.value);
}, { deep: true });

watch(() => wells.value, () => {
  renderer.value?.setWeakPoints(wells.value);
}, { deep: true });

watch(() => trays.value, () => {
  renderer.value?.setCableTrays(trays.value);
}, { deep: true });

watch(() => viewport.value, () => {
  if (currentDrawing.value) {
    currentDrawing.value.viewport = { ...viewport.value };
    projectStore.markDirty();
  }
  updateRulers();
}, { deep: true });

// ============ 对外暴露 ============

defineExpose({
  /** 获取主画布元素（用于导出快照） */
  getMainCanvas: () => mainCanvas.value,
  /** 捕获当前画布快照 dataURL（PNG） */
  captureSnapshot: (): string | null => {
    try {
      return mainCanvas.value ? mainCanvas.value.toDataURL('image/png') : null;
    } catch {
      return null;
    }
  },
});
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--canvas-bg, #fafafa);
}

.main-canvas,
.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.main-canvas {
  z-index: 1;
  cursor: crosshair;
}

.overlay-canvas {
  z-index: 2;
  pointer-events: none;
}

.ruler {
  position: absolute;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  z-index: 10;
  font-size: 10px;
  color: var(--text-secondary);
  user-select: none;
}

.ruler-top {
  top: 0;
  left: 24px;
  right: 0;
  height: 24px;
  display: flex;
  align-items: flex-end;
  padding-bottom: 2px;
}

.ruler-left {
  top: 24px;
  bottom: 28px;
  left: 0;
  width: 24px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-right: 2px;
}

.ruler-mark {
  position: absolute;
  font-size: 9px;
  color: var(--text-tertiary);
}

.ruler-top .ruler-mark {
  bottom: 2px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.ruler-left .ruler-mark {
  right: 2px;
  transform: translateY(50%);
  white-space: nowrap;
}

.floating-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.floating-toolbar button {
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

.floating-toolbar button:hover {
  background: var(--bg-tertiary);
}

.floating-toolbar button.active {
  background: #3b82f6;
  color: white;
}

.floating-toolbar button.active:hover {
  background: #2563eb;
}

.toolbar-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.status-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  z-index: 10;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  padding: 4px 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: var(--bg-tertiary);
}

.context-menu-item.danger {
  color: #ef4444;
}

.context-menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.context-menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}
</style>