<template>
  <div class="settings-wiring">
    <div class="setting-group">
      <h4>自动布线</h4>

      <el-form :model="model.autoWiring" label-width="160px" size="small">
        <el-form-item label="启用自动布线">
          <el-switch v-model="model.autoWiring.enabled" />
        </el-form-item>

        <el-form-item label="默认算法">
          <el-select v-model="model.autoWiring.defaultAlgorithm" placeholder="选择算法" style="width: 220px">
            <el-option label="最小生成树 (MST - Kruskal)" value="mst-kruskal" />
            <el-option label="最小生成树 (Prim)" value="mst-prim" />
            <el-option label="最短路径树 (Dijkstra)" value="shortest-path" />
            <el-option label="斯坦纳树 (近似)" value="steiner" />
            <el-option label="曼哈顿 MST" value="manhattan-mst" />
          </el-select>
        </el-form-item>

        <el-form-item label="布线模式">
          <el-radio-group v-model="model.autoWiring.routingMode">
            <el-radio-button label="orthogonal">正交 (曼哈顿)</el-radio-button>
            <el-radio-button label="octilinear">八方向</el-radio-button>
            <el-radio-button label="euclidean">欧几里得 (直线)</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="避让障碍物">
          <el-switch v-model="model.autoWiring.avoidObstacles" />
        </el-form-item>

        <el-form-item label="障碍物图层">
          <el-tag
            v-for="layer in model.autoWiring.obstacleLayers"
            :key="layer"
            closable
            @close="removeAutoObstacleLayer(layer)"
          >
            {{ layer }}
          </el-tag>
          <el-select v-model="newAutoObstacleLayer" placeholder="添加图层" style="width: 160px; margin-top: 8px" @change="addAutoObstacleLayer">
            <el-option v-for="l in availableLayers" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>

        <el-form-item label="最小线缆长度">
          <el-input-number v-model="model.autoWiring.minLength" :min="0.1" :max="100" :step="0.1" :precision="1" controls-position="right" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="最大线缆长度">
          <el-input-number v-model="model.autoWiring.maxLength" :min="10" :max="5000" :step="10" controls-position="right" />
          <template #append>米 (0=无限制)</template>
        </el-form-item>

        <el-form-item label="允许分支">
          <el-switch v-model="model.autoWiring.allowBranching" />
        </el-form-item>

        <el-form-item label="最大分支数">
          <el-input-number v-model="model.autoWiring.maxBranches" :min="1" :max="20" :step="1" controls-position="right" :disabled="!model.autoWiring.allowBranching" />
        </el-form-item>

        <el-form-item label="线缆类型">
          <el-select v-model="model.autoWiring.defaultCableType" placeholder="选择默认类型" style="width: 200px">
            <el-option label="网线 (Cat6)" value="cat6" />
            <el-option label="光纤 (单模)" value="fiber-sm" />
            <el-option label="光纤 (多模)" value="fiber-mm" />
            <el-option label="电源线 (RVV)" value="rvv" />
            <el-option label="控制线 (RVVP)" value="rvvp" />
            <el-option label="同轴电缆" value="coaxial" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="优化目标">
          <el-checkbox-group v-model="model.autoWiring.optimizationGoals">
            <el-checkbox label="total-length">最小总长度</el-checkbox>
            <el-checkbox label="max-length">最小化最长线缆</el-checkbox>
            <el-checkbox label="junction-count">最少接线盒</el-checkbox>
            <el-checkbox label="tray-usage">最少桥架占用</el-checkbox>
            <el-checkbox label="conduit-fill">管道填充率均衡</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="迭代次数上限">
          <el-input-number v-model="model.autoWiring.maxIterations" :min="10" :max="10000" :step="10" controls-position="right" />
          <span class="switch-desc">复杂布线的最大计算轮数</span>
        </el-form-item>

        <el-form-item label="计算超时">
          <el-input-number v-model="model.autoWiring.timeout" :min="1" :max="300" :step="1" controls-position="right" />
          <template #append>秒</template>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>手动布线</h4>

      <el-form :model="model.manualWiring" label-width="140px" size="small">
        <el-form-item label="正交模式">
          <el-switch v-model="model.manualWiring.orthogonalMode" />
        </el-form-item>

        <el-form-item label="吸附线缆端点">
          <el-switch v-model="model.manualWiring.snapToEndpoints" />
        </el-form-item>

        <el-form-item label="显示长度实时标注">
          <el-switch v-model="model.manualWiring.showLengthLabel" />
        </el-form-item>

        <el-form-item label="自动插入弯头">
          <el-switch v-model="model.manualWiring.autoBend" />
          <span class="switch-desc">正交转弯自动添加圆角/弯头</span>
        </el-form-item>

        <el-form-item label="弯头半径">
          <el-input-number v-model="model.manualWiring.bendRadius" :min="0" :max="500" :step="5" controls-position="right" :disabled="!model.manualWiring.autoBend" />
          <template #append>mm (0=直角)</template>
        </el-form-item>

        <el-form-item label="线缆颜色">
          <el-color-picker v-model="model.manualWiring.wireColor" show-alpha />
        </el-form-item>

        <el-form-item label="线缆宽度">
          <el-input-number v-model="model.manualWiring.wireWidth" :min="0.5" :max="10" :step="0.5" :precision="1" controls-position="right" />
          <template #append>px</template>
        </el-form-item>

        <el-form-item label="虚线样式">
          <el-select v-model="model.manualWiring.dashPattern" placeholder="选择样式" style="width: 160px">
            <el-option label="实线" value="solid" />
            <el-option label="虚线" value="dashed" />
            <el-option label="点线" value="dotted" />
            <el-option label="长短划线" value="dashdot" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>弱电井/桥架</h4>

      <el-form :model="model.infrastructure" label-width="140px" size="small">
        <el-form-item label="弱电井默认尺寸">
          <el-row :gutter="8">
            <el-col :span="8">
              <el-input-number v-model="model.infrastructure.wellWidth" :min="100" :max="2000" :step="50" controls-position="right" placeholder="宽" />
            </el-col>
            <el-col :span="8">
              <el-input-number v-model="model.infrastructure.wellDepth" :min="100" :max="2000" :step="50" controls-position="right" placeholder="深" />
            </el-col>
            <el-col :span="8">
              <el-input-number v-model="model.infrastructure.wellHeight" :min="100" :max="5000" :step="100" controls-position="right" placeholder="高" />
            </el-col>
          </el-row>
          <span class="switch-desc">单位: mm</span>
        </el-form-item>

        <el-form-item label="桥架默认规格">
          <el-row :gutter="8">
            <el-col :span="12">
              <el-input-number v-model="model.infrastructure.trayWidth" :min="50" :max="1000" :step="25" controls-position="right" placeholder="宽度" />
            </el-col>
            <el-col :span="12">
              <el-input-number v-model="model.infrastructure.trayHeight" :min="25" :max="200" :step="25" controls-position="right" placeholder="高度" />
            </el-col>
          </el-row>
          <span class="switch-desc">单位: mm</span>
        </el-form-item>

        <el-form-item label="管道默认直径">
          <el-select v-model="model.infrastructure.defaultConduitSize" placeholder="选择直径" style="width: 160px">
            <el-option label="Φ16" value="16" />
            <el-option label="Φ20" value="20" />
            <el-option label="Φ25" value="25" />
            <el-option label="Φ32" value="32" />
            <el-option label="Φ40" value="40" />
            <el-option label="Φ50" value="50" />
            <el-option label="Φ70" value="70" />
            <el-option label="Φ100" value="100" />
          </el-select>
        </el-form-item>

        <el-form-item label="最大填充率">
          <el-slider v-model="model.infrastructure.maxFillRatio" :min="20" :max="80" :step="5" show-stops show-tooltip />
          <span class="slider-tip">{{ model.infrastructure.maxFillRatio }}%</span>
        </el-form-item>

        <el-form-item label="显示填充率警告">
          <el-switch v-model="model.infrastructure.showFillWarning" />
        </el-form-item>

        <el-form-item label="桥架颜色">
          <el-color-picker v-model="model.infrastructure.trayColor" show-alpha />
        </el-form-item>

        <el-form-item label="管道颜色">
          <el-color-picker v-model="model.infrastructure.conduitColor" show-alpha />
        </el-form-item>

        <el-form-item label="弱电井颜色">
          <el-color-picker v-model="model.infrastructure.wellColor" show-alpha />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>拓扑生成</h4>

      <el-form :model="model.topology" label-width="140px" size="small">
        <el-form-item label="自动生成拓扑">
          <el-switch v-model="model.topology.autoGenerate" />
        </el-form-item>

        <el-form-item label="拓扑类型">
          <el-select v-model="model.topology.type" placeholder="选择类型" style="width: 200px">
            <el-option label="星型" value="star" />
            <el-option label="环型" value="ring" />
            <el-option label="树型" value="tree" />
            <el-option label="总线型" value="bus" />
            <el-option label="混合型" value="hybrid" />
          </el-select>
        </el-form-item>

        <el-form-item label="根节点选择">
          <el-radio-group v-model="model.topology.rootSelection">
            <el-radio-button label="auto">自动 (中心设备)</el-radio-button>
            <el-radio-button label="manual">手动指定</el-radio-button>
            <el-radio-button label="first">首个设备</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="显示设备类型图标">
          <el-switch v-model="model.topology.showDeviceIcons" />
        </el-form-item>

        <el-form-item label="显示线缆标签">
          <el-switch v-model="model.topology.showCableLabels" />
        </el-form-item>

        <el-form-item label="布局算法">
          <el-select v-model="model.topology.layoutAlgorithm" placeholder="选择算法" style="width: 200px">
            <el-option label="层次布局" value="hierarchical" />
            <el-option label="力导向" value="force-directed" />
            <el-option label="环形布局" value="circular" />
            <el-option label="网格布局" value="grid" />
          </el-select>
        </el-form-item>

        <el-form-item label="节点间距">
          <el-input-number v-model="model.topology.nodeSpacing" :min="50" :max="500" :step="10" controls-position="right" />
          <template #append>px</template>
        </el-form-item>

        <el-form-item label="层间距">
          <el-input-number v-model="model.topology.layerSpacing" :min="50" :max="500" :step="10" controls-position="right" />
          <template #append>px</template>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>线缆规格库</h4>

      <el-form :model="model.cableLibrary" label-width="140px" size="small">
        <el-form-item label="启用规格校验">
          <el-switch v-model="model.cableLibrary.enableValidation" />
        </el-form-item>

        <el-form-item label="超长警告阈值">
          <el-input-number v-model="model.cableLibrary.lengthWarningThreshold" :min="10" :max="500" :step="5" controls-position="right" :disabled="!model.cableLibrary.enableValidation" />
          <template #append>米</template>
        </el-form-item>

        <el-form-item label="默认线缆规格">
          <el-table :data="model.cableLibrary.defaultSpecs" border size="small" style="width: 100%">
            <el-table-column prop="type" label="类型" width="120">
              <template #default="scope">
                <el-select v-model="scope.row.type" placeholder="类型" style="width: 100%">
                  <el-option label="网线" value="ethernet" />
                  <el-option label="光纤" value="fiber" />
                  <el-option label="电源" value="power" />
                  <el-option label="控制" value="control" />
                  <el-option label="同轴" value="coaxial" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="model" label="型号" width="150">
              <template #default="scope">
                <el-input v-model="scope.row.model" size="small" placeholder="型号" />
              </template>
            </el-table-column>
            <el-table-column prop="maxLength" label="最大长度(m)" width="120">
              <template #default="scope">
                <el-input-number v-model="scope.row.maxLength" :min="10" :max="2000" :step="10" controls-position="right" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="color" label="颜色" width="100">
              <template #default="scope">
                <el-color-picker v-model="scope.row.color" show-alpha size="small" />
              </template>
            </el-table-column>
            <el-table-column fixed="right" width="50">
              <template #default="scope">
                <el-button size="small" type="danger" link @click="removeCableSpec(scope.$index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button size="small" @click="addCableSpec" icon="Plus" style="margin-top: 8px">添加规格</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Delete, Plus } from '@element-plus/icons-vue';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = ref(JSON.parse(JSON.stringify(props.modelValue)));

const availableLayers = [
  'WALL', 'DOOR', 'WINDOW', 'COLUMN', 'BEAM', 'EQUIPMENT',
  'CABLE_TRAY', 'CONDUIT', 'WELL', 'SHAFT', 'OBSTACLE',
];

const newAutoObstacleLayer = ref('');

function onChange() {
  emit('update:modelValue', model.value);
  settingsStore.updateSettings('wiring', model.value);
}

function removeAutoObstacleLayer(layer: string) {
  model.value.autoWiring.obstacleLayers = model.value.autoWiring.obstacleLayers.filter((l: string) => l !== layer);
  onChange();
}

function addAutoObstacleLayer(value: string) {
  if (value && !model.value.autoWiring.obstacleLayers.includes(value)) {
    model.value.autoWiring.obstacleLayers.push(value);
    onChange();
  }
  newAutoObstacleLayer.value = '';
}

function removeObstacleLayer(layer: string) {
  model.value.infrastructure.obstacleLayers = model.value.infrastructure.obstacleLayers.filter((l: string) => l !== layer);
  onChange();
}

function addObstacleLayer(value: string) {
  if (value && !model.value.infrastructure.obstacleLayers.includes(value)) {
    model.value.infrastructure.obstacleLayers.push(value);
    onChange();
  }
  newObstacleLayer.value = '';
}

function removeCableSpec(index: number) {
  model.value.cableLibrary.defaultSpecs.splice(index, 1);
  onChange();
}

function addCableSpec() {
  model.value.cableLibrary.defaultSpecs.push({
    type: 'ethernet',
    model: '',
    maxLength: 100,
    color: '#3b82f6',
  });
  onChange();
}

watch(() => props.modelValue, (newVal) => {
  model.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });
</script>

<style scoped>
.settings-wiring {
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

.el-tag {
  margin: 2px 4px 2px 0;
}
</style>