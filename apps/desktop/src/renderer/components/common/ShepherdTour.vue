// ShepherdTour 新手引导组件
<template>
  <div v-if="currentStep < steps.length" class="shepherd-overlay">
    <div class="shepherd-modal" :style="modalStyle">
      <div class="shepherd-header">
        <h3 class="shepherd-title">{{ currentStepData.title }}</h3>
        <button class="shepherd-close" @click="cancel" aria-label="关闭">×</button>
      </div>
      <div class="shepherd-content">
        <p class="shepherd-text">{{ currentStepData.text }}</p>
      </div>
      <div class="shepherd-footer">
        <div class="shepherd-progress">
          <span>{{ currentStep + 1 }} / {{ steps.length }}</span>
          <div class="shepherd-progress-bar">
            <div class="shepherd-progress-fill" :style="{ width: ((currentStep + 1) / steps.length * 100) + '%' }"></div>
          </div>
        </div>
        <div class="shepherd-buttons">
          <button v-if="currentStep > 0" class="btn btn-secondary" @click="previous">
            上一步
          </button>
          <button v-if="currentStep === steps.length - 1" class="btn btn-primary" @click="complete">
            {{ currentStepData.buttons?.find(b => b.action === 'complete')?.text || '完成' }}
          </button>
          <button v-else class="btn btn-primary" @click="next">
            {{ currentStepData.buttons?.find(b => b.action === 'next')?.text || '下一步' }}
          </button>
          <button v-if="currentStep === 0" class="btn btn-text" @click="cancel">
            跳过
          </button>
        </div>
      </div>
    </div>

    <!-- 高亮目标元素 -->
    <div
      v-if="currentStepData.attachTo?.element"
      class="shepherd-highlight"
      :style="highlightStyle"
    ></div>

    <!-- 箭头指向 -->
    <div
      v-if="currentStepData.attachTo?.element && arrowPosition"
      class="shepherd-arrow"
      :style="arrowStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';

const props = defineProps<{
  steps: Array<{
    id: string;
    title: string;
    text: string;
    attachTo?: { element: string; on: 'top' | 'bottom' | 'left' | 'right' };
    buttons: Array<{ text: string; action: 'next' | 'back' | 'complete' }>;
  }>;
}>();

const emit = defineEmits<{
  complete: [];
  cancel: [];
}>();

const currentStep = ref(0);

const currentStepData = computed(() => props.steps[currentStep.value] || {});

// 计算模态框位置
const modalStyle = computed(() => {
  const step = currentStepData.value;
  if (!step.attachTo?.element) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const target = document.querySelector(step.attachTo.element);
  if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const rect = target.getBoundingClientRect();
  const modalWidth = 360;
  const modalHeight = 200;
  const gap = 16;

  const positions: Record<string, { top: number; left: number }> = {
    top: { top: rect.top - modalHeight - gap, left: rect.left + rect.width / 2 - modalWidth / 2 },
    bottom: { top: rect.bottom + gap, left: rect.left + rect.width / 2 - modalWidth / 2 },
    left: { top: rect.top + rect.height / 2 - modalHeight / 2, left: rect.left - modalWidth - gap },
    right: { top: rect.top + rect.height / 2 - modalHeight / 2, left: rect.right + gap },
  };

  const pos = positions[step.attachTo.on] || positions.bottom;

  // 边界检查
  let left = Math.max(16, Math.min(pos.left, window.innerWidth - modalWidth - 16));
  let top = Math.max(16, Math.min(pos.top, window.innerHeight - modalHeight - 16));

  return { top: `${top}px`, left: `${left}px` };
});

// 高亮样式
const highlightStyle = computed(() => {
  const step = currentStepData.value;
  if (!step.attachTo?.element) return {};

  const target = document.querySelector(step.attachTo.element);
  if (!target) return {};

  const rect = target.getBoundingClientRect();
  return {
    top: `${rect.top - 4}px`,
    left: `${rect.left - 4}px`,
    width: `${rect.width + 8}px`,
    height: `${rect.height + 8}px`,
  };
});

// 箭头样式
const arrowPosition = ref<{ top: number; left: number } | null>(null);
const arrowStyle = computed(() => {
  if (!arrowPosition.value) return {};
  return { top: `${arrowPosition.value.top}px`, left: `${arrowPosition.value.left}px` };
});

watch(currentStepData, () => {
  nextTick(() => updateArrowPosition());
});

function updateArrowPosition() {
  const step = currentStepData.value;
  if (!step.attachTo?.element) {
    arrowPosition.value = null;
    return;
  }

  const target = document.querySelector(step.attachTo.element);
  const modal = document.querySelector('.shepherd-modal');
  if (!target || !modal) {
    arrowPosition.value = null;
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const modalRect = modal.getBoundingClientRect();

  // 简化：箭头在模态框边缘指向目标中心
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  let arrowTop = 0, arrowLeft = 0;

  if (modalRect.bottom < targetRect.top) {
    // 模态框在目标上方
    arrowTop = modalRect.bottom - 8;
    arrowLeft = Math.max(16, Math.min(targetCenterX - modalRect.left, modalRect.width - 16));
  } else if (modalRect.top > targetRect.bottom) {
    // 模态框在目标下方
    arrowTop = modalRect.top - 8;
    arrowLeft = Math.max(16, Math.min(targetCenterX - modalRect.left, modalRect.width - 16));
  } else if (modalRect.right < targetRect.left) {
    // 模态框在目标左侧
    arrowLeft = modalRect.right - 8;
    arrowTop = Math.max(16, Math.min(targetCenterY - modalRect.top, modalRect.height - 16));
  } else {
    // 模态框在目标右侧
    arrowLeft = modalRect.left - 8;
    arrowTop = Math.max(16, Math.min(targetCenterY - modalRect.top, modalRect.height - 16));
  }

  arrowPosition.value = { top: arrowTop, left: arrowLeft };
}

function next() {
  if (currentStep.value < props.steps.length - 1) {
    currentStep.value++;
  }
}

function previous() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function complete() {
  emit('complete');
}

function cancel() {
  emit('cancel');
}
</script>

<style scoped>
.shepherd-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}

.shepherd-modal {
  position: absolute;
  width: 360px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.shepherd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 0;
}

.shepherd-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.shepherd-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 20px;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.shepherd-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.shepherd-content {
  padding: 12px 20px 20px;
}

.shepherd-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.shepherd-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 0 0 12px 12px;
}

.shepherd-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.shepherd-progress-bar {
  width: 80px;
  height: 4px;
  background: var(--bg-primary);
  border-radius: 2px;
  overflow: hidden;
}

.shepherd-progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.2s ease;
}

.shepherd-buttons {
  display: flex;
  gap: 8px;
}

.shepherd-highlight {
  position: absolute;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); }
  50% { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7); }
}

.shepherd-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  pointer-events: none;
  z-index: 10001;
}

.shepherd-arrow::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 7px solid transparent;
}

/* 箭头方向由 JS 控制 */
.shepherd-arrow[data-direction="down"] {
  border-top-color: var(--bg-secondary);
  border-bottom: none;
  top: -8px;
}
.shepherd-arrow[data-direction="down"]::before {
  border-top-color: var(--border-color);
  top: -8px;
  left: -7px;
}

.shepherd-arrow[data-direction="up"] {
  border-bottom-color: var(--bg-secondary);
  border-top: none;
  bottom: -8px;
}
.shepherd-arrow[data-direction="up"]::before {
  border-bottom-color: var(--border-color);
  bottom: -8px;
  left: -7px;
}

.shepherd-arrow[data-direction="right"] {
  border-left-color: var(--bg-secondary);
  border-right: none;
  left: -8px;
}
.shepherd-arrow[data-direction="right"]::before {
  border-left-color: var(--border-color);
  left: -8px;
  top: -7px;
}

.shepherd-arrow[data-direction="left"] {
  border-right-color: var(--bg-secondary);
  border-left: none;
  right: -8px;
}
.shepherd-arrow[data-direction="left"]::before {
  border-right-color: var(--border-color);
  right: -8px;
  top: -7px;
}
</style>