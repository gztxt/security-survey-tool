<template>
  <div class="layer-manager-panel">
    <div class="panel-header">
      <h3>图层管理</h3>
      <button class="icon-btn" @click="refreshLayers" title="刷新">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <polyline points="23 20 23 14 17 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
    </div>

    <div class="panel-body">
      <div class="layer-toolbar">
        <button class="icon-btn" @click="addLayer" title="新建图层">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="icon-btn" @click="importLayers" title="导入图层">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>
        <button class="icon-btn danger" @click="deleteSelectedLayers" :disabled="selectedLayers.length === 0" title="删除选中图层">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <div class="toolbar-spacer"></div>
        <label class="layer-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" v-model="searchQuery" placeholder="搜索图层..." />
        </label>
      </div>

      <div class="layer-list" ref="listRef">
        <div
          v-for="layer in filteredLayers"
          :key="layer.name"
          class="layer-item"
          :class="{
            'layer-selected': isSelected(layer.name),
            'layer-locked': layer.locked,
            'layer-hidden': !layer.visible,
            'layer-current': layer.name === currentLayer,
          }"
          @click="toggleLayerSelection(layer.name, $event)"
          @dblclick="setCurrentLayer(layer.name)"
          @contextmenu.prevent="showLayerContextMenu(layer, $event)"
          draggable="true"
          @dragstart="onDragStart(layer, $event)"
          @dragover.prevent="onDragOver($event)"
          @drop="onDrop(layer, $event)"
          @dragend="onDragEnd"
        >
          <!-- 可见性 -->
          <button
            class="layer-visibility"
            @click.stop="toggleVisibility(layer.name)"
            :title="layer.visible ? '隐藏图层' : '显示图层'"
            :aria-label="layer.visible ? '隐藏' : '显示'"
          >
            <svg v-if="layer.visible" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>

          <!-- 锁定 -->
          <button
            class="layer-lock"
            @click.stop="toggleLock(layer.name)"
            :title="layer.locked ? '解锁图层' : '锁定图层'"
            :aria-label="layer.locked ? '解锁' : '锁定'"
          >
            <svg v-if="layer.locked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
          </button>

          <!-- 颜色指示 -->
          <div class="layer-color" :style="{ backgroundColor: getLayerColor(layer) }" :title="`颜色: ${layer.color}`"></div>

          <!-- 名称 -->
          <div class="layer-name-container">
            <span class="layer-name" v-if="!editingLayerName">{{ layer.name }}</span>
            <input
              v-else
              class="layer-name-input"
              ref="nameInputRef"
              :value="editingLayerName"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.esc="cancelRename"
            />
          </div>

          <!-- 统计信息 -->
          <span class="layer-stats" v-if="layer.entityCount !== undefined">
            {{ layer.entityCount }} 图元
          </span>

          <!-- 当前图层标记 -->
          <span class="current-badge" v-if="layer.name === currentLayer" title="当前图层">●</span>

          <!-- 操作菜单 -->
          <button class="layer-menu" @click.stop="showLayerContextMenu(layer, $event)" title="更多操作">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>

        <div v-if="filteredLayers.length === 0" class="empty-state">
          <p>暂无图层</p>
          <button class="btn btn-sm btn-primary" @click="addLayer">创建第一个图层</button>
        </div>
      </div>

      <!-- 图层详情 -->
      <div class="layer-details" v-if="selectedLayers.length === 1">
        <div class="detail-section">
          <h4>图层属性</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>名称</label>
              <span>{{ selectedLayer.name }}</span>
            </div>
            <div class="detail-item">
              <label>颜色</label>
              <div class="color-picker-row">
                <input type="color" v-model="selectedLayer.color" @change="updateLayerColor" />
                <span class="color-hex">{{ selectedLayer.color }}</span>
              </div>
            </div>
            <div class="detail-item">
              <label>线型</label>
              <select v-model="selectedLayer.lineType" @change="updateLayerLineType" class="detail-select">
                <option value="BYLAYER">按图层</option>
                <option value="CONTINUOUS">实线</option>
                <option value="DASHED">虚线</option>
                <option value="DOTTED">点线</option>
                <option value="DASH_DOT">点划线</option>
                <option value="DASH_DOT_DOT">双点划线</option>
              </select>
            </div>
            <div class="detail-item">
              <label>线宽</label>
              <select v-model="selectedLayer.lineWeight" @change="updateLayerLineWeight" class="detail-select">
                <option value="-1">默认</option>
                <option value="0">0.00mm</option>
                <option value="15">0.15mm</option>
                <option value="25">0.25mm</option>
                <option value="35">0.35mm</option>
                <option value="50">0.50mm</option>
                <option value="70">0.70mm</option>
                <option value="100">1.00mm</option>
              </select>
            </div>
            <div class="detail-item">
              <label>打印</label>
              <input type="checkbox" :checked="selectedLayer.plottable" @change="updateLayerPlottable" />
            </div>
            <div class="detail-item">
              <label>冻结</label>
              <input type="checkbox" :checked="selectedLayer.frozen" @change="updateLayerFrozen" />
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>统计信息</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>图元数量</label>
              <span>{{ selectedLayer.entityCount || 0 }}</span>
            </div>
            <div class="detail-item">
              <label>可见</label>
              <span>{{ selectedLayer.visible ? '是' : '否' }}</span>
            </div>
            <div class="detail-item">
              <label>锁定</label>
              <span>{{ selectedLayer.locked ? '是' : '否' }}</span>
            </div>
            <div class="detail-item">
              <label>打印</label>
              <span>{{ selectedLayer.plottable !== false ? '是' : '否' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="selectedLayers.length > 1" class="layer-details">
        <p class="multi-selected">{{ selectedLayers.length }} 个图层已选中</p>
        <div class="batch-actions">
          <button class="btn btn-sm btn-secondary" @click="batchToggleVisibility(true)">全部显示</button>
          <button class="btn btn-sm btn-secondary" @click="batchToggleVisibility(false)">全部隐藏</button>
          <button class="btn btn-sm btn-secondary" @click="batchToggleLock(true)">全部锁定</button>
          <button class="btn btn-sm btn-secondary" @click="batchToggleLock(false)">全部解锁</button>
        </div>
      </div>

      <div v-else class="layer-details-empty">
        <p>请选择图层查看详情</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      v-model:visible="contextMenu.visible"
      :position="contextMenu.position"
      :items="contextMenu.items"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';
import ContextMenu from '@/components/common/ContextMenu.vue';

const projectStore = useProjectStore();

const props = defineProps<{
  width?: number;
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  'layer-changed': [layerName: string];
}>();

// 状态
const searchQuery = ref('');
const selectedLayers = ref<string[]>([]);
const editingLayerName = ref<string | null>(null);
const editingLayerValue = ref('');
const nameInputRef = ref<HTMLInputElement>();
const listRef = ref<HTMLDivElement>();
const draggedLayer = ref<string | null>(null);
const contextMenu = ref({ visible: false, position: { x: 0, y: 0 }, items: [] as any[] });

// 计算属性
const layers = computed(() => projectStore.currentDrawing?.layers || []);
const currentLayer = computed(() => projectStore.currentDrawing?.currentLayer || '0');

const filteredLayers = computed(() => {
  if (!searchQuery.value) return layers.value;
  const q = searchQuery.value.toLowerCase();
  return layers.value.filter(l => l.name.toLowerCase().includes(q));
});

const selectedLayer = computed(() => {
  if (selectedLayers.value.length !== 1) return null;
  return layers.value.find(l => l.name === selectedLayers.value[0]) || null;
});

// 方法
function isSelected(name: string) {
  return selectedLayers.value.includes(name);
}

function toggleLayerSelection(name: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    if (isSelected(name)) {
      selectedLayers.value = selectedLayers.value.filter(n => n !== name);
    } else {
      selectedLayers.value = [...selectedLayers.value, name];
    }
  } else if (event.shiftKey && selectedLayers.value.length > 0) {
    // Shift 多选范围
    const allNames = layers.value.map(l => l.name);
    const startIdx = allNames.indexOf(selectedLayers.value[0]);
    const endIdx = allNames.indexOf(name);
    if (startIdx !== -1 && endIdx !== -1) {
      const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
      selectedLayers.value = allNames.slice(min, max + 1);
    }
  } else {
    selectedLayers.value = [name];
  }
}

function setCurrentLayer(name: string) {
  if (projectStore.currentDrawing) {
    projectStore.currentDrawing.currentLayer = name;
    projectStore.markDirty();
    emit('layer-changed', name);
  }
}

function toggleVisibility(name: string) {
  const layer = layers.value.find(l => l.name === name);
  if (layer) {
    layer.visible = !layer.visible;
    projectStore.markDirty();
  }
}

function toggleLock(name: string) {
  const layer = layers.value.find(l => l.name === name);
  if (layer) {
    layer.locked = !layer.locked;
    projectStore.markDirty();
  }
}

function getLayerColor(layer: any) {
  return layer.color || '#999999';
}

function addLayer() {
  const newName = generateUniqueLayerName('Layer');
  const newLayer = {
    name: newName,
    color: generateRandomColor(),
    visible: true,
    locked: false,
    lineType: 'BYLAYER',
    lineWeight: -1,
    plottable: true,
    frozen: false,
    entityCount: 0,
  };
  projectStore.currentDrawing?.layers.push(newLayer as any);
  projectStore.markDirty();
  selectedLayers.value = [newName];
  nextTick(() => {
    const el = listRef.value?.querySelector(`.layer-item[data-name="${newName}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function generateUniqueLayerName(base: string): string {
  const existing = new Set(layers.value.map(l => l.name));
  let name = base;
  let i = 1;
  while (existing.has(name)) {
    name = `${base}${i}`;
    i++;
  }
  return name;
}

function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

function startRename(layer: any) {
  editingLayerName.value = layer.name;
  editingLayerValue.value = layer.name;
  nextTick(() => nameInputRef.value?.focus());
}

function finishRename() {
  if (editingLayerName.value && editingLayerValue.value.trim()) {
    const oldName = editingLayerName.value;
    const newName = editingLayerValue.value.trim();
    if (newName !== oldName && !layers.value.some(l => l.name === newName)) {
      const layer = layers.value.find(l => l.name === oldName);
      if (layer) {
        layer.name = newName;
        // 更新引用该图层的实体
        // projectStore.updateEntityLayers(oldName, newName);
        projectStore.markDirty();
      }
    }
  }
  editingLayerName.value = null;
  editingLayerValue.value = '';
}

function cancelRename() {
  editingLayerName.value = null;
  editingLayerValue.value = '';
}

function updateLayerColor() {
  if (selectedLayer.value) {
    projectStore.markDirty();
  }
}

function updateLayerLineType() {
  if (selectedLayer.value) projectStore.markDirty();
}

function updateLayerLineWeight() {
  if (selectedLayer.value) projectStore.markDirty();
}

function updateLayerPlottable(event: Event) {
  if (selectedLayer.value) {
    selectedLayer.value.plottable = (event.target as HTMLInputElement).checked;
    projectStore.markDirty();
  }
}

function updateLayerFrozen(event: Event) {
  if (selectedLayer.value) {
    selectedLayer.value.frozen = (event.target as HTMLInputElement).checked;
    projectStore.markDirty();
  }
}

function refreshLayers() {
  // 重新统计实体数量
  if (projectStore.currentDrawing) {
    const entities = projectStore.currentDrawing.entities || [];
    for (const layer of projectStore.currentDrawing.layers) {
      layer.entityCount = entities.filter((e: any) => e.layer === layer.name).length;
    }
    projectStore.markDirty();
  }
}

function importLayers() {
  // 打开文件选择对话框
}

function deleteSelectedLayers() {
  if (selectedLayers.value.length === 0) return;
  if (!confirm(`确定删除选中的 ${selectedLayers.value.length} 个图层吗？`)) return;

  // 不能删除图层 0
  const toDelete = selectedLayers.value.filter(n => n !== '0');
  for (const name of toDelete) {
    const idx = layers.value.findIndex(l => l.name === name);
    if (idx >= 0) layers.value.splice(idx, 1);
  }
  selectedLayers.value = [];
  projectStore.markDirty();
}

function showLayerContextMenu(layer: any, event: MouseEvent) {
  event.preventDefault();
  const items = [
    { label: '重命名', action: 'rename', data: layer },
    { label: layer.visible ? '隐藏' : '显示', action: 'toggle-visibility', data: layer },
    { label: layer.locked ? '解锁' : '锁定', action: 'toggle-lock', data: layer },
    { label: '设为当前', action: 'set-current', data: layer },
    { type: 'separator' },
    { label: '复制图层', action: 'duplicate', data: layer },
    { label: '合并到当前', action: 'merge-to-current', data: layer },
    { type: 'separator' },
    { label: '删除', action: 'delete', data: layer, danger: true, disabled: layer.name === '0' },
  ];

  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    items,
  };
}

function onContextMenuSelect(action: string, data: any) {
  contextMenu.value.visible = false;
  switch (action) {
    case 'rename':
      startRename(data);
      break;
    case 'toggle-visibility':
      toggleVisibility(data.name);
      break;
    case 'toggle-lock':
      toggleLock(data.name);
      break;
    case 'set-current':
      setCurrentLayer(data.name);
      break;
    case 'duplicate':
      duplicateLayer(data);
      break;
    case 'merge-to-current':
      mergeToCurrent(data);
      break;
    case 'delete':
      deleteLayer(data.name);
      break;
  }
}

function duplicateLayer(layer: any) {
  const newLayer = {
    ...layer,
    name: generateUniqueLayerName(`${layer.name}_copy`),
    entityCount: 0,
  };
  layers.value.push(newLayer);
  projectStore.markDirty();
}

function mergeToCurrent(layer: any) {
  // 将图层实体移动到当前图层
  const current = currentLayer.value;
  if (current === layer.name) return;
  // projectStore.moveEntitiesToLayer(layer.name, current);
  const drawing: any = projectStore.currentDrawing;
  if (drawing) {
    drawing.layers = drawing.layers.filter((l: any) => l.name !== layer.name);
  }
  projectStore.markDirty();
}

function deleteLayer(name: string) {
  if (name === '0') return;
  const drawing: any = projectStore.currentDrawing;
  if (drawing) {
    drawing.layers = drawing.layers.filter((l: any) => l.name !== name);
  }
  selectedLayers.value = selectedLayers.value.filter(n => n !== name);
  projectStore.markDirty();
}

function batchToggleVisibility(visible: boolean) {
  for (const name of selectedLayers.value) {
    const layer = layers.value.find(l => l.name === name);
    if (layer) layer.visible = visible;
  }
  projectStore.markDirty();
}

function batchToggleLock(locked: boolean) {
  for (const name of selectedLayers.value) {
    const layer = layers.value.find(l => l.name === name);
    if (layer) layer.locked = locked;
  }
  projectStore.markDirty();
}

// 拖拽排序
function onDragStart(layer: any, event: DragEvent) {
  draggedLayer.value = layer.name;
  event.dataTransfer!.effectAllowed = 'move';
  // 添加拖拽样式
  const target = event.target as HTMLElement;
  target.classList.add('dragging');
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'move';
}

function onDrop(targetLayer: any, event: DragEvent) {
  event.preventDefault();
  if (!draggedLayer.value || draggedLayer.value === targetLayer.name) return;

  const allLayers = layers.value;
  const fromIdx = allLayers.findIndex(l => l.name === draggedLayer.value);
  const toIdx = allLayers.findIndex(l => l.name === targetLayer.name);

  if (fromIdx !== -1 && toIdx !== -1) {
    const [removed] = allLayers.splice(fromIdx, 1);
    allLayers.splice(toIdx, 0, removed);
    projectStore.markDirty();
  }
  draggedLayer.value = null;
}

function onDragEnd(event: DragEvent) {
  const target = event.target as HTMLElement;
  target.classList.remove('dragging');
  draggedLayer.value = null;
}
</script>

<style scoped>
.layer-manager-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover:not(:disabled) {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.layer-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.toolbar-spacer { flex: 1; }

.layer-search {
  position: relative;
  flex: 1;
  min-width: 150px;
}

.layer-search svg {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.layer-search input {
  width: 100%;
  padding: 6px 8px 6px 28px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
}

.layer-search input:focus {
  outline: none;
  border-color: #3b82f6;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  min-height: 0;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
}

.layer-item:hover {
  background: var(--bg-tertiary);
}

.layer-item.layer-selected {
  background: rgba(59, 130, 246, 0.1);
}

.layer-item.layer-locked .layer-name {
  opacity: 0.6;
}

.layer-item.layer-hidden .layer-name {
  text-decoration: line-through;
  opacity: 0.5;
}

.layer-item.layer-current {
  background: rgba(59, 130, 246, 0.08);
}

.layer-item.dragging {
  opacity: 0.5;
  background: var(--accent-color);
}

.layer-visibility,
.layer-lock {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.layer-visibility:hover,
.layer-lock:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.layer-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.layer-name-container {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.layer-name {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-name-input {
  width: 100%;
  padding: 2px 6px;
  border: 1px solid #3b82f6;
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.layer-stats {
  font-size: 10px;
  color: var(--text-tertiary);
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  white-space: nowrap;
}

.current-badge {
  color: #3b82f6;
  font-size: 10px;
  margin-left: 4px;
}

.layer-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.layer-item:hover .layer-menu,
.layer-item.layer-selected .layer-menu {
  opacity: 1;
}

.layer-menu:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 12px;
}

.empty-state p { margin: 0; font-size: 13px; }
.empty-state .btn { padding: 6px 16px; }

/* 详情面板 */
.layer-details {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  max-height: 40vh;
  overflow-y: auto;
}

.layer-details-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
  color: var(--text-tertiary);
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h4 {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-item label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.detail-item span {
  font-size: 12px;
  color: var(--text-primary);
}

.detail-select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker-row input[type="color"] {
  width: 32px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.color-hex {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.multi-selected {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>