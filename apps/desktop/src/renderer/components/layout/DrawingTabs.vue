<template>
  <div class="drawing-tabs">
    <div class="tabs-container" ref="tabsContainer">
      <div class="tab-list" ref="tabList" :style="{ transform: `translateX(${scrollOffset}px)` }">
        <div
          v-for="drawing in drawings"
          :key="drawing.id"
          class="tab"
          :class="{ active: drawing.id === activeDrawingId, dirty: drawing.dirty }"
          @click="switchDrawing(drawing.id)"
          @contextmenu.prevent="showTabContextMenu(drawing, $event)"
        >
          <span class="tab-icon" :class="getFormatIconClass(drawing)">
            <svg v-if="drawing.file?.format === 'dwg'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <svg v-else-if="drawing.file?.format === 'dxf'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </span>
          <span class="tab-title" :title="drawing.name">{{ drawing.name || '未命名图纸' }}</span>
          <span v-if="drawing.dirty" class="dirty-indicator" title="未保存">●</span>
          <button class="tab-close" @click.stop="closeDrawing(drawing.id)" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- 新建标签按钮 -->
        <button class="tab tab-new" @click="addDrawing" title="新建图纸 (Ctrl+T)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <!-- 滚动按钮 -->
      <button class="scroll-btn scroll-left" @click="scrollLeft" :disabled="scrollOffset >= 0" aria-label="向左滚动">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button class="scroll-btn scroll-right" @click="scrollRight" :disabled="!canScrollRight" aria-label="向右滚动">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- 标签右键菜单 -->
    <ContextMenu
      v-model:visible="tabMenu.visible"
      :position="tabMenu.position"
      :items="tabMenu.items"
      @select="onTabMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';
import ContextMenu from '@/components/common/ContextMenu.vue';

const projectStore = useProjectStore();

const props = defineProps<{
  height?: number;
}>();

const emit = defineEmits<{
  'drawing-add': [];
  'drawing-switch': [drawingId: string];
  'drawing-close': [drawingId: string];
}>();

const drawings = computed(() => projectStore.drawings);
const activeDrawingId = computed(() => projectStore.currentDrawingId);
const scrollOffset = ref(0);
const tabMenu = ref({ visible: false, position: { x: 0, y: 0 }, items: [] as any[], data: null as any });
const tabListRef = ref<HTMLDivElement>();
const tabsContainerRef = ref<HTMLDivElement>();

const tabWidth = 180;
const minTabWidth = 120;

const canScrollRight = computed(() => {
  if (!tabListRef.value || !tabsContainerRef.value) return false;
  const containerWidth = tabsContainerRef.value.clientWidth - 80; // 减去滚动按钮宽度
  const totalWidth = drawings.value.length * tabWidth;
  return Math.abs(scrollOffset.value) < totalWidth - containerWidth;
});

function switchDrawing(drawingId: string) {
  projectStore.setCurrentDrawing(drawingId);
  emit('drawing-switch', drawingId);
}

function closeDrawing(drawingId: string) {
  projectStore.removeDrawing(drawingId);
  emit('drawing-close', drawingId);
}

function addDrawing() {
  emit('drawing-add');
}

function scrollLeft() {
  scrollOffset.value = Math.min(0, scrollOffset.value + tabWidth * 3);
}

function scrollRight() {
  if (!canScrollRight.value) return;
  const containerWidth = tabsContainerRef.value?.clientWidth || 0;
  const totalWidth = drawings.value.length * tabWidth;
  const maxOffset = -(totalWidth - containerWidth + 80);
  scrollOffset.value = Math.max(maxOffset, scrollOffset.value - tabWidth * 3);
}

function showTabContextMenu(drawing: any, event: MouseEvent) {
  event.preventDefault();
  const items = [
    { label: '关闭', action: 'close', data: drawing },
    { label: '关闭其他', action: 'close-others', data: drawing },
    { label: '关闭右侧', action: 'close-right', data: drawing },
    { type: 'separator' },
    { label: '重命名', action: 'rename', data: drawing },
    { label: drawing.dirty ? '保存' : '导出', action: drawing.dirty ? 'save' : 'export', data: drawing },
    { label: '复制路径', action: 'copy-path', data: drawing },
  ];

  tabMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    items,
    data: drawing,
  };
}

function onTabMenuSelect(action: string, data: any) {
  tabMenu.value.visible = false;
  switch (action) {
    case 'close':
      closeDrawing(data.id);
      break;
    case 'close-others':
      for (const d of drawings.value) {
        if (d.id !== data.id) closeDrawing(d.id);
      }
      break;
    case 'close-right':
      const currentIdx = drawings.value.findIndex(d => d.id === data.id);
      for (let i = currentIdx + 1; i < drawings.value.length; i++) {
        closeDrawing(drawings.value[i].id);
      }
      break;
    case 'rename':
      // 触发重命名
      break;
    case 'save':
      // 触发保存
      break;
    case 'export':
      // 触发导出
      break;
    case 'copy-path':
      navigator.clipboard.writeText(data.file?.path || '');
      break;
  }
}

function getFormatIconClass(drawing: any) {
  const fmt = drawing.file?.format || 'dxf';
  return `format-${fmt}`;
}

// 键盘快捷键
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 't':
      case 'T':
        e.preventDefault();
        addDrawing();
        break;
      case 'w':
      case 'W':
        e.preventDefault();
        if (activeDrawingId.value) closeDrawing(activeDrawingId.value);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Tab - 上一个
          const idx = drawings.value.findIndex(d => d.id === activeDrawingId.value);
          const prev = drawings.value[(idx - 1 + drawings.value.length) % drawings.value.length];
          if (prev) switchDrawing(prev.id);
        } else {
          // Ctrl+Tab - 下一个
          const idx = drawings.value.findIndex(d => d.id === activeDrawingId.value);
          const next = drawings.value[(idx + 1) % drawings.value.length];
          if (next) switchDrawing(next.id);
        }
        break;
    }
  }
}

// 监听活动图纸变化，确保可见
watch(activeDrawingId, (newId) => {
  nextTick(() => ensureTabVisible(newId));
});

function ensureTabVisible(drawingId: string) {
  if (!tabListRef.value || !tabsContainerRef.value) return;
  const idx = drawings.value.findIndex(d => d.id === drawingId);
  if (idx === -1) return;

  const tabLeft = idx * tabWidth;
  const tabRight = tabLeft + tabWidth;
  const containerLeft = -scrollOffset.value;
  const containerRight = containerLeft + tabsContainerRef.value.clientWidth - 80;

  if (tabLeft < containerLeft) {
    scrollOffset.value = -tabLeft;
  } else if (tabRight > containerRight) {
    scrollOffset.value = -(tabRight - tabsContainerRef.value.clientWidth + 80);
  }
}
</script>

<style scoped>
.drawing-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs-container {
  position: relative;
  height: 36px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
}

.tab-list {
  display: flex;
  height: 100%;
  transition: transform 0.2s ease;
  will-change: transform;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
  max-width: 180px;
  height: 100%;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-color);
  border-radius: 0;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tab:hover:not(.active):not(.tab-new) {
  background: var(--bg-secondary);
}

.tab.active {
  background: var(--bg-primary);
  border-bottom: 2px solid #3b82f6;
}

.tab.dirty .tab-title::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 4px;
  background: #f59e0b;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tab-new {
  min-width: 36px;
  max-width: 36px;
  justify-content: center;
  color: var(--text-tertiary);
  border-right: none;
}

.tab-new:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.tab-icon.format-dwg { color: #ef4444; }
.tab-icon.format-dxf { color: #3b82f6; }
.tab-icon.format-pdf { color: #f59e0b; }
.tab-icon.format-jpg,
.tab-icon.format-png { color: #10b981; }

.tab-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.tab.active .tab-title {
  font-weight: 600;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.scroll-btn {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: linear-gradient(to right, transparent, var(--bg-tertiary));
  color: var(--text-secondary);
  cursor: pointer;
  z-index: 10;
  transition: color 0.15s;
}

.scroll-btn:hover:not(:disabled) {
  color: var(--text-primary);
}

.scroll-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.scroll-left { left: 0; }
.scroll-right { right: 0; transform: rotate(180deg); }
</style>