<template>
  <div class="device-library-view">
    <div class="library-header">
      <div class="header-left">
        <h1 class="page-title">设备库</h1>
        <p class="page-subtitle">管理内置与自定义设备型号，支持 FOV 参数配置与批量部署</p>
      </div>
      <div class="header-right">
        <el-button @click="importDevices" icon="Upload" size="small">导入设备</el-button>
        <el-button @click="exportDevices" icon="Download" size="small">导出设备</el-button>
        <el-button type="primary" @click="openDeviceForm" icon="Plus" size="small">新建设备</el-button>
      </div>
    </div>

    <!-- 搜索过滤栏 -->
    <el-card class="filter-bar" shadow="never" style="margin-bottom: 16px">
      <div class="filter-row">
        <el-input
          v-model="searchQuery"
          placeholder="搜索设备名称、型号、厂商..."
          size="small"
          prefix-icon="Search"
          clearable
          style="width: 300px"
        />
        <el-select v-model="filterCategory" placeholder="全部分类" size="small" style="width: 160px">
          <el-option label="全部" value="" />
          <el-option label="摄像机" value="camera" />
          <el-option label="报警探测器" value="alarm" />
          <el-option label="门禁设备" value="access" />
          <el-option label="布线设备" value="wiring" />
          <el-option label="传输设备" value="transmission" />
          <el-option label="存储设备" value="storage" />
          <el-option label="显示设备" value="display" />
          <el-option label="控制设备" value="control" />
          <el-option label="电源设备" value="power" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-select v-model="filterSource" placeholder="来源" size="small" style="width: 140px">
          <el-option label="全部" value="" />
          <el-option label="内置" value="builtin" />
          <el-option label="自定义" value="custom" />
        </el-select>
        <el-select v-model="filterFov" placeholder="FOV 支持" size="small" style="width: 140px">
          <el-option label="全部" value="" />
          <el-option label="支持" value="true" />
          <el-option label="不支持" value="false" />
        </el-select>
        <el-button @click="clearFilters" size="small">重置</el-button>
      </div>
    </el-card>

    <!-- 分类侧边栏 + 设备列表 -->
    <div class="library-layout">
      <!-- 左侧分类树 -->
      <el-card class="category-sidebar" shadow="never">
        <div class="sidebar-header">
          <h3>设备分类</h3>
          <el-button size="small" link @click="expandAllCategories">
            <el-icon><Expand /></el-icon> 展开全部
          </el-button>
        </div>

        <el-tree
          :data="categoryTree"
          :props="treeProps"
          :default-expanded-keys="expandedKeys"
          @node-click="onCategoryClick"
          show-checkbox
          @check-change="onCategoryCheck"
          highlight-current
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <el-icon v-if="data.icon"><component :is="data.icon" /></el-icon>
              <span class="node-label">{{ data.label }}</span>
              <el-tag v-if="data.count > 0" size="small" effect="light" :type="data.type">{{ data.count }}</el-tag>
            </span>
          </template>
        </el-tree>
      </el-card>

      <!-- 右侧设备列表 -->
      <div class="device-list-area" :class="{ 'has-sidebar': true }">
        <!-- 视图切换 -->
        <div class="list-toolbar">
          <el-radio-group v-model="listViewMode" size="small" button-style="solid">
            <el-radio-button value="grid" title="网格视图">网格</el-radio-button>
            <el-radio-button value="list" title="列表视图">列表</el-radio-button>
            <el-radio-button value="table" title="表格视图">表格</el-radio-button>
          </el-radio-group>

          <div class="toolbar-right">
            <el-select v-model="sortBy" placeholder="排序" size="small" style="width: 160px">
              <el-option label="名称 A-Z" value="name-asc" />
              <el-option label="名称 Z-A" value="name-desc" />
              <el-option label="分类" value="category" />
              <el-option label="厂商" value="manufacturer" />
              <el-option label="最近更新" value="updated-desc" />
            </el-select>
            <span class="device-count">{{ filteredDevices.length }} 个设备</span>
          </div>
        </div>

        <!-- 网格视图 -->
        <div v-if="listViewMode === 'grid'" class="devices-grid">
          <div
            v-for="device in paginatedDevices"
            :key="device.id"
            class="device-card"
            @click="selectDevice(device)"
            @contextmenu.prevent="showDeviceContextMenu(device, $event)"
            :class="{ selected: selectedDeviceId === device.id }"
          >
            <div class="card-image">
              <img v-if="device.image" :src="device.image" :alt="device.name" />
              <div v-else class="icon-placeholder">
                <span>{{ device.name.slice(0, 1) }}</span>
              </div>
              <el-tag v-if="device.source === 'builtin'" class="source-tag builtin" effect="light">内置</el-tag>
              <el-tag v-else class="source-tag custom" effect="light">自定义</el-tag>
            </div>

            <div class="card-content">
              <h4 class="device-name" :title="device.name">{{ device.name }}</h4>
              <p class="device-model" :title="device.model">{{ device.model }}</p>

              <div class="device-tags">
                <el-tag size="small" :type="getCategoryType(device.category)">{{ getCategoryLabel(device.category) }}</el-tag>
                <el-tag v-if="device.manufacturer" size="small" effect="light">{{ device.manufacturer }}</el-tag>
              </div>

              <div class="device-params" v-if="device.fovSupported">
                <span class="param" title="水平视角">
                  <el-icon><Monitor /></el-icon>
                  {{ device.hFov }}°
                </span>
                <span class="param" title="垂直视角">
                  <el-icon><Monitor /></el-icon>
                  {{ device.vFov }}°
                </span>
                <span class="param" title="最大距离">
                  <el-icon><ScaleToOriginal /></el-icon>
                  {{ device.maxDistance }}m
                </span>
              </div>

              <div class="device-params" v-else>
                <el-tag size="small" effect="dark" style="background: var(--bg-tertiary); color: var(--text-tertiary)">无 FOV</el-tag>
              </div>
            </div>

            <div class="card-actions">
              <el-dropdown trigger="click">
                <el-button size="small" circle link>
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click.stop="selectDevice(device); editDevice(device)"><el-icon><Edit /></el-icon> 编辑</el-dropdown-item>
                    <el-dropdown-item @click.stop="selectDevice(device); cloneDevice(device)"><el-icon><CopyDocument /></el-icon> 复制</el-dropdown-item>
                    <el-dropdown-item @click.stop="placeDevice(device)"><el-icon><AddLocation /></el-icon> 放置到画布</el-dropdown-item>
                    <el-dropdown-item divided @click.stop="deleteDevice(device.id)" class="danger"><el-icon><Delete /></el-icon> 删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="filteredDevices.length === 0" class="empty-state">
            <el-icon><Box /></el-icon>
            <h3>{{ searchQuery || filterCategory || filterSource ? '没有匹配的设备' : '设备库为空' }}</h3>
            <p>{{ searchQuery || filterCategory || filterSource ? '尝试调整筛选条件' : '点击「新建设备」添加第一个设备，或导入设备库' }}</p>
            <el-button v-if="!(searchQuery || filterCategory || filterSource)" type="primary" @click="openDeviceForm" icon="Plus">新建设备</el-button>
            <el-button v-else @click="clearFilters">清除筛选</el-button>
          </div>
        </div>

        <!-- 列表视图 -->
        <div v-else-if="listViewMode === 'list'" class="devices-list">
          <div
            v-for="device in paginatedDevices"
            :key="device.id"
            class="device-list-item"
            @click="selectDevice(device)"
            @contextmenu.prevent="showDeviceContextMenu(device, $event)"
            :class="{ selected: selectedDeviceId === device.id }"
          >
            <div class="item-icon" :style="{ background: device.color || getCategoryColor(device.category) }">
              <component :is="device.icon" />
            </div>
            <div class="item-info">
              <div class="item-main">
                <span class="item-name">{{ device.name }}</span>
                <el-tag v-if="device.source === 'builtin'" size="small" effect="light" class="builtin-tag">内置</el-tag>
                <el-tag v-else size="small" effect="light" class="custom-tag">自定义</el-tag>
              </div>
              <div class="item-sub">
                <span class="item-model">{{ device.model }}</span>
                <span class="item-mfg" v-if="device.manufacturer">{{ device.manufacturer }}</span>
                <el-tag size="small" :type="getCategoryType(device.category)" style="margin-left: 8px">{{ getCategoryLabel(device.category) }}</el-tag>
              </div>
            </div>
            <div class="item-fov" v-if="device.fovSupported">
              <span class="fov-tag">{{ device.hFov }}° × {{ device.vFov }}°</span>
              <span class="dist-tag">{{ device.maxDistance }}m</span>
            </div>
            <div class="item-fov" v-else>
              <el-tag size="small" effect="dark" style="background: var(--bg-tertiary)">无 FOV</el-tag>
            </div>
            <div class="item-actions">
              <el-dropdown trigger="click">
                <el-button size="small" circle link><el-icon><More /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click.stop="selectDevice(device); editDevice(device)"><el-icon><Edit /></el-icon> 编辑</el-dropdown-item>
                    <el-dropdown-item @click.stop="selectDevice(device); cloneDevice(device)"><el-icon><CopyDocument /></el-icon> 复制</el-dropdown-item>
                    <el-dropdown-item @click.stop="placeDevice(device)"><el-icon><AddLocation /></el-icon> 放置</el-dropdown-item>
                    <el-dropdown-item divided @click.stop="deleteDevice(device.id)" class="danger"><el-icon><Delete /></el-icon> 删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>

        <!-- 表格视图 -->
        <div v-else class="devices-table">
          <el-table
            :data="paginatedDevices"
            border
            size="small"
            style="width: 100%"
            row-key="id"
            highlight-current-row
            @row-click="selectDevice"
            @row-contextmenu="showDeviceContextMenu"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="model" label="型号" width="150" show-overflow-tooltip />
            <el-table-column prop="manufacturer" label="厂商" width="130" show-overflow-tooltip />
            <el-table-column label="分类" width="120">
              <template #default="scope">
                <el-tag :type="getCategoryType(scope.row.category)" size="small">{{ getCategoryLabel(scope.row.category) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="FOV" width="160">
              <template #default="scope">
                <span v-if="scope.row.fovSupported">{{ scope.row.hFov }}° × {{ scope.row.vFov }}° / {{ scope.row.maxDistance }}m</span>
                <el-tag v-else size="small" effect="dark" style="background: var(--bg-tertiary)">—</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="80">
              <template #default="scope">
                <el-tag v-if="scope.row.source === 'builtin'" size="small" effect="light">内置</el-tag>
                <el-tag v-else size="small" effect="light" type="success">自定义</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="150">
              <template #default="scope">
                {{ formatDate(scope.row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column fixed="right" label="操作" width="120">
              <template #default="scope">
                <el-dropdown trigger="click" size="small">
                  <el-button link><el-icon><More /></el-icon></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click.stop="editDevice(scope.row)"><el-icon><Edit /></el-icon> 编辑</el-dropdown-item>
                      <el-dropdown-item @click.stop="cloneDevice(scope.row)"><el-icon><CopyDocument /></el-icon> 复制</el-dropdown-item>
                      <el-dropdown-item @click.stop="placeDevice(scope.row)"><el-icon><AddLocation /></el-icon> 放置</el-dropdown-item>
                      <el-dropdown-item divided @click.stop="deleteDevice(scope.row.id)" class="danger"><el-icon><Delete /></el-icon> 删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 分页 -->
        <div class="pagination" v-if="totalPages > 1">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="filteredDevices.length"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            size="small"
            background
          />
        </div>
      </div>
    </div>

    <!-- 设备编辑/新建对话框 -->
    <el-dialog
      v-model="deviceDialogVisible"
      :title="editingDevice ? '编辑设备' : '新建设备'"
      width="720px"
      :before-close="handleDialogClose"
      destroy-on-close
    >
      <el-form ref="deviceFormRef" :model="deviceForm" :rules="deviceRules" label-width="120px" size="default">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="设备名称" prop="name" required>
              <el-input v-model="deviceForm.name" placeholder="例如：400万像素红外定焦半球网络摄像机" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="型号" prop="model" required>
              <el-input v-model="deviceForm.model" placeholder="例如：IPC-HDW2431T-AS-S2" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="category" required>
              <el-select v-model="deviceForm.category" placeholder="选择分类" style="width: 100%">
                <el-option label="摄像机" value="camera" />
                <el-option label="报警探测器" value="alarm" />
                <el-option label="门禁设备" value="access" />
                <el-option label="布线设备" value="wiring" />
                <el-option label="传输设备" value="transmission" />
                <el-option label="存储设备" value="storage" />
                <el-option label="显示设备" value="display" />
                <el-option label="控制设备" value="control" />
                <el-option label="电源设备" value="power" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="厂商" prop="manufacturer">
              <el-input v-model="deviceForm.manufacturer" placeholder="例如：大华/海康/宇视/汉邦高科" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="图标颜色" prop="color">
              <el-color-picker v-model="deviceForm.color" show-alpha predefine />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="图标" prop="icon">
              <div class="icon-picker">
                <div class="current-icon" :style="{ background: deviceForm.color }" @click="openIconPicker">
                  <component :is="deviceForm.icon" style="color: white" />
                </div>
                <el-button size="small" @click="openIconPicker">选择图标</el-button>
              </div>
            </el-form-item>
          </el-col>

          <!-- FOV 参数 -->
          <el-col :span="24">
            <el-form-item label="FOV 支持" prop="fovSupported">
              <el-switch v-model="deviceForm.fovSupported" :inline-prompt="{ on: '是', off: '否' }" />
            </el-form-item>
          </el-col>

          <el-col :span="8" v-if="deviceForm.fovSupported">
            <el-form-item label="水平视角 (°)" prop="hFov">
              <el-input-number v-model="deviceForm.hFov" :min="1" :max="360" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8" v-if="deviceForm.fovSupported">
            <el-form-item label="垂直视角 (°)" prop="vFov">
              <el-input-number v-model="deviceForm.vFov" :min="1" :max="180" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8" v-if="deviceForm.fovSupported">
            <el-form-item label="最大距离 (m)" prop="maxDistance">
              <el-input-number v-model="deviceForm.maxDistance" :min="1" :max="1000" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>

          <!-- 规格参数 -->
          <el-col :span="24">
            <el-form-item label="规格参数">
              <el-tag
                v-for="spec in deviceForm.specs"
                :key="spec.key"
                closable
                @close="removeSpec(spec.key)"
                style="margin: 4px"
              >
                {{ spec.key }}: {{ spec.value }}
              </el-tag>
              <el-button size="small" @click="addSpec" icon="Plus">添加参数</el-button>
            </el-form-item>
          </el-col>

          <!-- 尺寸与安装 -->
          <el-col :span="8">
            <el-form-item label="宽度 (mm)" prop="width">
              <el-input-number v-model="deviceForm.width" :min="1" :max="5000" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="高度 (mm)" prop="height">
              <el-input-number v-model="deviceForm.height" :min="1" :max="5000" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="深度 (mm)" prop="depth">
              <el-input-number v-model="deviceForm.depth" :min="1" :max="5000" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="重量 (g)" prop="weight">
              <el-input-number v-model="deviceForm.weight" :min="0" :max="100000" :step="10" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="安装方式" prop="mountType">
              <el-select v-model="deviceForm.mountType" placeholder="选择方式" style="width: 100%">
                <el-option label="吊装" value="ceiling" />
                <el-option label="壁装" value="wall" />
                <el-option label="立杆" value="pole" />
                <el-option label="嵌入" value="recessed" />
                <el-option label="桌面" value="desktop" />
                <el-option label="机架" value="rack" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="供电方式" prop="powerType">
              <el-select v-model="deviceForm.powerType" placeholder="选择方式" style="width: 100%">
                <el-option label="PoE" value="poe" />
                <el-option label="DC 12V" value="dc12v" />
                <el-option label="DC 24V" value="dc24v" />
                <el-option label="AC 220V" value="ac220v" />
                <el-option label="电池" value="battery" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>

          <!-- 备注 -->
          <el-col :span="24">
            <el-form-item label="备注" prop="description">
              <el-input v-model="deviceForm.description" type="textarea" :rows="3" placeholder="补充说明..." maxlength="500" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deviceDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveDevice" :loading="savingDevice">{{ editingDevice ? '保存' : '创建' }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 图标选择器 -->
    <el-dialog v-model="iconPickerVisible" title="选择图标" width="600px">
      <div class="icon-grid">
        <div
          v-for="icon in availableIcons"
          :key="icon"
          class="icon-option"
          :class="{ selected: deviceForm.icon === icon }"
          @click="deviceForm.icon = icon; iconPickerVisible = false"
        >
          <component :is="icon" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Upload, Download, Plus, Search, Expand,
  Edit, CopyDocument, AddLocation, Delete, More, Monitor, ScaleToOriginal, Box,
} from '@element-plus/icons-vue';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';
import { BUILTIN_DEVICES } from '@security-survey/device-lib';
import type { DeviceModel } from '@security-survey/shared-types';

const deviceStore = useDeviceLibraryStore();

const props = defineProps<{}>();
const emit = defineEmits<{ 'place-device': [device: any] }>();

// 旧视图字段兼容：把 DeviceModel 映射为本模板期望的展示结构
const builtinIds = new Set(BUILTIN_DEVICES.map(x => x.id));
function normalizeDevice(d: DeviceModel): any {
  const specs: any = d.specs || {};
  return {
    ...d,
    model: d.type,
    manufacturer: d.vendor,
    source: builtinIds.has(d.id) ? 'builtin' : 'custom',
    image: d.icon?.type === 'svg' && d.icon.svg ? d.icon.svg : '',
    fovSupported: !!(specs.hFov || specs.vFov),
    hFov: specs.hFov ?? '-',
    vFov: specs.vFov ?? '-',
    maxDistance: specs.maxDistance ?? specs.range ?? '-',
    color: d.icon?.color || '#3b82f6',
  };
}

// 状态
const searchQuery = ref('');
const filterCategory = ref('');
const filterSource = ref('');
const filterFov = ref('');
const listViewMode = ref<'grid' | 'list' | 'table'>('grid');
const sortBy = ref('name-asc');
const currentPage = ref(1);
const pageSize = ref(20);
const selectedDeviceId = ref<string | null>(null);

// 对话框
const deviceDialogVisible = ref(false);
const editingDevice = ref<any>(null);
const savingDevice = ref(false);
const deviceFormRef = ref<any>();
const iconPickerVisible = ref(false);

// 表单
const deviceForm = ref({
  id: '',
  name: '',
  model: '',
  category: 'camera',
  manufacturer: '',
  color: '#3b82f6',
  icon: 'Monitor',
  fovSupported: true,
  hFov: 90,
  vFov: 50,
  maxDistance: 50,
  specs: [] as { key: string; value: string }[],
  width: 100,
  height: 100,
  depth: 100,
  weight: 500,
  mountType: 'ceiling',
  powerType: 'poe',
  description: '',
  source: 'custom',
  createdAt: '',
  updatedAt: '',
});

const deviceRules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
};

// 分类树
const categoryTree = ref([
  { id: 'camera', label: '摄像机', icon: 'Monitor', type: 'primary', count: 0, children: [
    { id: 'camera-bullet', label: '枪机', count: 0 },
    { id: 'camera-dome', label: '半球', count: 0 },
    { id: 'camera-ptz', label: '球机', count: 0 },
    { id: 'camera-pano', label: '全景', count: 0 },
    { id: 'camera-thermal', label: '热成像', count: 0 },
  ]},
  { id: 'alarm', label: '报警探测器', icon: 'Bell', type: 'warning', count: 0, children: [
    { id: 'alarm-ir', label: '红外对射', count: 0 },
    { id: 'alarm-laser', label: '激光对射', count: 0 },
    { id: 'alarm-fence', label: '电子围栏', count: 0 },
    { id: 'alarm-vibration', label: '振动光缆', count: 0 },
  ]},
  { id: 'access', label: '门禁设备', icon: 'Lock', type: 'success', count: 0, children: [
    { id: 'access-controller', label: '控制器', count: 0 },
    { id: 'access-reader', label: '读头', count: 0 },
    { id: 'access-lock', label: '电锁', count: 0 },
    { id: 'access-button', label: '出门按钮', count: 0 },
  ]},
  { id: 'wiring', label: '布线设备', icon: 'Link', type: 'info', count: 0, children: [
    { id: 'wiring-tray', label: '桥架', count: 0 },
    { id: 'wiring-conduit', label: '管道', count: 0 },
    { id: 'wiring-well', label: '弱电井', count: 0 },
    { id: 'wiring-box', label: '接线盒', count: 0 },
  ]},
  { id: 'transmission', label: '传输设备', icon: 'Connection', type: 'primary', count: 0, children: [
    { id: 'trans-switch', label: '交换机', count: 0 },
    { id: 'trans-fiber', label: '光纤收发器', count: 0 },
    { id: 'trans-wireless', label: '无线桥接', count: 0 },
  ]},
  { id: 'storage', label: '存储设备', icon: 'HardDisk', type: 'warning', count: 0 },
  { id: 'display', label: '显示设备', icon: 'Monitor', type: 'success', count: 0 },
  { id: 'control', label: '控制设备', icon: 'Cpu', type: 'info', count: 0 },
  { id: 'power', label: '电源设备', icon: 'Battery', type: 'danger', count: 0 },
  { id: 'other', label: '其他', icon: 'Box', type: 'default', count: 0 },
]);

const treeProps = {
  children: 'children',
  label: 'label',
  disabled: 'disabled',
};

const expandedKeys = ref(['camera', 'alarm', 'access', 'wiring']);

// 可用图标
const availableIcons = [
  'Monitor', 'Camera', 'VideoCamera', 'Cpu', 'Box', 'Lock', 'Key',
  'Link', 'Connection', 'Wifi', 'Signal', 'Battery', 'Lightning',
  'Bell', 'AlarmClock', 'Siren', 'Radar', 'Compass', 'Location',
  'Ruler', 'Scale', 'Temperature', 'Humidity', 'Wind', 'Rain',
  'Fire', 'Water', 'Gas', 'Smoke', 'Co2', 'Pm25',
  'Truck', 'Car', 'Bicycle', 'Person', 'User', 'Users',
  'Setting', 'Tools', 'Wrench', 'Screwdriver', 'Hammer',
  'Folder', 'File', 'Document', 'Picture', 'Video', 'Music',
  'Grid', 'Table', 'List', 'Tree', 'MindMap', 'FlowChart',
];

// 计算属性
const filteredDevices = computed(() => {
  let result = deviceStore.allDevices.map(normalizeDevice);

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      (d.manufacturer?.toLowerCase().includes(q))
    );
  }

  if (filterCategory.value) {
    result = result.filter(d => d.category === filterCategory.value);
  }

  if (filterSource.value) {
    result = result.filter(d => d.source === filterSource.value);
  }

  if (filterFov.value !== '') {
    result = result.filter(d => d.fovSupported === (filterFov.value === 'true'));
  }

  // 排序
  switch (sortBy.value) {
    case 'name-asc':
      result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      break;
    case 'name-desc':
      result.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
      break;
    case 'category':
      result.sort((a, b) => a.category.localeCompare(b.category));
      break;
    case 'manufacturer':
      result.sort((a, b) => (a.manufacturer || '').localeCompare(b.manufacturer || ''));
      break;
    case 'updated-desc':
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
  }

  return result;
});

const paginatedDevices = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredDevices.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() => Math.ceil(filteredDevices.value.length / pageSize.value));

// 方法
function onCategoryClick(data: any) {
  if (data.id && !data.children) {
    filterCategory.value = data.id;
  }
}

function onCategoryCheck(data: any, checked: boolean) {
  if (checked) {
    // 取消其他同级选中
  }
}

function expandAllCategories() {
  expandedKeys.value = categoryTree.value.flatMap(getAllIds);
}

function getAllIds(node: any): string[] {
  const ids = [node.id];
  if (node.children) {
    node.children.forEach((child: any) => ids.push(...getAllIds(child)));
  }
  return ids;
}

function clearFilters() {
  searchQuery.value = '';
  filterCategory.value = '';
  filterSource.value = '';
  filterFov.value = '';
}

function selectDevice(device: any) {
  selectedDeviceId.value = device.id;
}

function openDeviceForm(device?: any) {
  editingDevice.value = device || null;
  if (device) {
    deviceForm.value = { ...device };
  } else {
    deviceForm.value = {
      id: '',
      name: '',
      model: '',
      category: 'camera',
      manufacturer: '',
      color: '#3b82f6',
      icon: 'Monitor',
      fovSupported: true,
      hFov: 90,
      vFov: 50,
      maxDistance: 50,
      specs: [],
      width: 100,
      height: 100,
      depth: 100,
      weight: 500,
      mountType: 'ceiling',
      powerType: 'poe',
      description: '',
      source: 'custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  deviceDialogVisible.value = true;
}

async function saveDevice() {
  try {
    await deviceFormRef.value.validate();
  } catch (e) {
    return;
  }

  savingDevice.value = true;
  try {
    const formData = {
      ...deviceForm.value,
      updatedAt: new Date().toISOString(),
    };

    if (editingDevice.value) {
      deviceStore.updateCustomDevice(formData.id, formData as any);
      ElMessage.success('设备已更新');
    } else {
      formData.id = 'dev-' + Date.now();
      formData.createdAt = new Date().toISOString();
      deviceStore.addCustomDevice(formData as any);
      ElMessage.success('设备已创建');
    }
    deviceDialogVisible.value = false;
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    savingDevice.value = false;
  }
}

function handleDialogClose(done: () => void) {
  deviceFormRef.value?.resetFields();
  done();
}

function cloneDevice(device: any) {
  const newDevice = {
    ...device,
    id: 'dev-' + Date.now(),
    name: device.name + ' (副本)',
    source: 'custom',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  deviceStore.addCustomDevice(newDevice);
  ElMessage.success('设备已复制');
}

function deleteDevice(id: string) {
  ElMessageBox.confirm('确定要删除该设备吗？此操作不可撤销。', '确认删除', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    deviceStore.removeCustomDevice(id);
    if (selectedDeviceId.value === id) selectedDeviceId.value = null;
    ElMessage.success('设备已删除');
  }).catch(() => {});
}

function placeDevice(device: any) {
  emit('place-device', device);
  ElMessage.success('请在画布上点击放置位置');
}

function editDevice(device: any) {
  openDeviceForm(device);
}

function showDeviceContextMenu(device: any, event: MouseEvent) {
  // 右键菜单逻辑
}

function openIconPicker() {
  iconPickerVisible.value = true;
}

function addSpec() {
  const key = `param${deviceForm.value.specs.length + 1}`;
  deviceForm.value.specs.push({ key, value: '' });
}

function removeSpec(key: string) {
  deviceForm.value.specs = deviceForm.value.specs.filter(s => s.key !== key);
}

function importDevices() {
  ElMessage.info('导入功能开发中...');
}

function exportDevices() {
  ElMessage.info('导出功能开发中...');
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN');
}

function getCategoryLabel(cat: string) {
  const labels: Record<string, string> = {
    camera: '摄像机', alarm: '报警', access: '门禁', wiring: '布线',
    transmission: '传输', storage: '存储', display: '显示', control: '控制',
    power: '电源', other: '其他',
  };
  return labels[cat] || cat;
}

function getCategoryType(cat: string) {
  const types: Record<string, string> = {
    camera: 'primary', alarm: 'warning', access: 'success', wiring: 'info',
    transmission: 'primary', storage: 'warning', display: 'success',
    control: 'info', power: 'danger', other: 'default',
  };
  return types[cat] || 'default';
}

function getCategoryColor(cat: string) {
  const colors: Record<string, string> = {
    camera: '#3b82f6', alarm: '#f59e0b', access: '#10b981', wiring: '#06b6d4',
    transmission: '#8b5cf6', storage: '#f59e0b', display: '#10b981',
    control: '#06b6d4', power: '#ef4444', other: '#6b7280',
  };
  return colors[cat] || '#6b7280';
}

// 监听 store 变化
watch(() => deviceStore.allDevices, () => {
  // 更新分类计数
  updateCategoryCounts();
}, { immediate: true, deep: true });

function updateCategoryCounts() {
  const counts: Record<string, number> = {};
  for (const d of deviceStore.allDevices) {
    counts[d.category] = (counts[d.category] || 0) + 1;
  }

  function updateTree(nodes: any[]) {
    for (const node of nodes) {
      node.count = counts[node.id] || 0;
      if (node.children) updateTree(node.children);
    }
  }
  updateTree(categoryTree.value);
}

onMounted(() => {
  // 初始化分类计数
  updateCategoryCounts();
});
</script>

<style scoped>
.device-library-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  gap: 16px;
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
  flex-shrink: 0;
}

.filter-bar {
  margin: 0 24px 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.library-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  margin: 0 24px 24px;
}

.category-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.device-list-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.list-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px 8px 0 0;
  margin-bottom: -1px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.device-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 网格视图 */
.devices-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.device-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: #3b82f6;
}

.device-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.card-image {
  position: relative;
  aspect-ratio: 1;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder {
  color: var(--text-tertiary);
  font-size: 48px;
}

.source-tag {
  position: absolute;
  top: 8px;
  right: 8px;
}

.card-content {
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.device-name {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-model {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.device-params {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.param {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
}

.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}

.device-card:hover .card-actions {
  opacity: 1;
}

/* 列表视图 */
.devices-list {
  flex: 1;
  overflow-y: auto;
}

.device-list-item {
  display: grid;
  grid-template-columns: 48px 1fr 180px 140px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.1s;
  gap: 16px;
}

.device-list-item:hover {
  background: var(--bg-tertiary);
}

.device-list-item.selected {
  background: rgba(59, 130, 246, 0.05);
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: white;
  flex-shrink: 0;
}

.item-info {
  min-width: 0;
}

.item-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.item-model {
  font-family: 'SF Mono', monospace;
}

.item-fov {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.fov-tag {
  color: #3b82f6;
  font-weight: 500;
}

.dist-tag {
  color: var(--text-tertiary);
}

.item-actions {
  justify-self: end;
}

/* 表格视图 */
.devices-table {
  flex: 1;
  overflow: auto;
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
  grid-column: 1 / -1;
}

.empty-state .el-icon {
  font-size: 48px;
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0 0 16px;
  font-size: 13px;
}

/* 分页 */
.pagination {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

/* 对话框 */
.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  background: var(--bg-tertiary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text-secondary);
}

.icon-option:hover {
  background: #3b82f6;
  color: white;
}

.icon-option.selected {
  background: #3b82f6;
  color: white;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
}

.current-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  margin-right: 12px;
  vertical-align: middle;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 0 0;
}

/* 响应式 */
@media (max-width: 1024px) {
  .devices-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

@media (max-width: 768px) {
  .library-header {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }

  .header-right {
    justify-content: flex-end;
  }

  .library-layout {
    flex-direction: column;
    margin: 0 16px 16px;
  }

  .category-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    max-height: 300px;
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-row > * {
    width: 100%;
  }

  .device-list-item {
    grid-template-columns: 48px 1fr;
    grid-template-rows: auto auto;
  }

  .item-fov {
    grid-column: 2;
  }

  .item-actions {
    grid-column: 1 / -1;
    justify-self: start;
    padding-top: 8px;
  }
}
</style>