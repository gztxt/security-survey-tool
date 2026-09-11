/**
 * 可见性收敛 —— 单一事实源（架构设计 决策 1 / 决策 5 / T4）
 *
 * 设计约束（铁律）：
 * 1. 本文件**只决定"露不露入口"**，绝不决定是否"能访问"。所有路由 name 全部保留，
 *    高级页在精简态依然可通过直达 URL / router.push({name}) 进入。
 * 2. 唯一驱动量是 `settingsStore.advancedMode`（默认 false）。关掉即回精简态，无需重启。
 * 3. 组件侧一律用 `showTool()/showPanel()/showNav()/visible*` 计算属性做 `v-if` 过滤，
 *    不允许在业务逻辑里读 advancedMode 改行为（避免"隐藏即降级功能")。
 */
import { computed, type ComputedRef } from 'vue';
import { useSettingsStore } from '@/stores/settings';

/** 工具栏按钮标识（与 Toolbar.vue 的按钮一一对应） */
export type ToolName =
  | 'new-project' | 'open-project' | 'save-project'
  | 'import-baseline' | 'calibrate'
  | 'select' | 'pan' | 'device' | 'wire' | 'tray' | 'well'
  | 'undo' | 'redo'
  | 'zoom-out' | 'zoom-in' | 'fit-view'
  | 'grid' | 'ruler' | 'snap'
  | 'export' | 'settings';

/** 左侧栏面板标识 */
export type PanelId = 'devices' | 'project' | 'layers' | 'wiring' | 'properties';

/** 设置页分区标识（9 面板 + 2 分隔符） */
export type SettingsCategoryId =
  | 'general' | 'canvas' | 'drawing' | 'device-library' | 'wiring'
  | 'export' | 'shortcuts' | 'advanced' | 'about' | 'divider' | 'divider2';

/** 导出类型标识（与 ExportView.exportTypes 的 id 对齐） */
export type ExportTypeId = 'pointmap' | 'dxf' | 'topology' | 'fov' | 'bom' | 'report';

/** 主导航项（首页顶部/侧边露出的页面级入口） */
export interface NavItem {
  /** 路由 name —— 全部保留，绝不删除 */
  name: string;
  label: string;
  /** 精简态是否露出（true = 常驻） */
  primary: boolean;
  /** 归类到「高级功能 ▾」的哪一组（精简态入口） */
  group?: AdvancedGroupId;
}

export type AdvancedGroupId = 'tools' | 'panels' | 'pages' | 'exports' | 'settings' | 'misc';

export interface AdvancedGroup {
  id: AdvancedGroupId;
  label: string;
}

/** 「高级功能 ▾」六个分组（决策 1 挂载点结构） */
export const ADVANCED_GROUPS: AdvancedGroup[] = [
  { id: 'tools', label: '专业工具' },
  { id: 'panels', label: '面板' },
  { id: 'pages', label: '管理页' },
  { id: 'exports', label: '高级导出' },
  { id: 'settings', label: '专业设置' },
  { id: 'misc', label: '其他' },
];

/**
 * 工具 → 是否进阶。
 * 精简态保留（决策 5.1 的 17 按钮基线）：新建/打开/保存/导入底图/校准/选择/平移/布点/布线/
 * 撤销/重做/缩小/放大/适应视图/网格/吸附（+ 右侧导出/设置）。
 * 进阶：桥架 / 弱电井 / 标尺。
 */
const ADVANCED_TOOLS: ToolName[] = ['tray', 'well', 'ruler'];

/** 侧栏精简态只留 devices（决策 5.5） */
const ADVANCED_PANELS: PanelId[] = ['project', 'layers', 'wiring', 'properties'];

/**
 * 设置 9 面板分级（决策 5.4）：
 * p0 = 精简态可见（通用 / 高级 / 关于）；p1 = 经典态可见；p2 = 仅经典态且显式开启（快捷键）。
 */
const SETTINGS_LEVELS: Record<SettingsCategoryId, 'p0' | 'p1' | 'p2'> = {
  general: 'p0',
  canvas: 'p1',
  drawing: 'p1',
  'device-library': 'p1',
  wiring: 'p1',
  export: 'p1',
  shortcuts: 'p2',
  advanced: 'p0',
  about: 'p0',
  divider: 'p1',
  divider2: 'p0',
};

/** 导出类型：精简态只留点位图 + DXF（决策 5.3 #7 + T3） */
const BASIC_EXPORTS: ExportTypeId[] = ['pointmap', 'dxf'];

/** 主导航全量清单（name 一律保留；hidden 仅表示"不在主导航露出"） */
export const NAV_ITEMS: NavItem[] = [
  { name: 'home', label: '首页', primary: true },
  { name: 'project', label: '图纸编辑', primary: true, group: 'pages' },
  { name: 'project-export', label: '导出与报告', primary: true, group: 'pages' },
  { name: 'Projects', label: '项目列表', primary: false, group: 'pages' },
  { name: 'ProjectCreate', label: '新建项目', primary: true },
  { name: 'Dashboard', label: '项目概览', primary: false, group: 'pages' },
  { name: 'DeviceLibrary', label: '设备库管理', primary: false, group: 'pages' },
  { name: 'settings', label: '设置', primary: true },
  { name: 'help', label: '帮助文档', primary: false, group: 'misc' },
];

/** 常用设备快选（精简态内置默认，决策 5.1 右下浮层） */
export const COMMON_DEVICE_KEYWORDS: string[] = [
  '枪机', '半球', '球机', '摄像头', '摄像机', '机柜',
];

/**
 * 可见性 composable。所有消费方：Toolbar / SidebarPanel / SettingsView /
 * ProjectHeader / HomeView / ExportView / AdvancedMenu。
 */
export function useVisibility() {
  const settingsStore = useSettingsStore();

  /** 专家（经典）模式总开关 —— 唯一驱动量 */
  const advancedMode = computed<boolean>(() => !!settingsStore.advancedMode);

  /** 工具按钮是否露出 */
  function showTool(name: ToolName): boolean {
    return advancedMode.value || !ADVANCED_TOOLS.includes(name);
  }

  /** 侧栏 Tab 是否露出 */
  function showPanel(id: PanelId): boolean {
    return advancedMode.value || !ADVANCED_PANELS.includes(id);
  }

  /** 设置分区是否露出（p2 只在经典态出，与 p1 同条件，单独保留语义位） */
  function showSettingsCategory(id: SettingsCategoryId): boolean {
    const level = SETTINGS_LEVELS[id] ?? 'p0';
    if (level === 'p0') return true;
    return advancedMode.value;
  }

  /** 导出类型是否露出 */
  function showExportType(id: ExportTypeId): boolean {
    return advancedMode.value || BASIC_EXPORTS.includes(id);
  }

  /** 主导航项是否露出 */
  function showNav(name: string): boolean {
    const item = NAV_ITEMS.find(n => n.name === name);
    if (!item) return true;
    return item.primary;
  }

  /** 归入「高级功能 ▾」的导航项（精简态入口） */
  const advancedNavItems: ComputedRef<NavItem[]> = computed(() =>
    NAV_ITEMS.filter(n => !n.primary && n.group),
  );

  /** 主导航（精简态过滤后） */
  const navItems: ComputedRef<NavItem[]> = computed(() =>
    NAV_ITEMS.filter(n => n.primary),
  );

  /** 常用设备快选命中判定（关键字包含即可，未命中时调用方回退取前 N 项） */
  function isCommonDevice(name: string): boolean {
    const label = (name || '').toLowerCase();
    return COMMON_DEVICE_KEYWORDS.some(k => label.includes(k.toLowerCase()));
  }

  /** 开启经典模式（唯一写入点，内部已持久化 localStorage） */
  function enableAdvancedMode(): void {
    settingsStore.setAdvancedMode(true);
  }

  /** 关闭经典模式（无需重启即回精简态） */
  function disableAdvancedMode(): void {
    settingsStore.setAdvancedMode(false);
  }

  return {
    advancedMode,
    showTool,
    showPanel,
    showSettingsCategory,
    showExportType,
    showNav,
    navItems,
    advancedNavItems,
    isCommonDevice,
    enableAdvancedMode,
    disableAdvancedMode,
  };
}

export default useVisibility;
