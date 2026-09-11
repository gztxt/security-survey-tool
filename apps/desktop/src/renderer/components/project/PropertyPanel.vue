<template>
  <div class="property-panel">
    <!-- 设备属性 -->
    <div v-if="device" class="property-section">
      <h3 class="section-title">设备属性</h3>

      <div class="field-group">
        <label class="field-label">名称</label>
        <input
          class="field-input"
          v-model="device.label"
          @blur="updateDevice"
          placeholder="输入设备名称"
        />
      </div>

      <div class="field-group">
        <label class="field-label">型号</label>
        <select class="field-input" v-model="device.modelId" @change="updateDevice">
          <option v-for="model in compatibleModels" :key="model.id" :value="model.id">
            {{ model.name }} ({{ model.vendor }})
          </option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label">位置</label>
        <div class="coordinate-inputs">
          <div class="coord-input">
            <span class="coord-label">X</span>
            <input
              type="number"
              class="field-input"
              :value="device.position.x.toFixed(0)"
              @change="updatePosition('x', $event)"
              step="1"
            />
            <span class="coord-unit">mm</span>
          </div>
          <div class="coord-input">
            <span class="coord-label">Y</span>
            <input
              type="number"
              class="field-input"
              :value="device.position.y.toFixed(0)"
              @change="updatePosition('y', $event)"
              step="1"
            />
            <span class="coord-unit">mm</span>
          </div>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">旋转</label>
        <div class="rotation-control">
          <input
            type="range"
            class="rotation-slider"
            :min="0"
            :max="360"
            :step="15"
            v-model.number="device.rotation"
            @input="updateDevice"
          />
          <input
            type="number"
            class="rotation-input"
            v-model.number="device.rotation"
            @change="updateDevice"
            min="0"
            max="360"
            step="15"
          />
          <span class="rotation-unit">°</span>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">备注</label>
        <textarea
          class="field-input field-textarea"
          v-model="device.remarks"
          @blur="updateDevice"
          rows="3"
          placeholder="备注信息"
        ></textarea>
      </div>

      <div class="field-group" v-if="device.customSpecs">
        <label class="field-label">自定义规格</label>
        <div class="specs-editor">
          <div class="spec-row" v-for="(value, key) in device.customSpecs" :key="key">
            <input class="field-input spec-key" :value="key" readonly />
            <input
              class="field-input spec-value"
              :value="value"
              @change="updateCustomSpec(key, $event)"
            />
            <button class="icon-btn danger" @click="deleteCustomSpec(key)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <button class="btn btn-secondary btn-sm" @click="addCustomSpec">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            添加规格
          </button>
        </div>
      </div>

      <!-- 快速操作 -->
      <div class="field-group">
        <label class="field-label">操作</label>
        <div class="action-buttons">
          <button class="btn btn-primary btn-sm" @click="duplicateDevice">复制设备</button>
          <button class="btn btn-danger btn-sm" @click="deleteDevice">删除设备</button>
        </div>
      </div>
    </div>

    <!-- 线缆属性 -->
    <div v-else-if="cable" class="property-section">
      <h3 class="section-title">线缆属性</h3>

      <div class="field-group">
        <label class="field-label">类型</label>
        <select class="field-input" v-model="cable.type" @change="updateCable">
          <option value="cat6">CAT6 网线</option>
          <option value="cat6a">CAT6A 网线</option>
          <option value="fiber-sm">单模光纤</option>
          <option value="fiber-mm">多模光纤</option>
          <option value="coaxial">同轴电缆</option>
          <option value="power">电源线</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label">颜色</label>
        <input type="color" class="color-input" v-model="cable.color" @change="updateCable" />
      </div>

      <div class="field-group">
        <label class="field-label">状态</label>
        <select class="field-input" v-model="cable.status" @change="updateCable">
          <option value="auto">自动生成</option>
          <option value="manual">手动布线</option>
          <option value="modified">已修改</option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label">长度</label>
        <div class="length-display">
          <span class="length-value">{{ cable.length.toFixed(1) }} mm</span>
          <span v-if="cable.correctedLength" class="length-corrected">(修正: {{ cable.correctedLength.toFixed(1) }} mm)</span>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">标签</label>
        <input class="field-input" v-model="cable.label" @blur="updateCable" placeholder="可选标签" />
      </div>

      <div class="field-group">
        <label class="field-label">路径点数</label>
        <span class="path-point-count">{{ cable.path.length }} 个节点</span>
      </div>

      <div class="field-group">
        <label class="field-label">操作</label>
        <div class="action-buttons">
          <button class="btn btn-primary btn-sm" @click="editCablePath">编辑路径</button>
          <button class="btn btn-danger btn-sm" @click="deleteCable">删除线缆</button>
        </div>
      </div>
    </div>

    <!-- 无选择时显示提示 -->
    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 8v8M8 12h8"></path>
      </svg>
      <p>未选中任何对象</p>
      <span>在画布中选择设备或线缆查看属性</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '@/stores/project';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import type { DeviceInstance, Cable } from '@security-survey/shared-types';

const props = defineProps<{
  deviceId?: string | null;
  cableId?: string | null;
}>();

const emit = defineEmits<{
  update: [updates: any];
  close: [];
}>();

const projectStore = useProjectStore();
const deviceLibraryStore = useDeviceLibraryStore();

const device = computed(() => {
  if (!props.deviceId) return null;
  return projectStore.projectDevices.find(d => d.id === props.deviceId) || null;
});

const cable = computed(() => {
  if (!props.cableId) return null;
  return projectStore.projectCables.find(c => c.id === props.cableId) || null;
});

const compatibleModels = computed(() => {
  if (!device.value) return [];
  const currentModel = deviceLibraryStore.allDevices.find(d => d.id === device.value?.modelId);
  if (!currentModel) return deviceLibraryStore.allDevices;
  return deviceLibraryStore.allDevices.filter(d =>
    d.category === currentModel.category && d.type === currentModel.type
  );
});

function updateDevice() {
  if (device.value) {
    emit('update', { ...device.value });
  }
}

function updatePosition(axis: 'x' | 'y', event: Event) {
  if (!device.value) return;
  const value = parseFloat((event.target as HTMLInputElement).value);
  if (!isNaN(value)) {
    device.value.position[axis] = value;
    updateDevice();
  }
}

function updateCustomSpec(key: string | number, event: Event) {
  if (!device.value?.customSpecs) return;
  const value = (event.target as HTMLInputElement).value;
  device.value.customSpecs[String(key)] = value;
  updateDevice();
}

function addCustomSpec() {
  if (!device.value) return;
  if (!device.value.customSpecs) device.value.customSpecs = {};
  const newKey = `spec${Object.keys(device.value.customSpecs).length + 1}`;
  device.value.customSpecs[newKey] = '';
  updateDevice();
}

function deleteCustomSpec(key: string | number) {
  if (!device.value?.customSpecs) return;
  delete device.value.customSpecs[String(key)];
  updateDevice();
}

function duplicateDevice() {
  if (!device.value) return;
  // 触发复制逻辑（在父组件处理）
  // 这里只关闭面板
  emit('close');
}

function deleteDevice() {
  if (!device.value) return;
  // 触发删除逻辑
  emit('close');
}

function updateCable() {
  if (cable.value) {
    emit('update', { ...cable.value });
  }
}

function editCablePath() {
  // 进入路径编辑模式
  emit('close');
}

function deleteCable() {
  if (!cable.value) return;
  // 触发删除
  emit('close');
}
</script>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  overflow-y: auto;
  gap: 20px;
}

.property-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.field-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-textarea {
  resize: vertical;
  min-height: 60px;
}

.coordinate-inputs {
  display: flex;
  gap: 12px;
}

.coord-input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.coord-label {
  font-size: 11px;
  color: var(--text-tertiary);
  min-width: 12px;
}

.coord-unit {
  font-size: 11px;
  color: var(--text-tertiary);
  min-width: 28px;
}

.rotation-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rotation-slider {
  flex: 1;
  accent-color: #3b82f6;
}

.rotation-input {
  width: 60px;
  text-align: center;
}

.rotation-unit {
  font-size: 12px;
  color: var(--text-tertiary);
}

.specs-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spec-key {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  min-width: 80px;
}

.spec-value {
  flex: 1;
}

.length-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.length-value {
  font-family: monospace;
  font-size: 13px;
  font-weight: 500;
}

.length-corrected {
  font-size: 12px;
  color: var(--text-tertiary);
}

.path-point-count {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.color-input {
  width: 48px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  background: none;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 12px;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  opacity: 0.3;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-state span {
  font-size: 12px;
}
</style>