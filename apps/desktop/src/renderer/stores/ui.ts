// UI 共享状态 —— 供「高级功能 ▾」与工具栏 / 侧栏 / 画布跨组件联动
// 设计约束：只承载"当前交互选择"（工具 / 侧栏 Tab / 引导回放），不承载任何业务数据。
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type EditorTool = 'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well';

export const useUiStore = defineStore('ui', () => {
  /** 当前编辑工具（与 Toolbar 按钮一致，AdvancedMenu「专业工具」组复用） */
  const activeTool = ref<EditorTool>('select');
  /** 左侧栏当前 Tab（与 SidebarPanel 一致，AdvancedMenu「面板」组复用） */
  const activeSidebarTab = ref('devices');
  /** 新手引导回放开关（默认关闭；AdvancedMenu「其他」组触发） */
  const showTour = ref(false);

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

  return {
    activeTool,
    activeSidebarTab,
    showTour,
    setTool,
    setSidebarTab,
    replayTour,
    closeTour,
  };
});
