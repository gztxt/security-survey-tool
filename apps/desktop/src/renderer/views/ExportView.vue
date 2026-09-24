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
                v-for="type in visibleExportTypes"
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
                <el-tooltip
                  v-for="fmt in outputFormats"
                  :key="fmt.value"
                  :content="fmt.tip"
                  :disabled="!fmt.tip"
                  placement="top"
                >
                  <el-radio-button :label="fmt.value" :disabled="fmt.disabled">
                    {{ fmt.label }}
                  </el-radio-button>
                </el-tooltip>
              </el-radio-group>
              <p v-if="formatUnsupportedNote(exportConfig.format)" class="format-note">
                {{ formatUnsupportedNote(exportConfig.format) }}
              </p>
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
        <!-- 导出前完整性检查：逐图纸显示 底图/布点/布线 完成度（工作流第 4 步的验收单） -->
        <el-card class="readiness-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h3>图纸完整性</h3>
              <span class="readiness-summary" :class="{ 'is-ok': readinessOk }">
                {{ readinessOk ? '全部就绪' : `${readinessIssues.length} 项待完善` }}
              </span>
            </div>
          </template>
          <div class="readiness-rows">
            <div v-for="row in readinessRows" :key="row.id" class="readiness-row">
              <span class="drawing-name" :title="row.name">{{ row.name }}</span>
              <span class="check" :class="{ ok: row.hasBasemap }" title="底图">{{ row.hasBasemap ? '✓' : '✗' }} 底图</span>
              <span class="check" :class="{ ok: row.hasDevices }" title="点位">{{ row.hasDevices ? '✓' : '✗' }} 点位</span>
              <span class="check" :class="{ ok: row.hasCables }" title="线路">{{ row.hasCables ? '✓' : '✗' }} 线路</span>
            </div>
            <div v-if="!readinessRows.length" class="readiness-empty">当前项目暂无图纸，请先在图纸页导入底图</div>
          </div>
        </el-card>

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
          <el-icon><CircleCheck /></el-icon>
          <span>导出完成！</span>
          <el-button size="small" @click="openExportFolder">打开文件夹</el-button>
          <el-button size="small" type="primary" @click="exportDialogVisible = false">完成</el-button>
        </div>
        <div v-if="exportProgress.status === 'exception'" class="progress-error">
          <el-icon><CircleClose /></el-icon>
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
import { Loading, Warning, Document, CircleCheck, CircleClose } from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/project';
import { useExportStore } from '@/stores/export';
import { useSettingsStore } from '@/stores/settings';

const projectStore = useProjectStore();
const exportStore = useExportStore();
const settingsStore = useSettingsStore();

// 同步主进程导出进度
watch(
  () => [exportStore.progress, exportStore.currentStep],
  ([p, step]) => {
    if (exporting.value) {
      exportProgress.value.percentage = p as number;
      if (step) exportProgress.value.current = step as string;
    }
  }
);

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

// ============ 导出前完整性检查（工作流第 4 步验收单）============
interface ReadinessRow {
  id: string;
  name: string;
  hasBasemap: boolean;
  hasDevices: boolean;
  hasCables: boolean;
}

const readinessRows = computed<ReadinessRow[]>(() =>
  (projectStore.drawings || []).map((d: any) => ({
    id: d.id,
    name: d.name || '未命名图纸',
    hasBasemap: !!d.file || (d.entities?.length || 0) > 0,
    hasDevices: (d.devices?.length || 0) > 0,
    hasCables: (d.wiring?.cables?.length || 0) > 0,
  }))
);

/** 缺项列表：任一图纸缺底图/点位/线路即视为待完善 */
const readinessIssues = computed(() => {
  const issues: string[] = [];
  for (const row of readinessRows.value) {
    if (!row.hasBasemap) issues.push(`${row.name}：缺底图`);
    if (!row.hasDevices) issues.push(`${row.name}：未布点`);
    if (!row.hasCables) issues.push(`${row.name}：未画线路`);
  }
  return issues;
});

const readinessOk = computed(() => readinessRows.value.length > 0 && readinessIssues.value.length === 0);

// 导出类型定义
// ★ AC-7.2：DXF 的文案严格写「导出 DXF」，禁写"导出 CAD"（与 AC-2.4 诚实声明红线同源）
const exportTypes = [
  {
    id: 'pointmap',
    name: '点位图',
    description: '设备布局平面图，含编号、FOV轮廓、图例',
    icon: 'PointMapIcon',
    color: '#3b82f6',
    disabled: false,
    advanced: false,
  },
  {
    id: 'dxf',
    name: '导出 DXF',
    description: '在 CAD 软件中打开 DXF 后可另存为 DWG；仅含标注图层（SS-* 前缀）',
    icon: 'Document',
    color: '#0ea5e9',
    disabled: false,
    advanced: false,
  },
  {
    id: 'topology',
    name: '拓扑图',
    description: '系统拓扑结构图，含线缆走向、弱电井、桥架',
    icon: 'TopologyIcon',
    color: '#10b981',
    disabled: false,
    advanced: true,
  },
  {
    id: 'fov',
    name: '视场分析',
    description: '覆盖率热力图、盲区标注、重叠区域分析',
    icon: 'FovIcon',
    color: '#f59e0b',
    disabled: false,
    advanced: true,
  },
  {
    id: 'bom',
    name: 'BOM清单',
    description: '物料清单，按类别分组，含规格、数量、价格',
    icon: 'BomIcon',
    color: '#8b5cf6',
    disabled: false,
    advanced: true,
  },
  {
    id: 'report',
    name: '工程报告',
    description: '完整工程报告，含封面、目录、正文、附件',
    icon: 'ReportIcon',
    color: '#ef4444',
    disabled: false,
    advanced: true,
  },
];

/**
 * 输出格式（AC-7.2 / AC-7.3）
 * - dxf：正常露出，label 严格"导出 DXF"，tooltip 说明"在 CAD 软件中打开 DXF 后可另存为 DWG"
 * - docx：按钮保留但 disabled + 后缀"（即将上线）" —— 不静默缺失
 * - dwg：不在格式组出现（属导入侧概念）；历史数据里若出现则同样提示"即将上线"
 */
const outputFormats = [
  { value: 'pdf', label: 'PDF', disabled: false, tip: '' },
  { value: 'png', label: 'PNG', disabled: false, tip: '' },
  { value: 'jpg', label: 'JPG', disabled: false, tip: '' },
  { value: 'xlsx', label: 'Excel', disabled: false, tip: '' },
  { value: 'dxf', label: '导出 DXF', disabled: false, tip: '在 CAD 软件中打开 DXF 后可另存为 DWG' },
  { value: 'docx', label: 'Word（即将上线）', disabled: true, tip: 'Word 报告导出尚未实现，敬请期待' },
];

/** 精简态只暴露点位图 + DXF（架构决策 5.4），其余专业导出走"高级功能" */
const visibleExportTypes = computed(() =>
  exportTypes.filter(t => !t.advanced || settingsStore.advancedMode),
);

/** 历史配置里可能残留未实现格式（如 dwg/docx），此处按 AC-7.3 统一给出提示 */
function formatUnsupportedNote(fmt: string): string {
  return fmt === 'dwg' || fmt === 'docx' ? '该格式即将上线，本次不会生成文件' : '';
}

/** AC-7.4：判断所选图纸里是否存在位图/PDF 底图（DXF 无法内嵌位图，须事先告知） */
function hasRasterBasemap(project: { drawings?: any[] }): boolean {
  return (project.drawings || []).some(d => ['png', 'jpg', 'jpeg', 'pdf'].includes(String(d?.file?.format || '').toLowerCase()));
}

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

async function startExport() {
  const project = projectStore.currentProject;
  if (!project) {
    ElMessage.warning('请先打开一个项目再导出');
    return;
  }
  if (exportConfig.value.types.length === 0) {
    ElMessage.warning('请至少选择一项导出内容');
    return;
  }

  // AC-7.4：底图为位图/PDF 时导出前必须告知"DXF 只含矢量标注图层，不含底图"
  if (exportConfig.value.types.includes('dxf') && hasRasterBasemap(project)) {
    try {
      await ElMessageBox.confirm(
        '当前项目底图为图片 / PDF。导出的 DXF 只包含矢量标注图层（SS-DEVICE / SS-CABLE 等 7 个 SS-* 图层），'
        + '不含底图本身；请在 CAD 中以 XATTACH 方式附上原图，或直接按同名坐标叠加。',
        '关于 DXF 导出的底图',
        { confirmButtonText: '继续导出', cancelButtonText: '返回调整', type: 'info' },
      );
    } catch {
      return;   // 用户选择返回调整：不改配置、不导出
    }
  }

  exporting.value = true;
  exportDialogVisible.value = true;
  exportDialogTitle.value = '正在导出...';

  const types = exportConfig.value.types as any[];
  exportProgress.value = {
    percentage: 0,
    status: 'active',
    current: '初始化...',
    detail: `准备导出 ${types.length} 项内容`,
    steps: types.map(t => getTypeLabel(t)),
    currentStep: 0,
    error: '',
  };

  runRealExport();
}

async function runRealExport() {
  const project = projectStore.currentProject!;
  try {
    // 保存当前配置
    localStorage.setItem('export-last-config', JSON.stringify(exportConfig.value));

    const result = await exportStore.runExport({
      project,
      types: exportConfig.value.types as any[],
      format: exportConfig.value.format,
      dpi: exportConfig.value.options.pointmap?.dpi,
      canvasSnapshots: projectStore.drawingSnapshots,
      projectName: exportConfig.value.project.name || project.name,
    });

    if (result.files.length > 0) {
      // 逐个选择保存位置并落盘
      const saved = await exportStore.saveFiles(result.files);
      exportProgress.value.percentage = 100;
      exportProgress.value.status = 'success';
      exportProgress.value.current = '导出完成';
      exportProgress.value.detail =
        saved.length > 0
          ? `已保存 ${saved.length} 个文件`
          : `生成 ${result.files.length} 个文件（未选择保存位置）`;
      if (result.errors.length) {
        ElMessage.warning(`部分导出项有警告：${result.errors.join('；')}`);
      } else {
        ElMessage.success('导出完成');
      }
    } else {
      exportProgress.value.status = 'exception';
      exportProgress.value.current = '导出失败';
      exportProgress.value.error = result.errors.join('；') || '未生成任何文件';
      exportProgress.value.detail = exportProgress.value.error;
      ElMessage.error(exportProgress.value.error);
    }
  } catch (err: any) {
    exportProgress.value.status = 'exception';
    exportProgress.value.current = '导出失败';
    exportProgress.value.error = err?.message || String(err);
    exportProgress.value.detail = exportProgress.value.error;
    ElMessage.error(exportProgress.value.error);
  } finally {
    exporting.value = false;
    saveToHistory();
  }
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
  ElMessage.info('历史文件未保留副本，请重新执行导出并选择保存位置');
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
  exporting.value = true;
  runRealExport();
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

.format-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #d97706;
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

.readiness-card {
  margin-bottom: 16px;
  border-radius: 12px;
  flex-shrink: 0;
}

.readiness-card :deep(.el-card__body) {
  padding: 12px 16px;
}

.readiness-summary {
  font-size: 12px;
  color: var(--warning-color, #f59e0b);
}

.readiness-summary.is-ok {
  color: var(--success-color, #10b981);
}

.readiness-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 128px;
  overflow-y: auto;
}

.readiness-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.readiness-row .drawing-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.readiness-row .check {
  flex-shrink: 0;
  color: var(--danger-color, #ef4444);
}

.readiness-row .check.ok {
  color: var(--success-color, #10b981);
}

.readiness-empty {
  font-size: 12.5px;
  color: var(--text-tertiary);
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