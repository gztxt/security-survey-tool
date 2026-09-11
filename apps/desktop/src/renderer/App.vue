// 根组件
<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import ShepherdTour from '@/components/common/ShepherdTour.vue';
import { onMounted, onUnmounted } from 'vue';

const settings = useSettingsStore();
const projectStore = useProjectStore();
const uiStore = useUiStore();

/** 新手引导（精简版）：只讲核心闭环，高级功能入口由「高级功能 ▾」菜单承担 */
const tourSteps: Array<{
  id: string;
  title: string;
  text: string;
  buttons: Array<{ text: string; action: 'next' | 'back' | 'complete' }>;
}> = [
  {
    id: 'intro',
    title: '欢迎使用安防勘点设计工具',
    text: '三步完成一次勘点方案：导入图纸 → 标注设备与走线 → 导出点位图 / DXF。',
    buttons: [{ text: '下一步', action: 'next' }],
  },
  {
    id: 'import',
    title: '第一步：导入图纸',
    text: '点击工具栏「导入底图」或直接拖入 CAD / 图片 / PDF 文件，即可在画布上打开底图。',
    buttons: [{ text: '上一步', action: 'back' }, { text: '下一步', action: 'next' }],
  },
  {
    id: 'mark',
    title: '第二步：标注与布线',
    text: '使用「布点」在图上放置摄像头，用「布线」连接设备与机柜；需要更精准时可先做比例尺校准。',
    buttons: [{ text: '上一步', action: 'back' }, { text: '完成', action: 'complete' }],
  },
];

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!projectStore.isDirty) return;
  e.preventDefault();
  e.returnValue = '当前项目有未保存的更改，确定要离开吗？';
  return e.returnValue;
}

onMounted(() => {
  // 自动保存：仅在已有落盘路径时静默写盘，否则只保留脏标记，
  // 避免每 30s 弹一次保存对话框（AC-5.1 / 决策 4）。
  projectStore.startAutoSave(settings.autoSaveInterval, async () => {
    if (!projectStore.projectFilePath) return;
    await projectStore.saveProject();
  });
  window.addEventListener('beforeunload', onBeforeUnload);
});

onUnmounted(() => {
  projectStore.stopAutoSave();
  window.removeEventListener('beforeunload', onBeforeUnload);
});
</script>

<template>
  <div class="app">
    <RouterView v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>

    <!-- 全局加载指示器 -->
    <Teleport to="body">
      <div v-if="projectStore.isDirty" class="auto-save-indicator" title="有未保存更改">
        <span class="dot"></span>
      </div>
    </Teleport>

    <!-- 新手引导（「高级功能 → 重播新手引导」触发） -->
    <ShepherdTour
      v-if="uiStore.showTour"
      :steps="tourSteps"
      @complete="uiStore.closeTour()"
      @cancel="uiStore.closeTour()"
    />
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.auto-save-indicator {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  border-radius: 20px;
  font-size: 12px;
  color: #92400E;
  animation: pulse 2s infinite;
}

.auto-save-indicator .dot {
  width: 8px;
  height: 8px;
  background: #F59E0B;
  border-radius: 50%;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
}
</style>