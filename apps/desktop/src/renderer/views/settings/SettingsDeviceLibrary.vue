<template>
  <div class="settings-device-library">
    <div class="setting-group">
      <h4>内置设备库</h4>

      <el-form :model="model" label-width="140px" size="small">
        <el-form-item label="启用内置库">
          <el-switch v-model="model.enableBuiltinLibrary" />
        </el-form-item>

        <el-form-item label="默认显示分类">
          <el-select v-model="model.defaultCategory" placeholder="选择分类" style="width: 200px">
            <el-option label="全部" value="all" />
            <el-option label="摄像机" value="camera" />
            <el-option label="报警" value="alarm" />
            <el-option label="门禁" value="access" />
            <el-option label="布线" value="wiring" />
            <el-option label="设备" value="device" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>

        <el-form-item label="设备图标大小">
          <el-slider v-model="model.iconSize" :min="24" :max="96" :step="4" show-stops show-tooltip />
          <span class="slider-tip">{{ model.iconSize }}px</span>
        </el-form-item>

        <el-form-item label="列表显示模式">
          <el-radio-group v-model="model.listViewMode">
            <el-radio-button label="grid">网格</el-radio-button>
            <el-radio-button label="list">列表</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>自定义设备</h4>

      <el-form :model="model" label-width="140px" size="small">
        <el-form-item label="自定义设备目录">
          <div class="path-input">
            <el-input v-model="model.customDeviceDir" placeholder="自定义设备 JSON 文件目录" readonly />
            <el-button @click="selectCustomDir" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="自动监视目录">
          <el-switch v-model="model.watchCustomDir" />
        </el-form-item>

        <el-form-item label="允许编辑内置设备">
          <el-switch v-model="model.allowEditBuiltin" />
          <span class="switch-desc">启用后可修改内置设备参数</span>
        </el-form-item>

        <el-form-item label="导入设备时">
          <el-radio-group v-model="model.importBehavior">
            <el-radio-button label="merge">合并同名</el-radio-button>
            <el-radio-button label="replace">覆盖</el-radio-button>
            <el-radio-button label="skip">跳过</el-radio-button>
            <el-radio-button label="rename">重命名</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <div class="device-stats">
        <el-card class="stat-card" shadow="never">
          <div class="stat-value">{{ deviceStats.builtin }}</div>
          <div class="stat-label">内置设备</div>
        </el-card>
        <el-card class="stat-card" shadow="never">
          <div class="stat-value">{{ deviceStats.custom }}</div>
          <div class="stat-label">自定义设备</div>
        </el-card>
        <el-card class="stat-card" shadow="never">
          <div class="stat-value">{{ deviceStats.categories }}</div>
          <div class="stat-label">分类数量</div>
        </el-card>
        <el-card class="stat-card" shadow="never">
          <div class="stat-value">{{ deviceStats.total }}</div>
          <div class="stat-label">总计</div>
        </el-card>
      </div>
    </div>

    <div class="setting-group">
      <h4>设备参数默认值</h4>

      <el-form :model="model.defaultParams" label-width="160px" size="small">
        <el-form-item label="摄像机默认水平视角">
          <el-input-number v-model="model.defaultParams.camera.hFov" :min="10" :max="180" :step="1" controls-position="right" />
          <template #append>°</template>
        </el-form-item>

        <el-form-item label="摄像机默认垂直视角">
          <el-input-number v-model="model.defaultParams.camera.vFov" :min="10" :max="180" :step="1" controls-position="right" />
          <template #append>°</template>
        </el-form-item>

        <el-form-item label="摄像机默认安装高度">
          <el-input-number v-model="model.defaultParams.camera.mountHeight" :min="1" :max="50" :step="0.1" :precision="1" controls-position="right" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="摄像机默认倾角">
          <el-input-number v-model="model.defaultParams.camera.tilt" :min="-90" :max="90" :step="1" controls-position="right" />
          <template #append>°</template>
        </el-form-item>

        <el-form-item label="报警器默认探测半径">
          <el-input-number v-model="model.defaultParams.alarm.detectRadius" :min="1" :max="100" :step="1" controls-position="right" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="报警器默认探测角度">
          <el-input-number v-model="model.defaultParams.alarm.detectAngle" :min="10" :max="360" :step="10" controls-position="right" />
          <template #append>°</template>
        </el-form-item>

        <el-form-item label="门禁默认门宽">
          <el-input-number v-model="model.defaultParams.access.doorWidth" :min="0.5" :max="5" :step="0.1" :precision="1" controls-position="right" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="设备默认颜色">
          <el-color-picker v-model="model.defaultParams.defaultColor" show-alpha />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>FOV 计算设置</h4>

      <el-form :model="model.fov" label-width="140px" size="small">
        <el-form-item label="计算精度">
          <el-select v-model="model.fov.precision" placeholder="选择精度" style="width: 180px">
            <el-option label="低 (5° 步进)" value="low" />
            <el-option label="中 (2° 步进)" value="medium" />
            <el-option label="高 (1° 步进)" value="high" />
            <el-option label="极高 (0.5° 步进)" value="ultra" />
          </el-select>
        </el-form-item>

        <el-form-item label="最大射线数">
          <el-input-number v-model="model.fov.maxRays" :min="36" :max="720" :step="36" controls-position="right" />
          <span class="switch-desc">每摄像机最大射线数</span>
        </el-form-item>

        <el-form-item label="遮挡检测">
          <el-switch v-model="model.fov.occlusionDetection" />
        </el-form-item>

        <el-form-item label="遮挡物图层">
          <el-tag
            v-for="layer in model.fov.occlusionLayers"
            :key="layer"
            closable
            @close="removeOcclusionLayer(layer)"
          >
            {{ layer }}
          </el-tag>
          <el-select v-model="newOcclusionLayer" placeholder="添加图层" style="width: 160px; margin-top: 8px" @change="addOcclusionLayer">
            <el-option v-for="l in availableLayers" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>

        <el-form-item label="FOV 显示颜色">
          <el-color-picker v-model="model.fov.fillColor" show-alpha />
          <span class="switch-desc">填充色</span>
        </el-form-item>

        <el-form-item label="FOV 边框颜色">
          <el-color-picker v-model="model.fov.strokeColor" show-alpha />
          <span class="switch-desc">边框色</span>
        </el-form-item>

        <el-form-item label="盲区标注颜色">
          <el-color-picker v-model="model.fov.blindSpotColor" show-alpha />
        </el-form-item>

        <el-form-item label="重叠区域颜色">
          <el-color-picker v-model="model.fov.overlapColor" show-alpha />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>批量部署</h4>

      <el-form :model="model.batchDeploy" label-width="140px" size="small">
        <el-form-item label="默认网格间距">
          <el-input-number v-model="model.batchDeploy.gridSpacing" :min="1" :max="100" :step="1" controls-position="right" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="默认边距">
          <el-input-number v-model="model.batchDeploy.margin" :min="0" :max="50" :step="0.5" :precision="1" controls-position="right" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="自动避开障碍物">
          <el-switch v-model="model.batchDeploy.avoidObstacles" />
        </el-form-item>

        <el-form-item label="障碍物图层">
          <el-tag
            v-for="layer in model.batchDeploy.obstacleLayers"
            :key="layer"
            closable
            @close="removeObstacleLayer(layer)"
          >
            {{ layer }}
          </el-tag>
          <el-select v-model="newObstacleLayer" placeholder="添加图层" style="width: 160px; margin-top: 8px" @change="addObstacleLayer">
            <el-option v-for="l in availableLayers" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>

        <el-form-item label="最小覆盖率要求">
          <el-slider v-model="model.batchDeploy.minCoverage" :min="0" :max="100" :step="5" show-stops show-tooltip />
          <span class="slider-tip">{{ model.batchDeploy.minCoverage }}%</span>
        </el-form-item>

        <el-form-item label="最大部署数量">
          <el-input-number v-model="model.batchDeploy.maxDevices" :min="1" :max="1000" :step="1" controls-position="right" />
          <span class="switch-desc">单次批量部署上限</span>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import { useSettingsStore } from '@/stores/settings';

const deviceStore = useDeviceLibraryStore();
const settingsStore = useSettingsStore();

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = ref(JSON.parse(JSON.stringify(props.modelValue)));

const deviceStats = computed(() => ({
  builtin: deviceStore.builtinCount,
  custom: deviceStore.customCount,
  categories: deviceStore.categories.length,
  total: deviceStore.totalCount,
}));

const availableLayers = computed(() => [
  'WALL', 'DOOR', 'WINDOW', 'COLUMN', 'BEAM', 'EQUIPMENT', 'CABLE_TRAY', 'CONDUIT',
]);

const newOcclusionLayer = ref('');
const newObstacleLayer = ref('');

const snapPriorityOptions = [
  { value: 'endpoint', label: '端点' },
  { value: 'midpoint', label: '中点' },
  { value: 'center', label: '中心' },
  { value: 'intersection', label: '交点' },
  { value: 'grid', label: '网格点' },
];

function onChange() {
  emit('update:modelValue', model.value);
  settingsStore.updateSettings('deviceLibrary', model.value);
}

async function selectCustomDir() {
  // const result = await window.electronAPI.selectDirectory();
  // if (result) model.value.customDeviceDir = result;
}

function removeOcclusionLayer(layer: string) {
  model.value.fov.occlusionLayers = model.value.fov.occlusionLayers.filter((l: string) => l !== layer);
  onChange();
}

function addOcclusionLayer(value: string) {
  if (value && !model.value.fov.occlusionLayers.includes(value)) {
    model.value.fov.occlusionLayers.push(value);
    onChange();
  }
  newOcclusionLayer.value = '';
}

function removeObstacleLayer(layer: string) {
  model.value.batchDeploy.obstacleLayers = model.value.batchDeploy.obstacleLayers.filter((l: string) => l !== layer);
  onChange();
}

function addObstacleLayer(value: string) {
  if (value && !model.value.batchDeploy.obstacleLayers.includes(value)) {
    model.value.batchDeploy.obstacleLayers.push(value);
    onChange();
  }
  newObstacleLayer.value = '';
}

watch(() => props.modelValue, (newVal) => {
  model.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });

onMounted(() => {
  // 初始化统计
});
</script>

<style scoped>
.settings-device-library {
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

.path-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input .el-input {
  flex: 1;
}

.device-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.stat-card {
  text-align: center;
  padding: 16px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #3b82f6;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.el-form-item__content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.el-tag {
  cursor: default;
}
</style>