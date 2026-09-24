<template>
  <div class="drawing-view" ref="containerRef" :class="{ 'is-dragover': dragOver }">
    <!-- 工具栏（D-2：本期由 CanvasView 迁到主视图挂载） -->
    <Toolbar
      ref="toolbarRef"
      @tool-changed="onToolChanged"
      @viewport-changed="onToolbarViewportChanged"
      @import="onToolbarImport"
      @calibrate="onToolbarCalibrate"
    />

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
        :snap-enabled="snapEnabled"
        :grid-enabled="gridEnabled"
        @entity-select="onEntitySelect"
        @device-place="onDevicePlace"
        @wire-start="onWireStart"
        @wire-end="onWireEnd"
        @viewport-changed="onViewportChange"
        @context-menu="onCanvasContextMenu"
      />

      <!-- 比例尺校准浮层（决策 5.2 / AC-3.1） -->
      <CalibrationOverlay
        v-if="calActive && activeDrawing"
        :step="calStep"
        :hint="calHint"
        :points="calPoints"
        :preview-distance="calPreviewDistance"
        :to-model="canvasToModel"
        :to-screen="canvasToScreen"
        @pick="onCalPick"
        @apply="onCalApply"
        @cancel="cal.cancel()"
      />

      <!-- 拖拽导入提示遮罩 -->
      <div v-if="dragOver" class="drop-mask">松开以导入底图（DWG 需转换，推荐 DXF）</div>

      <!-- 工作流引导卡片：按当前图纸进度提示下一步（对标 Axis/海康设计工具的任务引导） -->
      <div v-if="guideCard && !dragOver" class="guide-card">
        <div class="guide-step">{{ guideCard.step }}</div>
        <h3 class="guide-title">{{ guideCard.title }}</h3>
        <p class="guide-desc">{{ guideCard.desc }}</p>
        <div class="guide-actions">
          <button v-for="act in guideCard.actions" :key="act.label"
            class="btn-primary" :class="{ 'is-secondary': act.secondary }"
            @click="act.run()">
            {{ act.label }}
          </button>
        </div>
        <p class="guide-tip" v-if="guideCard.tip">{{ guideCard.tip }}</p>
      </div>

      <!-- 空状态（无图纸） -->
      <div v-if="!activeDrawing" class="empty-state">
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

    <!-- 状态栏（图纸级信息）。
         坐标与缩放不在此显示：CanvasViewport 自带的画布状态栏才是这两项的真值源
         （它持有 hover 位置与实时 viewport）。此前外层用 drawing.viewport.worldX 展示
         坐标，而 worldX 在 ViewportState 里是可选字段、全仓无任何写入点，值恒为
         undefined ⇒ 模板里 worldX.toFixed() 在渲染期抛 TypeError，Vue 直接把整个
         DrawingView 卸载：打包应用里画布/工具栏/图纸标签全部消失，只剩空白工作区
         （真实 AppImage 冒烟 R9 实测，单测因走内存 fixture 未暴露）。 -->
    <div class="status-bar">
      <div class="status-left">
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
          比例尺: 1:{{ Math.round(1 / (activeDrawing?.calibration?.scale || 1)) }} ({{ activeDrawing?.calibration?.unit || 'm' }})
        </span>
      </div>
      <!-- 状态栏右侧原为"设计/视场/布线视图"徽标，已删除：viewMode 只是本组件
           的本地 ref，CanvasViewport 声明了 viewMode prop 却从不读取，切换后
           画布不发生任何变化 ⇒ 假状态。而它的 v/w 按键与画布的"选择 (V)/
           布线 (W)"工具键双重绑定：按一次 v 同时切"视场视图"（无效果）和
           选择工具（有效果），用户看到的是快捷键行为诡异。视野显示的真实
           入口是设备右键"显示视野"，与此无关。坐标读数在画布自己的状态条。 -->
    </div>

    <!-- 画布右键菜单 -->
    <ContextMenu
      v-model:visible="canvasMenu.visible"
      :position="canvasMenu.position"
      :items="canvasMenu.items"
      @select="onCanvasMenuSelect"
    />

    <!-- DWG 无 ODA 降级引导（AC-2.2 三选一） -->
    <DwgFallbackDialog
      :files="baselineImport.fallbackFiles.value"
      @import="onFallbackImport"
      @as-raster="onFallbackRaster"
      @dismiss="baselineImport.dismissFallback()"
    />

    <!-- 多页 PDF 选页（AC-1.3） -->
    <PdfPagePicker
      v-if="baselineImport.pdfPagePick.value"
      :name="basenameOf(baselineImport.pdfPagePick.value.path)"
      :page-count="baselineImport.pdfPagePick.value.pageCount"
      @confirm="baselineImport.confirmPdfPage"
      @dismiss="baselineImport.dismissPdfPick()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';
import { useDeviceStore } from '@/stores/deviceLibrary';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import DrawingTabs from '@/components/layout/DrawingTabs.vue';
import CanvasViewport from '@/components/canvas/CanvasViewport.vue';
import ContextMenu from '@/components/common/ContextMenu.vue';
import Toolbar from '@/components/common/Toolbar.vue';
import CalibrationOverlay from '@/components/canvas/CalibrationOverlay.vue';
import DwgFallbackDialog from '@/components/import/DwgFallbackDialog.vue';
import PdfPagePicker from '@/components/import/PdfPagePicker.vue';
import { useBaselineImport, basenameOf } from '@/composables/useBaselineImport';
import { useCalibration } from '@/composables/useCalibration';
import type { Point2D } from '@security-survey/shared-types';

const projectStore = useProjectStore();
const deviceStore = useDeviceStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();

/** 基线导入链（对话框/拖拽/右键/项目树四入口汇聚） */
const baselineImport = useBaselineImport();
/** 比例尺校准链 */
const cal = useCalibration();
// 模板解包：composable 返回的是普通对象内的 ref，模板不会自动解包嵌套 ref，
// 需显式 computed 取值（同时避免 v-if="cal.active" 恒真的问题）
const calActive = computed(() => cal.active.value);
const calStep = computed(() => cal.step.value);
const calHint = computed(() => cal.hint.value);
const calPreviewDistance = computed(() => cal.previewDistance.value);

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
const toolbarRef = ref<any>(null);

/**
 * 画布坐标换算桥：校准浮层与画布共用同一变换矩阵，
 * 画布尚未挂载（无图纸）时给单位阵，保证浮层不抛错。
 */
function canvasToModel(screen: Point2D): Point2D {
  return viewportRef.value?.screenToModel?.(screen) ?? { x: screen.x, y: screen.y };
}
function canvasToScreen(model: Point2D): Point2D {
  return viewportRef.value?.modelToScreen?.(model) ?? { x: model.x, y: model.y };
}

/** 校准已拾取点（模型坐标），交给浮层做标记与连线 */
const calPoints = computed<Point2D[]>(() => {
  const pts: Point2D[] = [];
  if (cal.point1.value) pts.push(cal.point1.value);
  if (cal.point2.value) pts.push(cal.point2.value);
  return pts;
});

function onCalPick(p: Point2D) {
  cal.addPoint(p);
}

function onCalApply(payload: { realDistance: number; unit: 'mm' | 'cm' | 'm' }) {
  cal.apply(payload);
}

function fitViewport() {
  viewportRef.value?.fitToContent?.();
}

// 让导入链在成功后自动适应视图（AC-1.4 / AC-2.4）
baselineImport.onFitViewport(() => fitViewport());

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
// 线缆真实路径是 wiring.cables（旧代码读 .wires 恒为空，状态栏/空态计数失真）
const wires = computed(() => activeDrawing.value?.wiring?.cables || []);

/** 吸附开关：真值在 settingsStore（画布 snapPoint 读它），此处只做读写代理 */
const snapEnabled = computed({
  get: () => settingsStore.snapEnabled,
  set: (v: boolean) => { settingsStore.snapEnabled = v; },
});
/** 网格开关：真值在当前图纸 viewport.showGrid（渲染器读它），按图纸各自持久化。
 *  不读 projectStore.viewport —— 画布写回 drawing.viewport 时不一定刷新该副本。 */
const gridEnabled = computed({
  get: () => activeDrawing.value?.viewport?.showGrid ?? true,
  set: (v: boolean) => {
    if (activeDrawing.value) {
      // 只改 drawing.viewport：画布 deep watcher 会 syncViewport 推给渲染器。
      // 不再调 setViewport —— 它用 store 副本整体覆盖 drawing.viewport，副本可能滞后。
      projectStore.updateDrawing(activeDrawing.value.id, {
        viewport: { ...activeDrawing.value.viewport, showGrid: v },
      });
    }
  },
});

// ============ 工作流引导卡片 ============
// 无底图 → 引导导入；有底图未校准 → 引导校准；有底图无设备 → 引导布点。
// 设备就位后不再打扰（步骤条持续可见）。
interface GuideCard {
  step: string;
  title: string;
  desc: string;
  actions: Array<{ label: string; secondary?: boolean; run: () => void }>;
  tip?: string;
}

const guideDismissed = ref<Set<string>>(new Set(
  (() => { try { return JSON.parse(localStorage.getItem('guide-dismissed') || '[]'); } catch { return []; } })()
));
function dismissGuide(key: string) {
  guideDismissed.value.add(key);
  localStorage.setItem('guide-dismissed', JSON.stringify([...guideDismissed.value]));
}

const guideCard = computed<GuideCard | null>(() => {
  const d = activeDrawing.value as any;
  if (!d || calActive.value) return null;
  // 判定复用 store 里的派生量，不再本地重算 hasBase（曾与 hasBasemap 口径不一致）
  const hasBase = projectStore.hasBasemap;
  const deviceCount = d.devices?.length || 0;
  const key = d.id + ':' + (!hasBase ? 'import' : !d.calibration?.isCalibrated ? 'calibrate' : deviceCount < 2 ? 'place' : 'none');
  if (guideDismissed.value.has(key)) return null;

  if (!hasBase) {
    return {
      step: '第 1 步 · 导入底图',
      title: '还没有底图',
      desc: '导入 DWG / DXF / 图片 / PDF 平面图作为勘察底图，之后才能布点与标注线路。',
      actions: [{ label: '选择文件导入', run: () => onToolbarImport() }],
      tip: '也可以直接把文件拖进本窗口；没有图纸时可新建空白图纸徒手布置。',
    };
  }
  if (!d.calibration?.isCalibrated) {
    return {
      step: '第 1 步 · 校准比例尺',
      title: '校准底图比例尺',
      desc: '在图上找一段已知长度的尺寸（如轴线间距），点两次再输入实际米数，线长统计才有真实数值。',
      actions: [
        { label: '开始校准', run: () => onToolbarCalibrate() },
        { label: '暂不校准', secondary: true, run: () => dismissGuide(key) },
      ],
    };
  }
  if (deviceCount < 2) {
    return {
      step: '第 2 步 · 添加点位',
      title: deviceCount === 0 ? '布置设备点位' : '再放一台设备',
      desc: deviceCount === 0
        ? '从左侧设备库选择摄像头 / 交换机 / 机柜，双击或拖到图纸上放置。'
        : '图上只有 1 台设备，线缆需要起止两个端点，再放一台交换机或摄像头即可开始连线。',
      actions: [
        {
          label: '打开设备库布点',
          run: () => { uiStore.setSidebarTab('devices'); uiStore.setTool('device'); dismissGuide(key); },
        },
      ],
      tip: '拖动中键或空格平移视图，滚轮缩放。',
    };
  }
  return null;
});


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
  if (!files.length) return;
  // 交给统一导入链：拖拽来源的路径会经 fs:grantPaths 申请授权（AC-2.2）
  importDrawings(files);
}

async function importDrawings(files: File[]) {
  await baselineImport.importFromFiles(files);
}

/** 工具栏 / 右键菜单 / 快捷键的统一导入入口（原生对话框路径） */
function onToolbarImport() {
  void baselineImport.runImport();
}

/** 降级对话框「选择 DXF 文件」回流 */
async function onFallbackImport(paths: string[]) {
  await baselineImport.importPaths(paths);
}

/** 降级对话框「作为图片底图导入」（AC-2.2 选项 2） */
async function onFallbackRaster(paths: string[]) {
  await baselineImport.importDwgAsRaster(paths);
}

function onToolbarCalibrate() {
  if (cal.active.value) {
    cal.cancel();
    return;
  }
  cal.start();
}

function onToolChanged(t: string) {
  // Toolbar 工具切换：校准态由 cal.active 独立管理，其余工具透传给画布
  if (t === 'calibrate') {
    onToolbarCalibrate();
    return;
  }
  viewportRef.value?.setActiveTool?.(t);
}

function onToolbarViewportChanged(vp: any) {
  if (vp && activeDrawing.value) {
    projectStore.updateViewport(vp);
  }
}

function onAddDrawing() {
  // 走 createBlankDrawing：补齐契约字段并切进新页签。
  // 旧写法 addDrawing({name} as any) 造出一张没有 id 的图纸 —— 页签点不动、
  // 保存后 .survey 里多一张无 id 图纸，而"新建图纸"是帮助页宣称的功能。
  projectStore.createBlankDrawing('新建图纸');
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

/**
 * 导入入口（右键菜单 / Ctrl+O）。
 * 原实现用 DOM `<input type=file>`，拿不到真实路径，主进程必然拒绝；
 * 改为走原生对话框 + grantPaths 链（决策 3）。
 */
function triggerFileImport() {
  void baselineImport.runImport();
}

function zoomFit() {
  fitViewport();
}

function zoomTo(zoom: number) {
  viewportRef.value?.zoomToLevel?.(zoom);
}

function zoomToSelection() {
  // 选区适应依赖选中集，暂以整体适应兜底（不改变既有行为语义）
  fitViewport();
}

function openDrawingProperties() {
  // TODO: 打开图纸属性对话框
}

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  // 全局快捷键（项目级：保存/另存为/导出/导入/返回首页 由 ProjectView 统一注册，
  // 此处只留图纸编辑级键，避免同一键在两处 window 监听器上重复触发）
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      // Ctrl+O 曾是"导入底图"的隐藏别名，但设置表/帮助页一致宣称
      // Ctrl+O = 打开项目（.survey）、Ctrl+I = 导入图纸。项目内按 O 会
      // 与 GlobalKeys 的"打开项目"同时触发（window 监听各自独立），
      // 一个键两件事 ⇒ 删除此别名，导入唯一入口是 Ctrl+I / 按钮 / 拖拽。
      // Ctrl+N 曾是"新建图纸"的隐藏别名，但帮助页与设置快捷键表都宣称
      // Ctrl+N = 新建项目 ⇒ 在首页按 Ctrl+N 毫无反应（假宣称），进了项目
      // 又干别的活。现取消此别名：新建图纸的唯一键是 Ctrl+T（DrawingTabs）。
      // 首页的真实 Ctrl+N/Ctrl+O 由 GlobalKeys 统一注册。
      case 'k':
        // 工具栏 title 早就写了 (Ctrl+K)，此前无人注册 ⇒ 补上
        e.preventDefault();
        onToolbarCalibrate();
        break;
    }
  }

  // 绘图仪级按键（不带修饰键的部分；工具选择键 V/D/W/T/Z 归 CanvasViewport，
  // 此处不重复处理，曾有的 v/w"视图模式"双重绑定已删除）
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    // 数字键一律按 e.code 判定，不看 e.key：按住 Shift 时主键区数字的
    // e.key 变成 '!'/@'，旧写法 switch (e.key) case '1' + e.shiftKey 永远
    // 进不去 ⇒ 帮助表宣称的 Shift+1（适应窗口）/Shift+2（缩放选中）对真实
    // 键盘是死键（真机 R14k 实测：按 Shift+1 缩放读数纹丝不动）。
    // code 判定与布局无关，也不再受 Shift 影响。
    const digit = /^Digit([1-9])$/.exec(e.code || '')?.[1];
    if (digit === '1' && !e.shiftKey) { zoomTo(1); return; }
    if ((digit === '1' && e.shiftKey) || e.code === 'Digit0') { zoomFit(); return; }
    if (digit === '2' && e.shiftKey) { zoomToSelection(); return; }
    const bareKey = e.key.toLowerCase();
    if (!e.shiftKey && bareKey === 'g') { gridEnabled.value = !gridEnabled.value; return; }
    if (!e.shiftKey && bareKey === 's') { snapEnabled.value = !snapEnabled.value; return; }
      // Escape 唯一所有者是 CanvasViewport（取消布线临时线 + 清选中 + 退
      // 工具一次收全）。此处曾有第二份 handler：emit 的三个事件全仓无人
      // 监听（死事件），cancelWire 与画布重复 ⇒ 删除，键位单一所有权。
  }
}

// 「导入底图」步骤已导入时，步骤条请求直接进入校准取点
watch(() => uiStore.calibrateRequest, () => {
  onToolbarCalibrate();
});

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

.drop-mask {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.08);
  border: 2px dashed #2563eb;
  color: #1d4ed8;
  font-size: 14px;
  pointer-events: none;
}

/* 工作流引导卡片：半透明悬浮于画布左上，不遮挡主内容 */
.guide-card {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 20;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.guide-step {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--primary-color, #3b82f6);
  letter-spacing: 0.02em;
}

.guide-title {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary, #111827);
}

.guide-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
}

.guide-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.guide-actions .btn-primary.is-secondary {
  background: transparent;
  color: var(--text-secondary, #6b7280);
  border: 1px solid var(--border-color, #d1d5db);
}

.guide-tip {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-tertiary, #9ca3af);
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
.unit-display {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
}

.snap-status.active,
.grid-status.active {
  color: #3b82f6;
}

.snap-status:hover,
.grid-status:hover {
  color: var(--text-primary);
  cursor: pointer;
}
</style>
