<template>
  <div class="settings-about">
    <div class="about-header">
      <div class="app-icon">
        <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </div>
      <div class="app-info">
        <h1 class="app-name">{{ appName }}</h1>
        <p class="app-version">版本 {{ appVersion }}</p>
        <p class="app-build">构建号: {{ buildNumber }}</p>
        <p class="app-channel" v-if="updateChannel">更新通道: {{ updateChannel }}</p>
      </div>
    </div>

    <el-divider />

    <div class="about-sections">
      <div class="about-section">
        <h3>技术栈</h3>
        <div class="tech-stack">
          <el-tag v-for="tech in techStack" :key="tech.name" :type="tech.type" effect="dark">
            {{ tech.name }} {{ tech.version }}
          </el-tag>
        </div>
      </div>

      <div class="about-section">
        <h3>核心依赖</h3>
        <div class="deps-grid">
          <div class="dep-item" v-for="dep in coreDeps" :key="dep.name">
            <span class="dep-name">{{ dep.name }}</span>
            <span class="dep-version">{{ dep.version }}</span>
            <span class="dep-desc">{{ dep.description }}</span>
          </div>
        </div>
      </div>

      <div class="about-section">
        <h3>Python 依赖</h3>
        <div class="deps-grid">
          <div class="dep-item" v-for="dep in pythonDeps" :key="dep.name">
            <span class="dep-name">{{ dep.name }}</span>
            <span class="dep-version">{{ dep.version }}</span>
            <span class="dep-desc">{{ dep.description }}</span>
          </div>
        </div>
      </div>

      <div class="about-section">
        <h3>开源协议</h3>
        <div class="license-info">
          <p>本软件基于 <strong>MIT 协议</strong> 开源</p>
          <el-button size="small" @click="viewLicense" icon="Document">查看完整协议</el-button>
        </div>
      </div>

      <div class="about-section">
        <h3>第三方组件许可</h3>
        <el-collapse v-model="activeLicenses" accordion>
          <el-collapse-item name="electron" title="Electron (MIT)">
            <p>Copyright (c) 2013-2024 GitHub Inc. and Electron contributors</p>
          </el-collapse-item>
          <el-collapse-item name="vue" title="Vue 3 (MIT)">
            <p>Copyright (c) 2013-present Evan You</p>
          </el-collapse-item>
          <el-collapse-item name="element-plus" title="Element Plus (MIT)">
            <p>Copyright (c) 2019-present Element Plus Contributors</p>
          </el-collapse-item>
          <el-collapse-item name="ezdxf" title="ezdxf (MIT)">
            <p>Copyright (c) 2011-2024 Manfred Moitzi</p>
          </el-collapse-item>
          <el-collapse-item name="pikepdf" title="pikepdf (MPL-2.0)">
            <p>Copyright (c) 2018-2024 pikepdf contributors</p>
          </el-collapse-item>
          <el-collapse-item name="other" title="其他依赖 (各自协议)">
            <p>完整列表请查看 <code>LICENSES.md</code> 或 <code>THIRD_PARTY_NOTICES.md</code></p>
          </el-collapse-item>
        </el-collapse>
      </div>

      <div class="about-section">
        <h3>致谢</h3>
        <p class="acknowledgements">
          感谢所有为开源社区做出贡献的开发者。特别感谢以下项目的维护者：
        </p>
        <ul class="acknowledgements-list">
          <li>Electron 团队 - 跨平台桌面应用框架</li>
          <li>Vue.js 团队 - 渐进式 JavaScript 框架</li>
          <li>Element Plus 团队 - Vue 3 组件库</li>
          <li>Manfred Moitzi - ezdxf DXF 解析库</li>
          <li>ODA (Open Design Alliance) - DWG 转换工具</li>
          <li>所有贡献代码、报告 Bug、提出建议的用户</li>
        </ul>
      </div>

      <div class="about-section">
        <h3>系统信息</h3>
        <div class="system-info">
          <div class="sys-item"><span class="sys-label">平台:</span> <span class="sys-value">{{ systemInfo.platform }}</span></div>
          <div class="sys-item"><span class="sys-label">架构:</span> <span class="sys-value">{{ systemInfo.arch }}</span></div>
          <div class="sys-item"><span class="sys-label">Electron:</span> <span class="sys-value">{{ systemInfo.electron }}</span></div>
          <div class="sys-item"><span class="sys-label">Chrome:</span> <span class="sys-value">{{ systemInfo.chrome }}</span></div>
          <div class="sys-item"><span class="sys-label">Node.js:</span> <span class="sys-value">{{ systemInfo.node }}</span></div>
          <div class="sys-item"><span class="sys-label">V8:</span> <span class="sys-value">{{ systemInfo.v8 }}</span></div>
          <div class="sys-item"><span class="sys-label">内存:</span> <span class="sys-value">{{ systemInfo.memory }}</span></div>
          <div class="sys-item"><span class="sys-label">应用路径:</span> <span class="sys-value">{{ systemInfo.appPath }}</span></div>
          <div class="sys-item"><span class="sys-label">用户数据:</span> <span class="sys-value">{{ systemInfo.userData }}</span></div>
        </div>
      </div>
    </div>

    <el-divider />

    <div class="about-links">
      <el-button @click="openWebsite" icon="Link">官方网站</el-button>
      <el-button @click="openGitHub" icon="Monitor">GitHub 仓库</el-button>
      <el-button @click="openIssues" icon="Warning">问题反馈</el-button>
      <el-button @click="openDiscussions" icon="ChatDotRound">讨论区</el-button>
      <el-button @click="checkUpdate" :loading="checkingUpdate" icon="Refresh">检查更新</el-button>
    </div>

    <div class="copyright">
      © 2024-{{ currentYear }} 安防勘点工具团队. 保留所有权利.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Link, Monitor, Warning, ChatDotRound, Refresh, Document } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue?: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const appName = '安防勘点布线工具';
const appVersion = '1.0.0-beta.1';
const buildNumber = '20241201-001';
const updateChannel = 'beta';
const currentYear = new Date().getFullYear();

const techStack = [
  { name: 'Electron', version: '28.x', type: 'primary' },
  { name: 'Vue', version: '3.4', type: 'success' },
  { name: 'TypeScript', version: '5.4', type: 'info' },
  { name: 'Vite', version: '5.x', type: 'warning' },
  { name: 'Element Plus', version: '2.6', type: 'danger' },
  { name: 'Pinia', version: '2.1', type: 'primary' },
  { name: 'Canvas 2D', version: '原生', type: 'success' },
  { name: 'IndexedDB', version: '原生', type: 'info' },
  { name: 'Python', version: '3.11+', type: 'warning' },
  { name: 'ezdxf', version: '1.2', type: 'danger' },
  { name: 'ODA Converter', version: '2024', type: 'primary' },
];

const coreDeps = [
  { name: 'vue-router', version: '4.3', description: '路由管理' },
  { name: '@vueuse/core', version: '10.9', description: '组合式工具库' },
  { name: 'mitt', version: '3.0', description: '事件总线' },
  { name: 'lodash-es', version: '4.17', description: '工具函数' },
  { name: 'uuid', version: '9.0', description: '唯一标识生成' },
  { name: 'jszip', version: '3.10', description: 'ZIP 压缩' },
  { name: 'file-saver', version: '2.0', description: '文件下载' },
  { name: 'xlsx', version: '0.18', description: 'Excel 导出' },
  { name: 'pdfkit', version: '0.14', description: 'PDF 生成' },
  { name: 'handlebars', version: '4.7', description: '模板引擎' },
  { name: 'canvas', version: '2.11', description: '服务端 Canvas' },
];

const pythonDeps = [
  { name: 'ezdxf', version: '1.2.0', description: 'DXF/DWG 解析' },
  { name: 'pikepdf', version: '8.0', description: 'PDF 处理' },
  { name: 'numpy', version: '1.26', description: '数值计算' },
  { name: 'shapely', version: '2.0', description: '几何运算' },
  { name: 'rtree', version: '1.0', description: '空间索引' },
  { name: 'click', version: '8.1', description: 'CLI 框架' },
];

const activeLicenses = ref<string[]>([]);

const systemInfo = ref({
  platform: '正在检测...',
  arch: '正在检测...',
  electron: '正在检测...',
  chrome: '正在检测...',
  node: '正在检测...',
  v8: '正在检测...',
  memory: '正在检测...',
  appPath: '正在检测...',
  userData: '正在检测...',
});

const checkingUpdate = ref(false);

onMounted(async () => {
  await loadSystemInfo();
});

async function loadSystemInfo() {
  try {
    // const info = await window.electronAPI.getSystemInfo();
    // systemInfo.value = info;
    systemInfo.value = {
      platform: `${process.platform} ${process.version}`,
      arch: process.arch,
      electron: '28.2.0',
      chrome: '120.0.6099.0',
      node: process.version,
      v8: '12.0',
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      appPath: '/Applications/安防勘点工具.app',
      userData: '~/Library/Application Support/安防勘点工具',
    };
  } catch (e) {
    console.error('Failed to load system info', e);
  }
}

function viewLicense() {
  // 打开 LICENSE 文件
  ElMessage.info('LICENSE 文件查看功能开发中...');
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

function openDiscussions() {
  window.open('https://github.com/example/security-survey-tool/discussions', '_blank');
}

async function checkUpdate() {
  checkingUpdate.value = true;
  try {
    // const result = await window.electronAPI.checkUpdate();
    // if (result.hasUpdate) {
    //   ElMessageBox.confirm(`发现新版本 ${result.version}，是否立即下载？`, '更新可用', {
    //     confirmButtonText: '下载',
    //     cancelButtonText: '稍后',
    //   }).then(() => window.electronAPI.downloadUpdate());
    // } else {
    //   ElMessage.success('已是最新版本');
    // }
    ElMessage.success('检查更新功能开发中...');
  } catch (e) {
    ElMessage.error('检查更新失败');
  } finally {
    checkingUpdate.value = false;
  }
}
</script>

<style scoped>
.settings-about {
  max-width: 800px;
  padding: 8px 0;
}

.about-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px 0;
}

.app-icon {
  flex-shrink: 0;
  color: #3b82f6;
  filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3));
}

.app-info {
  flex: 1;
}

.app-name {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-version {
  margin: 0 0 4px;
  font-size: 16px;
  color: var(--text-secondary);
}

.app-build {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}

.app-channel {
  margin: 0;
  font-size: 12px;
  color: #f59e0b;
  font-weight: 500;
}

.about-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.about-section {
  padding: 0 4px;
}

.about-section h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.deps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.dep-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.dep-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.dep-version {
  color: #3b82f6;
  font-size: 12px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}

.dep-desc {
  color: var(--text-tertiary);
  font-size: 11px;
}

.license-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.acknowledgements {
  margin: 0 0 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.acknowledgements-list {
  margin: 0;
  padding-left: 20px;
  color: var(--text-secondary);
  line-height: 2;
  font-size: 13px;
}

.system-info {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.sys-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.sys-label {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  min-width: 80px;
}

.sys-value {
  flex: 1;
  color: var(--text-primary);
  font-size: 12px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  word-break: break-all;
}

.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  padding: 24px 0;
}

.copyright {
  text-align: center;
  padding: 16px 0;
  color: var(--text-tertiary);
  font-size: 12px;
  border-top: 1px solid var(--border-color);
}
</style>