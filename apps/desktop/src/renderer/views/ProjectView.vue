<template>
  <div class="project-view">
    <ProjectHeader
      :project="project"
      :dirty="isDirty"
      @save="saveProject"
      @save-as="saveProjectAs"
      @export="showExportDialog"
      @import="importDrawing"
    />

    <div class="project-layout">
      <SidebarPanel
        :collapsible="true"
        @collapse="onSidebarCollapse"
      />

      <div class="main-area" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import ProjectHeader from '@/components/layout/ProjectHeader.vue';
import SidebarPanel from '@/components/layout/SidebarPanel.vue';
import { useBaselineImport, basenameOf } from '@/composables/useBaselineImport';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const baselineImport = useBaselineImport();

const project = computed(() => projectStore.currentProject);
const isDirty = computed(() => projectStore.isDirty);
const sidebarCollapsed = ref(false);

onMounted(() => {
  // 同步当前图纸
  if (route.params.drawingId) {
    projectStore.setCurrentDrawing(route.params.drawingId as string);
  }
  // 打开项目时底图重水合失败 → 提示"底图文件已移动"（AC-5）
  if (projectStore.basemapMissing.length) promptMissingBasemap();
});

watch(
  () => projectStore.basemapMissing,
  (list) => {
    if (list.length) promptMissingBasemap();
  },
);

function promptMissingBasemap() {
  const list = projectStore.basemapMissing;
  ElMessage.warning(
    list.length === 1
      ? `底图文件已移动，请重新链接：${basenameOf(list[0])}（标注数据已保留）`
      : `${list.length} 个底图文件已移动，请重新链接（标注数据已保留）`,
  );
}

function onSidebarCollapse(collapsed: boolean) {
  sidebarCollapsed.value = collapsed;
}

async function saveProject() {
  if (!project.value) return;
  await projectStore.saveProject(project.value);
}

async function saveProjectAs() {
  if (!project.value) return;
  const result = await projectStore.saveProjectAs(project.value);
  if (result?.success && result.path) {
    router.push({ name: 'project', params: { id: result.path } });
  }
}

function showExportDialog() {
  router.push({ name: 'project-export', params: { id: project.value?.id } });
}

function importDrawing() {
  // 基线导入链：原生对话框 → grantPaths → drawing.import（决策 3）
  void baselineImport.runImport();
}
</script>

<style scoped>
.project-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.project-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: margin-left 0.2s;
}

.main-area.sidebar-collapsed {
  margin-left: -232px; /* 280 - 48 */
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>