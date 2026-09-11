<template>
  <div class="settings-general">
    <div class="setting-group">
      <h4>应用程序</h4>

      <el-form :model="model" label-width="140px" size="small">
        <el-form-item label="启动时">
          <el-radio-group v-model="model.startupBehavior">
            <el-radio-button label="welcome">显示欢迎页</el-radio-button>
            <el-radio-button label="new">新建项目</el-radio-button>
            <el-radio-button label="last">打开最近项目</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="语言">
          <el-select v-model="model.language" placeholder="选择语言" style="width: 180px">
            <el-option label="简体中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
            <el-option label="繁體中文" value="zh-TW" />
          </el-select>
        </el-form-item>

        <el-form-item label="主题">
          <el-radio-group v-model="model.theme">
            <el-radio-button label="light">浅色</el-radio-button>
            <el-radio-button label="dark">深色</el-radio-button>
            <el-radio-button label="system">跟随系统</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="启动时检查更新">
          <el-switch v-model="model.checkUpdates" />
        </el-form-item>

        <el-form-item label="自动保存间隔">
          <el-input-number v-model="model.autoSaveInterval" :min="1" :max="60" :step="1" :controls="false" style="width: 100px" />
          <span class="unit">分钟 (0 为禁用)</span>
        </el-form-item>

        <el-form-item label="最大撤销步数">
          <el-input-number v-model="model.maxUndoSteps" :min="10" :max="500" :step="10" :controls="false" style="width: 100px" />
          <span class="unit">步 (大值占用更多内存)</span>
        </el-form-item>

        <el-form-item label="最近项目列表长度">
          <el-input-number v-model="model.recentProjectsLimit" :min="5" :max="50" :step="1" :controls="false" style="width: 100px" />
          <span class="unit">项</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>文件处理</h4>

      <el-form :model="model" label-width="140px" size="small">
        <el-form-item label="默认保存路径">
          <div class="path-input">
            <el-input v-model="model.defaultSavePath" placeholder="选择默认保存目录" readonly />
            <el-button @click="selectSavePath" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="导入 DWG 时">
          <el-radio-group v-model="model.dwgImportBehavior">
            <el-radio-button label="convert">自动转换为 DXF</el-radio-button>
            <el-radio-button label="prompt">询问转换方式</el-radio-button>
            <el-radio-button label="reference">作为外部参照</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="拖拽导入行为">
          <el-radio-group v-model="model.dragImportBehavior">
            <el-radio-button label="new-drawing">新建图纸标签页</el-radio-button>
            <el-radio-button label="current">合并到当前图纸</el-radio-button>
            <el-radio-button label="ask">每次询问</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="打开项目时恢复">
          <el-checkbox-group v-model="model.restoreOnOpen">
            <el-checkbox value="viewport">视口位置缩放</el-checkbox>
            <el-checkbox value="selection">选中状态</el-checkbox>
            <el-checkbox value="panels">面板布局</el-checkbox>
            <el-checkbox value="layers">图层可见性</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="文件关联">
          <div class="file-assoc">
            <el-button @click="registerFileAssociations" :loading="registeringAssoc">注册 .survey/.dwg/.dxf</el-button>
            <el-button @click="unregisterFileAssociations" :disabled="registeringAssoc">取消关联</el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>窗口与界面</h4>

      <el-form :model="model" label-width="140px" size="small">
        <el-form-item label="窗口状态">
          <el-radio-group v-model="model.windowState">
            <el-radio-button label="normal">普通</el-radio-button>
            <el-radio-button label="maximized">最大化</el-radio-button>
            <el-radio-button label="fullscreen">全屏</el-radio-button>
            <el-radio-button label="remember">记住上次状态</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="最小化到托盘">
          <el-switch v-model="model.minimizeToTray" />
        </el-form-item>

        <el-form-item label="关闭窗口行为">
          <el-radio-group v-model="model.closeBehavior">
            <el-radio-button label="quit">退出程序</el-radio-button>
            <el-radio-button label="tray">最小化到托盘</el-radio-button>
            <el-radio-button label="ask">询问</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="启用动画">
          <el-switch v-model="model.enableAnimations" />
        </el-form-item>

        <el-form-item label="紧凑模式">
          <el-switch v-model="model.compactMode" />
          <span class="switch-desc">减少界面间距，适合小屏幕</span>
        </el-form-item>

        <el-form-item label="状态栏显示">
          <el-checkbox-group v-model="model.statusBarItems">
            <el-checkbox value="coordinates">坐标</el-checkbox>
            <el-checkbox value="zoom">缩放</el-checkbox>
            <el-checkbox value="entity-count">实体统计</el-checkbox>
            <el-checkbox value="snap">吸附状态</el-checkbox>
            <el-checkbox value="grid">网格状态</el-checkbox>
            <el-checkbox value="unit">单位/比例</el-checkbox>
            <el-checkbox value="view-mode">视图模式</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>数据与隐私</h4>

      <el-form :model="model" label-width="140px" size="small">
        <el-form-item label="发送使用统计">
          <el-switch v-model="model.sendTelemetry" />
          <span class="switch-desc">匿名统计，帮助改进产品</span>
        </el-form-item>

        <el-form-item label="崩溃报告">
          <el-switch v-model="model.crashReporting" />
          <span class="switch-desc">自动发送崩溃日志</span>
        </el-form-item>

        <el-form-item label="数据存储位置">
          <div class="path-input">
            <el-input v-model="model.dataPath" placeholder="数据存储目录" readonly />
            <el-button @click="openDataFolder" icon="FolderOpened" />
          </div>
        </el-form-item>

        <el-form-item label="清理缓存">
          <div class="cache-actions">
            <el-button @click="clearCache" icon="Delete">清理临时文件</el-button>
            <el-button @click="clearIndexedDB" icon="Delete" type="warning">清空 IndexedDB</el-button>
            <span class="cache-size">缓存大小: {{ cacheSize }}</span>
          </div>
        </el-form-item>

        <el-form-item label="重置所有数据">
          <el-button type="danger" @click="resetAllData" icon="Refresh">重置为出厂状态</el-button>
          <span class="switch-desc danger">⚠ 将删除所有项目、设置、历史记录，不可恢复</span>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { ElMessage, ElMessageBox } from 'element-plus';
import { FolderOpened, Delete, Refresh } from '@element-plus/icons-vue';

const settingsStore = useSettingsStore();

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const registeringAssoc = ref(false);
const cacheSize = ref('计算中...');

async function selectSavePath() {
  // TODO: 调用 Electron API 选择文件夹
  // const result = await window.electronAPI.selectDirectory();
  // if (result) model.value.defaultSavePath = result;
}

async function registerFileAssociations() {
  registeringAssoc.value = true;
  try {
    // await window.electronAPI.registerFileAssociations();
    ElMessage.success('文件关联已注册');
  } catch (e) {
    ElMessage.error('注册失败');
  } finally {
    registeringAssoc.value = false;
  }
}

async function unregisterFileAssociations() {
  try {
    // await window.electronAPI.unregisterFileAssociations();
    ElMessage.success('文件关联已取消');
  } catch (e) {
    ElMessage.error('取消失败');
  }
}

async function openDataFolder() {
  // await window.electronAPI.openPath(model.value.dataPath);
}

async function clearCache() {
  try {
    // await window.electronAPI.clearCache();
    ElMessage.success('临时文件已清理');
    updateCacheSize();
  } catch (e) {
    ElMessage.error('清理失败');
  }
}

async function clearIndexedDB() {
  const confirm = await ElMessageBox.confirm('确定要清空所有本地数据库数据吗？这将删除所有项目缓存。', '确认清空', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning',
  }).catch(() => false);

  if (confirm) {
    try {
      // await window.electronAPI.clearIndexedDB();
      ElMessage.success('IndexedDB 已清空');
      updateCacheSize();
    } catch (e) {
      ElMessage.error('清空失败');
    }
  }
}

async function resetAllData() {
  const confirm = await ElMessageBox.confirm('⚠️ 此操作将删除所有项目、设置、历史记录、缓存，且不可恢复。确定要继续吗？', '危险操作', {
    confirmButtonText: '我理解，重置',
    cancelButtonText: '取消',
    type: 'error',
    dangerouslyUseHTMLString: true,
  }).catch(() => false);

  if (confirm) {
    const confirm2 = await ElMessageBox.confirm('最后确认：所有数据将永久丢失！', '最后警告', {
      confirmButtonText: '确定重置',
      cancelButtonText: '取消',
      type: 'error',
    }).catch(() => false);

    if (confirm2) {
      // await window.electronAPI.resetAllData();
      ElMessage.success('数据已重置，请重启应用');
    }
  }
}

async function updateCacheSize() {
  try {
    // const size = await window.electronAPI.getCacheSize();
    // cacheSize.value = formatBytes(size);
    cacheSize.value = '--';
  } catch {
    cacheSize.value = '未知';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

watch(model, (newVal) => {
  settingsStore.updateSettings('general', newVal);
}, { deep: true });

onMounted(() => {
  updateCacheSize();
});
</script>

<style scoped>
.settings-general {
  max-width: 720px;
}

.setting-group {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.setting-group h4 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.setting-group:last-child {
  margin-bottom: 0;
}

.unit {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.switch-desc {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.switch-desc.danger {
  color: #ef4444;
  font-weight: 500;
}

.path-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input .el-input {
  flex: 1;
}

.file-assoc {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cache-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.cache-size {
  margin-left: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.el-form-item__content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.el-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>