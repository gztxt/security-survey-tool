<template>
  <div class="settings-export">
    <div class="setting-group">
      <h4>默认导出设置</h4>

      <el-form :model="model.defaults" label-width="140px" size="small">
        <el-form-item label="默认输出目录">
          <div class="path-input">
            <el-input v-model="model.defaults.outputDir" placeholder="选择默认导出目录" readonly />
            <el-button @click="selectOutputDir" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="默认格式">
          <el-radio-group v-model="model.defaults.format">
            <el-radio-button label="pdf">PDF</el-radio-button>
            <el-radio-button label="png">PNG</el-radio-button>
            <el-radio-button label="jpg">JPG</el-radio-button>
            <el-radio-button label="xlsx">Excel</el-radio-button>
            <el-radio-button label="docx">Word</el-radio-button>
            <el-radio-button label="zip">压缩包 (全选)</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="文件命名规则">
          <el-input v-model="model.defaults.namingPattern" placeholder="{project}_{type}_{date}" />
          <span class="input-hint">可用变量: {project}, {type}, {date}, {time}, {scale}, {drawing}</span>
        </el-form-item>

        <el-form-item label="导出后自动打开">
          <el-switch v-model="model.defaults.autoOpen" />
        </el-form-item>

        <el-form-item label="导出后显示通知">
          <el-switch v-model="model.defaults.showNotification" />
        </el-form-item>

        <el-form-item label="包含元数据">
          <el-switch v-model="model.defaults.includeMetadata" />
          <span class="switch-desc">在文件属性中嵌入项目信息</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>图片导出设置 (PNG/JPG)</h4>

      <el-form :model="model.image" label-width="140px" size="small">
        <el-form-item label="默认分辨率">
          <el-select v-model="model.image.defaultDpi" placeholder="选择 DPI" style="width: 160px">
            <el-option label="72 DPI (屏幕)" value="72" />
            <el-option label="150 DPI" value="150" />
            <el-option label="300 DPI (打印)" value="300" />
            <el-option label="600 DPI (高精度)" value="600" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义 DPI" v-if="model.image.defaultDpi === 'custom'">
          <el-input-number v-model="model.image.customDpi" :min="50" :max="1200" :step="10" controls-position="right" />
        </el-form-item>

        <el-form-item label="背景颜色">
          <el-color-picker v-model="model.image.backgroundColor" show-alpha />
        </el-form-item>

        <el-form-item label="透明背景">
          <el-switch v-model="model.image.transparentBackground" />
        </el-form-item>

        <el-form-item label="抗锯齿">
          <el-switch v-model="model.image.antialias" />
        </el-form-item>

        <el-form-item label="包含图框">
          <el-switch v-model="model.image.includeBorder" />
        </el-form-item>

        <el-form-item label="包含标尺">
          <el-switch v-model="model.image.includeRulers" />
        </el-form-item>

        <el-form-item label="JPG 质量">
          <el-slider v-model="model.image.jpgQuality" :min="10" :max="100" :step="5" show-stops show-tooltip />
          <span class="slider-tip">{{ model.image.jpgQuality }}%</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>PDF 导出设置</h4>

      <el-form :model="model.pdf" label-width="140px" size="small">
        <el-form-item label="页面尺寸">
          <el-select v-model="model.pdf.pageSize" placeholder="选择尺寸" style="width: 180px">
            <el-option label="A4 (210×297mm)" value="a4" />
            <el-option label="A3 (297×420mm)" value="a3" />
            <el-option label="A2 (420×594mm)" value="a2" />
            <el-option label="A1 (594×841mm)" value="a1" />
            <el-option label="A0 (841×1189mm)" value="a0" />
            <el-option label="自动适应" value="auto" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义宽度" v-if="model.pdf.pageSize === 'custom'">
          <el-input-number v-model="model.pdf.customWidth" :min="50" :max="5000" :step="1" controls-position="right" />
          <template #append>mm</template>
        </el-form-item>

        <el-form-item label="自定义高度" v-if="model.pdf.pageSize === 'custom'">
          <el-input-number v-model="model.pdf.customHeight" :min="50" :max="5000" :step="1" controls-position="right" />
          <template #append>mm</template>
        </el-form-item>

        <el-form-item label="页面方向">
          <el-radio-group v-model="model.pdf.orientation">
            <el-radio-button label="portrait">纵向</el-radio-button>
            <el-radio-button label="landscape">横向</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="页边距">
          <el-row :gutter="8">
            <el-col :span="6">
              <el-input-number v-model="model.pdf.margins.top" :min="0" :max="100" :step="1" controls-position="right" placeholder="上" />
            </el-col>
            <el-col :span="6">
              <el-input-number v-model="model.pdf.margins.right" :min="0" :max="100" :step="1" controls-position="right" placeholder="右" />
            </el-col>
            <el-col :span="6">
              <el-input-number v-model="model.pdf.margins.bottom" :min="0" :max="100" :step="1" controls-position="right" placeholder="下" />
            </el-col>
            <el-col :span="6">
              <el-input-number v-model="model.pdf.margins.left" :min="0" :max="100" :step="1" controls-position="right" placeholder="左" />
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item label="矢量输出">
          <el-switch v-model="model.pdf.vectorOutput" />
          <span class="switch-desc">保留矢量图元，可无限缩放</span>
        </el-form-item>

        <el-form-item label="嵌入字体">
          <el-switch v-model="model.pdf.embedFonts" />
          <span class="switch-desc">增大文件但保证显示一致</span>
        </el-form-item>

        <el-form-item label="压缩">
          <el-switch v-model="model.pdf.compress" />
        </el-form-item>

        <el-form-item label="PDF 版本">
          <el-select v-model="model.pdf.version" placeholder="选择版本" style="width: 140px">
            <el-option label="1.4 (Acrobat 5)" value="1.4" />
            <el-option label="1.5 (Acrobat 6)" value="1.5" />
            <el-option label="1.6 (Acrobat 7)" value="1.6" />
            <el-option label="1.7 (Acrobat 8+)" value="1.7" />
            <el-option label="2.0 (ISO 32000-2)" value="2.0" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>Excel/CSV 导出设置</h4>

      <el-form :model="model.excel" label-width="140px" size="small">
        <el-form-item label="默认格式">
          <el-radio-group v-model="model.excel.defaultFormat">
            <el-radio-button label="xlsx">Excel (.xlsx)</el-radio-button>
            <el-radio-button label="csv">CSV (.csv)</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="CSV 编码">
          <el-select v-model="model.excel.csvEncoding" placeholder="选择编码" style="width: 160px">
            <el-option label="UTF-8" value="utf-8" />
            <el-option label="UTF-8 with BOM" value="utf-8-bom" />
            <el-option label="GBK" value="gbk" />
            <el-option label="GB2312" value="gb2312" />
          </el-select>
        </el-form-item>

        <el-form-item label="CSV 分隔符">
          <el-select v-model="model.excel.csvDelimiter" placeholder="选择分隔符" style="width: 140px">
            <el-option label="逗号 (,)" value="," />
            <el-option label="分号 (;)" value=";" />
            <el-option label="制表符 (\\t)" value="\t" />
            <el-option label="竖线 (|)" value="|" />
          </el-select>
        </el-form-item>

        <el-form-item label="包含表头">
          <el-switch v-model="model.excel.includeHeader" />
        </el-form-item>

        <el-form-item label="冻结表头行">
          <el-switch v-model="model.excel.freezeHeader" />
        </el-form-item>

        <el-form-item label="自动列宽">
          <el-switch v-model="model.excel.autoColumnWidth" />
        </el-form-item>

        <el-form-item label="样式化">
          <el-switch v-model="model.excel.styled" />
          <span class="switch-desc">添加表头背景、边框、数字格式等</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>报告模板设置</h4>

      <el-form :model="model.report" label-width="140px" size="small">
        <el-form-item label="默认模板">
          <el-select v-model="model.report.defaultTemplate" placeholder="选择模板" style="width: 220px">
            <el-option label="标准工程报告" value="standard" />
            <el-option label="简版报告" value="simple" />
            <el-option label="详细技术规格书" value="detailed" />
            <el-option label="验收报告" value="acceptance" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义模板路径" v-if="model.report.defaultTemplate === 'custom'">
          <div class="path-input">
            <el-input v-model="model.report.customTemplatePath" placeholder="选择 .hbs/.docx 模板文件" readonly />
            <el-button @click="selectTemplate" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="封面信息">
          <el-checkbox-group v-model="model.report.coverFields">
            <el-checkbox value="projectName">项目名称</el-checkbox>
            <el-checkbox value="projectCode">项目编号</el-checkbox>
            <el-checkbox value="company">编制单位</el-checkbox>
            <el-checkbox value="designer">设计人</el-checkbox>
            <el-checkbox value="date">日期</el-checkbox>
            <el-checkbox value="version">版本号</el-checkbox>
            <el-checkbox value="logo">公司 Logo</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="包含章节">
          <el-checkbox-group v-model="model.report.sections">
            <el-checkbox value="toc">目录</el-checkbox>
            <el-checkbox value="overview">项目概况</el-checkbox>
            <el-checkbox value="designBasis">设计依据</el-checkbox>
            <el-checkbox value="pointMap">点位图</el-checkbox>
            <el-checkbox value="topology">拓扑图</el-checkbox>
            <el-checkbox value="fovAnalysis">视场分析</el-checkbox>
            <el-checkbox value="bom">BOM 清单</el-checkbox>
            <el-checkbox value="wiringDiagram">布线图</el-checkbox>
            <el-checkbox value="calculation">计算书</el-checkbox>
            <el-checkbox value="appendix">附件</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="Logo 文件">
          <div class="path-input">
            <el-input v-model="model.report.logoPath" placeholder="选择 Logo 图片" readonly />
            <el-button @click="selectLogo" icon="Picture" />
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>批量导出</h4>

      <el-form :model="model.batch" label-width="140px" size="small">
        <el-form-item label="最大并发数">
          <el-input-number v-model="model.batch.maxConcurrency" :min="1" :max="8" :step="1" controls-position="right" />
        </el-form-item>

        <el-form-item label="导出前预检查">
          <el-switch v-model="model.batch.preCheck" />
          <span class="switch-desc">检查数据完整性、校准有效性</span>
        </el-form-item>

        <el-form-item label="失败时">
          <el-radio-group v-model="model.batch.onError">
            <el-radio-button label="continue">继续其他</el-radio-button>
            <el-radio-button label="stop">停止全部</el-radio-button>
            <el-radio-button label="ask">询问</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="生成汇总报告">
          <el-switch v-model="model.batch.generateSummary" />
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { FolderOpened, Picture } from '@element-plus/icons-vue';

const settingsStore = useSettingsStore();

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = ref(JSON.parse(JSON.stringify(props.modelValue)));

function onChange() {
  emit('update:modelValue', model.value);
  settingsStore.updateSettings('export', model.value);
}

async function selectOutputDir() {
  // const result = await window.electronAPI.selectDirectory();
  // if (result) model.value.defaults.outputDir = result;
}

async function selectTemplate() {
  // const result = await window.electronAPI.selectFile({ filters: [{ name: 'Templates', extensions: ['hbs', 'docx'] }] });
  // if (result) model.value.report.customTemplatePath = result;
}

async function selectLogo() {
  // const result = await window.electronAPI.selectFile({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'svg'] }] });
  // if (result) model.value.report.logoPath = result;
}

watch(() => props.modelValue, (newVal) => {
  model.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });
</script>

<style scoped>
.settings-export {
  max-width: 720px;
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

.path-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input .el-input {
  flex: 1;
}

.input-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.unit {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.switch-desc {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.slider-tip {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  min-width: 50px;
}

.el-form-item__content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>