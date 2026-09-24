<template>
  <div class="property-panel">
    <!-- 设备属性 -->
    <div v-if="device" class="property-section">
      <h3 class="section-title">设备属性</h3>

      <div class="field-group">
        <label class="field-label">名称</label>
        <input
          class="field-input"
          v-model="form.label"
          @blur="updateDevice"
          placeholder="输入设备名称"
        />
      </div>

      <div class="field-group">
        <label class="field-label">型号</label>
        <select class="field-input" v-model="form.modelId" @change="updateDevice">
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
              :value="form.x"
              @change="updatePosition('x', $event)"
              step="1"
            />
            <span class="coord-unit">模型单位</span>
          </div>
          <div class="coord-input">
            <span class="coord-label">Y</span>
            <input
              type="number"
              class="field-input"
              :value="form.y"
              @change="updatePosition('y', $event)"
              step="1"
            />
            <span class="coord-unit">模型单位</span>
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
            v-model.number="form.rotationDeg"
            @change="updateDevice"
          />
          <input
            type="number"
            class="rotation-input"
            v-model.number="form.rotationDeg"
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
          v-model="form.remarks"
          @blur="updateDevice"
          rows="3"
          placeholder="备注信息"
        ></textarea>
      </div>

      <div class="field-group" v-if="specEntries.length">
        <label class="field-label">自定义规格</label>
        <div class="specs-editor">
          <div class="spec-row" v-for="entry in specEntries" :key="entry.key">
            <input class="field-input spec-key" :value="entry.key" readonly />
            <input
              class="field-input spec-value"
              :value="entry.value"
              @change="updateCustomSpec(entry.key, $event)"
            />
            <button class="icon-btn danger" @click="deleteCustomSpec(entry.key)" title="删除">
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
        <select class="field-input" v-model="cableForm.type" @change="updateCable">
          <!-- option value 必须落在 CableType 联合内：旧写法 fiber-sm/coaxial
               既不是合法枚举（下划线 vs 连字符），也没有对应的颜色/规格映射 -->
          <option value="cat6">CAT6 网线</option>
          <option value="cat6a">CAT6A 网线</option>
          <option value="cat7">CAT7 网线</option>
          <option value="fiber_sm">单模光纤</option>
          <option value="fiber_mm">多模光纤</option>
          <option value="power">电源线</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label">颜色</label>
        <input type="color" class="color-input" v-model="cableForm.color" @change="updateCable" />
      </div>

      <div class="field-group">
        <label class="field-label">状态</label>
        <select class="field-input" v-model="cableForm.status" @change="updateCable">
          <option value="auto">自动生成</option>
          <option value="manual">手动布线</option>
          <option value="modified">已修改</option>
        </select>
      </div>

      <div class="field-group">
        <label class="field-label">长度</label>
        <div class="length-display">
          <span class="length-value">{{ cable.length.toFixed(1) }} m</span>
          <span v-if="cable.correctedLength" class="length-corrected">(含盘留: {{ cable.correctedLength.toFixed(1) }} m)</span>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">标签</label>
        <input class="field-input" v-model="cableForm.label" @blur="updateCable" placeholder="可选标签" />
      </div>

      <div class="field-group">
        <label class="field-label">路径点数</label>
        <span class="path-point-count">{{ cable.path.length }} 个拐点</span>
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
import { useUiStore } from '@/stores/ui';
import type { DeviceInstance, Cable, CableType } from '@security-survey/shared-types';

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
const uiStore = useUiStore();

/** 无显式 props（侧栏直呼面板）时回落到全局选择 */
const activeDeviceId = computed(() => props.deviceId ?? uiStore.selectedDeviceId);
const activeCableId = computed(() => props.cableId ?? uiStore.selectedCableId);

const device = computed(() => {
  if (!activeDeviceId.value) return null;
  return projectStore.projectDevices.find(d => d.id === activeDeviceId.value) || null;
});

const cable = computed(() => {
  if (!activeCableId.value) return null;
  return projectStore.projectCables.find(c => c.id === activeCableId.value) || null;
});

/**
 * 表单草稿：此前 v-model 直接绑到 store 里的设备对象，
 * 一次拖动滑块 = N 次对象改写，undo 快照又被 restore 覆盖 ⇒ 撤销粒度失控。
 * 草稿只在"提交"（change/blur）时写回 store 一次。
 */
const form = ref({
  label: '',
  modelId: '',
  x: 0,
  y: 0,
  rotationDeg: 0,
  remarks: '',
  customSpecs: {} as Record<string, unknown>,
});

const cableForm = ref<{ type: CableType; color: string; status: Cable['status']; label: string }>({
  type: 'cat6',
  color: '#3b82f6',
  status: 'manual',
  label: '',
});

function syncFormFromDevice() {
  const d = device.value;
  if (!d) return;
  form.value = {
    label: d.label ?? '',
    modelId: d.modelId ?? '',
    x: Math.round(d.position.x),
    y: Math.round(d.position.y),
    rotationDeg: Math.round((d.rotation ?? 0) * 180 / Math.PI),
    remarks: d.remarks ?? '',
    customSpecs: { ...(d.customSpecs as Record<string, unknown> | undefined ?? {}) },
  };
}

function syncFormFromCable() {
  const c = cable.value;
  if (!c) return;
  cableForm.value = { type: c.type, color: c.color, status: c.status, label: c.label ?? '' };
}

watch(device, syncFormFromDevice, { immediate: true });
watch(cable, syncFormFromCable, { immediate: true });

const specEntries = computed(() =>
  Object.entries(form.value.customSpecs ?? {}).map(([key, value]) => ({ key, value }))
);

const compatibleModels = computed(() => {
  if (!device.value) return [];
  const currentModel = deviceLibraryStore.allDevices.find(d => d.id === device.value?.modelId);
  if (!currentModel) return deviceLibraryStore.allDevices;
  return deviceLibraryStore.allDevices.filter(d =>
    d.category === currentModel.category && d.type === currentModel.type
  );
});

/** 把草稿变更提交到 store（一次 change = 一步历史） */
function commitDevice() {
  if (!device.value) return;
  const updates: Partial<DeviceInstance> = {
    label: form.value.label,
    modelId: form.value.modelId,
    remarks: form.value.remarks,
    position: { ...device.value.position, x: form.value.x, y: form.value.y },
    rotation: form.value.rotationDeg * Math.PI / 180,
    customSpecs: form.value.customSpecs as Partial<DeviceInstance['customSpecs']> & Record<string, unknown>,
  };
  projectStore.updateDevice(device.value.id, updates);
  emit('update', updates);
}

function updateDevice() {
  commitDevice();
}

function updatePosition(axis: 'x' | 'y', event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value);
  if (!isNaN(value)) {
    form.value[axis] = value;
    updateDevice();
  }
}

function updateCustomSpec(key: string | number, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  form.value.customSpecs[String(key)] = value;
  updateDevice();
}

function addCustomSpec() {
  const newKey = `spec${Object.keys(form.value.customSpecs).length + 1}`;
  form.value.customSpecs[newKey] = '';
  updateDevice();
}

function deleteCustomSpec(key: string | number) {
  delete form.value.customSpecs[String(key)];
  updateDevice();
}

function duplicateDevice() {
  const d = device.value;
  if (!d) return;
  const copy: DeviceInstance = {
    ...JSON.parse(JSON.stringify(d)),
    id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    position: { x: d.position.x + 500, y: d.position.y + 500 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  projectStore.addDevice(copy);
  uiStore.setSelection(copy.id, null);
}

function deleteDevice() {
  const d = device.value;
  if (!d) return;
  projectStore.removeDevice(d.id);
  uiStore.setSelection(null, null);
  emit('close');
}

function updateCable() {
  if (!cable.value) return;
  projectStore.updateCable(cable.value.id, { ...cableForm.value });
  emit('update', { ...cableForm.value });
}

function editCablePath() {
  // 进入路径编辑模式
  emit('close');
}

function deleteCable() {
  const c = cable.value;
  if (!c) return;
  projectStore.removeCable(c.id);
  uiStore.setSelection(null, null);
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