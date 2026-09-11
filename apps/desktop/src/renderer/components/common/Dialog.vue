<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click="close">
      <div
        class="dialog"
        :class="sizeClass"
        @click.stop
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'dialog-title' : undefined"
        :aria-describedby="contentId"
      >
        <div class="dialog-header" v-if="title || showClose">
          <h3 id="dialog-title" class="dialog-title" v-if="title">{{ title }}</h3>
          <button class="dialog-close" @click="close" aria-label="关闭" v-if="showClose">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div :id="contentId" class="dialog-content">
          <slot />
        </div>

        <div class="dialog-footer" v-if="$slots.footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showClose?: boolean;
  destroyOnClose?: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  close: [];
}>();

const contentId = `dialog-content-${Math.random().toString(36).slice(2, 9)}`;
const isMounted = ref(false);

const sizeClass = computed(() => `dialog-${props.size || 'md'}`);

function close() {
  if (props.destroyOnClose) {
    // 延迟销毁以允许动画完成
    setTimeout(() => emit('update:visible', false), 200);
  } else {
    emit('update:visible', false);
  }
  emit('close');
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEscape) {
    close();
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeydown);
  } else {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleKeydown);
  }
});

onMounted(() => {
  isMounted.value = true;
  if (props.visible) {
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeydown);
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.2s ease-out;
  overflow: hidden;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-sm { width: 360px; max-width: calc(100% - 48px); }
.dialog-md { width: 520px; max-width: calc(100% - 48px); }
.dialog-lg { width: 720px; max-width: calc(100% - 48px); }
.dialog-xl { width: 960px; max-width: calc(100% - 48px); }
.dialog-full { width: 100%; max-width: none; max-height: 100%; height: 100%; border-radius: 0; }

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.dialog-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dialog-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
  min-height: 0;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .dialog-overlay {
    padding: 0;
    align-items: flex-end;
  }
  .dialog {
    width: 100% !important;
    max-width: none !important;
    height: auto;
    max-height: 85vh;
    border-radius: 16px 16px 0 0;
  }
  .dialog-full {
    height: 100%;
    border-radius: 0;
  }
}
</style>