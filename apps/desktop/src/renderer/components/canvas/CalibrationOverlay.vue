<template>
  <!-- 比例尺校准浮层（决策 5.2 / AC-3.1）：透明捕获层 + 底部操作条 -->
  <div ref="overlayEl" class="calibration-overlay" @click="onClick" @contextmenu.prevent>
    <!-- 已拾取点标记（屏幕像素定位，由父级 transform 投影得到） -->
    <span
      v-for="(m, i) in markers"
      :key="i"
      class="cal-marker"
      :style="{ left: m.x + 'px', top: m.y + 'px' }"
    >{{ i === 0 ? 'A' : 'B' }}</span>

    <!-- A-B 连线示意 -->
    <svg v-if="markers.length === 2" class="cal-line">
      <line :x1="markers[0].x" :y1="markers[0].y" :x2="markers[1].x" :y2="markers[1].y" />
    </svg>

    <div class="cal-bar" @click.stop>
      <div class="cal-step">
        <span class="cal-badge">{{ stepIndex }}/{{ stepTotal }}</span>
        <span class="cal-hint">{{ hint }}</span>
      </div>

      <div v-if="step === 'distance'" class="cal-inputs">
        <input
          ref="distanceInputRef"
          v-model.number="realDistance"
          class="cal-input"
          type="number"
          min="0.001"
          step="0.1"
          placeholder="实际长度"
          @keyup.enter="confirm"
        />
        <select v-model="unit" class="cal-select">
          <option value="mm">毫米</option>
          <option value="cm">厘米</option>
          <option value="m">米</option>
        </select>
        <span class="cal-preview">图上距离 {{ previewDistance.toFixed(1) }} mm</span>
      </div>

      <div class="cal-actions">
        <button class="cal-btn cal-btn-primary" :disabled="step !== 'distance'" @click="confirm">
          应用校准
        </button>
        <button class="cal-btn" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * CalibrationOverlay —— 两点取距浮层（挂载在 DrawingView 的画布容器内）。
 *
 * 交互契约：
 *  - 覆盖层吃掉画布点击，经父级注入的 toModel 换算为模型坐标后 emit('pick', Point2D)；
 *  - 父级（DrawingView）把点转交 useCalibration().addPoint()，并把已拾取点回传 points；
 *  - 标记定位需要模型→屏幕投影，故由父级注入 toScreen（与画布共用同一变换矩阵，
 *    避免本组件自行读取 viewport 造成缩放后标记漂移）。
 *  - 「应用校准」emit('apply', {realDistance, unit})，写入逻辑在 composable 内。
 */
import { computed, nextTick, ref, watch } from 'vue';
import type { CalibrationData, Point2D } from '@security-survey/shared-types';

const props = defineProps<{
  step: 'point1' | 'point2' | 'distance' | 'idle';
  hint: string;
  /** 已拾取的模型坐标点（最多 2 个） */
  points: Point2D[];
  /** 两点间模型坐标距离（毫米） */
  previewDistance: number;
  /** 屏幕像素 → 模型坐标（与画布变换一致） */
  toModel: (screen: Point2D) => Point2D;
  /** 模型坐标 → 容器内屏幕像素（与画布变换一致） */
  toScreen: (model: Point2D) => Point2D;
}>();

const emit = defineEmits<{
  pick: [point: Point2D];
  apply: [payload: { realDistance: number; unit: CalibrationData['unit'] }];
  cancel: [];
}>();

const overlayEl = ref<HTMLElement>();
const distanceInputRef = ref<HTMLInputElement>();
const realDistance = ref(0);
const unit = ref<CalibrationData['unit']>('m');

const stepIndex = computed(() => (props.step === 'point1' ? 1 : props.step === 'point2' ? 2 : 3));
const stepTotal = 3;

const markers = computed(() => props.points.slice(0, 2).map(p => props.toScreen(p)));

function onClick(e: MouseEvent) {
  const el = overlayEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  emit('pick', props.toModel({ x: e.clientX - rect.left, y: e.clientY - rect.top }));
}

function confirm() {
  if (props.step !== 'distance') return;
  emit('apply', { realDistance: realDistance.value, unit: unit.value });
}

/** 进入距离输入态时自动聚焦并全选，减少一次点击（AC-3.1 主流程顺畅性） */
watch(() => props.step, async (s) => {
  if (s !== 'distance') return;
  await nextTick();
  distanceInputRef.value?.focus();
  distanceInputRef.value?.select();
});
</script>

<style scoped>
.calibration-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  cursor: crosshair;
  background: rgba(59, 130, 246, 0.04);
  outline: 2px dashed rgba(59, 130, 246, 0.5);
  outline-offset: -2px;
}

.cal-line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.cal-line line {
  stroke: #2563eb;
  stroke-width: 2;
  stroke-dasharray: 6 4;
}

.cal-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  pointer-events: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
}

.cal-bar {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  cursor: default;
  flex-wrap: wrap;
  white-space: nowrap;
}

.cal-step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
}

.cal-hint {
  font-size: 13px;
  color: #374151;
}

.cal-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cal-input {
  width: 96px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.cal-select {
  padding: 4px 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

.cal-preview {
  font-size: 12px;
  color: #6b7280;
}

.cal-actions {
  display: flex;
  gap: 8px;
}

.cal-btn {
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}

.cal-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cal-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.cal-btn-primary:not(:disabled):hover {
  background: #1d4ed8;
}
</style>
