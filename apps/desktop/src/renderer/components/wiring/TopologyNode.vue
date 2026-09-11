<template>
  <div class="topology-node" :class="{ 'has-children': node.children && node.children.length > 0 }" @click.stop="$emit('click', node.id)">
    <div class="node-main" :style="{ '--node-color': nodeColor }">
      <div class="node-icon" :class="node.type">
        <component :is="nodeIcon" v-if="nodeIcon" :size="20" />
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      </div>

      <div class="node-info">
        <span class="node-name">{{ node.metadata?.name || node.metadata?.label || node.id }}</span>
        <span class="node-type">{{ getTypeLabel(node.type) }}</span>
      </div>

      <button
        class="node-toggle"
        @click.stop="toggleExpand"
        :class="{ expanded: isExpanded }"
        v-if="node.children && node.children.length > 0"
        aria-label="展开/折叠"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <div class="node-children" v-show="isExpanded" v-if="node.children && node.children.length > 0">
      <div class="tree-branch">
        <TopologyNode
          v-for="childId in node.children"
          :key="childId"
          :node="getNodeById(childId)"
          :all-nodes="allNodes"
          :level="level + 1"
          @click="$emit('click', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  node: any;
  allNodes: any[];
  level?: number;
}>();

const emit = defineEmits<{
  click: [nodeId: string];
}>();

const isExpanded = ref(true);
const level = computed(() => props.level || 0);

const nodeIcon = computed(() => {
  if (props.node.metadata?.icon) return props.node.metadata.icon;
  return null;
});

const nodeColor = computed(() => {
  const colors: Record<string, string> = {
    device: '#3b82f6',
    switch: '#10b981',
    nvr: '#8b5cf6',
    core: '#f59e0b',
    weak_point: '#ef4444',
  };
  return colors[props.node.type] || '#6b7280';
});

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function getNodeById(id: string) {
  return props.allNodes.find(n => n.id === id) || { id, name: id, type: 'unknown', children: [], metadata: {} };
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    device: '设备',
    switch: '交换机',
    nvr: 'NVR',
    core: '核心',
    weak_point: '弱电井',
  };
  return labels[type] || type;
}
</script>

<style scoped>
.topology-node {
  display: flex;
  flex-direction: column;
}

.node-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.node-main::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-color);
}

.node-main:hover {
  background: var(--bg-tertiary);
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--node-color);
  color: white;
  flex-shrink: 0;
}

.node-icon.device { background: #3b82f6; }
.node-icon.switch { background: #10b981; }
.node-icon.nvr { background: #8b5cf6; }
.node-icon.core { background: #f59e0b; }
.node-icon.weak_point { background: #ef4444; }

.node-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.node-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-type {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.node-toggle {
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

.node-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.node-toggle svg {
  transition: transform 0.2s;
}

.node-toggle.expanded svg {
  transform: rotate(90deg);
}

.node-children {
  padding-left: 16px;
  border-left: 1px solid var(--border-color);
  margin-left: 14px;
  overflow: hidden;
  transition: opacity 0.2s, height 0.2s;
}

.node-children:not([style*="display: none"]) {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.tree-branch {
  position: relative;
}

.tree-branch::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-color);
}

@media (max-width: 640px) {
  .node-main {
    padding: 6px 8px 6px 8px;
  }
  .node-main::before { left: -8px; }
  .node-children { padding-left: 12px; margin-left: 10px; }
  .tree-branch::before { left: -10px; }
}
</style>