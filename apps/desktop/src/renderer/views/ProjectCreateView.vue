<template>
  <div class="project-create-view">
    <div class="create-header">
      <h1 class="page-title">新建项目</h1>
      <p class="page-subtitle">填写项目基本信息，选择模板快速开始</p>
    </div>

    <el-card class="create-form-card" shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" size="default">
        <!-- 基本信息 -->
        <el-form-item label="项目名称" prop="name" required>
          <el-input v-model="form.name" placeholder="例如：某小区安防监控系统改造项目" maxlength="100" />
        </el-form-item>

        <el-form-item label="项目编号" prop="code">
          <el-input v-model="form.code" placeholder="例如：PRJ-2026-001" maxlength="50" />
        </el-form-item>

        <el-form-item label="设计单位" prop="designer">
          <el-input v-model="form.designer" placeholder="例如：某某设计院/某某科技有限公司" maxlength="100" />
        </el-form-item>

        <el-form-item label="项目地点" prop="location">
          <el-input v-model="form.location" placeholder="例如：北京市朝阳区某路某号" maxlength="200" />
        </el-form-item>

        <el-form-item label="项目类型" prop="type">
          <el-select v-model="form.type" placeholder="选择项目类型" style="width: 100%;">
            <el-option label="视频监控系统" value="video-surveillance" />
            <el-option label="周界报警系统" value="perimeter-alarm" />
            <el-option label="门禁考勤系统" value="access-control" />
            <el-option label="综合安防系统" value="integrated-security" />
            <el-option label="智能交通/卡口" value="traffic" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>

        <el-form-item label="项目描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="简要描述项目范围、建设规模、技术要求等" maxlength="1000" show-word-limit />
        </el-form-item>

        <el-divider>模板选择</el-divider>

        <el-form-item label="使用模板" prop="template">
          <el-radio-group v-model="form.template">
            <el-radio-button label="blank">空白项目</el-radio-button>
            <el-radio-button label="standard">标准安防工程</el-radio-button>
            <el-radio-button label="video">视频监控专项</el-radio-button>
            <el-radio-button label="alarm">周界报警专项</el-radio-button>
            <el-radio-button label="access">门禁考勤专项</el-radio-button>
            <el-radio-button label="custom">从文件导入...</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.template === 'custom'" label="模板文件">
          <div class="template-file-input">
            <el-input v-model="customTemplatePath" placeholder="选择 .survey 模板文件" readonly />
            <el-button @click="selectTemplateFile" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-divider>默认图纸设置</el-divider>

        <el-form-item label="默认单位">
          <el-select v-model="form.defaultUnit" placeholder="选择单位" style="width: 180px;">
            <el-option label="毫米 (mm)" value="mm" />
            <el-option label="厘米 (cm)" value="cm" />
            <el-option label="米 (m)" value="m" />
          </el-select>
        </el-form-item>

        <el-form-item label="默认比例">
          <el-select v-model="form.defaultScale" placeholder="选择比例" style="width: 180px;">
            <el-option label="1:1" value="1" />
            <el-option label="1:20" value="0.05" />
            <el-option label="1:50" value="0.02" />
            <el-option label="1:100" value="0.01" />
            <el-option label="1:200" value="0.005" />
            <el-option label="1:500" value="0.002" />
            <el-option label="1:1000" value="0.001" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.defaultScale === 'custom'" label="自定义比例">
          <el-input-number v-model="form.customScale" :min="0.0001" :max="10" :step="0.0001" :precision="4" controls-position="right" style="width: 160px" />
          <span class="scale-hint">1 : {{ (1 / form.customScale).toFixed(0) }}</span>
        </el-form-item>

        <el-form-item label="默认纸张">
          <el-select v-model="form.defaultPaper" placeholder="选择纸张" style="width: 200px;">
            <el-option label="A4 (210×297mm)" value="a4" />
            <el-option label="A3 (297×420mm)" value="a3" />
            <el-option label="A2 (420×594mm)" value="a2" />
            <el-option label="A1 (594×841mm)" value="a1" />
            <el-option label="A0 (841×1189mm)" value="a0" />
          </el-select>
        </el-form-item>

        <el-form-item label="默认方向">
          <el-radio-group v-model="form.defaultOrientation">
            <el-radio-button label="portrait">纵向</el-radio-button>
            <el-radio-button label="landscape">横向</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-divider>高级选项</el-divider>

        <el-form-item label="自动保存">
          <el-switch v-model="form.autoSave" active-value="true" inactive-value="false" />
        </el-form-item>

        <el-form-item label="创建后打开">
          <el-switch v-model="form.openAfterCreate" active-value="true" inactive-value="false" />
        </el-form-item>

        <el-form-item label="添加示例数据">
          <el-switch v-model="form.addSampleData" active-value="true" inactive-value="false" />
          <span class="switch-hint">预置几个设备和布线示例，便于快速上手</span>
        </el-form-item>
      </el-form>

      <div class="form-actions">
        <el-button @click="cancelCreate">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          <template #default>创建项目</template>
        </el-button>
      </div>
    </el-card>

    <!-- 模板预览 -->
    <el-card class="template-preview" shadow="never" v-if="form.template !== 'blank' && form.template !== 'custom'">
      <template #header>
        <div class="preview-header">
          <span>模板预览：{{ getTemplateLabel(form.template) }}</span>
        </div>
      </template>

      <div class="preview-content">
        <div class="preview-section">
          <h4>预置图纸</h4>
          <el-tag v-for="d in templateData.drawings" :key="d" size="small" effect="light">{{ d }}</el-tag>
        </div>
        <div class="preview-section">
          <h4>预置设备分类</h4>
          <el-tag v-for="c in templateData.categories" :key="c" size="small" effect="light">{{ c }}</el-tag>
        </div>
        <div class="preview-section">
          <h4>预置图层</h4>
          <el-tag v-for="l in templateData.layers" :key="l" size="small" effect="light">{{ l }}</el-tag>
        </div>
        <div class="preview-section">
          <h4>预置报告模板</h4>
          <el-tag v-for="r in templateData.reports" :key="r" size="small" effect="light">{{ r }}</el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { FolderOpened } from '@element-plus/icons-vue';

const router = useRouter();

const formRef = ref<any>();
const submitting = ref(false);
const customTemplatePath = ref('');

const templateData = reactive({
  drawings: [] as string[],
  categories: [] as string[],
  layers: [] as string[],
  reports: [] as string[],
});

const form = reactive({
  name: '',
  code: '',
  designer: '',
  location: '',
  type: 'integrated-security',
  description: '',
  template: 'standard',
  defaultUnit: 'mm',
  defaultScale: '0.01',
  customScale: 0.01,
  defaultPaper: 'a3',
  defaultOrientation: 'landscape',
  autoSave: true,
  openAfterCreate: true,
  addSampleData: false,
});

const rules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 字符', trigger: 'blur' },
  ],
  code: [
    { pattern: /^[A-Z0-9\-_]+$/, message: '仅支持大写字母、数字、连字符、下划线', trigger: 'blur' },
  ],
};

const templateDetails: Record<string, any> = {
  standard: {
    label: '标准安防工程',
    drawings: ['总平面图', '监控点位图', '报警点位图', '门禁点位图', '布线拓扑图', '系统拓扑图'],
    categories: ['摄像机', '报警探测器', '门禁设备', '布线设备', '传输设备', '存储设备', '显示设备', '控制设备'],
    layers: ['CAMERA', 'ALARM', 'ACCESS', 'CABLE_TRAY', 'CONDUIT', 'WELL', 'WALL', 'DOOR', 'WINDOW', 'GRID', 'TEXT', 'DIM'],
    reports: ['点位图', '拓扑图', '视场分析', 'BOM清单', '工程报告', '验收报告'],
  },
  video: {
    label: '视频监控专项',
    drawings: ['监控点位图', '视场覆盖图', '监控布线图', '机房设备图'],
    categories: ['枪机', '球机', '半球', '全景', '热成像', 'NVR', '解码器', '键盘', '显示器', '存储'],
    layers: ['CAMERA_FIXED', 'CAMERA_PTZ', 'CAMERA_DOME', 'CAMERA_PANO', 'CAMERA_THERMAL', 'NVR', 'MONITOR', 'CABLE', 'CONDUIT', 'RACK'],
    reports: ['点位图', '视场分析', '布线图', 'BOM清单', '设备清单'],
  },
  alarm: {
    label: '周界报警专项',
    drawings: ['报警点位图', '防区划分图', '报警布线图', '中心机房图'],
    categories: ['红外对射', '激光对射', '电子围栏', '振动光缆', '张力围栏', '报警主机', '键盘', '警灯警号', '传输模块'],
    layers: ['ALARM_BEAM', 'ALARM_LASER', 'ALARM_FENCE', 'ALARM_VIBRATION', 'ALARM_TENSION', 'HOST', 'KEYPAD', 'SIREN', 'CABLE', 'CONDUIT'],
    reports: ['点位图', '防区图', '布线图', 'BOM清单', '联动逻辑表'],
  },
  access: {
    label: '门禁考勤专项',
    drawings: ['门禁点位图', '门禁布线图', '控制器柜图', '权限规划图'],
    categories: ['控制器', '读头', '电锁', '出门按钮', '门磁', '考勤机', '消防联动', '电源', '线材'],
    layers: ['ACCESS_CTRL', 'ACCESS_READER', 'ACCESS_LOCK', 'ACCESS_BUTTON', 'ACCESS_CONTACT', 'ATTENDANCE', 'FIRE_LINK', 'POWER', 'CABLE'],
    reports: ['点位图', '布线图', 'BOM清单', '权限矩阵', '消防联动表'],
  },
};

function getTemplateLabel(key: string) {
  return templateDetails[key]?.label || key;
}

watch(() => form.template, (newVal) => {
  if (templateDetails[newVal]) {
    const t = templateDetails[newVal];
    templateData.drawings = t.drawings;
    templateData.categories = t.categories;
    templateData.layers = t.layers;
    templateData.reports = t.reports;
  } else {
    templateData.drawings = [];
    templateData.categories = [];
    templateData.layers = [];
    templateData.reports = [];
  }
}, { immediate: true });

async function selectTemplateFile() {
  // const result = await window.electronAPI.selectFile({ filters: [{ name: 'Survey Template', extensions: ['survey'] }] });
  // if (result) customTemplatePath.value = result;
}

function cancelCreate() {
  router.push({ name: 'Dashboard' });
}

async function submitForm() {
  try {
    await formRef.value?.validate();
  } catch (e) {
    return;
  }

  submitting.value = true;

  try {
    // const projectId = await window.electronAPI.createProject({
    //   ...form,
    //   defaultScale: form.defaultScale === 'custom' ? form.customScale : parseFloat(form.defaultScale),
    // });

    // 模拟创建成功
    await new Promise(r => setTimeout(r, 800));
    const projectId = 'proj-' + Date.now();

    ElMessage.success('项目创建成功');

    if (form.openAfterCreate) {
      router.push({ name: 'Drawing', params: { projectId } });
    } else {
      router.push({ name: 'Dashboard' });
    }
  } catch (error: any) {
    ElMessage.error(error.message || '创建失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.project-create-view {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.create-header {
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-tertiary);
}

.create-form-card {
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.template-file-input {
  display: flex;
  gap: 8px;
}

.template-file-input .el-input {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  margin-top: 8px;
  border-top: 1px solid var(--border-color);
}

.template-preview {
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.preview-header {
  font-weight: 600;
  color: var(--text-primary);
}

.preview-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 8px 0;
}

.preview-section h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.preview-section .el-tag {
  margin: 2px 4px 2px 0;
}

.scale-hint {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.switch-hint {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .project-create-view {
    padding: 16px;
  }

  .preview-content {
    grid-template-columns: 1fr;
  }
}
</style>