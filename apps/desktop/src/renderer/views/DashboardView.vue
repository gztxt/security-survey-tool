<template>
  <div class="dashboard-view">
    <div class="dashboard-header">
      <h1 class="page-title">项目仪表盘</h1>
      <div class="header-actions">
        <el-button type="primary" @click="createNewProject" icon="Plus">
          新建项目
        </el-button>
        <el-button @click="importProject" icon="Upload">
          导入项目
        </el-button>
      </div>
    </div>

    <div class="dashboard-stats">
      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon projects">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ projectStats.projects }}</span>
            <span class="stat-label">项目总数</span>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon drawings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ projectStats.drawings }}</span>
            <span class="stat-label">图纸总数</span>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon devices">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ projectStats.devices }}</span>
            <span class="stat-label">设备总数</span>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="never">
        <div class="stat-content">
          <div class="stat-icon wiring">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ projectStats.wiringLength }}m</span>
            <span class="stat-label">布线总长</span>
          </div>
        </div>
      </el-card>
    </div>

    <div class="dashboard-grid">
      <!-- 最近项目 -->
      <el-card class="dashboard-card" shadow="never">
        <template #header>
          <div class="card-header">
            <h3>最近项目</h3>
            <el-button size="small" link @click="navigateToProjects">查看全部</el-button>
          </div>
        </template>

        <div v-if="recentProjects.length === 0" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>暂无项目</p>
          <el-button type="primary" size="small" @click="createNewProject">创建第一个项目</el-button>
        </div>

        <div v-else class="project-list">
          <div
            v-for="project in recentProjects"
            :key="project.id"
            class="project-item"
            @click="openProject(project.id)"
          >
            <div class="project-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="project-info">
              <div class="project-name">{{ project.name }}</div>
              <div class="project-meta">
                <span>{{ project.drawingCount }} 张图纸</span>
                <span>·</span>
                <span>{{ project.deviceCount }} 个设备</span>
                <span>·</span>
                <span>{{ formatDate(project.updatedAt) }}</span>
              </div>
            </div>
            <div class="project-actions">
              <el-button size="small" link @click.stop="openProject(project.id)">打开</el-button>
              <el-dropdown @click.stop>
                <el-button size="small" link>更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click.stop="duplicateProject(project.id)">复制</el-dropdown-item>
                    <el-dropdown-item @click.stop="exportProject(project.id)">导出</el-dropdown-item>
                    <el-dropdown-item divided @click.stop="deleteProject(project.id)">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 快速操作 -->
      <el-card class="dashboard-card" shadow="never">
        <template #header>
          <h3>快速操作</h3>
        </template>

        <div class="quick-actions">
          <el-button class="action-btn" @click="createNewProject">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>新建项目</span>
          </el-button>

          <el-button class="action-btn" @click="importProject">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>导入项目</span>
          </el-button>

          <el-button class="action-btn" @click="createFromTemplate">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 13V11a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path>
              <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"></path>
            </svg>
            <span>从模板创建</span>
          </el-button>

          <el-button class="action-btn" @click="openSettings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>设置</span>
          </el-button>
        </div>
      </el-card>

      <!-- 设备库概览 -->
      <el-card class="dashboard-card" shadow="never">
        <template #header>
          <div class="card-header">
            <h3>设备库概览</h3>
            <el-button size="small" link @click="navigateToDeviceLib">管理设备</el-button>
          </div>
        </template>

        <div class="device-categories">
          <div
            v-for="cat in deviceCategories"
            :key="cat.id"
            class="category-item"
          >
            <div class="category-icon" :style="{ background: cat.color }">
              <component :is="cat.icon" width="18" height="18" />
            </div>
            <div class="category-info">
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-count">{{ cat.count }} 种设备</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 最近活动 -->
      <el-card class="dashboard-card" shadow="never">
        <template #header>
          <div class="card-header">
            <h3>最近活动</h3>
            <el-button size="small" link>查看全部</el-button>
          </div>
        </template>

        <div v-if="recentActivity.length === 0" class="empty-state small">
          <p>暂无活动记录</p>
        </div>

        <el-timeline v-else :reverse="true">
          <el-timeline-item
            v-for="act in recentActivity"
            :key="act.id"
            :timestamp="formatTime(act.time)"
            :type="act.type"
            :icon="act.icon"
            :color="act.color"
          >
            {{ act.message }}
          </el-timeline-item>
        </el-timeline>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';

const router = useRouter();
const projectStore = useProjectStore();
const deviceStore = useDeviceLibraryStore();

const recentProjects = computed(() => projectStore.recentProjects);
const projectStats = computed(() => projectStore.getProjectStats());
const deviceCategories = computed(() => deviceStore.getCategoriesWithCount());
const recentActivity = computed(() => projectStore.recentActivity);

function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN');
}

function formatTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return d.toLocaleDateString('zh-CN');
}

function createNewProject() {
  router.push({ name: 'ProjectCreate' });
}

function importProject() {
  // 触发文件选择（Web 通道的 input[accept] 带 .zip，但项目包不是已实现的能力，去掉以免选了打不开）
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.survey';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await projectStore.importProject(file);
      router.push({ name: 'project', params: { id: (projectStore.currentProject as any)?.id || '' } });
    } catch (err: any) {
      ElMessage.error(`导入失败：${err?.message || err}`);
    }
  };
  input.click();
}

function createFromTemplate() {
  // 模板选择本来就是新建项目表单里的一项，不再另设一个只有 toast 的空按钮
  router.push({ name: 'ProjectCreate' });
}

function openSettings() {
  router.push({ name: 'Settings' });
}

async function openProject(projectId: string) {
  // 旧实现把项目 id 当文件路径喂给 loadProject（loadProject 内部是 fs.readFile(id)），
  // 必然抛错且没人 catch：点最近项目 = 静默失败。
  const res = await projectStore.openProjectById(projectId);
  if (!res.ok) {
    ElMessage.warning(res.error || '无法打开该项目');
    return;
  }
  router.push({ name: 'project', params: { id: projectId } });
}

function navigateToProjects() {
  router.push({ name: 'Projects' });
}

function navigateToDeviceLib() {
  router.push({ name: 'DeviceLibrary' });
}

function duplicateProject(projectId: string) {
  projectStore.duplicateProject(projectId);
  ElMessage.success('项目已复制');
}

function exportProject(projectId: string) {
  projectStore.exportProject(projectId);
}

async function deleteProject(projectId: string) {
  const result = await ElMessageBox.confirm('确定要删除该项目吗？此操作不可撤销。', '确认删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  if (result === 'confirm') {
    projectStore.deleteProject(projectId);
    ElMessage.success('项目已删除');
  }
}
</script>

<style scoped>
.dashboard-view {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: white;
}

.stat-icon.projects { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
.stat-icon.drawings { background: linear-gradient(135deg, #10b981, #059669); }
.stat-icon.devices { background: linear-gradient(135deg, #f59e0b, #d97706); }
.stat-icon.wiring { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
}

.dashboard-card {
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  height: fit-content;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0;
}

.card-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.project-list {
  max-height: 320px;
  overflow-y: auto;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: background 0.15s;
  cursor: pointer;
}

.project-item:hover {
  background: var(--bg-tertiary);
}

.project-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-meta {
  font-size: 11px;
  color: var(--text-tertiary);
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.project-actions {
  display: flex;
  gap: 4px;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 8px;
}

.action-btn {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 20px 16px !important;
  border-radius: 12px !important;
  border: 1px solid var(--border-color) !important;
  background: var(--bg-primary) !important;
  color: var(--text-primary) !important;
  transition: all 0.15s !important;
}

.action-btn:hover {
  border-color: #3b82f6 !important;
  background: rgba(59, 130, 246, 0.05) !important;
  color: #3b82f6 !important;
  transform: translateY(-2px);
}

.device-categories {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.15s;
  cursor: pointer;
}

.category-item:hover {
  background: var(--bg-tertiary);
}

.category-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: white;
}

.category-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.category-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.category-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 12px;
}

.empty-state svg {
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.empty-state.small {
  padding: 20px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-view {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .quick-actions {
    grid-template-columns: 1fr;
  }
}
</style>