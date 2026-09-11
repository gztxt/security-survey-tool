<template>
  <div class="project-tree-panel">
    <div class="panel-header">
      <h3>项目结构</h3>
      <button class="icon-btn" @click="addDrawing" title="添加图纸">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
      </button>
    </div>

    <div class="panel-body">
      <!-- 项目信息 -->
      <div class="project-info-card">
        <div class="project-name">{{ project?.name || '未命名项目' }}</div>
        <div class="project-stats">
          <span>{{ drawings.length }} 图纸</span>
          <span>{{ totalDevices }} 设备</span>
          <span>{{ totalCables }} 线缆</span>
        </div>
      </div>

      <!-- 图纸树 -->
      <div class="tree-container">
        <div class="tree-header">
          <span>图纸列表</span>
          <span class="tree-count">{{ drawings.length }}</span>
        </div>

        <div class="tree-body">
          <div
            v-for="drawing in drawings"
            :key="drawing.id"
            class="tree-node drawing-node"
            :class="{ active: drawing.id === projectStore.currentDrawingId }"
            @click="selectDrawing(drawing.id)"
          >
            <!-- 折叠按钮 -->
            <button
              class="node-toggle"
              @click.stop="toggleExpand(drawing.id)"
              :class="{ expanded: expandedNodes.has(drawing.id) }"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

            <!-- 图标 -->
            <div class="node-icon" :class="getDrawingIconClass(drawing)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>

            <!-- 名称 -->
            <span class="node-name">{{ drawing.name || '未命名图纸' }}</span>

            <!-- 状态标记 -->
            <div class="node-badges">
              <span v-if="!drawing.calibration?.isCalibrated" class="badge warning" title="未校准">!</span>
              <span v-else class="badge success" title="已校准">✓</span>
              <span v-if="drawing.devices?.length === 0" class="badge muted" title="暂无设备">○</span>
              <span v-else class="badge info" :title="`${drawing.devices.length} 设备`">{{ drawing.devices.length }}</span>
            </div>

            <!-- 操作 -->
            <button class="node-action" @click.stop="showDrawingMenu(drawing, $event)" title="更多">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>

            <!-- 子节点 -->
            <div class="node-children" v-show="expandedNodes.has(drawing.id)">
              <!-- 设备组 -->
              <div
                v-if="drawing.devices?.length > 0"
                class="tree-node group-node"
                @click.stop="toggleExpand(`devices-${drawing.id}`)"
              >
                <button
                  class="node-toggle"
                  :class="{ expanded: expandedNodes.has(`devices-${drawing.id}`) }"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
                <div class="node-icon group-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"></rect>
                    <path d="M8 21h8M12 17v4"></path>
                  </svg>
                </div>
                <span class="node-name">设备 ({{ drawing.devices.length }})</span>

                <div class="node-children" v-show="expandedNodes.has(`devices-${drawing.id}`)">
                  <div
                    v-for="device in drawing.devices"
                    :key="device.id"
                    class="tree-node device-node"
                    @click.stop="selectDevice(device.id)"
                  >
                    <div class="node-icon device-icon" :class="getDeviceIconClass(device)">
                      <DeviceIcon :device="getDeviceModel(device.modelId)" :size="20" />
                    </div>
                    <span class="node-name">{{ device.label }}</span>
                    <span class="device-coord mono">{{ formatCoord(device.position) }}</span>
                  </div>
                </div>
              </div>

              <!-- 线缆组 -->
              <div
                v-if="drawing.wiring?.cables?.length > 0"
                class="tree-node group-node"
                @click.stop="toggleExpand(`cables-${drawing.id}`)"
              >
                <button
                  class="node-toggle"
                  :class="{ expanded: expandedNodes.has(`cables-${drawing.id}`) }"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
                <div class="node-icon group-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 12h16M12 4v16"></path>
                  </svg>
                </div>
                <span class="node-name">线缆 ({{ drawing.wiring.cables.length }})</span>

                <div class="node-children" v-show="expandedNodes.has(`cables-${drawing.id}`)">
                  <div
                    v-for="cable in drawing.wiring.cables"
                    :key="cable.id"
                    class="tree-node cable-node"
                    @click.stop="selectCable(cable.id)"
                  >
                    <div class="node-icon cable-color-bar" :style="{ backgroundColor: cable.color }"></div>
                    <span class="node-name">{{ cable.type.toUpperCase() }}</span>
                    <span class="cable-length mono">{{ cable.length.toFixed(0) }}mm</span>
                    <span class="cable-status" :class="cable.status">{{ getStatusLabel(cable.status) }}</span>
                  </div>
                </div>
              </div>

              <!-- 弱电井组 -->
              <div
                v-if="drawing.wiring?.weakPoints?.length > 0"
                class="tree-node group-node"
                @click.stop="toggleExpand(`wells-${drawing.id}`)"
              >
                <button
                  class="node-toggle"
                  :class="{ expanded: expandedNodes.has(`wells-${drawing.id}`) }"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
                <div class="node-icon group-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v20M17 5H7a2 2 0 0 1-2 2v10a2 2 0 0 1 2 2h10"></path>
                  </svg>
                </div>
                <span class="node-name">弱电井 ({{ drawing.wiring.weakPoints.length }})</span>

                <div class="node-children" v-show="expandedNodes.has(`wells-${drawing.id}`)">
                  <div
                    v-for="well in drawing.wiring.weakPoints"
                    :key="well.id"
                    class="tree-node well-node"
                    @click.stop="selectWell(well.id)"
                  >
                    <div class="node-icon well-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M17 5H7a2 2 0 0 1-2 2v10a2 2 0 0 1 2 2h10"></path>
                      </svg>
                    </div>
                    <span class="node-name">{{ well.name }}</span>
                    <span class="well-device-count">{{ well.devices?.length || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="drawings.length === 0" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p>暂无图纸</p>
            <button class="btn btn-sm btn-primary" @click="addDrawing">添加图纸</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 图纸右键菜单 -->
    <ContextMenu
      v-model:visible="drawingMenu.visible"
      :position="drawingMenu.position"
      :items="drawingMenu.items"
      @select="onDrawingMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import { useRouter } from 'vue-router';
import DeviceIcon from '@/components/device/DeviceIcon.vue';
import ContextMenu from '@/components/common/ContextMenu.vue';

const projectStore = useProjectStore();
const deviceLibraryStore = useDeviceLibraryStore();
const router = useRouter();

const props = defineProps<{
  width?: number;
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  'drawing-selected': [drawingId: string];
  'device-selected': [deviceId: string];
  'cable-selected': [cableId: string];
  'well-selected': [wellId: string];
}>();

// 状态
const expandedNodes = ref(new Set<string>());
const drawingMenu = ref({ visible: false, position: { x: 0, y: 0 }, items: [] as any[], data: null as any });

// 计算属性
const project = computed(() => projectStore.currentProject);
const drawings = computed(() => projectStore.drawings);

const totalDevices = computed(() => {
  return drawings.value.reduce((sum, d) => sum + (d.devices?.length || 0), 0);
});

const totalCables = computed(() => {
  return drawings.value.reduce((sum, d) => sum + (d.wiring?.cables?.length || 0), 0);
});

// 方法
function toggleExpand(id: string) {
  if (expandedNodes.value.has(id)) {
    expandedNodes.value.delete(id);
  } else {
    expandedNodes.value.add(id);
  }
}

function selectDrawing(drawingId: string) {
  projectStore.setCurrentDrawing(drawingId);
  // 自动展开
  expandedNodes.value.add(drawingId);
  emit('drawing-selected', drawingId);
}

function selectDevice(deviceId: string) {
  emit('device-selected', deviceId);
  // 同时选中图纸
  const drawing = drawings.value.find(d => d.devices?.some(dev => dev.id === deviceId));
  if (drawing) selectDrawing(drawing.id);
}

function selectCable(cableId: string) {
  emit('cable-selected', cableId);
}

function selectWell(wellId: string) {
  emit('well-selected', wellId);
}

function addDrawing() {
  router.push({ name: 'import' });
}

function showDrawingMenu(drawing: any, event: MouseEvent) {
  event.preventDefault();
  const items = [
    { label: '打开', action: 'open', data: drawing },
    { label: '重命名', action: 'rename', data: drawing },
    { label: '导出图纸', action: 'export', data: drawing },
    { type: 'separator' },
    { label: '校准比例尺', action: 'calibrate', data: drawing },
    { label: '图层管理', action: 'layers', data: drawing },
    { type: 'separator' },
    { label: '删除', action: 'delete', data: drawing, danger: true },
  ];

  drawingMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    items,
    data: drawing,
  };
}

function onDrawingMenuSelect(action: string, data: any) {
  drawingMenu.value.visible = false;
  switch (action) {
    case 'open':
      selectDrawing(data.id);
      break;
    case 'rename':
      // 触发重命名
      break;
    case 'export':
      router.push({ name: 'export', params: { drawingId: data.id } });
      break;
    case 'calibrate':
      // 触发校准
      break;
    case 'layers':
      // 打开图层面板
      break;
    case 'delete':
      if (confirm(`确定删除图纸 "${data.name}" 吗？`)) {
        projectStore.removeDrawing(data.id);
      }
      break;
  }
}

function getDrawingIconClass(drawing: any) {
  const ext = drawing.file?.format || 'dxf';
  return `format-${ext}`;
}

function getDeviceIconClass(device: any) {
  const model = getDeviceModel(device.modelId);
  return model ? `device-${model.category}` : 'device-unknown';
}

function getDeviceModel(modelId: string) {
  return deviceLibraryStore.allDevices.find(d => d.id === modelId) || null;
}

function formatCoord(pos: any) {
  if (!pos) return '';
  return `(${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    auto: '自动',
    manual: '手动',
    modified: '修改',
  };
  return labels[status] || status;
}
</script>

<style scoped>
.project-tree-panel {
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

.icon-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 项目信息卡 */
.project-info-card {
  margin: 12px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.project-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.project-stats {
  display: flex;
  gap: 12px;
}

.project-stats span {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg-primary);
  border-radius: 10px;
  color: var(--text-secondary);
}

/* 树容器 */
.tree-container {
  flex: 1;
  min-height: 0;
  padding: 0 8px 12px;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
}

.tree-count {
  background: var(--bg-tertiary);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.tree-body {
  margin-top: 8px;
}

/* 树节点通用样式 */
.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
}

.tree-node:hover {
  background: var(--bg-tertiary);
}

.tree-node.active {
  background: rgba(59, 130, 246, 0.12);
}

.node-toggle {
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
  transition: all 0.15s;
  flex-shrink: 0;
}

.node-toggle svg {
  transition: transform 0.15s;
}

.node-toggle.expanded svg {
  transform: rotate(90deg);
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.node-icon.format-dwg { color: #ef4444; }
.node-icon.format-dxf { color: #3b82f6; }
.node-icon.format-pdf { color: #f59e0b; }
.node-icon.format-jpg,
.node-icon.format-png { color: #10b981; }

.group-icon {
  color: var(--text-tertiary);
}

.device-icon {
  width: 24px;
  height: 24px;
}

.device-camera { color: #3b82f6; }
.device-nvr { color: #8b5cf6; }
.device-switch { color: #10b981; }
.device-sensor { color: #f59e0b; }
.device-unknown { color: #6b7280; }

.node-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-coord,
.cable-length {
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: monospace;
}

.node-badges {
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 600;
}

.badge.warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.badge.success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.badge.info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.badge.muted { background: var(--bg-tertiary); color: var(--text-tertiary); }

.node-action {
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

.tree-node:hover .node-action {
  opacity: 1;
}

.node-action:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.node-children {
  margin-left: 14px;
  border-left: 1px solid var(--border-color);
  padding-left: 8px;
}

/* 线缆节点 */
.cable-color-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.cable-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  text-transform: uppercase;
}

.cable-status.auto { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.cable-status.manual { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.cable-status.modified { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

/* 弱电井节点 */
.well-icon {
  color: #ef4444;
}

.well-device-count {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 10px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 12px;
}

.empty-state p { margin: 0; font-size: 13px; }
.empty-state svg { opacity: 0.3; }
.empty-state .btn { padding: 6px 16px; }

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

@media (max-width: 640px) {
  .project-info-card {
    padding: 12px;
  }
  .project-name { font-size: 14px; }
  .tree-node { padding: 8px 6px; }
  .node-children { margin-left: 8px; padding-left: 6px; }
}
</style>