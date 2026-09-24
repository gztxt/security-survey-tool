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

    <!-- 工作流步骤条：导入底图 → 添加点位 → 标注线路 → 生成导出 -->
    <WorkflowStepper :on-import-basemap="importDrawing" />

    <div class="project-layout">
      <SidebarPanel :collapsible="true" />

      <div class="main-area">
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
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import ProjectHeader from '@/components/layout/ProjectHeader.vue';
import WorkflowStepper from '@/components/layout/WorkflowStepper.vue';
import SidebarPanel from '@/components/layout/SidebarPanel.vue';
import { useBaselineImport, basenameOf } from '@/composables/useBaselineImport';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const baselineImport = useBaselineImport();

const project = computed(() => projectStore.currentProject);
const isDirty = computed(() => projectStore.isDirty);

/**
 * 路由 :id → 项目实例。这里是"刷新/深链/重启后进入 /project/:id"唯一的补齐点。
 *
 * 历史缺陷：本视图只读 store.currentProject，从不按 id 载入。于是
 *  - 从项目列表用浏览器前进/后退、或直接把 URL 贴给别人，画布永远是空的；
 *  - F5 刷新后当前项目丢失，URL 里明明有 id 却不加载。
 * 表现都是"项目存在但打开是空白"，用户会以为数据没了。
 */
async function resolveRouteProject(): Promise<void> {
  const routeId = typeof route.params.id === 'string' ? route.params.id : '';
  const current = projectStore.currentProject;

  // 路由没带 id（直接访问 /project）：有内存态就沿用，没有就回列表页，
  // 而不是停在一个没有项目的空壳视图里。
  if (!routeId) {
    if (!current) void router.replace({ name: 'Projects' });
    return;
  }
  // 内存里就是它：包含"刚新建/刚复制、尚未落盘"的项目。此时若强行按磁盘重载，
  // 会被 openProjectById 的"尚未保存"分支判为失败并踢回列表，等于建完就被赶出去。
  if (current && current.id === routeId) return;
  if (current && projectStore.isDirty) {
    ElMessage.warning('当前项目有未保存的修改，已保留当前项目；请先保存后再切换');
    return;
  }

  const res = await projectStore.openProjectById(routeId);
  if (!res.ok) {
    ElMessage.warning(res.error || '无法打开该项目');
    void router.replace({ name: 'Projects' });
  }
}

onMounted(async () => {
  await resolveRouteProject();
  // 同步当前图纸
  if (route.params.drawingId) {
    projectStore.setCurrentDrawing(route.params.drawingId as string);
  }
  // 打开项目时底图重水合失败 → 提示"底图文件已移动"（AC-5）
  if (projectStore.basemapMissing.length) promptMissingBasemap();
});

watch(() => route.params.id, () => { void resolveRouteProject(); });

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

async function saveProject() {
  if (!project.value) return;
  await projectStore.saveProject(project.value);
}

async function saveProjectAs() {
  if (!project.value) return;
  const result = await projectStore.saveProjectAs(project.value);
  // 路由 :id 的口径是"项目 id"（见 resolveRouteProject），不能再写文件路径；
  // 另存成功时 store 已更新落盘路径，无需导航。
  void result;
}

function showExportDialog() {
  router.push({ name: 'project-export', params: { id: project.value?.id } });
}

function importDrawing() {
  // 基线导入链：原生对话框 → grantPaths → drawing.import（决策 3）
  void baselineImport.runImport();
}

/**
 * 项目级快捷键（此前 ProjectHeader 的按钮 title 标了 Ctrl+Shift+H / Ctrl+Shift+S /
 * Ctrl+I / Ctrl+E，但全局没有任何地方注册过这些键 ⇒ 提示是假的，按了无反应）。
 * 这里统一补齐；图纸编辑级快捷键（Ctrl+N 新建图纸、Ctrl+O 导入文件、1/2/V/W/G 视图
 * 切换）仍归 DrawingView，两层互不重叠。
 */
function handleProjectShortcuts(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
  if (!(e.ctrlKey || e.metaKey)) return;

  const key = e.key.toLowerCase();
  if (key === 's' && e.shiftKey) {
    e.preventDefault();
    void saveProjectAs();
  } else if (key === 's') {
    e.preventDefault();
    void saveProject();
  } else if (key === 'i') {
    e.preventDefault();
    importDrawing();
  } else if (key === 'e') {
    e.preventDefault();
    showExportDialog();
  } else if (key === 'h' && e.shiftKey) {
    e.preventDefault();
    router.push({ name: 'home' });
  }
}

onMounted(() => window.addEventListener('keydown', handleProjectShortcuts));
onUnmounted(() => window.removeEventListener('keydown', handleProjectShortcuts));
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