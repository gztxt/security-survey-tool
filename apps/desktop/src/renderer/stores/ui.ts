// UI 共享状态 —— 供「高级功能 ▾」与工具栏 / 侧栏 / 画布跨组件联动
// 设计约束：只承载"当前交互选择"（工具 / 侧栏 Tab / 引导回放），不承载任何业务数据。
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type EditorTool = 'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well' | 'zoom';

export const useUiStore = defineStore('ui', () => {
  /** 当前编辑工具（与 Toolbar 按钮一致，AdvancedMenu「专业工具」组复用） */
  const activeTool = ref<EditorTool>('select');
  /** 左侧栏当前 Tab（与 SidebarPanel 一致，AdvancedMenu「面板」组复用） */
  const activeSidebarTab = ref('devices');
  /** 新手引导回放开关（默认关闭；AdvancedMenu「其他」组触发） */
  const showTour = ref(false);
  /**
   * 侧栏折叠状态（单一事实源）。
   * 此前 ProjectHeader 的折叠按钮翻的是组件私有 ref，无人消费 ⇒ 按了没反应；
   * 真正的折叠在 SidebarPanel 内部，两者互相看不见。统一到这里后
   * Header 与面板内的折叠按钮都读写同一状态。
   */
  const sidebarCollapsed = ref(false);

  /**
   * 画布「全选」的注册入口（Ctrl+A 用）。CanvasViewport 挂载时把实现
   * 注册进来、卸载时清空；GlobalKeys 只认这个函数是否存在 —— 画布不在场
   * （首页/设置页）时 Ctrl+A 不劫持浏览器默认行为。
   * 不用 window 全局变量：可测试、可随组件生命周期自动失效。
   */
  const canvasSelectAll = ref<(() => void) | null>(null);
  function setCanvasSelectAll(fn: (() => void) | null) {
    canvasSelectAll.value = fn;
  }
  /**
   * 画布当前选中的单个设备 / 线缆 id。
   * 此前"属性"面板从未收到 deviceId ⇒ 永远渲染空态，选中设备看不到任何属性。
   * 选择属于"当前交互选择"，不放业务 store，与 uiStore 定位一致。
   */
  const selectedDeviceId = ref<string | null>(null);
  const selectedCableId = ref<string | null>(null);

  function setSelection(deviceId: string | null, cableId: string | null = null) {
    selectedDeviceId.value = deviceId;
    selectedCableId.value = cableId;
  }

  /**
   * 跨组件动作请求（递增计数，宿主视图 watch 后执行）。
   * WorkflowStepper 在「导入底图」步骤已导入时应直接进入校准，
   * 而不是弹一句"请在右侧项目树选中图纸后用工具栏校准"让用户自己找路径。
   */
  const calibrateRequest = ref(0);

  function requestCalibrate() {
    calibrateRequest.value += 1;
  }

  function setTool(tool: EditorTool) {
    activeTool.value = tool;
  }

  function setSidebarTab(id: string) {
    activeSidebarTab.value = id;
  }

  function replayTour() {
    showTour.value = true;
  }

  function closeTour() {
    showTour.value = false;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return {
    activeTool,
    activeSidebarTab,
    showTour,
    sidebarCollapsed,
    canvasSelectAll,
    setCanvasSelectAll,
    selectedDeviceId,
    selectedCableId,
    setSelection,
    calibrateRequest,
    requestCalibrate,
    setTool,
    setSidebarTab,
    replayTour,
    closeTour,
    toggleSidebar,
  };
});
