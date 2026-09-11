<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-item">
        缩放: {{ zoomPercent }}
      </span>
      <span class="status-item">
        中心: ({{ centerText }})
      </span>
      <span class="status-item" :class="{ calibrated: calibration?.isCalibrated }">
        比例尺: {{ scaleText }}
      </span>
    </div>
    <div class="status-right">
      <span v-if="selectedCount > 0" class="status-item selected">
        已选 {{ selectedCount }} 项
      </span>
      <span class="status-item hint">空格+拖动平移 · 滚轮缩放</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 底部状态栏：视口缩放/中心坐标/比例尺/选择状态
import { computed } from 'vue';

const props = defineProps<{
  viewport?: { zoom?: number; center?: { x: number; y: number } } | null;
  calibration?: { isCalibrated?: boolean; scale?: number } | null;
  selectedCount?: number;
}>();

const zoomPercent = computed(() => {
  const zoom = props.viewport?.zoom ?? 1;
  return `${Math.round(zoom * 100)}%`;
});

const centerText = computed(() => {
  const c = props.viewport?.center;
  if (!c) return '0, 0';
  return `${c.x.toFixed(1)}, ${c.y.toFixed(1)}`;
});

const scaleText = computed(() => {
  if (!props.calibration?.isCalibrated || !props.calibration.scale) return '未校准';
  return `1:${Math.round(1 / props.calibration.scale)}`;
});
</script>

<style scoped>
.status-bar {
  height: var(--statusbar-height, 28px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--color-surface, #fff);
  border-top: 1px solid var(--color-border, #e2e8f0);
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item.calibrated {
  color: var(--color-success, #22c55e);
}

.status-item.selected {
  color: var(--color-primary, #3b82f6);
  font-weight: 600;
}

.status-item.hint {
  opacity: 0.7;
}
</style>
