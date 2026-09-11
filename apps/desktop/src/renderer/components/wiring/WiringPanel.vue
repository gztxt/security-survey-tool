<template>
  <div class="wiring-panel">
    <div class="panel-header">
      <h3>布线管理</h3>
      <button class="icon-btn" @click="autoWireAll" :disabled="!canAutoWire" title="全自动布线">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </button>
    </div>

    <div class="panel-body">
      <!-- 弱电井管理 -->
      <div class="panel-section">
        <div class="section-header">
          <h4>弱电井 ({{ wells.length }})</h4>
          <button class="btn btn-sm btn-primary" @click="addWell">添加弱电井</button>
        </div>

        <div class="well-list">
          <div
            v-for="well in wells"
            :key="well.id"
            class="well-item"
            :class="{ selected: selectedWellId === well.id }"
            @click="selectWell(well.id)"
          >
            <div class="well-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H7a2 2 0 0 1-2 2v10a2 2 0 0 1 2 2h10"/>
              </svg>
            </div>
            <div class="well-info">
              <span class="well-name">{{ well.name }}</span>
              <span class="well-type">{{ getWellTypeLabel(well.type) }}</span>
            </div>
            <div class="well-device-count">{{ well.devices?.length || 0 }} 设备</div>
            <button class="icon-btn danger" @click.stop="removeWell(well.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div v-if="wells.length === 0" class="empty-state">
            <p>暂无弱电井</p>
            <button class="btn btn-sm btn-primary" @click="addWell">添加第一个弱电井</button>
          </div>
        </div>
      </div>

      <!-- 桥架管理 -->
      <div class="panel-section">
        <div class="section-header">
          <h4>桥架 ({{ trays.length }})</h4>
          <button class="btn btn-sm btn-primary" @click="startTrayDrawing">绘制桥架</button>
        </div>

        <div class="tray-list">
          <div
            v-for="tray in trays"
            :key="tray.id"
            class="tray-item"
            :class="{ selected: selectedTrayId === tray.id }"
            @click="selectTray(tray.id)"
          >
            <div class="tray-icon" :style="{ borderColor: getTrayColor(tray.type) }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12h16M4 8h16M4 16h16"/>
              </svg>
            </div>
            <div class="tray-info">
              <span class="tray-type">{{ getTrayTypeLabel(tray.type) }}</span>
              <span class="tray-specs">{{ tray.width }}×{{ tray.height }}mm × {{ tray.layers }}层</span>
            </div>
            <div class="tray-length">{{ (tray.length || 0).toFixed(0) }}mm</div>
            <button class="icon-btn danger" @click.stop="removeTray(tray.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div v-if="trays.length === 0" class="empty-state">
            <p>暂无桥架</p>
            <button class="btn btn-sm btn-primary" @click="startTrayDrawing">绘制第一个桥架</button>
          </div>
        </div>
      </div>

      <!-- 线缆管理 -->
      <div class="panel-section">
        <div class="section-header">
          <h4>线缆 ({{ cables.length }})</h4>
          <div class="cable-filters">
            <select class="filter-select" v-model="cableTypeFilter">
              <option value="">全部类型</option>
              <option value="cat6">CAT6</option>
              <option value="cat6a">CAT6A</option>
              <option value="fiber-sm">单模光纤</option>
              <option value="fiber-mm">多模光纤</option>
              <option value="coaxial">同轴</option>
              <option value="power">电源线</option>
            </select>
            <select class="filter-select" v-model="cableStatusFilter">
              <option value="">全部状态</option>
              <option value="auto">自动生成</option>
              <option value="manual">手动布线</option>
              <option value="modified">已修改</option>
            </select>
          </div>
        </div>

        <div class="cable-list">
          <div
            v-for="cable in filteredCables"
            :key="cable.id"
            class="cable-item"
            :class="{ selected: selectedCableId === cable.id }"
            @click="selectCable(cable.id)"
          >
            <div class="cable-color" :style="{ backgroundColor: cable.color }"></div>
            <div class="cable-info">
              <div class="cable-header">
                <span class="cable-type">{{ cable.type.toUpperCase() }}</span>
                <span class="cable-status" :class="cable.status">{{ getStatusLabel(cable.status) }}</span>
              </div>
              <div class="cable-path">
                <span class="cable-from">{{ getDeviceLabel(cable.startDeviceId) }}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                <span class="cable-to">{{ getDeviceLabel(cable.endDeviceId) }}</span>
              </div>
            </div>
            <div class="cable-length">
              {{ cable.length.toFixed(0) }}mm
              <span v-if="cable.correctedLength" class="corrected"> ({{ cable.correctedLength.toFixed(0) }})</span>
            </div>
            <button class="icon-btn danger" @click.stop="removeCable(cable.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div v-if="filteredCables.length === 0" class="empty-state">
            <p v-if="cables.length === 0">暂无线缆</p>
            <p v-else>无匹配的线缆</p>
          </div>
        </div>
      </div>

      <!-- 拓扑视图 -->
      <div class="panel-section">
        <div class="section-header">
          <h4>拓扑结构</h4>
          <button class="btn btn-sm btn-secondary" @click="generateTopology">生成拓扑</button>
        </div>

        <div class="topology-preview" v-if="topology.length > 0">
          <div class="topology-tree">
            <TopologyNode
              v-for="node in topologyRoots"
              :key="node.id"
              :node="node"
              :all-nodes="topology"
              :level="0"
              @click="selectTopologyNode"
            />
          </div>
        </div>

        <div v-else class="empty-state">
          <p>暂无拓扑数据</p>
          <button class="btn btn-sm btn-secondary" @click="generateTopology">点击生成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/project';
import { wiringEngine } from '@security-survey/wiring-engine';
import TopologyNode from './TopologyNode.vue';

const projectStore = useProjectStore();

const props = defineProps<{
  width?: number;
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  'well-selected': [wellId: string];
  'tray-selected': [trayId: string];
  'cable-selected': [cableId: string];
}>();

// 状态
const selectedWellId = ref<string | null>(null);
const selectedTrayId = ref<string | null>(null);
const selectedCableId = ref<string | null>(null);
const cableTypeFilter = ref('');
const cableStatusFilter = ref('');
const topology = ref<any[]>([]);

// 计算属性
const wells = computed(() => projectStore.projectWells);
const trays = computed(() => projectStore.projectTrays);
const cables = computed(() => projectStore.projectCables);
const devices = computed(() => projectStore.projectDevices);

const filteredCables = computed(() => {
  return cables.value.filter(c => {
    if (cableTypeFilter.value && c.type !== cableTypeFilter.value) return false;
    if (cableStatusFilter.value && c.status !== cableStatusFilter.value) return false;
    return true;
  });
});

const topologyRoots = computed(() => {
  return topology.value.filter(n => !topology.value.some(t => t.children?.includes(n.id)));
});

const canAutoWire = computed(() => {
  return devices.value.length > 1 && wells.value.length > 0;
});

/** 全自动布线：基于弱电井/设备/桥架调用布线引擎 */
function autoWireAll() {
  if (!canAutoWire.value) return;
  wiringEngine.setDevices(devices.value as any);
  wiringEngine.setWeakPoints(wells.value as any);
  wiringEngine.setCableTrays(trays.value as any);
  wiringEngine.setCables(cables.value as any);
  const result = wiringEngine.autoWire();
  for (const cable of result.cables) {
    projectStore.addCable(cable);
  }
  ElMessage.success(`自动布线完成，生成 ${result.cables.length} 根线缆`);
}

// 方法
function selectWell(wellId: string) {
  selectedWellId.value = wellId;
  emit('well-selected', wellId);
}

function selectTray(trayId: string) {
  selectedTrayId.value = trayId;
  emit('tray-selected', trayId);
}

function selectCable(cableId: string) {
  selectedCableId.value = cableId;
  emit('cable-selected', cableId);
}

function addWell() {
  const well = {
    id: `well-${Date.now()}`,
    position: { x: 0, y: 0 },
    name: `${wells.value.length + 1}#弱电井`,
    type: 'floor' as const,
    devices: [],
    notes: '',
  };
  projectStore.addWell(well);
  selectWell(well.id);
}

function removeWell(wellId: string) {
  if (confirm('确定删除该弱电井吗？')) {
    // projectStore.removeWell(wellId);
    if (selectedWellId.value === wellId) selectedWellId.value = null;
  }
}

function startTrayDrawing() {
  // 触发画布进入桥架绘制模式
}

function removeTray(trayId: string) {
  if (confirm('确定删除该桥架吗？')) {
    // projectStore.removeTray(trayId);
    if (selectedTrayId.value === trayId) selectedTrayId.value = null;
  }
}

function removeCable(cableId: string) {
  if (confirm('确定删除这条线缆吗？')) {
    projectStore.removeCable(cableId);
    if (selectedCableId.value === cableId) selectedCableId.value = null;
  }
}

function getWellTypeLabel(type: string) {
  const labels: Record<string, string> = {
    main: '总弱电间',
    floor: '楼层弱电井',
    roof: '屋顶弱电井',
    custom: '自定义',
  };
  return labels[type] || type;
}

function getTrayTypeLabel(type: string) {
  const labels: Record<string, string> = {
    ladder: '梯式桥架',
    trough: '槽式桥架',
    wire_mesh: '网格桥架',
  };
  return labels[type] || type;
}

function getTrayColor(type: string) {
  const colors: Record<string, string> = {
    ladder: '#3b82f6',
    trough: '#10b981',
    wire_mesh: '#f59e0b',
  };
  return colors[type] || '#64748b';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    auto: '自动',
    manual: '手动',
    modified: '修改',
  };
  return labels[status] || status;
}

function getDeviceLabel(deviceId: string) {
  if (!deviceId) return '未连接';
  const device = devices.value.find(d => d.id === deviceId);
  return device ? device.label : deviceId;
}

function generateTopology() {
  // 生成拓扑逻辑
  const nodes: any[] = [];

  // 添加弱电井节点
  for (const well of wells.value) {
    nodes.push({
      id: well.id,
      type: 'weak_point',
      refId: well.id,
      position: well.position,
      children: well.devices || [],
      metadata: { name: well.name, wellType: well.type },
    });
  }

  // 添加设备节点
  for (const device of devices.value) {
    nodes.push({
      id: device.id,
      type: 'device',
      refId: device.id,
      position: device.position,
      children: [],
      metadata: { label: device.label, modelId: device.modelId },
    });
  }

  // 添加 NVR/交换机作为汇聚节点
  const nvrs = devices.value.filter(d => d.modelId?.includes('nvr') || d.modelId?.includes('NVR'));
  const switches = devices.value.filter(d => d.modelId?.includes('switch') || d.modelId?.includes('Switch'));

  topology.value = nodes;
}

function selectTopologyNode(nodeId: string) {
  // 选中拓扑节点
  console.log('Select topology node:', nodeId);
}
</script>

<style scoped>
.wiring-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  overflow-y: auto;
  gap: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
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

.icon-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm { padding: 4px 10px; font-size: 11px; }

.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
.btn-secondary:hover { background: var(--border-color); }

/* 列表通用 */
.well-list, .tray-list, .cable-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.well-item, .tray-item, .cable-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.well-item:hover, .tray-item:hover, .cable-item:hover {
  background: var(--border-color);
}

.well-item.selected, .tray-item.selected, .cable-item.selected {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid #3b82f6;
}

.well-icon, .tray-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--bg-primary);
  flex-shrink: 0;
}

.tray-icon {
  border: 2px solid;
}

.well-info, .tray-info, .cable-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.well-name, .tray-type, .cable-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.well-type, .tray-specs, .cable-path {
  font-size: 11px;
  color: var(--text-tertiary);
}

.well-device-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 10px;
}

.cable-color {
  width: 4px;
  height: 100%;
  min-height: 36px;
  border-radius: 2px 0 0 2px;
  flex-shrink: 0;
}

.cable-header {
  flex-wrap: wrap;
}

.cable-type {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 4px;
}

.cable-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  text-transform: capitalize;
}

.cable-status.auto { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.cable-status.manual { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.cable-status.modified { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.cable-path {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.cable-from, .cable-to {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cable-length {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-secondary);
  white-space: nowrap;
}

.cable-length .corrected {
  color: #3b82f6;
  font-size: 11px;
}

.icon-btn.danger {
  color: var(--text-tertiary);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.cable-filters {
  display: flex;
  gap: 8px;
}

.filter-select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  cursor: pointer;
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
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.empty-state p { margin: 0; font-size: 13px; }
.empty-state .btn { padding: 6px 16px; }

/* 拓扑树 */
.topology-preview {
  flex: 1;
  min-height: 150px;
}

.topology-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px dashed var(--border-color);
}

@media (max-width: 768px) {
  .section-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  .cable-filters { width: 100%; }
  .filter-select { flex: 1; }
}
</style>