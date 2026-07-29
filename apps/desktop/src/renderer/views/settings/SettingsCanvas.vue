<template>
  <div class="settings-canvas">
    <div class="setting-group">
      <h4>网格设置</h4>

      <el-form :model="model.grid" label-width="140px" size="small">
        <el-form-item label="显示网格" prop="enabled">
          <el-switch v-model="model.grid.enabled" @change="onChange" />
        </el-form-item>

        <el-form-item label="网格类型" prop="type">
          <el-select v-model="model.grid.type" placeholder="选择类型" style="width: 100%;" @change="onChange">
            <el-option label="正方形网格" value="square" />
            <el-option label="等距网格" value="isometric" />
            <el-option label="点阵" value="dots" />
          </el-select>
        </el-form-item>

        <el-form-item label="主网格间距" prop="majorSpacing">
          <el-input-number v-model="model.grid.majorSpacing" :min="1" :max="10000" :step="1" controls-position="right" @change="onChange" />
          <template #append>mm</template>
        </el-form-item>

        <el-form-item label="次网格分割" prop="minorDivisions">
          <el-input-number v-model="model.grid.minorDivisions" :min="1" :max="20" :step="1" controls-position="right" @change="onChange" />
          <template #append>分/格</template>
        </el-form-item>

        <el-form-item label="主网格颜色" prop="majorColor">
          <el-color-picker v-model="model.grid.majorColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="次网格颜色" prop="minorColor">
          <el-color-picker v-model="model.grid.minorColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="网格线宽" prop="lineWidth">
          <el-input-number v-model="model.grid.lineWidth" :min="0.1" :max="2" :step="0.1" :precision="1" controls-position="right" @change="onChange" />
          <template #append>px</template>
        </el-form-item>

        <el-form-item label="自适应缩放" prop="adaptive">
          <el-switch v-model="model.grid.adaptive" @change="onChange" />
          <span class="switch-desc">缩小时自动隐藏次网格</span>
        </el-form-item>

        <el-form-item label="吸附网格" prop="snapToGrid">
          <el-switch v-model="model.grid.snapToGrid" @change="onChange" />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>吸附设置</h4>

      <el-form :model="model.snap" label-width="140px" size="small">
        <el-form-item label="启用吸附" prop="enabled">
          <el-switch v-model="model.snap.enabled" @change="onChange" />
        </el-form-item>

        <el-form-item label="吸附距离" prop="threshold">
          <el-input-number v-model="model.snap.threshold" :min="1" :max="50" :step="1" controls-position="right" @change="onChange" />
          <template #append>px (屏幕像素)</template>
        </el-form-item>

        <el-form-item label="吸附优先级" prop="priority">
          <el-tag
            v-for="p in model.snap.priority"
            :key="p"
            closable
            @close="removeSnapPriority(p)"
            class="priority-tag"
          >
            {{ getSnapPriorityLabel(p) }}
          </el-tag>
          <el-select v-model="newPriority" placeholder="添加优先级" style="width: 160px; margin-top: 8px;" @change="addSnapPriority">
            <el-option v-for="opt in snapPriorityOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="显示吸附预览" prop="showPreview">
          <el-switch v-model="model.snap.showPreview" @change="onChange" />
        </el-form-item>

        <el-form-item label="吸附指示器颜色" prop="indicatorColor">
          <el-color-picker v-model="model.snap.indicatorColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="对象吸附类型" prop="objectTypes">
          <el-checkbox-group v-model="model.snap.objectTypes" @change="onChange">
            <el-checkbox :label="t.value" v-for="t in snapObjectTypes" :key="t.value">
              {{ t.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>视图与渲染</h4>

      <el-form :model="model.view" label-width="140px" size="small">
        <el-form-item label="背景颜色" prop="bgColor">
          <el-color-picker v-model="model.view.bgColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="纸张背景" prop="paperBgColor">
          <el-color-picker v-model="model.view.paperBgColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="选择高亮色" prop="selectionColor">
          <el-color-picker v-model="model.view.selectionColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="框选颜色" prop="crosshairColor">
          <el-color-picker v-model="model.view.crosshairColor" show-alpha @change="onChange" />
        </el-form-item>

        <el-form-item label="缩放范围" prop="zoomRange">
          <el-row :gutter="8">
            <el-col :span="11">
              <el-input-number v-model="model.view.zoomRange.min" :min="0.01" :max="1" :step="0.01" :precision="2" controls-position="right" placeholder="最小" @change="onChange" />
            </el-col>
            <el-col :span="2" style="display: flex; align-items: center; justify-content: center;">~</el-col>
            <el-col :span="11">
              <el-input-number v-model="model.view.zoomRange.max" :min="1" :max="1000" :step="10" controls-position="right" placeholder="最大" @change="onChange" />
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item label="鼠标滚轮缩放" prop="wheelZoom">
          <el-switch v-model="model.view.wheelZoom" @change="onChange" />
        </el-form-item>

        <el-form-item label="滚轮缩放速度" prop="wheelZoomSpeed">
          <el-slider v-model="model.view.wheelZoomSpeed" :min="0.05" :max="0.5" :step="0.01" show-tooltip @change="onChange" />
        </el-form-item>

        <el-form-item label="中键拖拽平移" prop="middlePan">
          <el-switch v-model="model.view.middlePan" @change="onChange" />
        </el-form-item>

        <el-form-item label="右键拖拽平移" prop="rightPan">
          <el-switch v-model="model.view.rightPan" @change="onChange" />
        </el-form-item>

        <el-form-item label="动画过渡" prop="animations">
          <el-switch v-model="model.view.animations" @change="onChange" />
        </el-form-item>

        <el-form-item label="抗锯齿" prop="antialias">
          <el-switch v-model="model.view.antialias" @change="onChange" />
        </el-form-item>

        <el-form-item label="高DPI支持" prop="highDpi">
          <el-switch v-model="model.view.highDpi" @change="onChange" />
          <span class="switch-desc">需重启应用</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>LOD (细节层级) 设置</h4>

      <el-form :model="model.lod" label-width="140px" size="small">
        <el-form-item label="启用 LOD" prop="enabled">
          <el-switch v-model="model.lod.enabled" @change="onChange" />
        </el-form-item>

        <el-form-item label="简化阈值" prop="simplifyThreshold">
          <el-input-number v-model="model.lod.simplifyThreshold" :min="1" :max="100" :step="1" controls-position="right" @change="onChange" />
          <template #append>px</template>
        </el-form-item>

        <el-form-item label="隐藏阈值" prop="hideThreshold">
          <el-input-number v-model="model.lod.hideThreshold" :min="1" :max="50" :step="1" controls-position="right" @change="onChange" />
          <template #append>px</template>
        </el-form-item>

        <el-form-item label="最大显示实体数" prop="maxEntities">
          <el-input-number v-model="model.lod.maxEntities" :min="1000" :max="100000" :step="1000" controls-position="right" @change="onChange" />
        </el-form-item>

        <el-form-item label="实体渐变" prop="fadeEntities">
          <el-switch v-model="model.lod.fadeEntities" @change="onChange" />
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>性能设置</h4>

      <el-form :model="model.performance" label-width="140px" size="small">
        <el-form-item label="视口剔除" prop="viewportCulling">
          <el-switch v-model="model.performance.viewportCulling" @change="onChange" />
        </el-form-item>

        <el-form-item label="脏矩形渲染" prop="dirtyRectRendering">
          <el-switch v-model="model.performance.dirtyRectRendering" @change="onChange" />
        </el-form-item>

        <el-form-item label="目标帧率" prop="targetFps">
          <el-select v-model="model.performance.targetFps" placeholder="选择帧率" style="width: 120px;" @change="onChange">
            <el-option label="30 FPS" value="30" />
            <el-option label="60 FPS" value="60" />
            <el-option label="120 FPS" value="120" />
            <el-option label="无限制" value="0" />
          </el-select>
        </el-form-item>

        <el-form-item label="空闲降帧" prop="idleThrottle">
          <el-switch v-model="model.performance.idleThrottle" @change="onChange" />
          <span class="switch-desc">鼠标静止时降低渲染频率</span>
        </el-form-item>

        <el-form-item label="WebGL 后备" prop="webglFallback">
          <el-switch v-model="model.performance.webglFallback" @change="onChange" />
          <span class="switch-desc">Canvas 2D 失败时尝试 WebGL</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>默认视图模式</h4>

      <el-form :model="model.defaults" label-width="140px" size="small">
        <el-form-item label="启动视图" prop="viewMode">
          <el-radio-group v-model="model.defaults.viewMode" @change="onChange">
            <el-radio-button label="design">设计模式</el-radio-button>
            <el-radio-button label="fov">视场分析</el-radio-button>
            <el-radio-button label="wiring">布线模式</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="默认缩放" prop="defaultZoom">
          <el-radio-group v-model="model.defaults.defaultZoom" @change="onChange">
            <el-radio-button label="fit">缩放适应</el-radio-button>
            <el-radio-button label="100">100%</el-radio-button>
            <el-radio-button label="extents">显示全部</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="显示标尺" prop="showRulers">
          <el-switch v-model="model.defaults.showRulers" @change="onChange" />
        </el-form-item>

        <el-form-item label="显示坐标" prop="showCoordinates">
          <el-switch v-model="model.defaults.showCoordinates" @change="onChange" />
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = ref(JSON.parse(JSON.stringify(props.modelValue)));

const newPriority = ref('');
const snapPriorityOptions = [
  { value: 'endpoint', label: '端点' },
  { value: 'midpoint', label: '中点' },
  { value: 'center', label: '圆心' },
  { value: 'intersection', label: '交点' },
  { value: 'perpendicular', label: '垂足' },
  { value: 'tangent', label: '切点' },
  { value: 'nearest', label: '最近点' },
  { value: 'grid', label: '网格点' },
];

const snapObjectTypes = [
  { value: 'line', label: '直线' },
  { value: 'arc', label: '圆弧' },
  { value: 'circle', label: '圆' },
  { value: 'polyline', label: '多段线' },
  { value: 'text', label: '文字' },
  { value: 'dimension', label: '标注' },
  { value: 'block', label: '块/设备' },
  { value: 'hatch', label: '填充' },
];

function getSnapPriorityLabel(value: string): string {
  const opt = snapPriorityOptions.find(o => o.value === value);
  return opt?.label || value;
}

function addSnapPriority(value: string) {
  if (value && !model.value.snap.priority.includes(value)) {
    model.value.snap.priority.push(value);
    newPriority.value = '';
    onChange();
  }
}

function removeSnapPriority(value: string) {
  model.value.snap.priority = model.value.snap.priority.filter(p => p !== value);
  onChange();
}

function onChange() {
  emit('update:modelValue', model.value);
}

watch(() => props.modelValue, (newVal) => {
  model.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true });
</script>

<style scoped>
.settings-canvas {
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

.switch-desc {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.priority-tag {
  margin: 4px 4px 0 0;
  cursor: pointer;
}

.priority-tag .el-tag__close {
  margin-left: 4px;
}
</style>