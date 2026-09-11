<template>
  <CanvasViewport
    ref="viewportRef"
    :drawing-id="drawingId"
    @device-placed="(d: any) => emit('device-placed', d)"
    @device-moved="(d: any) => emit('device-moved', d)"
    @device-rotated="(d: any) => emit('device-rotated', d)"
    @device-selected="(ids: any) => emit('device-selected', ids)"
    @cable-created="(c: any) => emit('cable-created', c)"
    @cable-updated="(c: any) => emit('cable-updated', c)"
    @well-created="(w: any) => emit('well-created', w)"
    @tray-created="(t: any) => emit('tray-created', t)"
    @viewport-changed="(v: any) => emit('viewport-changed', v)"
  />
</template>

<script setup lang="ts">
// Canvas 包装组件：转发 CanvasViewport 的事件，并暴露工具切换/快照接口
import { ref } from 'vue';
import CanvasViewport from '@/components/canvas/CanvasViewport.vue';

defineProps<{
  drawingId: string;
}>();

const emit = defineEmits<{
  'device-placed': [device: any];
  'device-moved': [device: any];
  'device-rotated': [device: any];
  'device-selected': [deviceIds: string[]];
  'cable-created': [cable: any];
  'cable-updated': [cable: any];
  'well-created': [well: any];
  'tray-created': [tray: any];
  'viewport-changed': [viewport: any];
}>();

const viewportRef = ref<any>(null);
const currentTool = ref('select');

function setTool(tool: string) {
  currentTool.value = tool;
  // 若视口组件实现了工具切换则转发
  if (typeof viewportRef.value?.setTool === 'function') {
    viewportRef.value.setTool(tool);
  }
}

function captureSnapshot(): string | null {
  if (typeof viewportRef.value?.captureSnapshot === 'function') {
    return viewportRef.value.captureSnapshot();
  }
  return null;
}

defineExpose({ setTool, captureSnapshot, currentTool });
</script>
