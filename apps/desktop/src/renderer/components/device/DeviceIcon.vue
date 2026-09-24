<template>
  <div :class="['device-icon', sizeClass]" :style="{ width: size + 'px', height: size + 'px' }" :title="device?.name">
    <!-- 自定义 SVG 图标 -->
    <component v-if="device?.icon?.svg" :is="device.icon.svg" class="icon-svg" />

    <!-- Lucide 图标名 -->
    <component v-else-if="device?.icon?.lucide" :is="lucideIcons[device.icon.lucide]" class="icon-lucide" />

    <!-- 内置分类图标 -->
    <component v-else :is="getCategoryIcon(device?.category)" class="icon-category" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { h } from 'vue';
import {
  Camera, Wifi, Cpu, Server, HardDrive, Monitor,
  Mic, Speaker, Zap, Shield, Lock, Key,
  Box, Truck, Package, Forklift,
} from 'lucide-vue-next';

const props = defineProps<{
  device?: any;
  size?: number;
}>();

const size = computed(() => props.size || 48);

const sizeClass = computed(() => {
  if (props.size && props.size <= 24) return 'size-sm';
  if (props.size && props.size <= 36) return 'size-md';
  if (props.size && props.size <= 64) return 'size-lg';
  return 'size-xl';
});

const lucideIcons = {
  camera: Camera,
  wifi: Wifi,
  cpu: Cpu,
  server: Server,
  'hard-drive': HardDrive,
  monitor: Monitor,
  mic: Mic,
  speaker: Speaker,
  zap: Zap,
  shield: Shield,
  lock: Lock,
  key: Key,
  box: Box,
  truck: Truck,
  package: Package,
  pallet: Forklift,
};

function getCategoryIcon(category: string | undefined) {
  const icons: Record<string, any> = {
    camera: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }),
      h('circle', { cx: 12, cy: 12, r: 4 }),
    ]),
    nvr: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }),
      h('path', { d: 'M8 21h8M12 17v4' }),
    ]),
    switch: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }),
      h('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }),
      h('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }),
      h('rect', { x: 14, y: 14, width: 7, height: 7, rx: 1 }),
    ]),
    fiber: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('path', { d: 'M2 12h20M2 12l4 4M2 12l4-4M22 12l-4 4M22 12l-4-4' }),
    ]),
    power: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('path', { d: 'M18.36 6.64a9 9 0 1 1-12.73 0' }),
      h('line', { x1: 12, y1: 2, x2: 12, y2: 12 }),
    ]),
    sensor: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('path', { d: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83' }),
    ]),
    alarm: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
      h('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }),
    ]),
    access: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }),
      h('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
    ]),
    default: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
      h('circle', { cx: 12, cy: 12, r: 4 }),
    ]),
    // 机柜：立柜 + 分层 U 位
    rack: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
      h('rect', { x: 5, y: 2, width: 14, height: 20, rx: 1.5 }),
      h('path', { d: 'M5 7h14M5 12h14M5 17h14' }),
      h('circle', { cx: 16.5, cy: 4.5, r: 0.6, fill: 'currentColor' }),
      h('circle', { cx: 16.5, cy: 9.5, r: 0.6, fill: 'currentColor' }),
    ]),
    door_station: () => icons.access ? icons.access() : icons.default(),
  };

  // 真实 DeviceCategory → 图标别名映射（dome/bullet/ptz… 与 legacy camera 键共存）
  const alias: Record<string, string> = {
    dome: 'camera', bullet: 'camera', ptz: 'camera', panoramic: 'camera',
    thermal: 'sensor', multi: 'camera', fisheye: 'camera',
    nvr: 'nvr', switch: 'switch', rack: 'rack', door_station: 'door_station',
  };
  const key = category ? (alias[category] || category) : '';
  return (icons as any)[key] || icons.default;
}
</script>

<style scoped>
.device-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  overflow: hidden;
  flex-shrink: 0;
}

.device-icon svg {
  width: 100%;
  height: 100%;
}

.icon-svg,
.icon-lucide,
.icon-category {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.size-sm { width: 20px !important; height: 20px !important; border-radius: 4px; }
.size-md { width: 32px !important; height: 32px !important; border-radius: 6px; }
.size-lg { width: 48px !important; height: 48px !important; border-radius: 8px; }
.size-xl { width: 64px !important; height: 64px !important; border-radius: 10px; }

.device-icon.size-sm svg { stroke-width: 2.5; }
.device-icon.size-md svg { stroke-width: 2; }
.device-icon.size-lg svg { stroke-width: 1.8; }
.device-icon.size-xl svg { stroke-width: 1.5; }
</style>