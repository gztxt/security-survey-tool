<template>
  <div class="export-view">
    <div class="export-header">
      <h1 class="page-title">导出与报告</h1>
      <p class="page-subtitle">生成点位图、拓扑图、视场分析、BOM清单、工程报告等多种格式</p>
    </div>

    <div class="export-layout">
      <!-- 左侧：导出任务配置 -->
      <div class="export-config">
        <el-card class="config-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h3>导出配置</h3>
              <el-button size="small" link @click="loadPreset">载入预设</el-button>
            </div>
          </template>

          <!-- 项目信息 -->
          <div class="config-section">
            <h4>项目信息</h4>
            <el-form :model="exportConfig.project" label-width="80px" size="small">
              <el-form-item label="项目名称" prop="name">
                <el-input v-model="exportConfig.project.name" placeholder="输入项目名称" />
              </el-form-item>
              <el-form-item label="项目编号" prop="code">
                <el-input v-model="exportConfig.project.code" placeholder="输入项目编号" />
              </el-form-item>
              <el-form-item label="设计单位" prop="designer">
                <el-input v-model="exportConfig.project.designer" placeholder="输入设计单位" />
              </el-form-item>
              <el-form-item label="日期" prop="date">
                <el-date-picker v-model="exportConfig.project.date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" placeholder="选择日期" />
              </el-form-item>
            </el-form>
          </div>

          <!-- 导出类型选择 -->
          <div class="config-section">
            <h4>导出内容</h4>
            <div class="export-types">
              <label
                v-for="type in exportTypes"
                :key="type.id"
                class="export-type-item"
                :class="{ selected: exportConfig.types.includes(type.id) }"
                @click="toggleExportType(type.id)"
              >
                <div class="type-icon" :style="{ background: type.color }">
                  <component :is="type.icon" width="20" height="20" />
                </div>
                <div class="type-info">
                  <span class="type-name">{{ type.name }}</span>
                  <span class="type-desc">{{ type.description }}</span>
                </div>
                <div class="type-checkbox">
                  <el-checkbox v-model="exportConfig.types" :label="type.id" :disabled="type.disabled" />
                </div>
              </label>
            </div>
          </div>

          <!-- 格式选择 -->
          <div class="config-section">
            <h4>输出格式</h4>
            <div class="format-options">
              <el-radio-group v-model="exportConfig.format" size="small">
                <el-radio-button :label="fmt.value" v-for="fmt in outputFormats" :key="fmt.value">
                  {{ fmt.label }}
                </el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <!-- 详细选项 -->
          <div class="config-section" v-if="exportConfig.types.length > 0">
            <h4>详细选项</h4>
            <div class="detail-options">
              <!-- 点位图选项 -->
              <el-collapse v-model="activeOptions" accordion>
                <el-collapse-item name="pointmap" title="点位图选项">
                  <el-form :model="exportConfig.options.pointmap" label-width="120px" size="small">
                    <el-form-item label="包含图例" prop="legend">
                      <el-switch v-model="exportConfig.options.pointmap.legend" />
                    </el-form-item>
                    <el-form-item label="显示设备编号" prop="showIds">
                      <el-switch v-model="exportConfig.options.pointmap.showIds" />
                    </el-form-item>
                    <el-form-item label="显示FOV轮廓" prop="showFov">
                      <el-switch v-model="exportConfig.options.pointmap.showFov" />
                    </el-form-item>
                    <el-form-item label="图纸边框" prop="border">
                      <el-select v-model="exportConfig.options.pointmap.border" placeholder="选择边框" style="width: 100%">
                        <el-option label="标准A4横向" value="a4-landscape" />
                        <el-option label="标准A3横向" value="a3-landscape" />
                        <el-option label="标准A2横向" value="a2-landscape" />
                        <el-option label="标准A1横向" value="a1-landscape" />
                        <el-option label="自动适应" value="auto" />
                        <el-option label="无边框" value="none" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="分辨率" prop="dpi">
                      <el-select v-model="exportConfig.options.pointmap.dpi" placeholder="选择分辨率" style="width: 100%">
                        <el-option label="150 DPI" value="150" />
                        <el-option label="300 DPI (推荐)" value="300" />
                        <el-option label="600 DPI" value="600" />
                      </el-select>
                    </el-form-item>
                  </el-form>
                </el-collapse-item>

                <el-collapse-item name="topology" title="拓扑图选项">
                  <el-form :model="exportConfig.options.topology" label-width="120px" size="small">
                    <el-form-item label="显示线缆类型" prop="showCableType">
                      <el-switch v-model="exportConfig.options.topology.showCableType" />
                    </el-form-item>
                    <el-form-item label="显示线缆长度" prop="showLength">
                      <el-switch v-model="exportConfig.options.topology.showLength" />
                    </el-form-item>
                    <el-form-item label="显示弱电井/桥架" prop="showWells">
                      <el-switch v-model="exportConfig.options.topology.showWells" />
                    </el-form-item>
                    <el-form-item label="布局算法" prop="layout">
                      <el-select v-model="exportConfig.options.topology.layout" placeholder="选择布局" style="width: 100%">
                        <el-option label="自动层次" value="hierarchical" />
                        <el-option label="力导向" value="force-directed" />
                        <el-option label="环形" value="circular" />
                        <el-option label="网格" value="grid" />
                      </el-select>
                    </el-form-item>
                  </el-form>
                </el-collapse-item>

                <el-collapse-item name="fov" title="视场分析选项">
                  <el-form :model="exportConfig.options.fov" label-width="120px" size="small">
                    <el-form-item label="显示覆盖率热力图" prop="heatmap">
                      <el-switch v-model="exportConfig.options.fov.heatmap" />
                    </el-form-item>
                    <el-form-item label="显示盲区标注" prop="blindSpots">
                      <el-switch v-model="exportConfig.options.fov.blindSpots" />
                    </el-form-item>
                    <el-form-item label="显示重叠区域" prop="overlap">
                      <el-switch v-model="exportConfig.options.fov.overlap" />
                    </el-form-item>
                    <el-form-item label="颜色方案" prop="colorScheme">
                      <el-select v-model="exportConfig.options.fov.colorScheme" placeholder="选择方案" style="width: 100%">
                        <el-option label="红黄绿 (标准)" value="ryg" />
                        <el-option label="蓝紫红" value="bpr" />
                        <el-option label="灰度" value="grayscale" />
                      </el-select>
                    </el-form-item>
                  </el-form>
                </el-collapse-item>

                <el-collapse-item name="bom" title="BOM清单选项">
                  <el-form :model="exportConfig.options.bom" label-width="120px" size="small">
                    <el-form-item label="按类别分组" prop="groupByCategory">
                      <el-switch v-model="exportConfig.options.bom.groupByCategory" />
                    </el-form-item>
                    <el-form-item label="包含价格估算" prop="includePrice">
                      <el-switch v-model="exportConfig.options.bom.includePrice" />
                    </el-form-item>
                    <el-form-item label="包含规格参数" prop="includeSpecs">
                      <el-switch v-model="exportConfig.options.bom.includeSpecs" />
                    </el-form-item>
                    <el-form-item label="导出格式" prop="format">
                      <el-radio-group v-model="exportConfig.options.bom.format">
                        <el-radio-button label="excel">Excel</el-radio-button>
                        <el-radio-button label="csv">CSV</el-radio-button>
                        <el-radio-button label="pdf">PDF</el-radio-button>
                      </el-radio-group>
                    </el-form-item>
                  </el-form>
                </el-collapse-item>

                <el-collapse-item name="report" title="工程报告选项">
                  <el-form :model="exportConfig.options.report" label-width="120px" size="small">
                    <el-form-item label="包含封面" prop="cover">
                      <el-switch v-model="exportConfig.options.report.cover" />
                    </el-form-item>
                    <el-form-item label="包含目录" prop="toc">
                      <el-switch v-model="exportConfig.options.report.toc" />
                    </el-form-item>
                    <el-form-item label="包含修订记录" prop="revisions">
                      <el-switch v-model="exportConfig.options.report.revisions" />
                    </el-form-item>
                    <el-form-item label="报告模板" prop="template">
                      <el-select v-model="exportConfig.options.report.template" placeholder="选择模板" style="width: 100%">
                        <el-option label="标准工程报告" value="standard" />
                        <el-option label="简版报告" value="simple" />
                        <el-option label="详细技术规格书" value="detailed" />
                        <el-option label="自定义..." value="custom" />
                      </el-select>
                    </el-form-item>
                  </el-form>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="config-actions">
            <el-button @click="savePreset" icon="Download">保存为预设</el-button>
            <el-button type="primary" @click="startExport" :loading="exporting" :disabled="exportConfig.types.length === 0 || exporting" icon="Upload">
              开始导出
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 右侧：预览与历史 -->
      <div class="export-preview">
        <!-- 预览区 -->
        <el-card class="preview-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h3>预览</h3>
              <div class="preview-actions">
                <el-select v-model="previewType" placeholder="选择预览" size="small" style="width: 140px" @change="updatePreview">
                  <el-option v-for="t in exportConfig.types" :key="t" :label="getTypeLabel(t)" :value="t" />
                </el-select>
              </div>
            </div>
          </template>

          <div class="preview-content">
            <div v-if="previewLoading" class="preview-loading">
              <el-icon><Loading /></el-icon>
              <span>正在生成预览...</span>
            </div>

            <div v-else-if="previewError" class="preview-error">
              <el-icon><Warning /></el-icon>
              <span>{{ previewError }}</span>
              <el-button size="small" @click="updatePreview">重试</el-button>
            </div>

            <div v-else-if="previewData" class="preview-data">
              <!-- 图片预览 -->
              <img v-if="previewType === 'pointmap' || previewType === 'fov' || previewType === 'topology'" :src="previewData" alt="预览" class="preview-image" />

              <!-- PDF预览 -->
              <iframe v-else-if="previewType === 'report'" :src="previewData" class="preview-pdf" />

              <!-- 表格预览 -->
              <div v-else-if="previewType === 'bom'" class="preview-table-wrapper">
                <el-table :data="previewData" border size="small" style="width: 100%">
                  <el-table-column prop="category" label="类别" width="120" />
                  <el-table-column prop="name" label="设备名称" min-width="150" />
                  <el-table-column prop="model" label="型号" width="120" />
                  <el-table-column prop="quantity" label="数量" width="80" align="center" />
                  <el-table-column prop="unit" label="单位" width="60" align="center" />
                  <el-table-column prop="spec" label="规格" min-width="150" />
                  <el-table-column v-if="exportConfig.options.bom.includePrice" prop="price" label="单价(元)" width="100" align="right" />
                  <el-table-column v-if="exportConfig.options.bom.includePrice" prop="total" label="合计(元)" width="100" align="right" />
                </el-table>
              </div>
            </div>

            <div v-else class="preview-empty">
              <el-icon><Document /></el-icon>
              <p>选择导出类型并配置选项后点击预览</p>
            </div>
          </div>
        </el-card>

        <!-- 导出历史 -->
        <el-card class="history-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h3>导出历史</h3>
              <el-button size="small" link @click="clearHistory">清空</el-button>
            </div>
          </template>

          <div v-if="exportHistory.length === 0" class="history-empty">
            <el-icon><Document /></el-icon>
            <p>暂无导出记录</p>
          </div>

          <div v-else class="history-list">
            <div
              v-for="item in exportHistory"
              :key="item.id"
              class="history-item"
              @click="reopenExport(item)"
            >
              <div class="history-icon" :style="{ background: item.color }">
                <component :is="item.icon" width="16" height="16" />
              </div>
              <div class="history-info">
                <div class="history-name">{{ item.name }}</div>
                <div class="history-meta">{{ item.type }} · {{ formatTime(item.time) }} · {{ item.format }}</div>
              </div>
              <div class="history-actions">
                <el-button size="small" link @click.stop="downloadExport(item)">下载</el-button>
                <el-button size="small" link @click.stop="deleteHistoryItem(item.id)">删除</el-button>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 导出进度对话框 -->
    <el-dialog v-model="exportDialogVisible" :title="exportDialogTitle" width="500px" :before-close="handleExportDialogClose" destroy-on-close>
      <div class="export-progress">
        <div class="progress-header">
          <div class="progress-spinner">
            <el-icon><Loading /></el-icon>
          </div>
          <div class="progress-info">
            <p class="progress-title">{{ exportProgress.current }}</p>
            <p class="progress-detail">{{ exportProgress.detail }}</p>
          </div>
        </div>
        <el-progress :percentage="exportProgress.percentage" :status="exportProgress.status" stroke-width="8" />
        <div class="progress-steps">
          <div
            v-for="(step, idx) in exportProgress.steps"
            :key="step"
            class="progress-step"
            :class="{ active: idx === exportProgress.currentStep, done: idx < exportProgress.currentStep, error: exportProgress.status === 'exception' && idx === exportProgress.currentStep }"
          >
            <span class="step-icon">{{ idx + 1 }}</span>
            <span class="step-label">{{ step }}</span>
          </div>
        </div>
        <div v-if="exportProgress.status === 'success'" class="progress-success">
          <el-icon><CheckCircle /></el-icon>
          <span>导出完成！</span>
          <el-button size="small" @click="openExportFolder">打开文件夹</el-button>
          <el-button size="small" type="primary" @click="exportDialogVisible = false">完成</el-button>
        </div>
        <div v-if="exportProgress.status === 'exception'" class="progress-error">
          <el-icon><CloseCircle /></el-icon>
          <span>导出失败：{{ exportProgress.error }}</span>
          <el-button size="small" @click="retryExport">重试</el-button>
          <el-button size="small" type="primary" @click="exportDialogVisible = false">关闭</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading, Warning, Document, CheckCircle, CloseCircle } from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/project';
import { useExportStore } from '@/stores/export'; // 假设存在

const projectStore = useProjectStore();
// const exportStore = useExportStore();

const props = defineProps<{}>();
const emit = defineEmits<{}>();

const exporting = ref(false);
const exportDialogVisible = ref(false);
const exportDialogTitle = ref('正在导出...');
const previewType = ref<string>('');
const previewLoading = ref(false);
const previewError = ref<string | null>(null);
const previewData = ref<any>(null);
const activeOptions = ref<string[]>(['pointmap']);

// 导出类型定义
const exportTypes = [
  {
    id: 'pointmap',
    name: '点位图',
    description: '设备布局平面图，含编号、FOV轮廓、图例',
    icon: 'PointMapIcon',
    color: '#3b82f6',
    disabled: false,
  },
  {
    id: 'topology',
    name: '拓扑图',
    description: '系统拓扑结构图，含线缆走向、弱电井、桥架',
    icon: 'TopologyIcon',
    color: '#10b981',
    disabled: false,
  },
  {
    id: 'fov',
    name: '视场分析',
    description: '覆盖率热力图、盲区标注、重叠区域分析',
    icon: 'FovIcon',
    color: '#f59e0b',
    disabled: false,
  },
  {
    id: 'bom',
    name: 'BOM清单',
    description: '物料清单，按类别分组，含规格、数量、价格',
    icon: 'BomIcon',
    color: '#8b5cf6',
    disabled: false,
  },
  {
    id: 'report',
    name: '工程报告',
    description: '完整工程报告，含封面、目录、正文、附件',
    icon: 'ReportIcon',
    color: '#ef4444',
    disabled: false,
  },
];

const outputFormats = [
  { value: 'pdf', label: 'PDF' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'docx', label: 'Word' },
];

const exportConfig = ref({
  project: {
    name: '',
    code: '',
    designer: '',
    date: new Date().toISOString().split('T')[0],
  },
  types: [] as string[],
  format: 'pdf',
  options: {
    pointmap: {
      legend: true,
      showIds: true,
      showFov: true,
      border: 'auto',
      dpi: 300,
    },
    topology: {
      showCableType: true,
      showLength: true,
      showWells: true,
      layout: 'hierarchical',
    },
    fov: {
      heatmap: true,
      blindSpots: true,
      overlap: true,
      colorScheme: 'ryg',
    },
    bom: {
      groupByCategory: true,
      includePrice: false,
      includeSpecs: true,
      format: 'excel',
    },
    report: {
      cover: true,
      toc: true,
      revisions: true,
      template: 'standard',
    },
  },
});

const exportProgress = ref({
  percentage: 0,
  status: 'active' as 'active' | 'success' | 'exception',
  current: '',
  detail: '',
  steps: [] as string[],
  currentStep: 0,
  error: '',
});

const exportHistory = ref<Array<any>>([]);

// 图标组件
const PointMapIcon = { template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><circle cx="15" cy="9" r="2"></circle><circle cx="9" cy="15" r="2"></circle><circle cx="15" cy="15" r="2"></circle>` };
const TopologyIcon = { template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><circle cx="4" cy="4" r="2"></circle><circle cx="20" cy="4" r="2"></circle><circle cx="4" cy="20" r="2"></circle><circle cx="20" cy="20" r="2"></circle><line x1="12" y1="15" x2="12" y2="22"></line><line x1="12" y1="9" x2="12" y2="6"></line><line x1="9" y1="12" x2="6" y2="12"></line><line x1="15" y1="12" x2="18" y2="12"></line>` };
const FovIcon = { template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>` };
const BomIcon = { template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>` };
const ReportIcon = { template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>` };

onMounted(() => {
  loadLastConfig();
  loadHistory();
  // 默认选中点位图
  if (exportConfig.value.types.length === 0) {
    exportConfig.value.types = ['pointmap'];
  }
  previewType.value = exportConfig.value.types[0];
});

function getTypeLabel(id: string) {
  return exportTypes.find(t => t.id === id)?.name || id;
}

function toggleExportType(typeId: string) {
  const idx = exportConfig.value.types.indexOf(typeId);
  if (idx > -1) {
    exportConfig.value.types.splice(idx, 1);
  } else {
    exportConfig.value.types.push(typeId);
  }
  if (!previewType.value || !exportConfig.value.types.includes(previewType.value)) {
    previewType.value = exportConfig.value.types[0] || '';
  }
}

async function updatePreview() {
  if (!previewType.value) return;
  previewLoading.value = true;
  previewError.value = null;
  previewData.value = null;

  try {
    // TODO: 调用导出服务生成预览
    // const result = await exportStore.generatePreview(previewType.value, exportConfig.value);
    // previewData.value = result;
    previewError.value = '预览功能开发中...';
  } catch (err: any) {
    previewError.value = err.message || '预览生成失败';
  } finally {
    previewLoading.value = false;
  }
}

function startExport() {
  exporting.value = true;
  exportDialogVisible.value = true;
  exportDialogTitle.value = '正在导出...';

  const types = exportConfig.value.types;
  exportProgress.value = {
    percentage: 0,
    status: 'active',
    current: '初始化...',
    detail: `准备导出 ${types.length} 项内容`,
    steps: types.map(t => getTypeLabel(t)),
    currentStep: 0,
    error: '',
  };

  // 模拟导出过程
  runExportSimulation();
}

async function runExportSimulation() {
  const steps = exportProgress.value.steps;
  for (let i = 0; i < steps.length; i++) {
    exportProgress.value.currentStep = i;
    exportProgress.value.current = `正在生成 ${steps[i]}...`;
    exportProgress.value.detail = `处理中 (${i + 1}/${steps.length})`;

    for (let p = 0; p <= 100; p += 10) {
      exportProgress.value.percentage = Math.round((i / steps.length) * 100 + p / steps.length);
      await new Promise(r => setTimeout(r, 50));
    }
  }

  exportProgress.value.percentage = 100;
  exportProgress.value.status = 'success';
  exportProgress.value.current = '导出完成';
  exportProgress.value.detail = '所有文件已生成';

  exporting.value = false;
  saveToHistory();
}

function saveToHistory() {
  const item = {
    id: Date.now().toString(),
    name: exportConfig.value.project.name || '未命名导出',
    type: exportConfig.value.types.map(getTypeLabel).join(', '),
    format: exportConfig.value.format.toUpperCase(),
    time: new Date().toISOString(),
    color: exportTypes.find(t => t.id === exportConfig.value.types[0])?.color || '#3b82f6',
    icon: exportTypes.find(t => t.id === exportConfig.value.types[0])?.icon || 'Document',
    config: JSON.parse(JSON.stringify(exportConfig.value)),
  };
  exportHistory.value.unshift(item);
  if (exportHistory.value.length > 50) exportHistory.value.pop();
  saveHistory();
}

function reopenExport(item: any) {
  exportConfig.value = item.config;
  previewType.value = exportConfig.value.types[0] || '';
  activeOptions.value = ['pointmap'];
  updatePreview();
}

function downloadExport(item: any) {
  ElMessage.info('下载功能开发中...');
}

function deleteHistoryItem(id: string) {
  exportHistory.value = exportHistory.value.filter(h => h.id !== id);
  saveHistory();
}

function clearHistory() {
  ElMessageBox.confirm('确定要清空所有导出历史吗？', '确认清空', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    exportHistory.value = [];
    saveHistory();
    ElMessage.success('历史已清空');
  }).catch(() => {});
}

function savePreset() {
  ElMessage.info('保存预设功能开发中...');
}

function loadPreset() {
  ElMessage.info('载入预设功能开发中...');
}

function loadLastConfig() {
  const saved = localStorage.getItem('export-last-config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      exportConfig.value = { ...exportConfig.value, ...parsed };
    } catch {}
  }
}

function saveHistory() {
  localStorage.setItem('export-history', JSON.stringify(exportHistory.value));
}

function loadHistory() {
  const saved = localStorage.getItem('export-history');
  if (saved) {
    try {
      exportHistory.value = JSON.parse(saved);
    } catch {}
  }
}

function formatTime(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return d.toLocaleDateString('zh-CN');
}

function handleExportDialogClose(done: () => void) {
  if (exportProgress.value.status === 'active') {
    ElMessageBox.confirm('导出正在进行中，确定要取消吗？', '确认取消', {
      confirmButtonText: '取消导出',
      cancelButtonText: '继续等待',
      type: 'warning',
    }).then(() => {
      exporting.value = false;
      exportProgress.value.status = 'exception';
      exportProgress.value.error = '用户取消';
      done();
    }).catch(() => {});
  } else {
    done();
  }
}

function retryExport() {
  exportProgress.value.status = 'active';
  exportProgress.value.error = '';
  runExportSimulation();
}

function openExportFolder() {
  // TODO: 打开导出文件夹
  ElMessage.info('打开文件夹功能开发中...');
}

// 监听配置变化，保存到本地
watch(exportConfig, (val) => {
  localStorage.setItem('export-last-config', JSON.stringify(val));
}, { deep: true });
</script>

<style scoped>
.export-view {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-primary);
}

.export-header {
  margin-bottom: 24px;
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

.export-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
  height: calc(100% - 100px);
}

.config-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.config-section {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.config-section:last-of-type {
  border-bottom: none;
}

.config-section h4 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.export-types {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-type-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.export-type-item:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.03);
}

.export-type-item.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: white;
  flex-shrink: 0;
}

.type-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.type-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.type-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.type-checkbox {
  flex-shrink: 0;
}

.format-options {
  width: 100%;
}

.detail-options {
  padding-top: 8px;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
}

.preview-card,
.history-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-loading,
.preview-error,
.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.preview-loading .el-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.preview-data {
  flex: 1;
  overflow: auto;
  position: relative;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--bg-secondary);
}

.preview-pdf {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-secondary);
}

.preview-table-wrapper {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: var(--bg-tertiary);
}

.history-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: white;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.history-actions {
  display: flex;
  gap: 4px;
}

.history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  padding: 20px;
}

.export-progress {
  padding: 8px 0;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.progress-spinner .el-icon {
  animation: spin 1s linear infinite;
  color: #3b82f6;
  font-size: 20px;
}

.progress-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.progress-detail {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  transition: color 0.15s;
}

.progress-step.done {
  color: #10b981;
}

.progress-step.active {
  color: #3b82f6;
  font-weight: 500;
}

.progress-step.error {
  color: #ef4444;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.progress-step.done .step-icon {
  background: #10b981;
  color: white;
}

.progress-step.active .step-icon {
  background: #3b82f6;
  color: white;
}

.progress-step.error .step-icon {
  background: #ef4444;
  color: white;
}

.progress-success,
.progress-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  flex-wrap: wrap;
}

.progress-success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.progress-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0;
}

.card-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-actions {
  flex-shrink: 0;
}

/* 响应式 */
@media (max-width: 1200px) {
  .export-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .config-card {
    height: auto;
  }
}

@media (max-width: 768px) {
  .export-view {
    padding: 16px;
  }

  .export-header {
    margin-bottom: 16px;
  }
}
</style>