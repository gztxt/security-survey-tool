// 设备库面板组件
<template>
  <div class="device-library-panel">
    <div class="panel-header">
      <h3>设备库</h3>
      <div class="header-actions">
        <input
          type="text"
          class="search-input"
          placeholder="搜索设备..."
          v-model="searchQuery"
          @input="setSearchQuery"
        />
        <button class="icon-btn" @click="showImportDialog = true" title="导入设备库">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <button class="icon-btn" @click="showExportDialog = true" title="导出设备库">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="icon-btn" @click="showAddDeviceDialog = true" title="添加自定义设备">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="panel-body">
      <!-- 分类标签 -->
      <div class="category-tabs" role="tablist">
        <button
          v-for="cat in categories"
          :key="cat"
          class="category-tab"
          :class="{ active: selectedCategory === cat }"
          @click="selectCategory(cat)"
          role="tab"
          :aria-selected="selectedCategory === cat"
        >
          <span class="tab-icon">{{ getCategoryIcon(cat) }}</span>
          <span class="tab-label">{{ getCategoryLabel(cat) }}</span>
          <span class="tab-count" v-if="cat !== 'all'">{{ devicesByCategory.get(cat)?.length || 0 }}</span>
        </button>
      </div>

      <!-- 设备列表 -->
      <div class="device-list" ref="listRef">
        <div
          v-for="device in filteredDevices"
          :key="device.id"
          class="device-item"
          :class="{ selected: selectedDeviceId === device.id, builtin: !customDevices.includes(device) }"
          @click="selectDevice(device.id)"
          @dblclick="startPlacement(device.id)"
          draggable="true"
          @dragstart="onDragStart(device, $event)"
          @contextmenu.prevent="showContextMenu(device, $event)"
        >
          <div class="device-preview">
            <DeviceIcon :device="device" :size="40" />
          </div>
          <div class="device-info">
            <h4 class="device-name">{{ device.name }}</h4>
            <p class="device-model">{{ device.vendor }} · {{ device.type }}</p>
            <div class="device-specs">
              <span class="spec" title="水平视场角">{{ device.specs.horizontalFOV }}°</span>
              <span class="spec" title="最远识别距离">{{ device.specs.maxDistance }}m</span>
              <span class="spec" title="分辨率">{{ device.specs.resolution }}</span>
            </div>
          </div>
          <div class="device-price" v-if="device.price">
            ¥{{ device.price }}
          </div>
          <div class="device-actions" v-if="selectedDeviceId === device.id">
            <button class="icon-btn small" @click.stop="startPlacement(device.id)" title="开始布点">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </button>
            <button class="icon-btn small" @click.stop="editDevice(device)" title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn small danger" @click.stop="deleteDevice(device.id)" title="删除" v-if="customDevices.includes(device)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredDevices.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>未找到匹配的设备</p>
          <button class="btn btn-secondary" @click="clearSearch">清空搜索</button>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <Dialog v-model:visible="showImportDialog" title="导入设备库" width="500">
      <template #content>
        <div class="dialog-content">
          <p>选择 JSON 格式的设备库文件导入</p>
          <input type="file" accept=".json" ref="importFileRef" class="file-input" @change="onImportFile" />
          <button class="btn btn-primary" @click="importFileRef?.click()">选择文件</button>
          <p class="hint">支持导出的设备库 JSON 格式</p>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" @click="showImportDialog = false">取消</button>
      </template>
    </Dialog>

    <!-- 导出对话框 -->
    <Dialog v-model:visible="showExportDialog" title="导出设备库" width="500">
      <template #content>
        <div class="dialog-content">
          <p>导出当前自定义设备库为 JSON 文件</p>
          <button class="btn btn-primary" @click="exportLibrary">导出 JSON</button>
          <p class="hint">{{ customDevices.length }} 个自定义设备</p>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" @click="showExportDialog = false">关闭</button>
      </template>
    </Dialog>

    <!-- 添加/编辑设备对话框 -->
    <Dialog v-model:visible="showAddDeviceDialog" :title="editingDevice ? '编辑设备' : '添加自定义设备'" width="600">
      <template #content>
        <DeviceForm
          :device="editingDevice"
          :models="builtinModels"
          @save="saveDevice"
          @cancel="showAddDeviceDialog = false"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import { BUILTIN_DEVICES } from '@security-survey/device-lib';
import DeviceIcon from './DeviceIcon.vue';
import Dialog from '@/components/common/Dialog.vue';
import DeviceForm from './DeviceForm.vue';

const store = useDeviceLibraryStore();

const props = defineProps<{
  width?: number;
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  'device-selected': [deviceId: string];
  'placement-start': [deviceId: string];
}>();

const searchQuery = ref('');
const selectedCategory = ref<'all' | any>('all');
const showImportDialog = ref(false);
const showExportDialog = ref(false);
const showAddDeviceDialog = ref(false);
const editingDevice = ref<any>(null);
const listRef = ref<HTMLDivElement>();
const importFileRef = ref<HTMLInputElement>();

const customDevices = computed(() => store.customDevices);
const selectedDeviceId = computed(() => store.selectedDeviceId);
const builtinModels = computed(() => BUILTIN_DEVICES);
const allDevices = computed(() => [...BUILTIN_DEVICES, ...customDevices.value]);
const categories = computed(() => ['all', ...store.categories]);

const filteredDevices = computed(() => {
  let result = allDevices.value;

  if (selectedCategory.value !== 'all') {
    result = result.filter(d => d.category === selectedCategory.value);
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.vendor.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  return result;
});

const devicesByCategory = computed(() => {
  const map = new Map();
  for (const device of allDevices.value) {
    const list = map.get(device.category) || [];
    list.push(device);
    map.set(device.category, list);
  }
  return map;
});

function selectCategory(cat: any) {
  selectedCategory.value = cat;
}

function setSearchQuery(query: string | Event) {
  searchQuery.value = typeof query === 'string' ? query : (query.target as HTMLInputElement).value;
}

// 分类图标与中文标签
const categoryIconMap: Record<string, string> = {
  all: '📦', camera: '📷', access_control: '🚪', alarm: '🚨', intercom: '📞',
  patrol: '🚓', storage: '💾', network: '🌐', display: '🖥️', power: '🔌', sensor: '📡', other: '🔧',
};
const categoryLabelMap: Record<string, string> = {
  all: '全部', camera: '摄像机', access_control: '门禁', alarm: '报警', intercom: '对讲',
  patrol: '巡更', storage: '存储', network: '网络', display: '显示', power: '电源', sensor: '传感', other: '其他',
};
function getCategoryIcon(cat: string) {
  return categoryIconMap[cat] || '📦';
}
function getCategoryLabel(cat: string) {
  return categoryLabelMap[cat] || cat;
}

function selectDevice(deviceId: string) {
  store.selectDevice(deviceId);
  emit('device-selected', deviceId);
}

function startPlacement(deviceId: string) {
  store.startPlacement(deviceId);
  emit('placement-start', deviceId);
}

function onDragStart(device: any, event: DragEvent) {
  // 拖拽数据
  event.dataTransfer?.setData('application/device', JSON.stringify(device));
}

function showContextMenu(device: any, event: MouseEvent) {
  // 可实现右键菜单
}

function clearSearch() {
  searchQuery.value = '';
}

function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = store.importLibrary(e.target?.result as string);
    alert(`导入完成: 成功 ${result.success}, 失败 ${result.failed}`);
    if (result.failed > 0) console.warn('部分设备导入失败');
    showImportDialog.value = false;
    importFileRef.value!.value = '';
  };
  reader.readAsText(file);
}

function exportLibrary() {
  const json = store.exportLibrary();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `device-library-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showExportDialog.value = false;
}

function editDevice(device: any) {
  editingDevice.value = { ...device };
  showAddDeviceDialog.value = true;
}

function deleteDevice(deviceId: string) {
  if (confirm('确定删除该自定义设备吗？')) {
    store.removeCustomDevice(deviceId);
  }
}

function saveDevice(deviceData: any) {
  if (editingDevice.value) {
    store.updateCustomDevice(editingDevice.value.id, deviceData);
  } else {
    store.addCustomDevice(deviceData);
  }
  showAddDeviceDialog.value = false;
  editingDevice.value = null;
}

watch(() => store.searchQuery, (v) => { searchQuery.value = v; });
watch(searchQuery, (v) => { store.setSearchQuery(v); });
watch(() => store.selectedCategory, (v) => { selectedCategory.value = v; });
watch(selectedCategory, (v) => { store.selectCategory(v); });
</script>

<style scoped>
.device-library-panel {
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
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.search-input {
  width: 180px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.icon-btn.small {
  width: 28px;
  height: 28px;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.category-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  flex-shrink: 0;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}

.category-tab:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.category-tab.active {
  background: #3b82f6;
  color: white;
}

.tab-icon { font-size: 14px; }
.tab-count {
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}

.category-tab.active .tab-count {
  background: rgba(255,255,255,0.2);
}

.device-list {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.device-item:hover {
  background: var(--bg-tertiary);
}

.device-item.selected {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
}

.device-item.builtin {
  opacity: 1;
}

.device-preview {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border-radius: 6px;
  flex-shrink: 0;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-name {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-model {
  margin: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-specs {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.spec {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--bg-primary);
  border-radius: 4px;
  color: var(--text-tertiary);
}

.device-price {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  margin-right: 8px;
}

.device-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.device-item:hover .device-actions,
.device-item.selected .device-actions {
  opacity: 1;
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 12px;
}

.empty-state svg {
  opacity: 0.3;
}

.empty-state p { margin: 0; }

.dialog-content {
  padding: 16px 0;
  text-align: center;
}

.dialog-content p { margin-bottom: 16px; }

.file-input { display: none; }

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 12px !important;
}
</style>