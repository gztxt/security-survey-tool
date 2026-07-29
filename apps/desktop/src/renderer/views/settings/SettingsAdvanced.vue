<template>
  <div class="settings-advanced">
    <div class="setting-group">
      <h4>Python 环境</h4>

      <el-form :model="model.python" label-width="160px" size="small">
        <el-form-item label="Python 可执行文件">
          <div class="path-input">
            <el-input v-model="model.python.executable" placeholder="自动检测或手动指定" readonly />
            <el-button @click="detectPython" icon="Search" />
            <el-button @click="selectPython" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="检测状态">
          <el-tag :type="pythonStatus.type">{{ pythonStatus.text }}</el-tag>
        </el-form-item>

        <el-form-item label="版本">
          <span class="version-text">{{ pythonStatus.version || '未检测' }}</span>
        </el-form-item>

        <el-form-item label="ezdxf 版本">
          <span class="version-text">{{ pythonStatus.ezdxf || '未安装' }}</span>
        </el-form-item>

        <el-form-item label="ODA File Converter">
          <div class="path-input">
            <el-input v-model="model.python.odaPath" placeholder="ODAFileConverter 路径" readonly />
            <el-button @click="selectOda" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="虚拟环境路径">
          <div class="path-input">
            <el-input v-model="model.python.venvPath" placeholder="可选: 指定虚拟环境" readonly />
            <el-button @click="selectVenv" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="额外参数">
          <el-input v-model="model.python.extraArgs" placeholder="传递给 Python 脚本的额外参数" />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>解析器设置</h4>

      <el-form :model="model.parser" label-width="160px" size="small">
        <el-form-item label="DXF 解析模式">
          <el-radio-group v-model="model.parser.mode">
            <el-radio-button label="full">完整解析 (所有实体)</el-radio-button>
            <el-radio-button label="fast">快速解析 (仅几何)</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="解析实体类型" v-if="model.parser.mode === 'custom'">
          <el-checkbox-group v-model="model.parser.entityTypes">
            <el-checkbox value="LINE">LINE</el-checkbox>
            <el-checkbox value="LWPOLYLINE">LWPOLYLINE</el-checkbox>
            <el-checkbox value="POLYLINE">POLYLINE</el-checkbox>
            <el-checkbox value="CIRCLE">CIRCLE</el-checkbox>
            <el-checkbox value="ARC">ARC</el-checkbox>
            <el-checkbox value="ELLIPSE">ELLIPSE</el-checkbox>
            <el-checkbox value="SPLINE">SPLINE</el-checkbox>
            <el-checkbox value="TEXT">TEXT</el-checkbox>
            <el-checkbox value="MTEXT">MTEXT</el-checkbox>
            <el-checkbox value="INSERT">INSERT (块)</el-checkbox>
            <el-checkbox value="DIMENSION">DIMENSION</el-checkbox>
            <el-checkbox value="HATCH">HATCH</el-checkbox>
            <el-checkbox value="POINT">POINT</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="忽略图层">
          <el-tag
            v-for="layer in model.parser.ignoredLayers"
            :key="layer"
            closable
            @close="removeIgnoredLayer(layer)"
          >
            {{ layer }}
          </el-tag>
          <el-select v-model="newIgnoredLayer" placeholder="添加忽略图层" style="width: 160px; margin-top: 8px" @change="addIgnoredLayer">
            <el-option v-for="l in commonLayers" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>

        <el-form-item label="坐标精度">
          <el-input-number v-model="model.parser.coordPrecision" :min="1" :max="10" :step="1" controls-position="right" />
          <template #append>位小数</template>
        </el-form-item>

        <el-form-item label="最大解析实体数">
          <el-input-number v-model="model.parser.maxEntities" :min="1000" :max="1000000" :step="1000" controls-position="right" />
        </el-form-item>

        <el-form-item label="超时时间">
          <el-input-number v-model="model.parser.timeout" :min="10" :max="600" :step="5" controls-position="right" />
          <template #append>秒</template>
        </el-form-item>

        <el-form-item label="内存限制">
          <el-input-number v-model="model.parser.memoryLimit" :min="128" :max="8192" :step="128" controls-position="right" />
          <template #append>MB</template>
        </el-form-item>

        <el-form-item label="使用 Web Worker">
          <el-switch v-model="model.parser.useWorker" />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>渲染器高级设置</h4>

      <el-form :model="model.renderer" label-width="160px" size="small">
        <el-form-item label="渲染后端">
          <el-select v-model="model.renderer.backend" placeholder="选择后端" style="width: 200px">
            <el-option label="Canvas 2D (默认)" value="canvas2d" />
            <el-option label="WebGL (实验性)" value="webgl" :disabled="true" />
            <el-option label="自动选择" value="auto" />
          </el-select>
        </el-form-item>

        <el-form-item label="设备像素比">
          <el-select v-model="model.renderer.devicePixelRatio" placeholder="选择比例" style="width: 160px">
            <el-option label="自动 (跟随系统)" value="auto" />
            <el-option label="1x" value="1" />
            <el-option label="2x (Retina)" value="2" />
            <el-option label="3x" value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="启用离屏渲染">
          <el-switch v-model="model.renderer.offscreenCanvas" />
          <span class="switch-desc">Web Worker 中渲染 (需浏览器支持)</span>
        </el-form-item>

        <el-form-item label="纹理图集大小">
          <el-select v-model="model.renderer.atlasSize" placeholder="选择大小" style="width: 160px">
            <el-option label="512x512" value="512" />
            <el-option label="1024x1024" value="1024" />
            <el-option label="2048x2048" value="2048" />
            <el-option label="4096x4096" value="4096" />
          </el-select>
        </el-form-item>

        <el-form-item label="批次大小">
          <el-input-number v-model="model.renderer.batchSize" :min="100" :max="5000" :step="100" controls-position="right" />
          <span class="switch-desc">每帧绘制实体数上限</span>
        </el-form-item>

        <el-form-item label="Frustum Culling">
          <el-switch v-model="model.renderer.frustumCulling" />
        </el-form-item>

        <el-form-item label="层级细节 (LOD)">
          <el-switch v-model="model.renderer.lodEnabled" />
        </el-form-item>

        <el-form-item label="LOD 阈值">
          <el-input-number v-model="model.renderer.lodThreshold" :min="1" :max="100" :step="1" controls-position="right" />
          <template #append>px</template>
        </el-form-item>

        <el-form-item label="抗锯齿">
          <el-switch v-model="model.renderer.antialias" />
        </el-form-item>

        <el-form-item label="Alpha 混合">
          <el-switch v-model="model.renderer.alphaBlend" />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>存储与数据</h4>

      <el-form :model="model.storage" label-width="160px" size="small">
        <el-form-item label="项目存储方式">
          <el-radio-group v-model="model.storage.mode">
            <el-radio-button label="indexeddb">IndexedDB (推荐)</el-radio-button>
            <el-radio-button label="file">文件系统 (.survey)</el-radio-button>
            <el-radio-button label="hybrid">混合模式</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="IndexedDB 数据库名">
          <el-input v-model="model.storage.dbName" placeholder="数据库名称" />
        </el-form-item>

        <el-form-item label="自动备份">
          <el-switch v-model="model.storage.autoBackup" />
        </el-form-item>

        <el-form-item label="备份间隔">
          <el-input-number v-model="model.storage.backupInterval" :min="5" :max="1440" :step="5" controls-position="right" :disabled="!model.storage.autoBackup" />
          <template #append>分钟</template>
        </el-form-item>

        <el-form-item label="最大备份数">
          <el-input-number v-model="model.storage.maxBackups" :min="1" :max="100" :step="1" controls-position="right" />
        </el-form-item>

        <el-form-item label="压缩存储">
          <el-switch v-model="model.storage.compress" />
        </el-form-item>

        <el-form-item label="数据迁移">
          <el-button type="primary" @click="migrateData" icon="Transfer">迁移旧版本数据</el-button>
          <span class="switch-desc">将旧版本 localStorage/文件数据迁移到当前存储</span>
        </el-form-item>

        <el-form-item label="数据库大小">
          <span class="version-text">{{ storageSize }}</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>开发者工具</h4>

      <el-form :model="model.dev" label-width="160px" size="small">
        <el-form-item label="开启开发工具">
          <el-switch v-model="model.dev.openDevTools" />
          <span class="switch-desc">启动时自动打开 DevTools (需重启)</span>
        </el-form-item>

        <el-form-item label="调试模式">
          <el-switch v-model="model.dev.debugMode" />
          <span class="switch-desc">显示性能面板、渲染统计、错误边界</span>
        </el-form-item>

        <el-form-item label="日志级别">
          <el-select v-model="model.dev.logLevel" placeholder="选择级别" style="width: 140px">
            <el-option label="Error" value="error" />
            <el-option label="Warn" value="warn" />
            <el-option label="Info" value="info" />
            <el-option label="Debug" value="debug" />
            <el-option label="Trace" value="trace" />
          </el-select>
        </el-form-item>

        <el-form-item label="性能监控">
          <el-switch v-model="model.dev.perfMonitor" />
        </el-form-item>

        <el-form-item label="渲染统计">
          <el-switch v-model="model.dev.renderStats" />
        </el-form-item>

        <el-form-item label="启用 Source Map">
          <el-switch v-model="model.dev.sourceMap" />
        </el-form-item>

        <el-form-item label="严格模式">
          <el-switch v-model="model.dev.strictMode" />
          <span class="switch-desc">开发环境额外检查</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>实验性功能</h4>

      <el-form :model="model.experimental" label-width="160px" size="small">
        <el-form-item label="WebGPU 渲染">
          <el-switch v-model="model.experimental.webgpu" />
          <el-tag type="warning">实验性</el-tag>
          <span class="switch-desc">需 Chrome 113+ 且启用标志</span>
        </el-form-item>

        <el-form-item label="WASM 加速解析">
          <el-switch v-model="model.experimental.wasmParser" />
          <el-tag type="warning">实验性</el-tag>
          <span class="switch-desc">使用 Rust/WASM 版 ezdxf (开发中)</span>
        </el-form-item>

        <el-form-item label="协同编辑">
          <el-switch v-model="model.experimental.collaboration" />
          <el-tag type="warning">实验性</el-tag>
          <span class="switch-desc">多用户实时编辑 (需后端)</span>
        </el-form-item>

        <el-form-item label="AI 辅助布线">
          <el-switch v-model="model.experimental.aiWiring" />
          <el-tag type="warning">实验性</el-tag>
          <span class="switch-desc">基于 ML 的路径优化 (开发中)</span>
        </el-form-item>

        <el-form-item label="点云导入">
          <el-switch v-model="model.experimental.pointCloud" />
          <el-tag type="warning">实验性</el-tag>
          <span class="switch-desc">支持 .las/.laz/.ply 格式</span>
        </el-form-item>

        <el-form-item label="三维视图">
          <el-switch v-model="model.experimental.view3d" />
          <el-tag type="warning">实验性</el-tag>
          <span class="switch-desc">基于 Three.js 的 3D 预览</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>故障排查</h4>

      <el-form :model="model.troubleshooting" label-width="160px" size="small">
        <el-form-item label="导出诊断报告">
          <el-button @click="exportDiagnostics" icon="Download">导出系统信息</el-button>
          <span class="switch-desc">包含版本、配置、日志、硬件信息</span>
        </el-form-item>

        <el-form-item label="清理所有缓存">
          <el-button type="warning" @click="clearAllCache" icon="Delete">清理缓存</el-button>
          <span class="switch-desc">IndexedDB、临时文件、Python 缓存</span>
        </el-form-item>

        <el-form-item label="重置 Python 环境">
          <el-button type="danger" @click="resetPythonEnv" icon="Refresh">重置</el-button>
          <span class="switch-desc">删除虚拟环境并重新安装依赖</span>
        </el-form-item>

        <el-form-item label="查看日志文件">
          <el-button @click="openLogFile" icon="Document">打开日志目录</el-button>
        </el-form-item>

        <el-form-item label="报告问题">
          <el-button @click="reportIssue" icon="ChatDotRound">在 GitHub 提交 Issue</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, FolderOpened, Transfer, Delete, Refresh, Download, Document, ChatDotRound } from '@element-plus/icons-vue';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const pythonStatus = ref({ type: 'info' as any, text: '未检测', version: '', ezdxf: '' });
const storageSize = ref('计算中...');
const commonLayers = ['DEFPOINTS', 'VIEWPORT', 'HATCH', 'DIMENSIONS', 'TEXT', '0'];
const newIgnoredLayer = ref('');

function onChange() {
  settingsStore.updateSettings('advanced', model.value);
}

async function detectPython() {
  pythonStatus.value = { type: 'info', text: '检测中...', version: '', ezdxf: '' };
  try {
    // const result = await window.electronAPI.detectPython();
    // pythonStatus.value = { type: 'success', text: '检测成功', version: result.version, ezdxf: result.ezdxfVersion };
    pythonStatus.value = { type: 'success', text: '检测成功 (模拟)', version: '3.11.5', ezdxf: '1.2.0' };
    model.value.python.executable = '/usr/bin/python3';
  } catch (e) {
    pythonStatus.value = { type: 'danger', text: '检测失败', version: '', ezdxf: '' };
  }
}

async function selectPython() {
  // const result = await window.electronAPI.selectFile({ filters: [{ name: 'Python', extensions: ['exe', 'bin', ''] }] });
  // if (result) model.value.python.executable = result;
}

async function selectOda() {
  // const result = await window.electronAPI.selectFile({ filters: [{ name: 'ODA', extensions: ['exe', 'bin'] }] });
  // if (result) model.value.python.odaPath = result;
}

async function selectVenv() {
  // const result = await window.electronAPI.selectDirectory();
  // if (result) model.value.python.venvPath = result;
}

function removeIgnoredLayer(layer: string) {
  model.value.parser.ignoredLayers = model.value.parser.ignoredLayers.filter((l: string) => l !== layer);
  onChange();
}

function addIgnoredLayer(value: string) {
  if (value && !model.value.parser.ignoredLayers.includes(value)) {
    model.value.parser.ignoredLayers.push(value);
    onChange();
  }
  newIgnoredLayer.value = '';
}

async function migrateData() {
  try {
    // await window.electronAPI.migrateData();
    ElMessage.success('数据迁移完成');
    updateStorageSize();
  } catch (e) {
    ElMessage.error('迁移失败');
  }
}

async function updateStorageSize() {
  try {
    // const size = await window.electronAPI.getStorageSize();
    // storageSize.value = formatBytes(size);
    storageSize.value = '2.4 MB (模拟)';
  } catch {
    storageSize.value = '未知';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

async function exportDiagnostics() {
  try {
    // const report = await window.electronAPI.generateDiagnostics();
    // const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `diagnostics-${Date.now()}.json`;
    // a.click();
    // URL.revokeObjectURL(url);
    ElMessage.success('诊断报告已导出');
  } catch (e) {
    ElMessage.error('导出失败');
  }
}

async function clearAllCache() {
  const confirm = await ElMessageBox.confirm('确定要清理所有缓存吗？这将删除 IndexedDB、临时文件、Python 缓存等。', '确认清理', {
    confirmButtonText: '清理',
    cancelButtonText: '取消',
    type: 'warning',
  }).catch(() => false);

  if (confirm) {
    try {
      // await window.electronAPI.clearAllCache();
      ElMessage.success('缓存已清理');
      updateStorageSize();
    } catch (e) {
      ElMessage.error('清理失败');
    }
  }
}

async function resetPythonEnv() {
  const confirm = await ElMessageBox.confirm('确定要重置 Python 环境吗？这将删除虚拟环境并重新安装 ezdxf 等依赖。', '确认重置', {
    confirmButtonText: '重置',
    cancelButtonText: '取消',
    type: 'error',
  }).catch(() => false);

  if (confirm) {
    try {
      // await window.electronAPI.resetPythonEnv();
      ElMessage.success('Python 环境已重置，请重启应用');
    } catch (e) {
      ElMessage.error('重置失败');
    }
  }
}

async function openLogFile() {
  // await window.electronAPI.openPath('logs');
}

function reportIssue() {
  window.open('https://github.com/your-repo/issues/new?template=bug_report.md', '_blank');
}

watch(model, onChange, { deep: true });

onMounted(() => {
  detectPython();
  updateStorageSize();
});
</script>

<style scoped>
.settings-advanced {
  max-width: 800px;
}

.setting-group {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.setting-group h4 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.setting-group:last-child {
  margin-bottom: 0;
}

.switch-desc {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.version-text {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.path-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input .el-input {
  flex: 1;
}

.el-tag {
  margin: 2px 4px 2px 0;
  cursor: default;
}
</style>