<template>
  <div class="help-view">
    <div class="help-header">
      <h1 class="page-title">帮助与文档</h1>
      <p class="page-subtitle">快速上手指南、功能详解、常见问题、快捷键参考</p>
    </div>

    <div class="help-layout">
      <!-- 左侧导航 -->
      <nav class="help-nav" aria-label="帮助导航">
        <div class="help-search">
          <el-input
            v-model="searchText"
            placeholder="搜索帮助..."
            size="small"
            prefix-icon="Search"
            clearable
            @input="filterContent"
          />
        </div>

        <div class="nav-sections">
          <div class="nav-section" v-for="section in navSections" :key="section.id">
            <div class="nav-section-title" @click="section.collapsed = !section.collapsed">
              <component :is="section.icon" class="section-icon" :class="{ rotated: section.collapsed }" />
              <span>{{ section.title }}</span>
              <el-icon :class="{ rotated: section.collapsed }"><ArrowDown /></el-icon>
            </div>
            <div class="nav-items" :class="{ collapsed: section.collapsed }">
              <div
                v-for="item in section.items"
                :key="item.id"
                class="nav-item"
                :class="{ active: activeItem === item.id }"
                @click="selectItem(item)"
              >
                <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
                <span>{{ item.title }}</span>
                <el-tag v-if="item.badge" :type="item.badgeType" size="small">{{ item.badge }}</el-tag>
              </div>
            </div>
          </div>
        </div>

        <div class="nav-footer">
          <el-button @click="openWebsite" icon="Link" size="small">官网</el-button>
          <el-button @click="openGitHub" icon="Platform" size="small">GitHub</el-button>
          <el-button @click="openIssues" icon="ChatDotRound" size="small">反馈</el-button>
        </div>
      </nav>

      <!-- 右侧内容 -->
      <div class="help-content">
        <div class="content-header">
          <h2 v-if="activeContent">{{ activeContent.title }}</h2>
          <div class="content-meta" v-if="activeContent">
            <span v-if="activeContent.updated">更新: {{ activeContent.updated }}</span>
            <span v-if="activeContent.readTime">阅读: {{ activeContent.readTime }}</span>
          </div>
        </div>

        <div class="content-body" v-if="activeContent">
          <div class="content-toc" v-if="activeContent.toc && activeContent.toc.length > 0">
            <h4>目录</h4>
            <ul>
              <li v-for="heading in activeContent.toc" :key="heading.id">
                <a :href="`#${heading.id}`" @click="scrollToHeading(heading.id)">{{ heading.text }}</a>
              </li>
            </ul>
          </div>

          <!--
            安全约束（XSS 加固）：activeContent.html 必须始终为本组件内联的可信静态内容
            （即下方 contentMap 各 section 的 html 字段），严禁接入远程接口、用户输入、
            或项目/外部文件内容。原因：本应用运行在 Electron 渲染进程中，渲染进程可通过 IPC
            触达本地文件系统，一旦 v-html 注入了不可信 HTML（如攻击者构造的 <script> 或
            on* 事件属性），即可造成 XSS，进而读写用户本地文件。
            下方 v-html 已通过 script 内的 sanitizeHtml() 做防御性净化，但净化只是兜底，
            真正的信任边界仍是内容来源——切勿放宽 contentMap 的来源管控。
          -->
          <div class="markdown-content" v-html="activeContent.html" ref="contentRef" />

          <div class="content-actions">
            <el-button @click="printContent" icon="Printer" size="small">打印</el-button>
            <el-button @click="exportContent" icon="Download" size="small">导出 PDF</el-button>
            <el-button @click="copyLink" icon="CopyDocument" size="small">复制链接</el-button>
          </div>
        </div>

        <!-- 欢迎页 -->
        <div class="welcome-page" v-if="!activeContent">
          <div class="welcome-icon">
            <el-icon><HelpFilled /></el-icon>
          </div>
          <h2>欢迎使用监控安防勘察布线工具</h2>
          <p class="welcome-desc">一站式安防系统设计、勘察、布线与文档生成平台</p>

          <div class="quick-start">
            <h3>快速开始</h3>
            <div class="quick-steps">
              <div class="step">
                <span class="step-num">1</span>
                <div class="step-info">
                  <h4>新建项目</h4>
                  <p>点击「新建项目」或按 <kbd>Ctrl+N</kbd> 创建项目</p>
                </div>
              </div>
              <div class="step">
                <span class="step-num">2</span>
                <div class="step-info">
                  <h4>导入图纸</h4>
                  <p>拖拽 DWG/DXF 文件或按 <kbd>Ctrl+I</kbd> 导入</p>
                </div>
              </div>
              <div class="step">
                <span class="step-num">3</span>
                <div class="step-info">
                  <h4>校准比例</h4>
                  <p>按 <kbd>Ctrl+K</kbd> 打开校准向导，设置图纸比例</p>
                </div>
              </div>
              <div class="step">
                <span class="step-num">4</span>
                <div class="step-info">
                  <h4>放置设备</h4>
                  <p>从左侧设备库拖拽摄像机、报警器等设备到图纸</p>
                </div>
              </div>
              <div class="step">
                <span class="step-num">5</span>
                <div class="step-info">
                  <h4>自动布线</h4>
                  <p>在侧栏「布线」面板点「全自动布线」，一键生成拓扑布线（需先有设备与弱电井）</p>
                </div>
              </div>
              <div class="step">
                <span class="step-num">6</span>
                <div class="step-info">
                  <h4>导出成果</h4>
                  <p>按 <kbd>Ctrl+E</kbd> 导出点位图、BOM、工程报告</p>
                </div>
              </div>
            </div>
          </div>

          <div class="welcome-links">
            <el-button type="primary" @click="selectItem({ id: 'getting-started' })" icon="VideoPlay">观看入门教程</el-button>
            <el-button @click="selectItem({ id: 'shortcuts' })" icon="Keyboard">查看快捷键</el-button>
            <el-button @click="openGitHub" icon="Platform">GitHub 仓库</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { KEYMAP, CATEGORY_LABELS, describeKey, type KeyBinding } from '@/keymap';
import {
  Document, FolderOpened, Picture, Setting, Upload, Download, Refresh,
  Search, ArrowDown, Link, Platform, ChatDotRound,
  VideoPlay, HelpFilled, Printer, CopyDocument
} from '@element-plus/icons-vue';

const props = defineProps<{}>();
const emit = defineEmits<{}>();

const searchText = ref('');
const activeItem = ref<string>('getting-started');
const activeContent = ref<any>(null);
const contentRef = ref<HTMLElement>();

// 导航结构
const navSections = ref([
  {
    id: 'start',
    title: '快速上手',
    icon: 'VideoPlay',
    collapsed: false,
    items: [
      { id: 'getting-started', title: '入门教程', icon: 'Document', badge: '必读', badgeType: 'primary' },
      { id: 'create-project', title: '创建项目', icon: 'FolderOpened' },
      { id: 'import-drawing', title: '导入图纸', icon: 'Picture' },
      { id: 'calibrate', title: '图纸校准', icon: 'Setting' },
      { id: 'place-devices', title: '放置设备', icon: 'Upload' },
      { id: 'auto-wiring', title: '自动布线', icon: 'Refresh' },
      { id: 'export-results', title: '导出成果', icon: 'Download' },
    ],
  },
  {
    id: 'drawing',
    title: '图纸管理',
    icon: 'Picture',
    collapsed: true,
    items: [
      { id: 'drawing-overview', title: '图纸概览', icon: 'Document' },
      { id: 'multi-drawing', title: '多图纸标签', icon: 'FolderOpened' },
      { id: 'layers', title: '图层管理', icon: 'Setting' },
      { id: 'calibration-adv', title: '高级校准', icon: 'Search' },
      { id: 'drawing-templates', title: '图纸模板', icon: 'Picture' },
    ],
  },
  {
    id: 'devices',
    title: '设备库与部署',
    icon: 'Upload',
    collapsed: true,
    items: [
      { id: 'device-library', title: '设备库浏览', icon: 'Document' },
      { id: 'custom-devices', title: '自定义设备', icon: 'Setting' },
      { id: 'device-params', title: '参数配置', icon: 'Setting' },
      { id: 'fov-analysis', title: '视场分析', icon: 'Search', badge: '核心', badgeType: 'danger' },
      { id: 'batch-deploy', title: '批量部署', icon: 'Refresh' },
    ],
  },
  {
    id: 'wiring',
    title: '布线设计',
    icon: 'Refresh',
    collapsed: true,
    items: [
      { id: 'manual-wiring', title: '手动布线', icon: 'Document' },
      { id: 'auto-wiring', title: '自动布线算法', icon: 'Setting' },
      { id: 'topology', title: '拓扑图生成', icon: 'Picture' },
      { id: 'wells-trays', title: '弱电井与桥架', icon: 'FolderOpened' },
      { id: 'cable-specs', title: '线缆规格库', icon: 'Setting' },
    ],
  },
  {
    id: 'export',
    title: '导出与报告',
    icon: 'Download',
    collapsed: true,
    items: [
      { id: 'point-map', title: '点位图', icon: 'Picture' },
      { id: 'topology-export', title: '拓扑图', icon: 'Picture' },
      { id: 'fov-export', title: '视场分析图', icon: 'Picture' },
      { id: 'bom-export', title: 'BOM 清单', icon: 'Document' },
      { id: 'report-export', title: '工程报告', icon: 'Document', badge: '核心', badgeType: 'danger' },
      { id: 'templates', title: '报告模板', icon: 'Setting' },
    ],
  },
  {
    id: 'advanced',
    title: '进阶功能',
    icon: 'Setting',
    collapsed: true,
    items: [
      { id: 'shortcuts', title: '快捷键大全', icon: 'Keyboard' },
      { id: 'settings', title: '设置详解', icon: 'Setting' },
      { id: 'performance', title: '性能优化', icon: 'Search' },
      { id: 'troubleshooting', title: '常见问题', icon: 'Search' },
      { id: 'python-env', title: 'Python 环境', icon: 'Setting' },
    ],
  },
]);

const filteredSections = computed(() => {
  if (!searchText.value) return navSections.value;

  const search = searchText.value.toLowerCase();
  return navSections.value
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.id.toLowerCase().includes(search)
      ),
    }))
    .filter(section => section.items.length > 0);
});

function selectItem(item: any) {
  activeItem.value = item.id;
  loadContent(item.id);
}

function filterContent() {
  // 搜索时自动展开匹配的分组
  for (const section of filteredSections.value) {
    section.collapsed = false;
  }
}

// 轻量 HTML 净化（防御性，不依赖 DOMPurify）
// 移除 <script> 元素、所有 on* 事件属性、以及 javascript: 协议的 href/src/xlink:href。
// 这只是兜底防线；真正的信任边界是内容来源（见模板 v-html 上方注释）。
function sanitizeHtml(dirty: string): string {
  if (!dirty) return dirty;
  const doc = new DOMParser().parseFromString(dirty, 'text/html');
  // 1. 移除所有 <script> 元素（内联与外部引用）
  doc.querySelectorAll('script').forEach((el) => el.remove());
  // 2. 移除 on* 事件属性，并清洗 javascript: 协议
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (
        (name === 'href' || name === 'src' || name === 'xlink:href') &&
        value.startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}


/**
 * 快捷键章节由 keymap（唯一真相源）生成 —— 帮助页不再手抄表格。
 * 此前手抄表里一半的键没有任何处理器（Ctrl+R 标尺、Ctrl+B 批量部署、
 * 全部 Ctrl+Shift+字母 快速导出、F11 全屏……），宣称与实现漂移。
 */
const SHORTCUT_GROUPS: Array<{ tocId: string; title: string; categories: KeyBinding['category'][] }> = [
  { tocId: 'global', title: '全局通用', categories: ['file', 'window', 'help'] },
  { tocId: 'canvas', title: '画布操作', categories: ['view'] },
  { tocId: 'drawing', title: '图纸管理', categories: ['drawing'] },
  { tocId: 'device', title: '设备与布线', categories: ['device', 'wiring'] },
  { tocId: 'edit', title: '编辑操作', categories: ['edit'] },
];

function shortcutToc() {
  return SHORTCUT_GROUPS.map(g => ({ id: g.tocId, text: g.title }));
}

function rowsFor(categories: KeyBinding['category'][]): string {
  return KEYMAP.filter(b => categories.includes(b.category))
    .map(b => `<tr><td><kbd>${b.keys.map(describeKey).join('</kbd> / <kbd>')}</kbd></td><td>${b.action}</td><td>${b.description}</td></tr>`)
    .join('\n          ');
}

function shortcutTablesHtml(): string {
  return SHORTCUT_GROUPS.map(g => `
        <h2 id="${g.tocId}">${g.title}</h2>
        <table>
          <thead><tr><th>快捷键</th><th>功能</th><th>说明</th></tr></thead>
          <tbody>
          ${rowsFor(g.categories)}
          </tbody>
        </table>`).join('\n') + `
        <p><em>本表由代码内的按键注册表自动生成：只列出真实接线可用的快捷键。若发现表中按键无响应，属于缺陷，请反馈。</em></p>
      `;
}

async function loadContent(id: string) {
  // TODO: 从本地文件或远程加载 Markdown 内容
  // 这里使用模拟数据
  const contentMap: Record<string, any> = {
    'getting-started': {
      title: '入门教程',
      updated: '2026-07-20',
      readTime: '15 分钟',
      toc: [
        { id: 'overview', text: '产品概览' },
        { id: 'workflow', text: '核心工作流' },
        { id: 'ui', text: '界面布局' },
        { id: 'tips', text: '使用技巧' },
      ],
      html: `
        <h2 id="overview">产品概览</h2>
        <p>监控安防勘察布线工具是一款面向安防工程师、系统集成商、设计院的专业桌面应用。它集成了 <strong>DWG/DXF 图纸解析</strong>、<strong>设备库管理</strong>、<strong>视场分析</strong>、<strong>自动布线</strong>、<strong>多格式导出</strong> 等核心功能，帮助您从现场勘察到交付文档的全流程数字化。</p>

        <h2 id="workflow">核心工作流</h2>
        <ol>
          <li><strong>建立项目</strong> - 创建项目、设置基本信息、选择模板</li>
          <li><strong>导入图纸</strong> - 支持 DWG/DXF/PDF，自动识别图框、比例</li>
          <li><strong>校准坐标</strong> - 两点法/已知距离/比例尺多种校准方式</li>
          <li><strong>布放设备</strong> - 从 20+ 内置设备库拖拽，支持自定义设备</li>
          <li><strong>视场验证</strong> - 实时 FOV 覆盖率热力图、盲区自动标注</li>
          <li><strong>智能布线</strong> - MST/曼哈顿/斯坦纳树多算法，避让障碍物</li>
          <li><strong>生成文档</strong> - 一键导出点位图、拓扑图、BOM、Word/PDF 报告</li>
        </ol>

        <h2 id="ui">界面布局</h2>
        <ul>
          <li><strong>顶部栏</strong> - 返回首页、项目名与面包屑、保存/另存为、导入图纸、导出方案、侧边栏折叠、设置（图标按钮，非下拉菜单）</li>
          <li><strong>左侧面板</strong> - 设备库、项目树、图层管理、弱电井/桥架</li>
          <li><strong>中间画布</strong> - 图纸显示、设备放置、布线绘制、多标签页</li>
          <li><strong>右侧面板</strong> - 属性面板、布线详情、视场参数、搜索</li>
          <li><strong>底部状态栏</strong> - 坐标、缩放、实体统计、吸附/网格状态、单位/比例</li>
        </ul>

        <h2 id="tips">使用技巧</h2>
        <ul>
          <li><kbd>空格</kbd>+<kbd>左键拖拽</kbd> = 平移画布</li>
          <li><kbd>滚轮</kbd> = 以鼠标为中心缩放</li>
          <li><kbd>Shift</kbd>+<kbd>滚轮</kbd> = 水平平移</li>
          <li><kbd>S</kbd> = 切换吸附，<kbd>G</kbd> = 切换网格</li>
          <li><kbd>1</kbd> = 100%，<kbd>Shift+1</kbd> = 缩放适应</li>
          <li>双击设备图标 = 编辑属性，右键 = 上下文菜单</li>
          <li>框选时按住 <kbd>Shift</kbd> = 追加选择，<kbd>Alt</kbd> = 减去选择</li>
        </ul>
      `,
    },
    'create-project': {
      title: '创建项目',
      updated: '2026-07-20',
      readTime: '5 分钟',
      toc: [],
      html: `
        <h2>创建新项目</h2>
        <p>启动应用后，点击欢迎页的「新建项目」，或按 <kbd>Ctrl+N</kbd>。</p>

        <h3>项目信息</h3>
        <ul>
          <li><strong>项目名称</strong>：必填，用于文档标题、文件命名</li>
          <li><strong>项目编号</strong>：可选，工程编号，如 <code>PRJ-2026-001</code></li>
          <li><strong>设计单位</strong>：您的公司/部门名称</li>
          <li><strong>项目描述</strong>：简要说明项目范围、地点、要求</li>
        </ul>

        <h3>模板选择</h3>
        <p>可选择预设模板快速开始：</p>
        <ul>
          <li><strong>标准安防工程</strong> - 含摄像机、报警、门禁、布线完整模板</li>
          <li><strong>视频监控专项</strong> - 侧重摄像机布放与视场分析</li>
          <li><strong>周界报警专项</strong> - 侧重红外/电子围栏/振动光缆</li>
          <li><strong>门禁考勤专项</strong> - 侧重门禁控制器、读头、电锁</li>
          <li><strong>空白项目</strong> - 完全自定义</li>
        </ul>

        <h3>默认设置</h3>
        <p>创建时会应用「设置 → 图纸 → 默认图纸设置」中的单位、比例、纸张大小等。</p>
      `,
    },
    'import-drawing': {
      title: '导入图纸',
      updated: '2026-07-20',
      readTime: '8 分钟',
      toc: [
        { id: 'formats', text: '支持格式' },
        { id: 'methods', text: '导入方式' },
        { id: 'dwg', text: 'DWG 转换' },
        { id: 'calibration', text: '导入后校准' },
      ],
      html: `
        <h2 id="formats">支持格式</h2>
        <table>
          <thead><tr><th>格式</th><th>扩展名</th><th>解析方式</th><th>备注</th></tr></thead>
          <tbody>
            <tr><td>DXF</td><td>.dxf</td><td>原生 (ezdxf)</td><td>推荐，解析最快最完整</td></tr>
            <tr><td>DWG</td><td>.dwg</td><td>ODA File Converter → DXF</td><td>需安装 ODA，自动后台转换</td></tr>
            <tr><td>PDF</td><td>.pdf</td><td>pdfjs + 矢量提取</td><td>仅矢量 PDF，位图不可编辑</td></tr>
            <tr><td>图片</td><td>.jpg/.png/.tif</td><td>作为底图参照</td><td>需手动校准，不解析实体</td></tr>
          </tbody>
        </table>

        <h2 id="methods">导入方式</h2>
        <ul>
          <li><strong>拖拽导入</strong>：将文件直接拖入画布区域或标签栏「+」旁</li>
          <li><strong>按钮导入</strong>：顶部栏「导入图纸」图标，或按 <kbd>Ctrl+I</kbd></li>
          <li><strong>项目树导入</strong>：右键项目 → 导入图纸</li>
        </ul>

        <h2 id="dwg">DWG 转换</h2>
        <p>首次导入 DWG 时会提示配置 ODA File Converter：</p>
        <ol>
          <li>下载 <a href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank">ODA File Converter</a> (免费)</li>
          <li>安装后在「设置 → 高级 → Python 环境」中指定路径</li>
          <li>后续导入 DWG 自动后台转换为 DXF 再解析</li>
        </ol>
        <p>转换进度显示在底部状态栏，完成后自动打开新标签页。</p>

        <h2 id="calibration">导入后校准</h2>
        <p>导入完成后建议立即校准：</p>
        <ol>
          <li>按 <kbd>Ctrl+K</kbd> 打开校准向导</li>
          <li>选择「两点法」：点击图纸上两个已知距离的点</li>
          <li>输入实际距离（米），系统自动计算比例</li>
          <li>或选择「比例尺法」：框选图纸上的比例尺标注</li>
          <li>确认后，状态栏单位/比例将更新</li>
        </ol>
      `,
    },
    'shortcuts': {
      title: '快捷键大全',
      updated: '2026-09-12',
      readTime: '5 分钟',
      toc: shortcutToc(),
      html: shortcutTablesHtml(),
    },
    'troubleshooting': {
      title: '常见问题',
      updated: '2026-07-20',
      readTime: '15 分钟',
      toc: [
        { id: 'dwg-fail', text: 'DWG 导入失败' },
        { id: 'python-missing', text: 'Python/ezdxf 缺失' },
        { id: 'performance', text: '大图纸卡顿' },
        { id: 'calibrate-wrong', text: '校准比例不对' },
        { id: 'export-blank', text: '导出内容为空' },
        { id: 'font-missing', text: '中文显示乱码' },
      ],
      html: `
        <h2 id="dwg-fail">DWG 导入失败</h2>
        <h3>现象</h3>
        <p>拖入 .dwg 文件后，长时间无反应，或报错「转换失败」。</p>
        <h3>排查步骤</h3>
        <ol>
          <li>确认已安装 <strong>ODA File Converter</strong> (官网免费下载)</li>
          <li>在「设置 → 高级 → Python 环境」中检查 ODA 路径是否正确</li>
          <li>尝试手动运行：<code>ODAFileConverter input.dwg output.dxf</code> 验证文件本身</li>
          <li>DWG 版本过新？ODA 支持至 AutoCAD 2024，更高版本请另存为低版本</li>
          <li>文件损坏？用 TrueView 或 AutoCAD 打开测试，另存为 DXF 再导入</li>
        </ol>

        <h2 id="python-missing">Python/ezdxf 缺失</h2>
        <h3>现象</h3>
        <p>启动时提示「未检测到 Python 环境」或「ezdxf 模块未安装」。</p>
        <h3>解决</h3>
        <ol>
          <li>安装 Python 3.10+ (推荐 3.11)，勾选「Add to PATH」</li>
          <li>运行：<code>pip install ezdxf==1.2.0</code></li>
          <li>在设置中点击「检测 Python 环境」验证</li>
          <li>或使用内置便携版 Python（设置 → 高级 → 使用内置环境）</li>
        </ol>

        <h2 id="performance">大图纸卡顿</h2>
        <h3>现象</h3>
        <p>实体数 > 5万 时，平移缩放延迟明显。</p>
        <h3>优化建议</h3>
        <ul>
          <li>开启「设置 → 画布 → 性能 → 视口剔除」</li>
          <li>开启「LOD 简化」，设置阈值 5-10px</li>
          <li>隐藏不需要的图层（图层面板）</li>
          <li>关闭「显示网格」「显示标尺」</li>
          <li>设置「最大渲染实体数」为 20000</li>
          <li>拆分大图纸：按楼层/区域导入多个标签页</li>
        </ul>

        <h2 id="calibrate-wrong">校准比例不对</h2>
        <h3>现象</h3>
        <p>设备尺寸、线缆长度与实际不符，或导出比例错误。</p>
        <h3>检查</h3>
        <ol>
          <li>状态栏显示的单位/比例是否正确 (如 <code>1:100</code>)</li>
          <li>校准时选取的两点距离是否准确（避免吸附到错误点）</li>
          <li>图纸原始单位：DWG 可能是英寸/英尺，需在校准向导中指定</li>
          <li>多点校准：勾选「高级 → 多点校准」获得更高精度</li>
        </ol>

        <h2 id="export-blank">导出内容为空</h2>
        <h3>现象</h3>
        <p>导出的 PDF/PNG 空白，或只有图框无内容。</p>
        <h3>排查</h3>
        <ol>
          <li>确认当前图纸有可见图层（图层面板检查）</li>
          <li>视口是否偏移到空白区域（按 <kbd>Shift+1</kbd> 适应）</li>
          <li>导出选项中「包含图框」「包含图层」是否勾选</li>
          <li>矢量输出模式下，实体过多可能超时，尝试位图模式</li>
        </ol>

        <h2 id="font-missing">中文显示乱码/缺字</h2>
        <h3>现象</h3>
        <p>DXF 中文文字显示为 □ 或乱码，导出 PDF 字体缺失。</p>
        <h3>解决</h3>
        <ol>
          <li>系统安装 <code>SimSun</code>、<code>SimHei</code>、<code>Microsoft YaHei</code></li>
          <li>设置 → 画布 → 字体回退链中添加中文字体</li>
          <li>导出 PDF 时开启「嵌入字体」选项</li>
          <li>DXF 导入时指定正确编码 (GBK/UTF-8)</li>
        </ol>
      `,
    },
  };

  // 防御性净化后再交给 v-html（内容必须为内联可信静态内容，见模板注释）
  const assignContent = (item: any) => {
    activeContent.value = { ...item, html: sanitizeHtml(item.html) };
  };

  if (contentMap[id]) {
    assignContent(contentMap[id]);
  } else {
    // 默认加载入门教程
    assignContent(contentMap['getting-started']);
  }
}

function scrollToHeading(id: string) {
  nextTick(() => {
    const el = contentRef.value?.querySelector(`#${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function printContent() {
  window.print();
}

function exportContent() {
  ElMessage.info('导出 PDF 功能开发中...');
}

function copyLink() {
  if (activeContent.value) {
    const url = `${window.location.origin}/help#${activeItem.value}`;
    navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  }
}

function openWebsite() {
  window.open('https://example.com', '_blank');
}

function openGitHub() {
  window.open('https://github.com/example/security-survey-tool', '_blank');
}

function openIssues() {
  window.open('https://github.com/example/security-survey-tool/issues', '_blank');
}

onMounted(() => {
  // 从 URL hash 恢复
  const hash = window.location.hash.slice(1);
  if (hash) {
    const found = navSections.value.some(s => s.items.some(i => i.id === hash));
    if (found) {
      selectItem({ id: hash });
      return;
    }
  }
  loadContent('getting-started');
});

watch(activeItem, (newId) => {
  window.location.hash = newId;
});
</script>

<style scoped>
.help-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.help-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.help-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.help-nav {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.help-search {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.nav-sections {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 4px;
}

.nav-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  user-select: none;
}

.nav-section-title:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.section-icon {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.section-icon.rotated {
  transform: rotate(-90deg);
}

.nav-items {
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.15s;
}

.nav-items.collapsed {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  font-weight: 500;
}

.nav-item.active .el-icon {
  color: #3b82f6;
}

.nav-footer {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  justify-content: center;
}

.help-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 48px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.content-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.content-header h2 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.content-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.content-body {
  line-height: 1.8;
}

.content-toc {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  max-width: 280px;
}

.content-toc h4 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.content-toc ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.content-toc li {
  margin: 6px 0;
}

.content-toc a {
  color: #3b82f6;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.15s;
}

.content-toc a:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.markdown-content {
  font-size: 14px;
  color: var(--text-primary);
}

.markdown-content h2 {
  margin: 32px 0 16px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.markdown-content h3 {
  margin: 24px 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.markdown-content p {
  margin: 12px 0;
}

.markdown-content ul, .markdown-content ol {
  margin: 12px 0;
  padding-left: 24px;
}

.markdown-content li {
  margin: 6px 0;
}

.markdown-content code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.9em;
  color: #ef4444;
}

.markdown-content pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-content pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: 13px;
}

.markdown-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
}

.markdown-content th, .markdown-content td {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.markdown-content th {
  background: var(--bg-tertiary);
  font-weight: 600;
}

.markdown-content kbd {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.85em;
  box-shadow: 0 1px 0 var(--border-color);
}

.markdown-content a {
  color: #3b82f6;
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.content-actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.welcome-page {
  text-align: center;
  padding: 60px 20px;
  max-width: 700px;
  margin: 0 auto;
}

.welcome-icon {
  font-size: 64px;
  color: #3b82f6;
  margin-bottom: 24px;
}

.welcome-page h2 {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.welcome-desc {
  margin: 0 0 40px;
  font-size: 16px;
  color: var(--text-secondary);
}

.quick-start {
  text-align: left;
  margin-bottom: 40px;
}

.quick-start h3 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.quick-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.step {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s;
}

.step:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.1);
}

.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  border-radius: 50%;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.step-info h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-info p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.step-info kbd {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.welcome-links {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 响应式 */
@media (max-width: 1024px) {
  .help-nav {
    width: 240px;
  }

  .help-content {
    padding: 24px 32px;
  }

  .quick-steps {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .help-layout {
    flex-direction: column;
  }

  .help-nav {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    max-height: 300px;
  }

  .help-content {
    padding: 20px;
  }

  .quick-steps {
    grid-template-columns: 1fr;
  }
}
</style>