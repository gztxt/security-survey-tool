<template>
  <div class="wiring-detail-panel">
    <div class="panel-header">
      <h3>布线详情</h3>
      <button class="icon-btn" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="panel-body" v-if="cable">
      <!-- 基本信息 -->
      <div class="detail-section">
        <h4>基本信息</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>ID</label>
            <span class="mono">{{ cable.id }}</span>
          </div>
          <div class="detail-item">
            <label>类型</label>
            <span>{{ cable.type }}</span>
          </div>
          <div class="detail-item">
            <label>状态</label>
            <span class="status-badge" :class="cable.status">{{ cable.status }}</span>
          </div>
          <div class="detail-item">
            <label>颜色</label>
            <span class="color-preview" :style="{ backgroundColor: cable.color }"></span>
          </div>
        </div>
      </div>

      <!-- 长度信息 -->
      <div class="detail-section">
        <h4>长度信息</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>几何长度</label>
            <span class="mono">{{ cable.length.toFixed(1) }} mm</span>
          </div>
          <div class="detail-item" v-if="cable.correctedLength">
            <label>修正长度</label>
            <span class="mono highlight">{{ cable.correctedLength.toFixed(1) }} mm</span>
          </div>
          <div class="detail-item" v-if="cable.slackRatio">
            <label>富余系数</label>
            <span>{{ (cable.slackRatio * 100).toFixed(1) }}%</span>
          </div>
          <div class="detail-item" v-if="cable.trayIds?.length">
            <label>经过桥架</label>
            <span>{{ cable.trayIds.length }} 段</span>
          </div>
        </div>
      </div>

      <!-- 端点信息 -->
      <div class="detail-section">
        <h4>端点连接</h4>
        <div class="endpoint-row">
          <div class="endpoint-card start">
            <div class="endpoint-label">起点</div>
            <div class="endpoint-device" v-if="startDevice">
              <DeviceIcon :device="startDevice" :size="32" />
              <div class="endpoint-info">
                <span class="endpoint-name">{{ startDevice.label }}</span>
                <span class="endpoint-model">{{ startDevice.modelId }}</span>
              </div>
            </div>
            <div v-else class="endpoint-placeholder">弱电井 / 未连接</div>
          </div>

          <div class="endpoint-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </div>

          <div class="endpoint-card end">
            <div class="endpoint-label">终点</div>
            <div class="endpoint-device" v-if="endDevice">
              <DeviceIcon :device="endDevice" :size="32" />
              <div class="endpoint-info">
                <span class="endpoint-name">{{ endDevice.label }}</span>
                <span class="endpoint-model">{{ endDevice.modelId }}</span>
              </div>
            </div>
            <div v-else class="endpoint-placeholder">弱电井 / 未连接</div>
          </div>
        </div>
      </div>

      <!-- 路径节点 -->
      <div class="detail-section">
        <h4>路径节点 ({{ cable.path.length }})</h4>
        <div class="path-nodes" ref="pathNodesRef">
          <div
            v-for="(point, index) in cable.path"
            :key="index"
            class="path-node"
            :class="{ start: index === 0, end: index === cable.path.length - 1 }"
          >
            <span class="node-index">{{ index + 1 }}</span>
            <span class="node-coords mono">{{ point.x.toFixed(0) }}, {{ point.y.toFixed(0) }}</span>
            <span v-if="index > 0 && index < cable.path.length - 1" class="node-type">折点</span>
          </div>
        </div>
      </div>

      <!-- 规格参数 -->
      <div class="detail-section">
        <h4>规格参数</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>导体材质</label>
            <span>{{ getCableSpec('conductor') }}</span>
          </div>
          <div class="detail-item">
            <label>绝缘材质</label>
            <span>{{ getCableSpec('insulation') }}</span>
          </div>
          <div class="detail-item">
            <label>外护套</label>
            <span>{{ getCableSpec('jacket') }}</span>
          </div>
          <div class="detail-item">
            <label>额定电压</label>
            <span>{{ getCableSpec('voltage') }}</span>
          </div>
          <div class="detail-item">
            <label>阻燃等级</label>
            <span>{{ getCableSpec('flameRating') }}</span>
          </div>
          <div class="detail-item">
            <label>工作温度</label>
            <span>{{ getCableSpec('temperature') }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="detail-actions">
        <button class="btn btn-primary" @click="editPath">编辑路径</button>
        <button class="btn btn-secondary" @click="replaceCable">替换型号</button>
        <button class="btn btn-danger" @click="deleteCable">删除线缆</button>
      </div>
    </div>

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 12h16M12 4v16"></path>
      </svg>
      <p>未选择线缆</p>
      <span>在画布中选择线缆查看详情</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '@/stores/project';
import DeviceIcon from '@/components/device/DeviceIcon.vue';

const props = defineProps<{
  cableId?: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const projectStore = useProjectStore();

const cable = computed(() => {
  if (!props.cableId) return null;
  return projectStore.projectCables.find(c => c.id === props.cableId) || null;
});

const startDevice = computed(() => {
  if (!cable.value) return null;
  return projectStore.projectDevices.find(d => d.id === cable.value?.startDeviceId) || null;
});

const endDevice = computed(() => {
  if (!cable.value) return null;
  return projectStore.projectDevices.find(d => d.id === cable.value?.endDeviceId) || null;
});

function getCableSpec(key: string): string {
  const specs: Record<string, Record<string, string>> = {
    cat5e: { conductor: '铜 (CCA/实心)', insulation: 'HDPE', jacket: 'PVC/LSZH', voltage: '300V', flameRating: 'CM/CMR', temperature: '-20°C ~ +60°C' },
    cat6: { conductor: '铜 (实心)', insulation: 'HDPE', jacket: 'PVC/LSZH', voltage: '300V', flameRating: 'CMR/CMP', temperature: '-20°C ~ +75°C' },
    cat6a: { conductor: '铜 (实心)', insulation: 'HDPE', jacket: 'PVC/LSZH', voltage: '300V', flameRating: 'CMP', temperature: '-20°C ~ +75°C' },
    cat7: { conductor: '铜 (实心)', insulation: 'HDPE', jacket: 'LSZH', voltage: '300V', flameRating: 'CMP', temperature: '-20°C ~ +75°C' },
    fiber: { conductor: '玻璃纤维', insulation: '凝胶/干式', jacket: 'LSZH/PE', voltage: 'N/A', flameRating: 'OFNR/OFNP', temperature: '-40°C ~ +70°C' },
    power: { conductor: '铜 (多股)', insulation: 'PVC/XLPE', jacket: 'PVC/LSZH', voltage: '0.6/1kV', flameRating: 'ZR/IEC60332', temperature: '-15°C ~ +90°C' },
  };
  return specs[cable.value?.type]?.[key] || '—';
}

function editPath() {
  emit('close');
  // 父组件处理进入编辑模式
}

function replaceCable() {
  emit('close');
  // 打开替换对话框
}

function deleteCable() {
  if (confirm('确定删除这条线缆吗？')) {
    emit('close');
    // 父组件处理删除
  }
}
</script>

<style scoped>
.wiring-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  overflow-y: auto;
  gap: 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
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
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-section h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.detail-item span {
  font-size: 13px;
  color: var(--text-primary);
}

.mono {
  font-family: monospace;
  font-size: 12px;
}

.highlight {
  color: #3b82f6;
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.auto { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.status-badge.manual { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.status-badge.modified { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.color-preview {
  display: inline-block;
  width: 24px;
  height: 16px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

.endpoint-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.endpoint-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  text-align: center;
}

.endpoint-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.endpoint-device {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.endpoint-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.endpoint-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.endpoint-model {
  font-size: 11px;
  color: var(--text-tertiary);
}

.endpoint-placeholder {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 12px;
}

.endpoint-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.path-nodes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.path-node {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  background: var(--bg-primary);
  border-radius: 4px;
  font-size: 12px;
}

.node-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.path-node.start .node-index { background: #10b981; color: white; }
.path-node.end .node-index { background: #ef4444; color: white; }

.node-coords {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
}

.node-type {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 8px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
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

.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
.btn-secondary:hover { background: var(--border-color); }
.btn-danger { background: #ef4444; color: white; }
.btn-danger:hover { background: #dc2626; }

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

.empty-state svg { width: 64px; height: 64px; opacity: 0.3; }
.empty-state p { margin: 0; font-size: 14px; font-weight: 500; color: var(--text-secondary); }
.empty-state span { font-size: 12px; }
</style>