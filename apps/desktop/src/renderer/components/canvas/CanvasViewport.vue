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
      @dragover="onCanvasDragOver"
      @drop.prevent="onCanvasDrop"
    ></canvas>

    <!-- 覆盖层 Canvas（用于悬停高亮、临时绘制） -->
    <canvas
      ref="overlayCanvas"
      class="overlay-canvas"
      @mousemove="onOverlayMouseMove"
      @mouseleave="onOverlayMouseLeave"
      @dragover="onCanvasDragOver"
      @drop.prevent="onCanvasDrop"
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
      <div class="status-item is-hint" v-if="wireHint">
        <span>{{ wireHint }}</span>
      </div>
      <div class="status-item is-hint" v-else-if="tool === 'wire' && wireStartId">
        <span>布线中：点击加折点 · 点击目标设备完成 · Enter 结束 · Esc 取消</span>
      </div>
      <div class="status-item is-hint" v-else-if="tool === 'tray' && tempTrayPath.length">
        <span>桥架中：点击加折点 · 双击或 Enter 结束 · Esc 取消</span>
      </div>
      <div class="status-item is-hint" v-else-if="tool === 'wire'">
        <span>点击起点设备开始布线</span>
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
import { modelUnitsToMeters } from '@security-survey/shared-types';
import { useUiStore } from '@/stores/ui';

// Props
const props = defineProps<{
  drawingId?: string;
  drawing?: any;
  entities?: any[];
  devices?: any[];
  wires?: any[];
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
const uiStore = useUiStore();
const deviceLibraryStore = useDeviceLibraryStore();
const settingsStore = useSettingsStore();

// State
const renderer = ref<CadRenderer | null>(null);
/**
 * 当前工具：真值在 uiStore.activeTool（工具栏按钮、「高级功能」菜单、快捷键、
 * 侧栏「绘制桥架」按钮都必须落到同一个状态）。
 * 此前这里是个组件私有 ref：键盘 T/W/V 改的是它、工具栏高亮读的是 uiStore，
 * 于是"按键盘换了工具但工具栏仍高亮旧工具"，且侧栏根本没有办法让画布进
 * 桥架模式（WiringPanel.startTrayDrawing 是个空函数 ⇒ 按钮点了没反应）。
 * 现在用 computed 双向代理，私有 state 撤掉，杜绝两处各说各话。
 */
type CanvasTool = 'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well' | 'zoom';
const CANVAS_TOOLS: CanvasTool[] = ['select', 'pan', 'device', 'wire', 'tray', 'well', 'zoom'];
const tool = computed<CanvasTool>({
  get: () => (uiStore.activeTool as CanvasTool) ?? 'select',
  set: (v) => { if (CANVAS_TOOLS.includes(v)) uiStore.setTool(v as any); },
});
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
/**
 * 设备拖拽态：按下时命中设备 ⇒ 记录被拖 id、按下处的模型坐标、按下前的选中集。
 * 未发生位移时按"点击选择"处理（保持原语义）；发生位移则整组随动。
 */
const deviceDrag = ref<{
  ids: string[];
  startModel: Point2D;
  moved: boolean;
} | null>(null);
const isPanning = ref(false);
const panStart = ref<Point2D>({ x: 0, y: 0 });
/** 本次拖拽开始时的位置快照，拖完作为一步历史压栈 */
const dragBefore = ref<Record<string, Point2D>>({});
const selectionBox = ref<{ start: Point2D; end: Point2D; additive: boolean; subtract: boolean } | null>(null);
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
/** 布线/桥架拖拽中的预览点（橡皮筋终点，跟随鼠标） */
const wirePreview = ref<Point2D | null>(null);
const trayPreview = ref<Point2D | null>(null);
/** 当前悬停可吸附目标（device:xx / well:xx），布线中高亮提示 */
const wireSnapTarget = ref<string | null>(null);
/** 布线交互提示文案（状态栏展示） */
const wireHint = ref<string | null>(null);

// 初始化
onMounted(async () => {
  await nextTick();

  if (mainCanvas.value) {
    renderer.value = createRenderer(mainCanvas.value);
    setupRenderer();
    // syncViewport 内部会在回填后推导默认视图（applyFreshDefault），
    // 挂载与后续每次内容变更走的是同一条路，视图不会被"回跳"打掉。
    syncViewport();
    startRenderLoop();
  }

  // 窗口大小变化
  window.addEventListener('resize', handleResize);

  // 键盘快捷键
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Ctrl+A 全选：把实现注册给 GlobalKeys（画布不在场时该键不生效）
  uiStore.setCanvasSelectAll(selectAll);
  // 画布外松手也要收尾：拖设备/框选时手指常移出画布（侧栏、状态栏方向），
  // 只绑在 canvas 上会让拖拽态卡住 —— 之后每次鼠标移动都继续搬设备。
  // onMouseUp 自身幂等（收尾后状态已清），重复触发无副作用。
  window.addEventListener('mouseup', onMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('mouseup', onMouseUp);
  uiStore.setCanvasSelectAll(null);
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

/** deviceId → 品类映射（从设备库解析 modelId），渲染器据此画摄像头/交换机/机柜差异图形 */
function buildDeviceCategoryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const dev of devices.value) {
    const model = deviceLibraryStore.allDevices.find(d => d.id === dev.modelId);
    if (model?.category) map.set(dev.id, model.category);
  }
  return map;
}

function setupRenderer() {
  if (!renderer.value || !currentDrawing.value) return;
  renderer.value.setEntities(entities.value);
  renderer.value.setDevices(devices.value);
  renderer.value.setDeviceCategories(buildDeviceCategoryMap());
  renderer.value.setCables(cables.value);
  renderer.value.setWeakPoints(wells.value);
  renderer.value.setCableTrays(trays.value);

  // 位图底图：把 IMAGE 图元的 dataURL 预注册到渲染缓存（图片 onload 后由 60fps 渲染循环自动绘制）
  for (const entity of entities.value) {
    if (entity.type === 'IMAGE') {
      const imgData = entity.data as any;
      if (imgData?.imagePath) {
        renderer.value!.registerImage(imgData.imagePath, imgData.imagePath);
      }
    }
  }

  // 图层可见性
  for (const layer of layers.value) {
    renderer.value!.setLayerVisibility(layer.name, layer.visible);
  }
}

/**
 * 视口双向同步守卫：
 * drawing(deep watcher) → syncViewport → viewport(deep watcher) → 写回 drawing → …
 * 拷贝越"干净"（新对象）越容易成环，故用标志位单向放行一次。
 */
let syncingViewport = false;

function syncViewport() {
  const vp = currentDrawing.value?.viewport;
  const cal = currentDrawing.value?.calibration;
  if (!vp && !cal) return;
  syncingViewport = true;
  if (vp) {
    viewport.value = {
      transform: { ...vp.transform },
      center: { ...vp.center },
      zoom: vp.zoom,
      showGrid: vp.showGrid,
      showRuler: vp.showRuler,
    };
    renderer.value?.setViewport(viewport.value);
  }
  if (cal) {
    calibration.value = { ...cal, point1: { ...cal.point1 }, point2: { ...cal.point2 } };
  }
  // 回填之后必须再判一次"默认视图"：本组件对 currentDrawing 是 deep watch，
  // 放设备/连线等任何内容变化都会走到这里，把视图打回图纸里存的
  // identity —— 真实 AppImage 实测第二次布点点在（按 0.1 缩放换算的）
  // (2000,930) 处、落库却成 (1000,0)，就是这个回跳把点击映射换掉了。
  applyFreshDefault();
  // 等本轮 watcher 队列冲刷完再放开
  queueMicrotask(() => { syncingViewport = false; });
}

// 事件处理
function handleResize() {
  if (renderer.value) {
    renderer.value.resize();
  }
  updateRulers();
}

/**
 * 新图纸的默认视口：单位阵 + zoom 1 意味着世界原点贴在画布左上角，
 * 且画布只显示 ±500mm（世界单位是毫米，标尺 x/1000=米）——不足一个 1m
 * 吸附格（settings.gridSize=1000）：第一台设备无论点哪儿都被吸附到
 * (0,0)/(1000,0)，第二台落点又吸附进同一格 ⇒ 真实 AppImage 实测
 * "布点看似无反应/两台重叠"（命中测试与状态栏取点取证）。
 * 挂载时把"从未动过视图"的图纸居中并把缩放定为 0.1：1 个网格 = 100px、
 * 画布可见约 11m×6m（房间尺度），设备图标按 DEVICE_ICON_SIZE/zoom 绘制、
 * 屏幕上恒为 24px，不受影响。
 * 判据必须是全默认（a/b/c/d/e/f + center + zoom），否则用户手工调回
 * 原状的图纸会被再次强行重置。
 * 不 emit、不写库：视图默认值是"随窗口尺寸而定的呈现态"，不是用户编辑，
 * 落库会误亮"未保存"徽章（store.setViewport 必然 markDirty），窗口改大
 * 之后还会过期。因此由挂载与每次 syncViewport 回填后重新推导，保持
 * 画面与"图纸从未存过视图"这一事实自洽。
 */
function applyFreshDefault() {
  const el = container.value || mainCanvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const vp = viewport.value;
  const t = vp.transform;
  const untouched =
    t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0 &&
    vp.zoom === 1 && vp.center.x === 0 && vp.center.y === 0;
  if (!untouched) return;
  const z = 0.1;
  viewport.value = {
    ...vp,
    transform: { a: z, b: 0, c: 0, d: z, e: rect.width / 2, f: rect.height / 2 },
    center: { x: 0, y: 0 },
    zoom: z,
  };
  renderer.value?.setViewport(viewport.value);
  updateRulers();
}

function onKeyDown(e: KeyboardEvent) {
  // 忽略输入框中的按键
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  // 空格/回车属于"激活控件"语义：工具栏按钮获得焦点后（点击即聚焦），
  // 再按空格/回车会既触发按钮 click、又被这里解释成抓手/完成桥架。
  // 交互元素上的这类按键让给元素本身。
  // t 未必是元素：测试直接向 window 派发时 target 就是 window，无 closest 方法。
  const t = e.target as Element | null;
  const onInteractive = !!(t && typeof t.closest === 'function'
    && t.closest('button, a[href], [role="button"], [role="tab"], select'));
  if (onInteractive && (e.code === 'Space' || e.code === 'Enter')) return;
  // 撤销 / 重做：画布聚焦时生效（与项目级快捷键分工，避免与输入冲突）
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      projectStore.undo();
      return;
    }
    if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault();
      projectStore.redo();
      return;
    }
    // 放大/缩小（帮助表宣称 Ctrl+= / Ctrl+-；= 与 + 同键）
    if (!e.shiftKey && (e.key === '=' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
      if (e.key === '-') zoomOut(); else zoomIn();
      return;
    }
  }

  // 带修饰键的组合（Ctrl/Alt/Meta）交给上层：Ctrl+T 新建图纸、Ctrl+W 关闭
  // 图纸、Ctrl+S 保存等。此前 KeyV / KeyT 未判修饰键 ⇒ 按 Ctrl+T 会同时
  // "新建图纸"和"切到桥架工具"，按 Ctrl+V 会静默改掉当前工具。
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.code) {
    case 'Space':
      if (tool.value !== 'pan') {
        tool.value = 'pan';
        document.body.style.cursor = 'grab';
      }
      break;
    case 'KeyV': tool.value = 'select'; break;
    case 'KeyD': if (!e.ctrlKey) tool.value = 'device'; break;
    // W 布线 / Shift+W 弱电井（按钮 title 与帮助表均宣称 Shift+W，此前无人注册）；
    // T 桥架 / Shift+T 同义（宣称 Shift+T，裸 T 是其别名，二者动作一致无冲突）。
    case 'KeyW': tool.value = e.shiftKey ? 'well' : 'wire'; break;
    case 'KeyT': tool.value = 'tray'; break;
    case 'KeyZ': if (e.ctrlKey) return; tool.value = 'zoom'; break;
    case 'Escape':
      // 帮助表宣称 Escape = "取消/退出模式：退出放置、布线、选择模式"。
      // 此前只退工具不清选中：有选中集时按 Esc 毫无反应，且正在布线时
      // 临时路径也没清（要再按一次先切 select 再退）。一次 Esc 收全：
      // 取消布线临时线、清空选中、回到选择工具。
      if (wireStartId.value || tempWirePath.value.length) projectStore.cancelWire();
      exitToolMode();
      if (selectedDevices.value.length || selectedEntities.value.length) {
        clearSelection();
      }
      break;
    case 'Enter':
      if (tool.value === 'tray' && tempTrayPath.value.length >= 2) finishTray(hoverPosition.value);
      break;
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

  // 中键拖拽平移（帮助表宣称"中键拖拽 = 平移画布"，此前未接线）：
  // 与当前工具无关，任何模式下都可按中键搬画布。
  if (e.button === 1) {
    isPanning.value = true;
    panStart.value = pos;
    document.body.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }

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
      handleWireClick(pos, modelPos);
      break;
    case 'tray':
      handleTrayClick(modelPos);
      break;
    case 'well':
      createWell(modelPos);
      break;
  }
}

function onMouseMove(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  hoverPosition.value = screenToModel(pos);

  if (deviceDrag.value) {
    const cur = hoverPosition.value;
    const start = deviceDrag.value.startModel;
    // 3px（模型坐标按当前缩放折算）以内视为点击，不启动拖拽：
    // 否则"点一下选中设备"会因手抖产生一步空历史。
    const dragThreshold = 3 / viewport.value.zoom;
    if (!deviceDrag.value.moved &&
        Math.hypot(cur.x - start.x, cur.y - start.y) < dragThreshold) return;
    deviceDrag.value.moved = true;
    const dx = cur.x - start.x;
    const dy = cur.y - start.y;
    for (const d of devices.value) {
      if (!deviceDrag.value.ids.includes(d.id)) continue;
      const base = dragBefore.value[d.id] ?? d.position;
      projectStore.updateDevicePosition(d.id, snapPoint({ x: base.x + dx, y: base.y + dy }));
    }
    return;
  }

  if (isPanning.value) {
    const dx = pos.x - panStart.value.x;
    const dy = pos.y - panStart.value.y;
    panViewport(dx, dy);
    panStart.value = pos;
  } else if (tool.value === 'wire' && wireStartId.value) {
    // 橡皮筋预览：已确认折点 + 跟随鼠标的预览段（点选确认，不沿途记录）
    wirePreview.value = snapPoint(hoverPosition.value);
    const picked = pickEntity(pos);
    wireSnapTarget.value =
      picked && (picked.startsWith('device:') || picked.startsWith('well:')) &&
      picked.split(':')[1] !== wireStartId.value
        ? picked
        : null;
    renderOverlay();
  } else if (tool.value === 'tray' && tempTrayPath.value.length > 0) {
    trayPreview.value = snapPoint(hoverPosition.value);
    renderOverlay();
  } else if (tool.value === 'select' && e.buttons === 1 && !selectionBox.value) {
    // 框选开始
    // 帮助表宣称：框选按住 Shift = 追加选择、Alt = 减去选择。按下瞬间的
    // 修饰键决定本次框选模式，拖拽途中改按键不生效（所见即所得）。
    selectionBox.value = { start: pos, end: pos, additive: e.shiftKey, subtract: e.altKey };
  } else if (selectionBox.value) {
    selectionBox.value.end = pos;
    renderOverlay();
  }
}

function onMouseUp(e: MouseEvent) {
  isPanning.value = false;
  document.body.style.cursor = 'default';

  // 设备拖拽收尾：真位移过才收一步历史（整组移动 = 一次撤销），
  // 纯点击则丢弃拖拽态、保留 handleSelect 已做的选择。
  if (deviceDrag.value) {
    if (deviceDrag.value.moved) {
      const label = deviceDrag.value.ids.length > 1
        ? `移动 ${deviceDrag.value.ids.length} 个设备`
        : `移动设备 ${devices.value.find(d => d.id === deviceDrag.value?.ids[0])?.label || deviceDrag.value.ids[0]}`;
      projectStore.commitDevicePositions(label, dragBefore.value);
      emitDeviceMoved();
    }
    deviceDrag.value = null;
    dragBefore.value = {};
  }

  if (selectionBox.value) {
    handleBoxSelection(selectionBox.value);
    selectionBox.value = null;
    renderOverlay();
  }
}

function onWheel(e: WheelEvent) {
  const pos = getCanvasPosition(e);
  const modelPos = screenToModel(pos);
  // 帮助表宣称"Shift+滚轮 = 水平平移"：按住 Shift 不再缩放，按滚轮增量
  // 横向搬画布（多数鼠标只有 deltaY，故 deltaY 也当横向增量用）。
  if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const dx = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 40;
    panViewport(dx, 0);
    return;
  }
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoomAt(modelPos, factor);
}

function onDblClick(e: MouseEvent) {
  const pos = getCanvasPosition(e);
  const modelPos = screenToModel(pos);
  const picked = pickEntity(pos);

  if (tool.value === 'tray' && tempTrayPath.value.length >= 2) {
    finishTray(modelPos);
    return;
  }
  if (tool.value === 'wire' && tempWirePath.value.length >= 2) {
    // 双击空白 = 以最后位置结束布线（未落在设备上则取消）
    finishWire(modelPos);
    return;
  }
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

/**
 * 设备库 → 画布放置的统一入口：
 *  - 双击/布点按钮：store.placementMode 置真，这里同步切到 device 工具（点选即放）
 *  - 拖拽落点：canvas @drop 调 placeAtScreen（落点坐标）
 * 旧版链路断裂：placement-start 事件无人接、画布无 drop 处理，拖放"看起来能实则不能"。
 */
watch(
  () => deviceLibraryStore.placementMode,
  (on) => {
    if (on && deviceLibraryStore.selectedDeviceId) tool.value = 'device';
  },
);

/** 在屏幕坐标处放置当前选中设备（拖拽落点用） */
function placeAtScreen(screenPos: Point2D) {
  const modelPos = screenToModel(screenPos);
  placeDevice(modelPos);
}

/** 设备库拖拽进入画布：仅对内部设备拖拽显示 copy 光标 */
function onCanvasDragOver(e: DragEvent) {
  const types = e.dataTransfer?.types || [];
  if (types.includes('application/device')) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }
}

/** 设备库拖拽落点放置：取 application/device 数据 → 设为当前型号 → 按落点坐标布点 */
function onCanvasDrop(e: DragEvent) {
  const types = e.dataTransfer?.types || [];
  if (!types.includes('application/device')) return; // 文件拖拽交给宿主视图导入链
  e.preventDefault();
  e.stopPropagation();
  let payload: any = null;
  try {
    payload = JSON.parse(e.dataTransfer?.getData('application/device') || 'null');
  } catch {
    payload = null;
  }
  if (!payload?.id) return;
  deviceLibraryStore.selectDevice(payload.id);
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  placeDevice(screenToModel({ x: e.clientX - rect.left, y: e.clientY - rect.top }));
}

function stopPlacement() {
  tempWirePath.value = [];
  tempTrayPath.value = [];
  wireStartId.value = null;
  wirePreview.value = null;
  trayPreview.value = null;
  wireSnapTarget.value = null;
  wireHint.value = null;
  renderOverlay();
}

/**
 * 结束当前工具并回到选择态。
 * stopPlacement 不再隐式改工具：工具真值在 uiStore，切换工具时若由
 * stopPlacement 顺手写 'select'，会把刚设的新工具覆盖掉（先设后清 ⇒ 顺序依赖
 * 的隐性 bug）。需要"用完回选择"的地方显式调用本函数。
 */
function exitToolMode() {
  stopPlacement();
  tool.value = 'select';
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
}

/**
 * 布线交互（点选式）：
 *  - 第一次点击：从设备/弱电井引出起点（空白处也可起，用 'free' 哨兵）
 *  - 中间点击：添加折点（走直角/斜线由用户控制）
 *  - 再次点击设备/弱电井：完成连线（manualWire 生成 cat6 线缆）
 *  - Escape / 右键：取消
 * 旧版把 startWire 挂在 mousedown、finishWire 从未被调用，导致"线跟着鼠标走但永远落不了地"。
 */
function handleWireClick(screenPos: Point2D, modelPos: Point2D) {
  const picked = pickEntity(screenPos);
  const isTarget = (v: string | null) =>
    !!v && (v.startsWith('device:') || v.startsWith('well:'));

  if (tempWirePath.value.length === 0) {
    // 起点必须落在设备/弱电井上，否则线缆没有电气归属
    if (!isTarget(picked)) {
      wireHint.value = '布线起点需落在设备或弱电井上';
      return;
    }
    wireStartId.value = picked!.split(':')[1];
    wireHint.value = null;
    tempWirePath.value = [snapPoint(modelPos)];
    wirePreview.value = null;
    renderOverlay();
    return;
  }

  if (isTarget(picked)) {
    // 终点吸附到设备：完成
    finishWire(modelPos, picked!.split(':')[1]);
    return;
  }

  // 添加中间折点
  tempWirePath.value.push(snapPoint(modelPos));
  wirePreview.value = null;
  renderOverlay();
}

function finishWire(modelPos: Point2D, explicitEndId: string | null = null) {
  // 起点 + 终点 = 两点即可直连；tempWirePath 只存已确认折点
  if (tempWirePath.value.length === 0) { exitToolMode(); return; }

  const end = snapPoint(modelPos);
  const path = [...tempWirePath.value, end];
  let endId = explicitEndId;
  if (!endId) {
    const picked = pickEntity(getCanvasPositionFromModel(end));
    endId = (picked?.startsWith('device:') || picked?.startsWith('well:'))
      ? picked.split(':')[1]
      : null;
  }

  if (endId && endId !== wireStartId.value && wireStartId.value && wireStartId.value !== 'free') {
    const cable = projectStore.manualWire(wireStartId.value, endId, path, 'cat6');
    if (cable) {
      emit('cable-created', cable);
    }
  }

  exitToolMode();
}

/** 桥架交互（点选式）：点击加折点，Enter/双击 结束，Esc 取消 */
function handleTrayClick(modelPos: Point2D) {
  if (tempTrayPath.value.length === 0) {
    tempTrayPath.value = [snapPoint(modelPos)];
  } else {
    tempTrayPath.value.push(snapPoint(modelPos));
  }
  trayPreview.value = null;
  renderOverlay();
}

function finishTray(modelPos: Point2D) {
  if (tempTrayPath.value.length < 2) { exitToolMode(); return; }

  const last = tempTrayPath.value[tempTrayPath.value.length - 1];
  const end = snapPoint(modelPos);
  // 双击结束时 mousedown 已加过同位点，去重避免零长段
  const path = Math.hypot(end.x - last.x, end.y - last.y) > 0.01
    ? [...tempTrayPath.value, end]
    : [...tempTrayPath.value];
  if (path.length < 2) { exitToolMode(); return; }

  const tray: CableTray = {
    id: `tray-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    path,
    width: 200,
    height: 100,
    type: 'ladder',
    layers: 1,
  };

  projectStore.addTray(tray);
  emit('tray-created', tray);
  exitToolMode();
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
  exitToolMode();
}

/** 拖拽结束后向后级（属性面板/自动布线）广播每个设备的最终位置 */
function emitDeviceMoved() {
  const ids = deviceDrag.value?.ids || [];
  for (const d of devices.value) {
    if (ids.includes(d.id)) emit('device-moved', d);
  }
}

// 选择处理
/** 把画布选择发布到 uiStore，供属性面板等跨组件消费 */
function publishSelection(cableId: string | null = null) {
  uiStore.setSelection(
    selectedDevices.value.length === 1 ? selectedDevices.value[0] : null,
    cableId,
  );
}

/** 单选一条线缆（清空设备选中） */
function selectCable(cableId: string) {
  selectedDevices.value = [];
  selectedEntities.value = [];
  emit('device-selected', []);
  publishSelection(cableId);
}

function handleSelect(pos: Point2D, modelPos: Point2D, e: MouseEvent) {
  const picked = pickEntity(pos);

  // 按在设备上：先记为"潜在拖拽"，位移超过阈值才真的搬；
  // 没位移则照旧走点击选择（保持原有语义不变）。
  if (!e.ctrlKey && !e.metaKey && picked?.startsWith('device:')) {
    const id = picked.split(':')[1];
    const dragIds = selectedDevices.value.includes(id) ? [...selectedDevices.value] : [id];
    deviceDrag.value = {
      ids: dragIds,
      startModel: modelPos,
      moved: false,
    };
    dragBefore.value = {};
    for (const d of devices.value) {
      if (dragIds.includes(d.id)) dragBefore.value[d.id] = { x: d.position.x, y: d.position.y };
    }
  }

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
        publishSelection();
      } else if (picked.startsWith('entity:')) {
        const id = picked.split(':')[1];
        if (selectedEntities.value.includes(id)) {
          selectedEntities.value = selectedEntities.value.filter(d => d !== id);
        } else {
          selectedEntities.value.push(id);
        }
        publishSelection();
      } else if (picked.startsWith('cable:')) {
        // 多选模式下点线缆 = 单选该线缆（线缆属性面板一次只看一条）
        selectCable(picked.split(':')[1]);
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
        publishSelection();
      } else if (picked.startsWith('cable:')) {
        selectCable(picked.split(':')[1]);
      } else if (picked.startsWith('entity:')) {
        selectedEntities.value = [picked.split(':')[1]];
        publishSelection();
      }
    } else {
      publishSelection();
    }
  }

  renderer.value?.setSelectedEntities(new Set(selectedEntities.value));
  renderer.value?.setSelectedDevices(new Set(selectedDevices.value));
  renderer.value?.setHoveredEntity(hoveredEntityId.value);
  renderer.value?.setHoveredDevice(hoveredDeviceId.value);
}

function handleBoxSelection(box: { start: Point2D; end: Point2D; additive: boolean; subtract: boolean }) {
  const prev = new Set(selectedDevices.value);
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

  if (box.subtract) {
    // Alt 框选：从当前选中集里移除落在框内的
    const remove = new Set(newSelectedDevices);
    selectedDevices.value = [...prev].filter(id => !remove.has(id));
  } else if (box.additive) {
    // Shift 框选：并入当前选中集（去重）
    selectedDevices.value = [...new Set([...prev, ...newSelectedDevices])];
  } else {
    selectedDevices.value = newSelectedDevices;
  }
  emit('device-selected', selectedDevices.value);
  uiStore.setSelection(newSelectedDevices.length === 1 ? newSelectedDevices[0] : null, null);

  renderer.value?.setSelectedDevices(new Set(selectedDevices.value));
}

function deleteSelected() {
  // 批量删除只算一步历史：一次 Ctrl+Z 应能撤销整批误删
  projectStore.runBatched(`删除 ${selectedDevices.value.length} 个设备`, () => {
    for (const id of [...selectedDevices.value]) {
      projectStore.removeDevice(id);
    }
    for (const id of [...selectedEntities.value]) {
      // 删除图元（如果支持）
    }
    clearSelection();
  });
}

/** 清空选中集：状态、跨组件广播（属性面板）、渲染器高亮三处同步 */
function clearSelection() {
  selectedDevices.value = [];
  selectedEntities.value = [];
  emit('device-selected', []);
  uiStore.setSelection(null, null);
  renderer.value?.setSelectedDevices(new Set());
  renderer.value?.setSelectedEntities(new Set());
}

/**
 * 全选当前图纸设备（Ctrl+A 宣称"选择所有对象"）。CAD 图元暂不纳入：
 * 图元删除链尚未落地（deleteSelected 里对 entities 是空循环），把
 * 删不掉的图元标成选中是另一种误导，等图元删除可用后再扩。
 */
function selectAll() {
  if (!devices.value.length) return;
  selectedEntities.value = [];
  selectedDevices.value = devices.value.map(d => d.id);
  emit('device-selected', selectedDevices.value);
  uiStore.setSelection(null, null);
  renderer.value?.setSelectedDevices(new Set(selectedDevices.value));
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

/**
 * 适应视图：把图纸内容缩放到刚好填满可视区（留 8% 边距）。
 * 供「导入后自动 fit」「缩放适应 (Shift+1)」调用（AC-2.4）。
 */
function fitToContent(): void {
  const el = container.value || mainCanvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const b = calculateDrawingBounds();
  const padding = 0.92; // 8% 边距
  const scaleX = (rect.width * padding) / Math.max(b.width, 1);
  const scaleY = (rect.height * padding) / Math.max(b.height, 1);
  const z = Math.min(scaleX, scaleY);
  const zoom = Math.max(0.02, Math.min(40, z));

  const cx = b.minX + b.width / 2;
  const cy = b.minY + b.height / 2;
  viewport.value = {
    ...viewport.value,
    transform: { a: zoom, b: 0, c: 0, d: zoom, e: rect.width / 2 - cx * zoom, f: rect.height / 2 - cy * zoom },
    center: { x: cx, y: cy },
    zoom,
  };
  renderer.value?.setViewport(viewport.value);
  emit('viewport-changed', viewport.value);
  updateRulers();
}

/** 缩放到指定倍率（保持中心不变），供「实际大小 100%」调用 */
function zoomToLevel(z: number): void {
  const el = container.value || mainCanvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const center = screenToModel({ x: rect.width / 2, y: rect.height / 2 });
  viewport.value = {
    ...viewport.value,
    transform: { a: z, b: 0, c: 0, d: z, e: rect.width / 2 - center.x * z, f: rect.height / 2 - center.y * z },
    zoom: z,
  };
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

  // 绘制临时线缆（已确认折点 + 橡皮筋预览段 + 吸附目标高亮）
  if (tempWirePath.value.length > 0) {
    const pts = [...tempWirePath.value];
    if (wirePreview.value) pts.push(wirePreview.value);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const screenStart = modelToScreen(pts[0]);
    ctx.moveTo(screenStart.x, screenStart.y);
    for (let i = 1; i < pts.length; i++) {
      const s = modelToScreen(pts[i]);
      ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 已确认折点小圆点
    ctx.fillStyle = '#3b82f6';
    for (const p of tempWirePath.value) {
      const s = modelToScreen(p);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 吸附目标高亮环
    if (wireSnapTarget.value) {
      const targetId = wireSnapTarget.value.split(':')[1];
      const kind = wireSnapTarget.value.split(':')[0];
      let tp: Point2D | null = null;
      if (kind === 'device') tp = devices.value.find(d => d.id === targetId)?.position || null;
      else tp = wells.value.find(w => w.id === targetId)?.position || null;
      if (tp) {
        const s = modelToScreen(tp);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // 绘制临时桥架（已确认折点 + 橡皮筋预览）
  if (tempTrayPath.value.length > 0) {
    const pts = [...tempTrayPath.value];
    if (trayPreview.value) pts.push(trayPreview.value);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    const screenStart = modelToScreen(pts[0]);
    ctx.moveTo(screenStart.x, screenStart.y);
    for (let i = 1; i < pts.length; i++) {
      const s = modelToScreen(pts[i]);
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

  // 标尺刻度以米呈现：模型单位需经统一换算（旧实现直接 x*scale，单位错位）
  const toMeters = (units: number) => modelUnitsToMeters(units, scale);

  // 顶部标尺
  rulerTop.value.innerHTML = '';
  const startX = Math.floor(viewportBounds.minX / 1000) * 1000;
  for (let x = startX; x <= viewportBounds.maxX; x += 1000) {
    const screenX = modelToScreen({ x, y: 0 }).x;
    if (screenX >= 0 && screenX <= rulerTop.value.clientWidth) {
      const mark = document.createElement('div');
      mark.className = 'ruler-mark';
      mark.style.left = `${screenX}px`;
      mark.textContent = `${toMeters(x).toFixed(1)}`;
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
      mark.textContent = `${toMeters(y).toFixed(1)}`;
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
      selectedDevices.value = [];
      emit('device-selected', []);
      uiStore.setSelection(null, null);
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
  // scale 是无量纲的 模型单位/实际毫米；先把模型单位换成米，再折算到录入单位
  const meters = modelUnitsToMeters(pos.x, scale);
  const metersY = modelUnitsToMeters(pos.y, scale);
  const perM = unit === 'm' ? 1 : unit === 'cm' ? 100 : 1000;
  const realX = meters * perM;
  const realY = metersY * perM;
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
  renderer.value?.setDeviceCategories(buildDeviceCategoryMap());
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
  if (syncingViewport) return; // syncViewport 回填期间，值来自 drawing，无需再写回
  if (currentDrawing.value) {
    currentDrawing.value.viewport = {
      transform: { ...viewport.value.transform },
      center: { ...viewport.value.center },
      zoom: viewport.value.zoom,
      showGrid: viewport.value.showGrid,
      showRuler: viewport.value.showRuler,
    };
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
  /** 适应视图：内容缩放到刚好填满可视区（导入后 / Shift+1） */
  fitToContent,
  /** 缩放到指定倍率（1 = 实际大小） */
  zoomToLevel,
  /** 视口变换（校准浮层做坐标换算用，与画布共用同一矩阵） */
  screenToModel,
  modelToScreen,
  /** 当前视口状态 */
  getViewport: () => viewport.value,
  /** 外部（主工具栏）切换交互工具 */
  setActiveTool: (t: string) => {
    const allowed = ['select', 'pan', 'device', 'wire', 'tray', 'well', 'zoom'];
    if (allowed.includes(t)) tool.value = t as typeof tool.value;
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

.status-item.is-hint {
  color: #3b82f6;
  font-weight: 500;
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
