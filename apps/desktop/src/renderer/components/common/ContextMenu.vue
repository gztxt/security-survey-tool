// ContextMenu 组件
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="context-menu-overlay"
      @click="close"
    >
      <div
        class="context-menu"
        :style="{ left: position.x + 'px', top: position.y + 'px' }"
        @click.stop
      >
        <template v-for="(item, index) in items" :key="index">
          <div
            v-if="item.type === 'separator'"
            class="context-menu-separator"
          />
          <button
            v-else
            class="context-menu-item"
            :class="{ disabled: item.disabled, danger: item.danger }"
            @click="select(item)"
          >
            <span class="item-label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="item-shortcut">{{ item.shortcut }}</span>
            <component v-if="item.icon" :is="item.icon" class="item-icon" />
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
  position: { x: number; y: number };
  items: Array<{
    label: string;
    action: string;
    data?: any;
    disabled?: boolean;
    danger?: boolean;
    shortcut?: string;
    icon?: any;
    type?: 'separator';
  }>;
}>();

const emit = defineEmits<{
  select: [action: string, data: any];
}>();

// 防止菜单超出屏幕
const adjustedPosition = ref(props.position);

watch(() => props.position, (pos) => {
  if (!pos) return;
  const menuWidth = 200;
  const menuHeight = props.items.length * 32;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = pos.x;
  let y = pos.y;

  if (x + menuWidth > viewportWidth) x = viewportWidth - menuWidth - 10;
  if (y + menuHeight > viewportHeight) y = viewportHeight - menuHeight - 10;
  if (x < 10) x = 10;
  if (y < 10) y = 10;

  adjustedPosition.value = { x, y };
}, { immediate: true });

function select(item: any) {
  if (item.disabled) return;
  emit('select', item.action, item.data);
  close();
}

function close() {
  // 由父组件控制 visible
}

function handleClickOutside(e: MouseEvent) {
  close();
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.context-menu {
  position: absolute;
  min-width: 180px;
  max-width: 280px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 4px;
  overflow: hidden;
  animation: fadeIn 0.1s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.context-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  gap: 12px;
  transition: background 0.1s;
}

.context-menu-item:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.context-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-item.danger {
  color: #ef4444;
}

.context-menu-item.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
}

.item-label { flex: 1; }
.item-shortcut {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: monospace;
}
.item-icon { width: 16px; height: 16px; flex-shrink: 0; }

.context-menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}
</style>