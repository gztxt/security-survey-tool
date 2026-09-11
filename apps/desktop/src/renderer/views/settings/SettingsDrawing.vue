<template>
  <div class="settings-drawing">
    <div class="setting-group">
      <h4>默认图纸设置</h4>

      <el-form :model="model.defaults" label-width="140px" size="small">
        <el-form-item label="默认图纸尺寸">
          <el-select v-model="model.defaults.defaultSize" placeholder="选择尺寸" style="width: 180px">
            <el-option label="A4 (210×297mm)" value="a4" />
            <el-option label="A3 (297×420mm)" value="a3" />
            <el-option label="A2 (420×594mm)" value="a2" />
            <el-option label="A1 (594×841mm)" value="a1" />
            <el-option label="A0 (841×1189mm)" value="a0" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义宽度" v-if="model.defaults.defaultSize === 'custom'">
          <el-input-number v-model="model.defaults.customWidth" :min="100" :max="10000" :step="1" controls-position="right" />
          <template #append>mm</template>
        </el-form-item>

        <el-form-item label="自定义高度" v-if="model.defaults.defaultSize === 'custom'">
          <el-input-number v-model="model.defaults.customHeight" :min="100" :max="10000" :step="1" controls-position="right" />
          <template #append>mm</template>
        </el-form-item>

        <el-form-item label="默认方向">
          <el-radio-group v-model="model.defaults.orientation">
            <el-radio-button label="portrait">纵向</el-radio-button>
            <el-radio-button label="landscape">横向</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="默认比例">
          <el-select v-model="model.defaults.defaultScale" placeholder="选择比例" style="width: 180px">
            <el-option label="1:1" value="1" />
            <el-option label="1:2" value="2" />
            <el-option label="1:5" value="5" />
            <el-option label="1:10" value="10" />
            <el-option label="1:20" value="20" />
            <el-option label="1:50" value="50" />
            <el-option label="1:100" value="100" />
            <el-option label="1:200" value="200" />
            <el-option label="1:500" value="500" />
            <el-option label="1:1000" value="1000" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义比例" v-if="model.defaults.defaultScale === 'custom'">
          <el-input-number v-model="model.defaults.customScale" :min="0.01" :max="10000" :step="0.01" :precision="2" controls-position="right" />
          <template #append>:1</template>
        </el-form-item>

        <el-form-item label="默认单位">
          <el-select v-model="model.defaults.defaultUnit" placeholder="选择单位" style="width: 180px">
            <el-option label="毫米 (mm)" value="mm" />
            <el-option label="厘米 (cm)" value="cm" />
            <el-option label="米 (m)" value="m" />
            <el-option label="英寸 (in)" value="in" />
            <el-option label="英尺 (ft)" value="ft" />
          </el-select>
        </el-form-item>

        <el-form-item label="新建图纸时">
          <el-checkbox-group v-model="model.defaults.onNewDrawing">
            <el-checkbox value="showCalibration">显示校准向导</el-checkbox>
            <el-checkbox value="importDwg">提示导入 DWG/DXF</el-checkbox>
            <el-checkbox value="addGrid">自动添加网格</el-checkbox>
            <el-checkbox value="addBorder">自动添加图框</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>图框与标题栏</h4>

      <el-form :model="model.border" label-width="140px" size="small">
        <el-form-item label="默认图框样式">
          <el-select v-model="model.border.defaultStyle" placeholder="选择样式" style="width: 200px">
            <el-option label="标准图框 (GB/T 10609)" value="standard" />
            <el-option label="简化图框" value="simple" />
            <el-option label="无图框" value="none" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="图框线宽">
          <el-input-number v-model="model.border.lineWidth" :min="0.1" :max="2" :step="0.1" :precision="1" controls-position="right" />
          <template #append>mm</template>
        </el-form-item>

        <el-form-item label="标题栏字体">
          <el-select v-model="model.border.titleFontFamily" placeholder="选择字体" style="width: 200px">
            <el-option label="宋体" value="SimSun" />
            <el-option label="黑体" value="SimHei" />
            <el-option label="微软雅黑" value="Microsoft YaHei" />
            <el-option label="Arial" value="Arial" />
            <el-option label="自定义..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="标题栏字号">
          <el-input-number v-model="model.border.titleFontSize" :min="6" :max="24" :step="1" controls-position="right" />
          <template #append>pt</template>
        </el-form-item>

        <el-form-item label="自动填充字段">
          <el-checkbox-group v-model="model.border.autoFields">
            <el-checkbox value="projectName">项目名称</el-checkbox>
            <el-checkbox value="projectCode">项目编号</el-checkbox>
            <el-checkbox value="drawingName">图纸名称</el-checkbox>
            <el-checkbox value="drawingNo">图纸编号</el-checkbox>
            <el-checkbox value="scale">比例</el-checkbox>
            <el-checkbox value="date">日期</el-checkbox>
            <el-checkbox value="designer">设计人</el-checkbox>
            <el-checkbox value="checker">校核人</el-checkbox>
            <el-checkbox value="approver">审批人</el-checkbox>
            <el-checkbox value="revision">版本/修订</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>校准设置</h4>

      <el-form :model="model.calibration" label-width="140px" size="small">
        <el-form-item label="校准方式">
          <el-radio-group v-model="model.calibration.method">
            <el-radio-button label="two-points">两点校准</el-radio-button>
            <el-radio-button label="known-distance">已知距离</el-radio-button>
            <el-radio-button label="scale-bar">比例尺</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="最少校准点数">
          <el-input-number v-model="model.calibration.minPoints" :min="2" :max="10" :step="1" controls-position="right" />
        </el-form-item>

        <el-form-item label="最大允许误差">
          <el-input-number v-model="model.calibration.maxError" :min="0.01" :max="10" :step="0.01" :precision="2" controls-position="right" />
          <template #append>%</template>
        </el-form-item>

        <el-form-item label="自动检测比例尺">
          <el-switch v-model="model.calibration.autoDetectScale" />
          <span class="switch-desc">从 DWG/DXF 标题栏读取比例</span>
        </el-form-item>

        <el-form-item label="保存校准历史">
          <el-switch v-model="model.calibration.saveHistory" />
        </el-form-item>

        <el-form-item label="校准点颜色">
          <el-color-picker v-model="model.calibration.pointColor" show-alpha />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>多图纸管理</h4>

      <el-form :model="model.multiDrawing" label-width="140px" size="small">
        <el-form-item label="标签页位置">
          <el-radio-group v-model="model.multiDrawing.tabPosition">
            <el-radio-button label="top">顶部</el-radio-button>
            <el-radio-button label="bottom">底部</el-radio-button>
            <el-radio-button label="left">左侧</el-radio-button>
            <el-radio-button label="right">右侧</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="最大标签页数">
          <el-input-number v-model="model.multiDrawing.maxTabs" :min="5" :max="100" :step="5" controls-position="right" />
        </el-form-item>

        <el-form-item label="标签页显示">
          <el-checkbox-group v-model="model.multiDrawing.tabShow">
            <el-checkbox value="icon">文件格式图标</el-checkbox>
            <el-checkbox value="dirty">未保存指示</el-checkbox>
            <el-checkbox value="close">关闭按钮</el-checkbox>
            <el-checkbox value="scale">当前比例</el-checkbox>
            <el-checkbox value="coords">坐标系</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="切换图纸时">
          <el-checkbox-group v-model="model.multiDrawing.onSwitch">
            <el-checkbox value="restoreViewport">恢复视口位置</el-checkbox>
            <el-checkbox value="restoreSelection">恢复选中状态</el-checkbox>
            <el-checkbox value="restoreLayers">恢复图层可见性</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="关闭图纸确认">
          <el-switch v-model="model.multiDrawing.confirmClose" />
          <span class="switch-desc">有未保存更改时提示</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>图层默认设置</h4>

      <el-form :model="model.layers" label-width="140px" size="small">
        <el-form-item label="新建图层默认">
          <el-checkbox-group v-model="model.layers.newLayerDefaults">
            <el-checkbox value="visible">可见</el-checkbox>
            <el-checkbox value="printable">可打印</el-checkbox>
            <el-checkbox value="locked">锁定</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="导入 DWG 图层">
          <el-radio-group v-model="model.layers.importBehavior">
            <el-radio-button label="preserve">保留原图层结构</el-radio-button>
            <el-radio-button label="merge">合并同名图层</el-radio-button>
            <el-radio-button label="flatten">扁平化到单图层</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="图层颜色策略">
          <el-select v-model="model.layers.colorStrategy" placeholder="选择策略" style="width: 220px">
            <el-option label="保留原色" value="preserve" />
            <el-option label="按类别着色" value="by-category" />
            <el-option label="单色模式" value="monochrome" />
            <el-option label="ACAD 标准色" value="acad-standard" />
          </el-select>
        </el-form-item>

        <el-form-item label="显示图层零长度">
          <el-switch v-model="model.layers.showZeroLength" />
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
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

watch(model, (newVal) => {
  settingsStore.updateSettings('drawing', newVal);
}, { deep: true });
</script>

<style scoped>
.settings-drawing {
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

.el-form-item__content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.el-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}
</style>