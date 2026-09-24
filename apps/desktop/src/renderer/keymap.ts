/**
 * 快捷键唯一真相源（keymap）
 *
 * 背景（P1 键位审计，2026-09-12）：
 *  - 设置页快捷键表（SettingsShortcuts）此前是一张 ~50 行的手写大表，
 *    与真实注册的按键几乎两两脱节：Ctrl+N 宣称"新建项目"实际是"新建
 *    图纸"（且首页按了没反应）、Ctrl+O 宣称"打开项目"实际在项目内被
 *    绑成"导入底图"、Ctrl+R/Ctrl+B/Ctrl+L/C+A/C+V/F2/F3/F11/所有
 *    Ctrl+Shift+字母"大多无任何处理器；表还能"修改/导入/导出/方案"，
 *    但没有任何运行时代码消费表里的键 ⇒ 改键是纯剧场。
 *  - 同一 window 上挂了 4~5 个互不知情的 keydown 监听器（ProjectView /
 *    DrawingView / CanvasViewport / DrawingTabs / SettingsShortcuts 编辑
 *    捕获），彼此双触发（Ctrl+T 同时新建图纸+切桥架工具；Ctrl+V 静默
 *    改工具；空格既点按钮又抓手）。
 *
 * 治理原则（本文件执行）：
 *  1. 单一所有权：每个键/组合只有一个 owner。键位分层：
 *     global（GlobalKeys，全应用）→ project（ProjectView，工作区内）→
 *     drawing（DrawingView，图纸页）→ canvas（CanvasViewport，画布工具）
 *     → tabs（DrawingTabs，页签）。上层不得抢占下层未消化的组合。
 *  2. 只登记已接线的动作。任何运行时无处理器的动作不得进入本表，
 *     也就不会出现在设置/帮助页上（杜绝"宣称即存在"的假面）。
 *  3. Help 页与设置页的快捷键表都从本表渲染，杜绝第二份手抄表漂移。
 *  4. 运行时冲突防线：registerKeyOwner 在开发期检测同一键被第二处注册
 *     时 console.error 报出来；单测（keymap.test.ts）对全表做静态查重。
 */

export type KeyScope = 'global' | 'project' | 'drawing' | 'canvas' | 'tabs';

export interface KeyBinding {
  /** 稳定 id，设置页/测试引用 */
  id: string;
  /** 动作名（中文，面向用户） */
  action: string;
  /** 说明（一句话） */
  description: string;
  /** 键序列，标准化小写：'ctrl+n'、'shift+w'、'delete'、'space' */
  keys: string[];
  /** 所有权层 */
  scope: KeyScope;
  /** 分类（帮助页分组用） */
  category: 'file' | 'edit' | 'view' | 'drawing' | 'device' | 'wiring' | 'window' | 'help';
}

/**
 * 已接线动作全集。新增条目必须同步：
 *  - 在对应 scope 组件里真实注册 keydown 处理器；
 *  - keymap.test.ts 会检查键位互不冲突；
 *  - （如新增 scope/动作）帮助页分组渲染自动带出，无需手抄。
 */
export const KEYMAP: KeyBinding[] = [
  // —— 全局（GlobalKeys.vue） ——
  { id: 'new-project', action: '新建项目', description: '创建新项目（未保存修改将先询问）', keys: ['ctrl+n'], scope: 'global', category: 'file' },
  { id: 'open-project', action: '打开项目', description: '打开现有 .survey 项目文件', keys: ['ctrl+o'], scope: 'global', category: 'file' },
  { id: 'settings', action: '设置', description: '打开设置页', keys: ['ctrl+,'], scope: 'global', category: 'window' },
  { id: 'toggle-sidebar', action: '切换侧边栏', description: '折叠/展开左侧面板', keys: ['f2'], scope: 'global', category: 'window' },
  { id: 'help', action: '帮助文档', description: '打开帮助页', keys: ['f1'], scope: 'global', category: 'help' },
  { id: 'select-all', action: '全选设备', description: '选中当前图纸的全部设备（画布在场时）', keys: ['ctrl+a'], scope: 'global', category: 'edit' },

  // —— 项目工作区（ProjectView.vue） ——
  { id: 'save-project', action: '保存项目', description: '保存到当前 .survey 文件', keys: ['ctrl+s'], scope: 'project', category: 'file' },
  { id: 'save-as', action: '另存为', description: '另存为新文件', keys: ['ctrl+shift+s'], scope: 'project', category: 'file' },
  { id: 'import-drawing', action: '导入图纸', description: '导入 CAD / 图片 / PDF 底图', keys: ['ctrl+i'], scope: 'project', category: 'file' },
  { id: 'export', action: '导出', description: '打开导出对话框', keys: ['ctrl+e'], scope: 'project', category: 'file' },
  { id: 'go-home', action: '返回首页', description: '回到项目列表', keys: ['ctrl+shift+h'], scope: 'project', category: 'window' },

  // —— 图纸标签页（DrawingTabs.vue） ——
  { id: 'new-drawing', action: '新建图纸', description: '添加新图纸标签页', keys: ['ctrl+t'], scope: 'tabs', category: 'drawing' },
  { id: 'close-drawing', action: '关闭图纸', description: '关闭当前图纸（删除前确认，Ctrl+Z 可撤销）', keys: ['ctrl+w'], scope: 'tabs', category: 'drawing' },
  { id: 'next-drawing', action: '下一张图纸', description: '切换到下一个标签页', keys: ['ctrl+tab'], scope: 'tabs', category: 'drawing' },
  { id: 'prev-drawing', action: '上一张图纸', description: '切换到上一个标签页', keys: ['ctrl+shift+tab'], scope: 'tabs', category: 'drawing' },
  { id: 'drawing-1-9', action: '切换图纸 1~9', description: '跳到第 N 个图纸标签页', keys: ['ctrl+1', 'ctrl+2', 'ctrl+3', 'ctrl+4', 'ctrl+5', 'ctrl+6', 'ctrl+7', 'ctrl+8', 'ctrl+9'], scope: 'tabs', category: 'drawing' },

  // —— 图纸视图（DrawingView.vue） ——
  { id: 'zoom-100', action: '实际大小', description: '100% 显示', keys: ['1'], scope: 'drawing', category: 'view' },
  // 0 = 适应视图：工具栏按钮 title 一直写着「适应视图 (0)」却无人注册（又一个
  // 宣称未接线），现补进处理器并登记为 zoom-fit 的第二个键位（与 Shift+1 同动作）。
  { id: 'zoom-fit', action: '缩放适应', description: '内容适应窗口', keys: ['shift+1', '0'], scope: 'drawing', category: 'view' },
  { id: 'zoom-selection', action: '缩放选中', description: '视图对准选区（暂以整体适应兜底）', keys: ['shift+2'], scope: 'drawing', category: 'view' },
  { id: 'toggle-grid', action: '切换网格', description: '显示/隐藏网格', keys: ['g'], scope: 'drawing', category: 'view' },
  { id: 'toggle-snap', action: '切换吸附', description: '启用/禁用吸附', keys: ['s'], scope: 'drawing', category: 'view' },
  { id: 'calibrate', action: '图纸校准', description: '打开校准向导', keys: ['ctrl+k'], scope: 'drawing', category: 'drawing' },

  // —— 画布工具（CanvasViewport.vue） ——
  { id: 'tool-select', action: '选择工具', description: '选择/移动对象', keys: ['v'], scope: 'canvas', category: 'view' },
  { id: 'tool-pan', action: '临时平移', description: '按住空格拖拽平移画布', keys: ['space'], scope: 'canvas', category: 'view' },
  { id: 'tool-device', action: '布点工具', description: '进入设备放置模式', keys: ['d'], scope: 'canvas', category: 'device' },
  { id: 'tool-wire', action: '布线工具', description: '进入手动布线模式', keys: ['w'], scope: 'canvas', category: 'wiring' },
  { id: 'tool-tray', action: '桥架工具', description: '绘制桥架（Enter/双击结束）', keys: ['t', 'shift+t'], scope: 'canvas', category: 'wiring' },
  { id: 'tool-well', action: '弱电井', description: '放置弱电井', keys: ['shift+w'], scope: 'canvas', category: 'wiring' },
  { id: 'tool-zoom', action: '缩放工具', description: '框选缩放区域', keys: ['z'], scope: 'canvas', category: 'view' },
  { id: 'zoom-in', action: '放大', description: '向上 zoom 一档', keys: ['ctrl+='], scope: 'canvas', category: 'view' },
  { id: 'zoom-out', action: '缩小', description: '向下 zoom 一档', keys: ['ctrl+-'], scope: 'canvas', category: 'view' },
  { id: 'zoom-wheel', action: '滚轮缩放', description: '以鼠标位置为中心缩放', keys: ['wheel'], scope: 'canvas', category: 'view' },
  { id: 'pan-wheel', action: '滚轮水平平移', description: '按住 Shift 滚动横向平移', keys: ['shift+wheel'], scope: 'canvas', category: 'view' },
  { id: 'pan-middle', action: '中键拖拽平移', description: '任何工具下按中键拖动画布', keys: ['middle'], scope: 'canvas', category: 'view' },
  { id: 'undo', action: '撤销', description: '撤销上一步（按图纸隔离的历史）', keys: ['ctrl+z'], scope: 'canvas', category: 'edit' },
  { id: 'redo', action: '重做', description: '重做最近撤销', keys: ['ctrl+y', 'ctrl+shift+z'], scope: 'canvas', category: 'edit' },
  { id: 'delete', action: '删除选中', description: '删除选中的设备', keys: ['delete'], scope: 'canvas', category: 'edit' },
  { id: 'cancel-mode', action: '取消/退出', description: '取消布线临时线、清空选中、退出工具', keys: ['escape'], scope: 'canvas', category: 'edit' },
  { id: 'finish-tray', action: '完成桥架', description: '桥架绘制中 Enter/双击收尾', keys: ['enter'], scope: 'canvas', category: 'wiring' },
];

/** 标准化键名（与处理器内 isKey(e,'ctrl+s') 的比较格式一致） */
export function normalizeKey(key: string): string {
  const k = key.toLowerCase();
  const map: Record<string, string> = {
    'ctrl+del': 'ctrl+delete',
    'ctrl+=': 'ctrl+=',
  };
  return map[k] ?? k;
}

/** 从 KeyboardEvent 生成标准键串（修饰键固定顺序 ctrl → shift → alt → 主键） */
export function eventKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  let main = e.key === ' ' ? 'space' : e.key.toLowerCase();
  // Ctrl+<symbol>：= + - , Tab 等保留字面；e.code 兜底 KeyX → x
  if (/^key[a-z]$/.test(main)) main = main.slice(3);
  if (main === 'tab') main = 'tab';
  parts.push(main);
  return parts.join('+');
}

/** UI 展示文案：'ctrl+shift+s' → 'Ctrl+Shift+S' */
export function describeKey(key: string): string {
  return key
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'shift') return 'Shift';
      if (part === 'alt') return 'Alt';
      if (part === 'wheelup') return '滚轮上';
      if (part === 'wheeldown') return '滚轮下';
      if (part === 'middle') return '中键';
      if (part === 'space') return 'Space';
      if (part === 'enter') return 'Enter';
      if (part === 'escape') return 'Esc';
      if (part === 'delete') return 'Del';
      return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
    })
    .join('+');
}

export const CATEGORY_LABELS: Record<KeyBinding['category'], string> = {
  file: '文件',
  edit: '编辑',
  view: '视图',
  drawing: '图纸',
  device: '设备',
  wiring: '布线',
  window: '窗口',
  help: '帮助',
};
