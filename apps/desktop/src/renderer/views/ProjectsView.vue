<template>
  <div class="projects-view">
    <div class="projects-header">
      <div class="header-left">
        <h1 class="page-title">项目管理</h1>
        <p class="page-subtitle">管理所有安防勘察布线项目</p>
      </div>
      <div class="header-right">
        <el-button @click="refreshProjects" icon="Refresh" size="small">刷新</el-button>
        <el-button type="primary" @click="createNewProject" icon="Plus" size="small">新建项目</el-button>
      </div>
    </div>

    <!-- 搜索过滤栏 -->
    <el-card class="filter-bar" shadow="never" style="margin-bottom: 16px">
      <div class="filter-row">
        <el-input
          v-model="searchQuery"
          placeholder="搜索项目名称、编号、描述..."
          size="small"
          prefix-icon="Search"
          clearable
          style="width: 300px"
        />
        <el-select v-model="filterStatus" placeholder="状态" size="small" style="width: 140px">
          <el-option label="全部" value="" />
          <el-option label="进行中" value="active" />
          <el-option label="已归档" value="archived" />
          <el-option label="已完成" value="completed" />
        </el-select>
        <el-select v-model="filterType" placeholder="类型" size="small" style="width: 180px">
          <el-option label="全部" value="" />
          <el-option label="标准安防" value="integrated-security" />
          <el-option label="视频监控" value="video-surveillance" />
          <el-option label="周界报警" value="perimeter-alarm" />
          <el-option label="门禁考勤" value="access-control" />
          <el-option label="自定义" value="custom" />
        </el-select>
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          size="small"
          style="width: 280px"
          value-format="YYYY-MM-DD"
        />
        <el-button @click="clearFilters" size="small">重置</el-button>
      </div>
    </el-card>

    <!-- 视图切换 -->
    <div class="view-toolbar" style="margin-bottom: 16px">
      <el-radio-group v-model="viewMode" size="small" button-style="solid">
        <el-radio-button value="grid" title="网格视图">网格</el-radio-button>
        <el-radio-button value="list" title="列表视图">列表</el-radio-button>
        <el-radio-button value="table" title="表格视图">表格</el-radio-button>
      </el-radio-group>

      <div class="toolbar-right">
        <el-select v-model="sortBy" placeholder="排序" size="small" style="width: 160px">
          <el-option label="更新时间 ↓" value="updated-desc" />
          <el-option label="更新时间 ↑" value="updated-asc" />
          <el-option label="创建时间 ↓" value="created-desc" />
          <el-option label="创建时间 ↑" value="created-asc" />
          <el-option label="名称 A-Z" value="name-asc" />
          <el-option label="名称 Z-A" value="name-desc" />
        </el-select>
        <span class="project-count">共 {{ filteredProjects.length }} 个项目</span>
      </div>
    </div>

    <!-- 网格视图 -->
    <div v-if="viewMode === 'grid'" class="projects-grid">
      <div
        v-for="project in paginatedProjects"
        :key="project.id"
        class="project-card"
        @click="openProject(project.id)"
        @contextmenu.prevent="showContextMenu(project, $event)"
      >
        <div class="card-header">
          <div class="project-icon" :style="{ background: project.color }">
            <component :is="project.typeIcon" />
          </div>
          <div class="card-actions">
            <el-dropdown trigger="click">
              <el-button size="small" circle link>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click.stop="openProject(project.id)"><el-icon><Edit /></el-icon> 打开</el-dropdown-item>
                  <el-dropdown-item @click.stop="duplicateProject(project.id)"><el-icon><CopyDocument /></el-icon> 复制</el-dropdown-item>
                  <el-dropdown-item @click.stop="exportProject(project.id)"><el-icon><Download /></el-icon> 导出</el-dropdown-item>
                  <el-dropdown-item divided @click.stop="archiveProject(project.id)"><el-icon><Box /></el-icon> 归档</el-dropdown-item>
                  <el-dropdown-item divided @click.stop="deleteProject(project.id)" class="danger"><el-icon><Delete /></el-icon> 删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div class="card-body">
          <h3 class="project-name" :title="project.name">{{ project.name }}</h3>
          <p v-if="project.code" class="project-code">{{ project.code }}</p>
          <p v-if="project.description" class="project-desc">{{ project.description }}</p>
        </div>

        <div class="card-meta">
          <div class="meta-item">
            <el-icon><FolderOpened /></el-icon>
            <span>{{ project.drawingCount }} 图纸</span>
          </div>
          <div class="meta-item">
            <el-icon><Monitor /></el-icon>
            <span>{{ project.deviceCount }} 设备</span>
          </div>
          <div class="meta-item">
            <el-icon><Link /></el-icon>
            <span>{{ project.wireCount }} 线路</span>
          </div>
        </div>

        <div class="card-footer">
          <el-tag :type="getStatusType(project.status)" size="small" effect="light">
            {{ getStatusLabel(project.status) }}
          </el-tag>
          <span class="updated-time">{{ formatRelativeTime(project.updatedAt) }}</span>
        </div>

        <div v-if="project.progress !== undefined" class="progress-bar">
          <el-progress :percentage="project.progress" :stroke-width="4" :show-text="false" color="#3b82f6" />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredProjects.length === 0" class="empty-state">
        <el-icon><FolderOpened /></el-icon>
        <h3>{{ searchQuery || filterStatus || filterType ? '没有匹配的项目' : '暂无项目' }}</h3>
        <p>{{ searchQuery || filterStatus || filterType ? '尝试调整搜索条件' : '点击「新建项目」创建第一个项目' }}</p>
        <el-button v-if="!(searchQuery || filterStatus || filterType)" type="primary" @click="createNewProject" icon="Plus">新建项目</el-button>
        <el-button v-else @click="clearFilters" icon="Refresh">清除筛选</el-button>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-else-if="viewMode === 'list'" class="projects-list">
      <div class="list-header">
        <div class="list-col col-name">项目名称</div>
        <div class="list-col col-code">编号</div>
        <div class="list-col col-type">类型</div>
        <div class="list-col col-status">状态</div>
        <div class="list-col col-stats">统计</div>
        <div class="list-col col-time">更新时间</div>
        <div class="list-col col-actions">操作</div>
      </div>
      <div
        v-for="project in paginatedProjects"
        :key="project.id"
        class="list-row"
        @click="openProject(project.id)"
        @contextmenu.prevent="showContextMenu(project, $event)"
      >
        <div class="list-col col-name">
          <div class="project-icon-sm" :style="{ background: project.color }">
            <component :is="project.typeIcon" />
          </div>
          <div class="name-info">
            <span class="name">{{ project.name }}</span>
            <span v-if="project.code" class="code">{{ project.code }}</span>
          </div>
        </div>
        <div class="list-col col-code">{{ project.code || '—' }}</div>
        <div class="list-col col-type">{{ getTypeLabel(project.type) }}</div>
        <div class="list-col col-status">
          <el-tag :type="getStatusType(project.status)" size="small" effect="light">{{ getStatusLabel(project.status) }}</el-tag>
        </div>
        <div class="list-col col-stats">
          <span class="stat">{{ project.drawingCount }} 图</span>
          <span class="stat">{{ project.deviceCount }} 设备</span>
          <span class="stat">{{ project.wireCount }} 线</span>
        </div>
        <div class="list-col col-time">{{ formatDate(project.updatedAt) }}</div>
        <div class="list-col col-actions">
          <el-button size="small" link @click.stop="openProject(project.id)">打开</el-button>
          <el-button size="small" link @click.stop="duplicateProject(project.id)">复制</el-button>
          <el-button size="small" link type="danger" @click.stop="deleteProject(project.id)">删除</el-button>
        </div>
      </div>

      <div v-if="filteredProjects.length === 0" class="empty-state">
        <el-icon><FolderOpened /></el-icon>
        <h3>没有匹配的项目</h3>
        <el-button @click="clearFilters" icon="Refresh">清除筛选</el-button>
      </div>
    </div>

    <!-- 表格视图 -->
    <el-table v-else-if="viewMode === 'table'" :data="paginatedProjects" border size="small" style="width: 100%" row-key="id" highlight-current-row @row-dblclick="openProject">
      <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <div class="table-name">
            <div class="project-icon-sm" :style="{ background: scope.row.color }">
              <component :is="scope.row.typeIcon" />
            </div>
            <span>{{ scope.row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="code" label="编号" width="140" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="120">
        <template #default="scope">
          <el-tag size="small" effect="light">{{ getTypeLabel(scope.row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)" size="small" effect="light">{{ getStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="图纸/设备/线路" width="180">
        <template #default="scope">
          <div class="table-stats">
            <span><el-icon><FolderOpened /></el-icon>{{ scope.row.drawingCount }}</span>
            <span><el-icon><Monitor /></el-icon>{{ scope.row.deviceCount }}</span>
            <span><el-icon><Link /></el-icon>{{ scope.row.wireCount }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="160">
        <template #default="scope">
          {{ formatDate(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="scope">
          <el-button size="small" link @click="openProject(scope.row.id)">打开</el-button>
          <el-button size="small" link @click="duplicateProject(scope.row.id)">复制</el-button>
          <el-button size="small" link type="danger" @click="deleteProject(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div v-if="filteredProjects.length > pageSize" class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredProjects.length"
        layout="prev, pager, next, sizes, total"
        :page-sizes="[12, 24, 48, 96]"
        size="small"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Plus, Search, More, Edit, CopyDocument, Download, Box, Delete,
  FolderOpened, Monitor, Link, Grid, List, Clock, Calendar
} from '@element-plus/icons-vue';

const router = useRouter();

const props = defineProps<{}>();
const emit = defineEmits<{}>();

const searchQuery = ref('');
const filterStatus = ref('');
const filterType = ref('');
const filterDateRange = ref<[string, string] | null>(null);
const viewMode = ref<'grid' | 'list' | 'table'>('grid');
const sortBy = ref('updated-desc');
const currentPage = ref(1);
const pageSize = 12;
const contextMenu = ref({ visible: false, x: 0, y: 0, project: null as any });

// 模拟项目数据
const allProjects = ref<Array<any>>([]);

function generateMockProjects() {
  const types = [
    { id: 'integrated-security', label: '标准安防', icon: 'Grid', color: '#3b82f6' },
    { id: 'video-surveillance', label: '视频监控', icon: 'Monitor', color: '#10b981' },
    { id: 'perimeter-alarm', label: '周界报警', icon: 'Link', color: '#f59e0b' },
    { id: 'access-control', label: '门禁考勤', icon: 'Lock', color: '#8b5cf6' },
  ];

  const statuses = ['active', 'archived', 'completed'];

  const names = [
    '某小区安防改造项目', '某工业园监控系统', '某学校周界报警', '某办公楼门禁系统',
    '某仓库智能监控', '某商场安防升级', '某医院安防项目', '某地铁站监控',
    '某数据中心安防', '某变电站周界', '某隧道监控系统', '某桥梁监控项目',
  ];

  const projects = [];
  for (let i = 0; i < 28; i++) {
    const type = types[i % types.length];
    const created = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    const updated = new Date(created.getTime() + Math.random() * (Date.now() - created.getTime()));

    projects.push({
      id: `proj-${1000 + i}`,
      name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
      code: `PRJ-${2026}-${String(i + 1).padStart(3, '0')}`,
      type: type.id,
      typeIcon: type.icon,
      typeColor: type.color,
      color: type.color,
      description: `这是一个${type.label}项目，包含多个子系统的设计与实施。`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      drawingCount: Math.floor(Math.random() * 10) + 1,
      deviceCount: Math.floor(Math.random() * 100) + 5,
      wireCount: Math.floor(Math.random() * 200) + 10,
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
      progress: Math.floor(Math.random() * 100),
    });
  }
  return projects;
}

const filteredProjects = computed(() => {
  let result = [...allProjects.value];

  // 搜索
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }

  // 状态筛选
  if (filterStatus.value) {
    result = result.filter(p => p.status === filterStatus.value);
  }

  // 类型筛选
  if (filterType.value) {
    result = result.filter(p => p.type === filterType.value);
  }

  // 日期范围筛选
  if (filterDateRange.value) {
    const [start, end] = filterDateRange.value;
    result = result.filter(p => {
      const d = p.updatedAt.split('T')[0];
      return d >= start && d <= end;
    });
  }

  // 排序
  switch (sortBy.value) {
    case 'updated-desc':
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case 'updated-asc':
      result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      break;
    case 'created-desc':
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'created-asc':
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
      break;
  }

  return result;
});

const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredProjects.value.slice(start, start + pageSize);
});

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    'integrated-security': '标准安防',
    'video-surveillance': '视频监控',
    'perimeter-alarm': '周界报警',
    'access-control': '门禁考勤',
    'custom': '自定义',
  };
  return map[type] || type;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    'active': '进行中',
    'archived': '已归档',
    'completed': '已完成',
  };
  return map[status] || status;
}

function getStatusType(status: string) {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    'active': 'success',
    'archived': 'info',
    'completed': 'warning',
  };
  return map[status] || 'info';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

function createNewProject() {
  router.push({ name: 'ProjectCreate' });
}

function openProject(projectId: string) {
  router.push({ name: 'Drawing', params: { projectId } });
}

function duplicateProject(projectId: string) {
  ElMessage.success('项目已复制，正在打开...');
  // TODO: 实现复制逻辑
  setTimeout(() => {
    router.push({ name: 'ProjectCreate' });
  }, 500);
}

function exportProject(projectId: string) {
  ElMessage.info('导出功能开发中...');
}

async function archiveProject(projectId: string) {
  try {
    await ElMessageBox.confirm('确定要归档该项目吗？归档后将不在主列表显示，但可在归档视图中查看。', '确认归档', {
      confirmButtonText: '归档',
      cancelButtonText: '取消',
      type: 'warning',
    });
    ElMessage.success('项目已归档');
    // TODO: 调用 API 归档
  } catch {}
}

async function deleteProject(projectId: string) {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确定要删除该项目吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'error',
    });
    allProjects.value = allProjects.value.filter(p => p.id !== projectId);
    ElMessage.success('项目已删除');
  } catch {}
}

function showContextMenu(project: any, event: MouseEvent) {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    project,
  };
}

function refreshProjects() {
  // TODO: 从后端/存储重新加载
  ElMessage.success('已刷新');
}

function clearFilters() {
  searchQuery.value = '';
  filterStatus.value = '';
  filterType.value = '';
  filterDateRange.value = null;
  currentPage.value = 1;
}

function onPageChange(page: number) {
  currentPage.value = page;
}

onMounted(() => {
  allProjects.value = generateMockProjects();
});
</script>

<style scoped>
.projects-view {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  flex: 1;
}

.page-title {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.header-right {
  display: flex;
  gap: 8px;
}

.filter-bar {
  padding: 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.view-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 网格视图 */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background: var(--bg-tertiary);
}

.project-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: white;
}

.card-actions {
  opacity: 0;
  transition: opacity 0.15s;
}

.project-card:hover .card-actions {
  opacity: 1;
}

.card-body {
  padding: 16px;
  flex: 1;
}

.project-name {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-code {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Monaco', monospace;
}

.project-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  gap: 16px;
  padding: 0 16px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.updated-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

/* 列表视图 */
.projects-list {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.list-header {
  display: grid;
  grid-template-columns: 2fr 120px 120px 100px 180px 160px 180px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.list-row {
  display: grid;
  grid-template-columns: 2fr 120px 120px 100px 180px 160px 180px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  align-items: center;
  cursor: pointer;
  transition: background 0.1s;
}

.list-row:hover {
  background: var(--bg-tertiary);
}

.list-row:last-child {
  border-bottom: none;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-info .name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 13px;
}

.name-info .code {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', monospace;
}

.table-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.table-stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-icon-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: white;
  flex-shrink: 0;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 16px;
}

.empty-state .el-icon {
  font-size: 48px;
  opacity: 0.3;
}

.empty-state h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.empty-state .el-button {
  margin-top: 8px;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .projects-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .projects-view {
    padding: 16px;
  }

  .projects-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .header-right {
    justify-content: flex-end;
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-row > * {
    width: 100%;
  }

  .list-header,
  .list-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .list-col {
    display: flex;
    justify-content: space-between;
  }

  .list-col::before {
    content: attr(data-label);
    font-weight: 500;
    color: var(--text-tertiary);
    font-size: 11px;
  }
}
</style>