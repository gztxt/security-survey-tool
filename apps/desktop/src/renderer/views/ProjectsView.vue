<template>
  <div class="projects-view">
    <div class="projects-header">
      <div class="header-left">
        <h1 class="page-title">项目管理</h1>
        <p class="page-subtitle">管理所有安防勘察布线项目</p>
      </div>
      <div class="header-right">
        <el-button @click="refreshProjects" icon="Refresh" size="small">刷新</el-button>
        <el-button @click="pickProjectFile" icon="FolderOpened" size="small">打开项目文件</el-button>
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
          <el-option label="未保存到磁盘" value="unsaved" />
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
      >
        <div class="card-header">
          <div class="project-icon" :style="{ background: typeColor(project.type) }">
            <el-icon><component :is="typeIcon(project.type)" /></el-icon>
          </div>
          <!-- @click.stop：卡片整体绑定了"打开项目"，不阻断冒泡时，点"⋯"会先跳进
               项目页、顺带把刚展开的下拉菜单连同宿主卡片一起卸载 ⇒ 网格视图的
               复制/导出/归档/删除菜单实际点不到（实测：点触发器后 URL 变成项目页）。 -->
          <div class="card-actions" @click.stop>
            <el-dropdown trigger="click">
              <el-button size="small" circle link>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click.stop="openProject(project.id)"><el-icon><Edit /></el-icon> 打开</el-dropdown-item>
                  <el-dropdown-item @click.stop="duplicateProject(project.id)"><el-icon><CopyDocument /></el-icon> 复制</el-dropdown-item>
                  <el-dropdown-item @click.stop="exportProject(project.id)"><el-icon><Download /></el-icon> 导出</el-dropdown-item>
                  <el-dropdown-item divided @click.stop="toggleArchive(project)"><el-icon><Box /></el-icon>{{ project.archived ? '取消归档' : '归档' }}</el-dropdown-item>
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
            <span>{{ project.cableCount }} 线路</span>
          </div>
        </div>

        <div class="card-footer">
          <el-tag :type="archived(project) ? 'info' : 'success'" size="small" effect="light">
            {{ archived(project) ? '已归档' : stageLabel(project) }}
          </el-tag>
          <el-tag v-if="!project.path" type="warning" size="small" effect="plain">未保存</el-tag>
          <span class="updated-time">{{ formatRelativeTime(project.updatedAt) }}</span>
        </div>

        <div v-if="!archived(project)" class="progress-bar">
          <el-tooltip :content="'下一步：' + stageHint(project)" placement="top">
            <el-progress :percentage="stageProgress(project)" :stroke-width="4" :show-text="false" color="#3b82f6" />
          </el-tooltip>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredProjects.length === 0" class="empty-state">
        <el-icon><FolderOpened /></el-icon>
        <h3>{{ searchQuery || filterStatus || filterType ? '没有匹配的项目' : '暂无项目' }}</h3>
        <p>{{ searchQuery || filterStatus || filterType ? '尝试调整搜索条件' : '点击「新建项目」创建第一个项目，或用「打开项目文件」载入已有 .survey 项目' }}</p>
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
      >
        <div class="list-col col-name">
          <div class="project-icon-sm" :style="{ background: typeColor(project.type) }">
            <el-icon><component :is="typeIcon(project.type)" /></el-icon>
          </div>
          <div class="name-info">
            <span class="name">{{ project.name }}</span>
            <span v-if="project.code" class="code">{{ project.code }}</span>
          </div>
        </div>
        <div class="list-col col-code">{{ project.code || '—' }}</div>
        <div class="list-col col-type">{{ getTypeLabel(project.type) }}</div>
        <div class="list-col col-status">
          <el-tag :type="archived(project) ? 'info' : 'success'" size="small" effect="light">{{ archived(project) ? '已归档' : stageLabel(project) }}</el-tag>
        </div>
        <div class="list-col col-stats">
          <span class="stat">{{ project.drawingCount }} 图</span>
          <span class="stat">{{ project.deviceCount }} 设备</span>
          <span class="stat">{{ project.cableCount }} 线</span>
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
    <el-table v-else-if="viewMode === 'table'" :data="paginatedProjects" border size="small" style="width: 100%" row-key="id" highlight-current-row @row-dblclick="openProjectRow">
      <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <div class="table-name">
            <div class="project-icon-sm" :style="{ background: typeColor(scope.row.type) }">
              <el-icon><component :is="typeIcon(scope.row.type)" /></el-icon>
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
          <el-tag :type="archived(scope.row) ? 'info' : 'success'" size="small" effect="light">{{ archived(scope.row) ? '已归档' : stageLabel(scope.row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="图纸/设备/线路" width="180">
        <template #default="scope">
          <div class="table-stats">
            <span><el-icon><FolderOpened /></el-icon>{{ scope.row.drawingCount }}</span>
            <span><el-icon><Monitor /></el-icon>{{ scope.row.deviceCount }}</span>
            <span><el-icon><Link /></el-icon>{{ scope.row.cableCount }}</span>
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
        v-model:page-size="pageSize"
        :total="filteredProjects.length"
        layout="prev, pager, next, sizes, total"
        :page-sizes="[12, 24, 48, 96]"
        size="small"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  More, Edit, CopyDocument, Download, Box, Delete,
  FolderOpened, Monitor, Link, Grid, VideoCamera, Lock
} from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/project';

const router = useRouter();
const projectStore = useProjectStore();

const searchQuery = ref('');
const filterStatus = ref('');
const filterType = ref('');
const filterDateRange = ref<[string, string] | null>(null);
const viewMode = ref<'grid' | 'list' | 'table'>('grid');
const sortBy = ref('updated-desc');
const currentPage = ref(1);
const pageSize = ref(12);

// 真实数据源：项目索引（保存项目时由 store 写入 localStorage:projects-index）。
// 这里曾经是 generateMockProjects() 编造的 28 个假项目 —— 用户真实保存的项目
// 一个都不显示，等于整个"打开最近项目"环节是断头路。
type ProjectItem = Record<string, any>;
const allProjects = computed<ProjectItem[]>(() => projectStore.projectIndex.map(p => ({ ...p })));

const filteredProjects = computed(() => {
  let result = [...allProjects.value];

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    );
  }

  // 状态 = 归档态 + 是否已落盘。刻意没有"已完成"：数据模型里没有它的真相源，
  // 一个所有人都能满足或不满足的筛选器是噪音。
  if (filterStatus.value === 'active') result = result.filter(p => !p.archived);
  if (filterStatus.value === 'archived') result = result.filter(p => !!p.archived);
  if (filterStatus.value === 'unsaved') result = result.filter(p => !p.path);

  if (filterType.value) {
    // 无类型的历史项目归入"自定义"，与 getTypeLabel 的兜底口径一致
    result = result.filter(p => (p.type || 'custom') === filterType.value);
  }

  if (filterDateRange.value) {
    const [start, end] = filterDateRange.value;
    result = result.filter(p => {
      const d = String(p.updatedAt).slice(0, 10);
      return d >= start && d <= end;
    });
  }

  const ts = (p: any) => new Date(p.updatedAt).getTime() || 0;
  const cts = (p: any) => (typeof p.createdAt === 'number' ? p.createdAt : new Date(p.createdAt).getTime()) || 0;
  switch (sortBy.value) {
    case 'updated-desc': result.sort((a, b) => ts(b) - ts(a)); break;
    case 'updated-asc': result.sort((a, b) => ts(a) - ts(b)); break;
    case 'created-desc': result.sort((a, b) => cts(b) - cts(a)); break;
    case 'created-asc': result.sort((a, b) => cts(a) - cts(b)); break;
    case 'name-asc': result.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN')); break;
    case 'name-desc': result.sort((a, b) => String(b.name).localeCompare(String(a.name), 'zh-CN')); break;
  }

  return result;
});

const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredProjects.value.slice(start, start + pageSize.value);
});

watch([searchQuery, filterStatus, filterType, filterDateRange, sortBy, pageSize], () => {
  // 换筛选条件或换每页条数后，旧页码可能已越界（表现为"列表空白但计数说共 30 个"）
  currentPage.value = 1;
});

// ============ 展示辅助 ============

const TYPE_LABELS: Record<string, string> = {
  'integrated-security': '标准安防',
  'video-surveillance': '视频监控',
  'perimeter-alarm': '周界报警',
  'access-control': '门禁考勤',
  'custom': '自定义',
};
function getTypeLabel(type?: string) {
  return TYPE_LABELS[type || ''] || '自定义';
}
function typeIcon(type?: string) {
  const map: Record<string, any> = {
    'integrated-security': Grid,
    'video-surveillance': VideoCamera,
    'perimeter-alarm': Link,
    'access-control': Lock,
  };
  return map[type || ''] || FolderOpened;
}
function typeColor(type?: string) {
  const map: Record<string, string> = {
    'integrated-security': '#3b82f6',
    'video-surveillance': '#10b981',
    'perimeter-alarm': '#f59e0b',
    'access-control': '#8b5cf6',
  };
  return map[type || ''] || '#64748b';
}

function archived(p: any) {
  return !!p.archived;
}

/**
 * 项目阶段：与 store.workflowStep 同一口径（校准 → ≥2 设备 → 有线缆），
 * 区别是这里按"全部图纸"聚合，而 workflowStep 针对当前图纸。
 * 索引里有 calibratedDrawingCount/deviceCount/cableCount，够算且是落盘真值，
 * 不需要（也不应该）凭 updatedAt 猜。
 */
function stageOf(p: any): 'basemap' | 'devices' | 'wiring' | 'export' {
  if (!p.calibratedDrawingCount) return 'basemap';
  if (!p.deviceCount || p.deviceCount < 2) return 'devices';
  if (!p.cableCount) return 'wiring';
  return 'export';
}
const STAGE_LABELS = { basemap: '导入底图', devices: '添加点位', wiring: '标注线路', export: '生成导出' } as const;
const STAGE_HINTS: Record<string, string> = {
  basemap: '还有图纸未导入底图/校准，长度数据不可信',
  devices: '底图就绪，开始布置摄像头/交换机/机柜',
  wiring: '画线标注网络线路走向',
  export: '四步就绪，可生成图纸与材料表',
};
function stageLabel(p: any) {
  return STAGE_LABELS[stageOf(p)];
}
function stageHint(p: any) {
  return STAGE_HINTS[stageOf(p)];
}
function stageProgress(p: any) {
  return { basemap: 25, devices: 50, wiring: 75, export: 100 }[stageOf(p)];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * 相对时间依赖"现在是几点"，而 Vue 只会追踪显式读取的响应式源。
 * 读一下 tick 把它纳入依赖，"刷新"按钮才有实际作用（否则点了什么都不变，
 * 又是一个只弹 toast 的假按钮）。
 */
const tick = ref(Date.now());

function formatRelativeTime(dateStr: string) {
  void tick.value;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

// ============ 动作（全部走 store 真实实现，禁止假成功提示） ============

function createNewProject() {
  router.push({ name: 'ProjectCreate' });
}

async function openProject(projectId: string) {
  const res = await projectStore.openProjectById(projectId);
  if (!res.ok) {
    ElMessage.warning(res.error || '无法打开该项目');
    return;
  }
  router.push({ name: 'project', params: { id: projectId } });
}

function openProjectRow(row: any) {
  if (row?.id) openProject(row.id);
}

async function duplicateProject(projectId: string) {
  const res = await projectStore.duplicateProject(projectId);
  if (!res.ok) {
    ElMessage.warning(res.error || '复制失败');
    return;
  }
  ElMessage.success('已复制为副本（尚未保存，保存时会另存为新文件）');
  router.push({ name: 'project', params: { id: res.newId } });
}

async function exportProject(projectId: string) {
  const res = await projectStore.exportProject(projectId);
  if (!res.ok) ElMessage.warning(res.error || '导出失败');
  else ElMessage.success('项目文件已开始下载（.survey.json）');
}

async function toggleArchive(p: any) {
  if (!p.archived) {
    try {
      await ElMessageBox.confirm('归档后项目从"进行中"列表隐藏，随时可取消归档。不影响磁盘文件。', '确认归档', {
        confirmButtonText: '归档', cancelButtonText: '取消', type: 'warning',
      });
    } catch { return; }
  }
  if (projectStore.setProjectArchived(p.id, !p.archived)) {
    ElMessage.success(p.archived ? '已取消归档' : '已归档');
  } else {
    ElMessage.error('项目已不在列表中，请刷新');
  }
}

async function deleteProject(projectId: string) {
  const item = allProjects.value.find(p => p.id === projectId);
  if (!item) return;
  // 说清楚"删的是列表记录，不是磁盘文件"，否则用户会以为工程被连带删除（或反过来以为磁盘文件也没了）
  const where = item.path ? `磁盘上的项目文件不会被删除：${item.path}` : '该项目还没有磁盘文件，只有一条列表记录';
  try {
    await ElMessageBox.confirm(`将从项目列表移除「${item.name}」。${where}。此操作不可恢复。`, '确认删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'error',
    });
  } catch { return; }
  projectStore.deleteProject(projectId);
  if (item.path) ElMessage.success('已从列表删除（磁盘上的 .survey 文件未删除，如需清理请手动删除该文件）');
  else ElMessage.success('项目已删除');
}

/** 载入一个磁盘上的 .survey 项目文件（此前全站没有"打开已有文件"入口） */
async function pickProjectFile() {
  const api = (window as any).api;
  if (!api?.fs?.showOpenDialog) {
    ElMessage.warning('当前环境不支持文件对话框，请在应用内打开');
    return;
  }
  try {
    const res = await api.fs.showOpenDialog({
      title: '打开项目文件',
      filters: [{ name: '勘点项目', extensions: ['survey'] }],
    });
    // 主进程透传 dialog.showOpenDialog 的结果，字段名是 filePaths（不是 paths）
    const path = res?.canceled ? null : (res?.filePaths?.[0] || null);
    if (!path) return;
    const text = await api.fs.readFile(path);
    if (!text) throw new Error('无法读取文件');
    const project = JSON.parse(text);
    if (!project?.drawings) throw new Error('不是有效的勘点项目文件');
    if (projectStore.isDirty) {
      ElMessage.warning('当前项目有未保存的修改，请先保存后再打开');
      return;
    }
    await projectStore.loadProject(path);
    router.push({ name: 'project', params: { id: project.id } });
  } catch (e: any) {
    ElMessage.error(`打开失败：${e?.message || e}`);
  }
}

function refreshProjects() {
  // 数据源是响应式 computed，本来就会自动更新；刷新按钮只做一次显式重读，
  // 顺手把相对时间（"3天前"）这类依赖当前时刻的文案重新求值。
  tick.value = Date.now();
  ElMessage.success('已刷新');
}



function clearFilters() {
  searchQuery.value = '';
  filterStatus.value = '';
  filterType.value = '';
  filterDateRange.value = null;
  currentPage.value = 1;
}
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