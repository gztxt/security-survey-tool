<template>
  <div class="settings-shortcuts">
    <div class="setting-group">
      <h4>快捷键映射</h4>

      <div class="shortcuts-toolbar">
        <el-input v-model="searchText" placeholder="搜索快捷键..." size="small" style="width: 240px" prefix-icon="Search" clearable />
        <el-select v-model="filterCategory" placeholder="全部分类" style="width: 160px" size="small">
          <el-option label="全部" value="" />
          <el-option label="文件操作" value="file" />
          <el-option label="编辑操作" value="edit" />
          <el-option label="视图控制" value="view" />
          <el-option label="图纸管理" value="drawing" />
          <el-option label="设备操作" value="device" />
          <el-option label="布线操作" value="wiring" />
          <el-option label="导出输出" value="export" />
          <el-option label="窗口管理" value="window" />
          <el-option label="帮助" value="help" />
        </el-select>
        <el-button @click="resetAllShortcuts" icon="Refresh" size="small">恢复默认</el-button>
        <el-button @click="exportShortcuts" icon="Download" size="small">导出配置</el-button>
        <el-button @click="importShortcuts" icon="Upload" size="small">导入配置</el-button>
      </div>

      <div class="shortcuts-table-wrapper">
        <el-table
          :data="filteredShortcuts"
          border
          size="small"
          style="width: 100%"
          row-key="id"
          highlight-current-row
        >
          <el-table-column prop="category" label="分类" width="100">
            <template #default="scope">
              <el-tag :type="getCategoryType(scope.row.category)" size="small">
                {{ getCategoryLabel(scope.row.category) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="action" label="操作" min-width="180" />
          <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />

          <el-table-column prop="keys" label="当前快捷键" width="180">
            <template #default="scope">
              <kbd class="key-display" @click="startEditing(scope.row)" :class="{ editing: editingId === scope.row.id }">
                {{ formatKeys(scope.row.keys) || '— 未设置 —' }}
              </kbd>
            </template>
          </el-table-column>

          <el-table-column prop="defaultKeys" label="默认快捷键" width="180">
            <template #default="scope">
              <kbd class="key-display default">{{ formatKeys(scope.row.defaultKeys) }}</kbd>
            </template>
          </el-table-column>

          <el-table-column fixed="right" label="操作" width="100">
            <template #default="scope">
              <div class="action-buttons">
                <el-button v-if="editingId !== scope.row.id" size="small" link @click="startEditing(scope.row)">修改</el-button>
                <el-button v-else size="small" type="primary" link @click="confirmEditing(scope.row)">确定</el-button>
                <el-button v-else size="small" link @click="cancelEditing">取消</el-button>
                <el-button size="small" link type="danger" @click="clearShortcut(scope.row.id)">清除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="shortcuts-hint">
        <span class="hint-item">
          <kbd>Esc</kbd> 取消编辑
        </span>
        <span class="hint-item">
          <kbd>Enter</kbd> 确认编辑
        </span>
        <span class="hint-item">
          点击快捷键区域开始录入
        </span>
        <span class="hint-item">
          支持组合键: <kbd>Ctrl</kbd>+<kbd>S</kbd>, <kbd>Shift</kbd>+<kbd>F1</kbd> 等
        </span>
      </div>
    </div>

    <div class="setting-group">
      <h4>快捷键方案</h4>

      <el-form :model="model.scheme" label-width="140px" size="small">
        <el-form-item label="当前方案">
          <el-select v-model="model.scheme.current" placeholder="选择方案" style="width: 220px">
            <el-option label="默认方案" value="default" />
            <el-option label="AutoCAD 风格" value="autocad" />
            <el-option label="SketchUp 风格" value="sketchup" />
            <el-option label="Revit 风格" value="revit" />
            <el-option label="Vim 风格" value="vim" />
            <el-option label="自定义方案..." value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="方案名称" v-if="model.scheme.current === 'custom'">
          <el-input v-model="model.scheme.customName" placeholder="输入方案名称" />
        </el-form-item>

        <el-form-item label="保存为新方案">
          <div class="scheme-actions">
            <el-input v-model="newSchemeName" placeholder="新方案名称" style="width: 200px" size="small" />
            <el-button @click="saveAsScheme" icon="Plus" size="small">保存</el-button>
            <el-button @click="deleteScheme" type="danger" size="small" :disabled="model.scheme.current !== 'custom'">删除</el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div class="setting-group">
      <h4>冲突检测</h4>

      <div v-if="conflicts.length === 0" class="no-conflicts">
        <el-icon><CheckCircle /></el-icon>
        <span>未检测到快捷键冲突</span>
      </div>

      <div v-else class="conflicts-list">
        <div
          v-for="conflict in conflicts"
          :key="conflict.id"
          class="conflict-item"
        >
          <el-tag type="warning" size="small">冲突</el-tag>
          <span class="conflict-keys">{{ formatKeys(conflict.keys) }}</span>
          <span class="conflict-actions">
            <span v-for="action in conflict.actions" :key="action">{{ action }}</span>
          </span>
          <el-button size="small" link @click="resolveConflict(conflict.id)">自动解决</el-button>
        </div>
      </div>

      <el-button @click="checkConflicts" icon="Search" size="small" style="margin-top: 12px">重新检测冲突</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { CheckCircle, Search, Refresh, Download, Upload, Plus, Delete } from '@element-plus/icons-vue';

const settingsStore = useSettingsStore();

const props = defineProps<{
  modelValue: any;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const model = ref(JSON.parse(JSON.stringify(props.modelValue)));

const searchText = ref('');
const filterCategory = ref('');
const editingId = ref<string | null>(null);
const pendingKeys = ref<string[]>([]);
const newSchemeName = ref('');
const conflicts = ref<Array<any>>([]);

const defaultShortcuts = [
  // 文件操作
  { id: 'new-project', category: 'file', action: '新建项目', description: '创建新项目', keys: ['ctrl+n'], defaultKeys: ['ctrl+n'] },
  { id: 'open-project', category: 'file', action: '打开项目', description: '打开现有项目文件', keys: ['ctrl+o'], defaultKeys: ['ctrl+o'] },
  { id: 'save-project', category: 'file', action: '保存项目', description: '保存当前项目', keys: ['ctrl+s'], defaultKeys: ['ctrl+s'] },
  { id: 'save-as', category: 'file', action: '另存为', description: '另存为新文件', keys: ['ctrl+shift+s'], defaultKeys: ['ctrl+shift+s'] },
  { id: 'import-dwg', category: 'file', action: '导入 DWG/DXF', description: '导入图纸文件', keys: ['ctrl+i'], defaultKeys: ['ctrl+i'] },
  { id: 'export', category: 'file', action: '导出', description: '打开导出对话框', keys: ['ctrl+e'], defaultKeys: ['ctrl+e'] },

  // 编辑操作
  { id: 'undo', category: 'edit', action: '撤销', description: '撤销上一步操作', keys: ['ctrl+z'], defaultKeys: ['ctrl+z'] },
  { id: 'redo', category: 'edit', action: '重做', description: '重做上一步撤销', keys: ['ctrl+y'], defaultKeys: ['ctrl+y'] },
  { id: 'copy', category: 'edit', action: '复制', description: '复制选中对象', keys: ['ctrl+c'], defaultKeys: ['ctrl+c'] },
  { id: 'paste', category: 'edit', action: '粘贴', description: '粘贴到当前图纸', keys: ['ctrl+v'], defaultKeys: ['ctrl+v'] },
  { id: 'duplicate', category: 'edit', action: '复制并粘贴', description: '原位复制', keys: ['ctrl+d'], defaultKeys: ['ctrl+d'] },
  { id: 'delete', category: 'edit', action: '删除', description: '删除选中对象', keys: ['delete'], defaultKeys: ['delete'] },
  { id: 'select-all', category: 'edit', action: '全选', description: '选择所有对象', keys: ['ctrl+a'], defaultKeys: ['ctrl+a'] },
  { id: 'deselect', category: 'edit', action: '取消选择', description: '清除当前选择', keys: ['escape'], defaultKeys: ['escape'] },

  // 视图控制
  { id: 'zoom-in', category: 'view', action: '放大', description: '放大视图', keys: ['ctrl+=', 'ctrl+wheelup'], defaultKeys: ['ctrl=', 'ctrl+wheelup'] },
  { id: 'zoom-out', category: 'view', action: '缩小', description: '缩小视图', keys: ['ctrl+-', 'ctrl+wheeldown'], defaultKeys: ['ctrl+-', 'ctrl+wheeldown'] },
  { id: 'zoom-fit', category: 'view', action: '缩放适应', description: '适应窗口大小', keys: ['shift+1'], defaultKeys: ['shift+1'] },
  { id: 'zoom-100', category: 'view', action: '实际大小', description: '100% 显示', keys: ['1'], defaultKeys: ['1'] },
  { id: 'zoom-selection', category: 'view', action: '缩放选中', description: '适应选中对象', keys: ['shift+2'], defaultKeys: ['shift+2'] },
  { id: 'pan', category: 'view', action: '平移', description: '平移视图', keys: ['middle', 'space+left'], defaultKeys: ['middle', 'space+left'] },
  { id: 'toggle-grid', category: 'view', action: '切换网格', description: '显示/隐藏网格', keys: ['g'], defaultKeys: ['g'] },
  { id: 'toggle-snap', category: 'view', action: '切换吸附', description: '启用/禁用吸附', keys: ['s'], defaultKeys: ['s'] },
  { id: 'toggle-rulers', category: 'view', action: '切换标尺', description: '显示/隐藏标尺', keys: ['ctrl+r'], defaultKeys: ['ctrl+r'] },

  // 图纸管理
  { id: 'new-drawing', category: 'drawing', action: '新建图纸', description: '添加新图纸标签页', keys: ['ctrl+t'], defaultKeys: ['ctrl+t'] },
  { id: 'close-drawing', category: 'drawing', action: '关闭图纸', description: '关闭当前图纸标签页', keys: ['ctrl+w'], defaultKeys: ['ctrl+w'] },
  { id: 'next-drawing', category: 'drawing', action: '下一张图纸', description: '切换到下一个标签页', keys: ['ctrl+tab'], defaultKeys: ['ctrl+tab'] },
  { id: 'prev-drawing', category: 'drawing', action: '上一张图纸', description: '切换到上一个标签页', keys: ['ctrl+shift+tab'], defaultKeys: ['ctrl+shift+tab'] },
  { id: 'drawing-properties', category: 'drawing', action: '图纸属性', description: '打开当前图纸属性', keys: ['ctrl+shift+p'], defaultKeys: ['ctrl+shift+p'] },
  { id: 'calibrate', category: 'drawing', action: '图纸校准', description: '打开校准向导', keys: ['ctrl+k'], defaultKeys: ['ctrl+k'] },

  // 设备操作
  { id: 'place-device', category: 'device', action: '放置设备', description: '进入设备放置模式', keys: ['d'], defaultKeys: ['d'] },
  { id: 'device-library', category: 'device', action: '设备库', description: '打开/关闭设备库面板', keys: ['ctrl+l'], defaultKeys: ['ctrl+l'] },
  { id: 'batch-deploy', category: 'device', action: '批量部署', description: '打开批量部署对话框', keys: ['ctrl+b'], defaultKeys: ['ctrl+b'] },
  { id: 'fov-analysis', category: 'device', action: '视场分析', description: '切换视场分析模式', keys: ['v'], defaultKeys: ['v'] },

  // 布线操作
  { id: 'start-wire', category: 'wiring', action: '开始布线', description: '进入布线模式', keys: ['w'], defaultKeys: ['w'] },
  { id: 'wiring-mode', category: 'wiring', action: '布线模式', description: '切换布线模式', keys: ['ctrl+w'], defaultKeys: ['ctrl+w'] },
  { id: 'auto-wire', category: 'wiring', action: '自动布线', description: '执行自动布线', keys: ['ctrl+shift+w'], defaultKeys: ['ctrl+shift+w'] },
  { id: 'add-well', category: 'wiring', action: '添加弱电井', description: '放置弱电井', keys: ['shift+w'], defaultKeys: ['shift+w'] },
  { id: 'add-tray', category: 'wiring', action: '添加桥架', description: '绘制桥架', keys: ['shift+t'], defaultKeys: ['shift+t'] },

  // 导出输出
  { id: 'export-pointmap', category: 'export', action: '导出点位图', description: '快速导出点位图', keys: ['ctrl+shift+p'], defaultKeys: ['ctrl+shift+p'] },
  { id: 'export-topology', category: 'export', action: '导出拓扑图', description: '快速导出拓扑图', keys: ['ctrl+shift+t'], defaultKeys: ['ctrl+shift+t'] },
  { id: 'export-fov', category: 'export', action: '导出视场', description: '快速导出视场分析', keys: ['ctrl+shift+f'], defaultKeys: ['ctrl+shift+f'] },
  { id: 'export-bom', category: 'export', action: '导出 BOM', description: '快速导出物料清单', keys: ['ctrl+shift+b'], defaultKeys: ['ctrl+shift+b'] },
  { id: 'export-report', category: 'export', action: '导出报告', description: '快速导出工程报告', keys: ['ctrl+shift+r'], defaultKeys: ['ctrl+shift+r'] },

  // 窗口管理
  { id: 'toggle-sidebar', category: 'window', action: '切换侧边栏', description: '显示/隐藏侧边栏', keys: ['f2'], defaultKeys: ['f2'] },
  { id: 'toggle-panel-right', category: 'window', action: '切换右侧面板', description: '显示/隐藏右侧属性面板', keys: ['f3'], defaultKeys: ['f3'] },
  { id: 'fullscreen', category: 'window', action: '全屏', description: '进入/退出全屏', keys: ['f11'], defaultKeys: ['f11'] },
  { id: 'settings', category: 'window', action: '设置', description: '打开设置对话框', keys: ['ctrl+,'], defaultKeys: ['ctrl+,'] },

  // 帮助
  { id: 'shortcuts-help', category: 'help', action: '快捷键帮助', description: '显示快捷键列表', keys: ['f1'], defaultKeys: ['f1'] },
  { id: 'about', category: 'help', action: '关于', description: '显示关于对话框', keys: ['ctrl+shift+a'], defaultKeys: ['ctrl+shift+a'] },
];

const filteredShortcuts = computed(() => {
  let result = model.value.shortcuts || defaultShortcuts;

  if (searchText.value) {
    const search = searchText.value.toLowerCase();
    result = result.filter(s =>
      s.action.toLowerCase().includes(search) ||
      s.description.toLowerCase().includes(search) ||
      s.keys.some(k => k.toLowerCase().includes(search))
    );
  }

  if (filterCategory.value) {
    result = result.filter(s => s.category === filterCategory.value);
  }

  return result;
});

function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    file: '文件',
    edit: '编辑',
    view: '视图',
    drawing: '图纸',
    device: '设备',
    wiring: '布线',
    export: '导出',
    window: '窗口',
    help: '帮助',
  };
  return labels[cat] || cat;
}

function getCategoryType(cat: string): string {
  const types: Record<string, string> = {
    file: 'primary',
    edit: 'success',
    view: 'info',
    drawing: 'warning',
    device: 'danger',
    wiring: 'primary',
    export: 'success',
    window: 'info',
    help: 'warning',
  };
  return types[cat] || 'info';
}

function formatKeys(keys: string[]): string {
  if (!keys || keys.length === 0) return '';
  return keys.map(k => formatSingleKey(k)).join(' / ');
}

function formatSingleKey(key: string): string {
  return key
    .split('+')
    .map(part => {
      const upper = part.toUpperCase();
      if (['CTRL', 'ALT', 'SHIFT', 'META', 'CMD', 'SUPER'].includes(upper)) {
        return upper === 'META' || upper === 'CMD' || upper === 'SUPER' ? '⌘' : upper === 'CTRL' ? 'Ctrl' : upper === 'ALT' ? 'Alt' : 'Shift';
      }
      return upper;
    })
    .join('+');
}

function startEditing(shortcut: any) {
  editingId.value = shortcut.id;
  pendingKeys.value = [];
  // 监听键盘事件
  window.addEventListener('keydown', captureKeys);
  nextTick(() => {
    const el = document.querySelector(`.key-display.editing`);
    el?.focus();
  });
}

function captureKeys(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') {
    cancelEditing();
    return;
  }

  if (e.key === 'Enter' || e.key === ' ') {
    confirmEditing();
    return;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.metaKey) parts.push('meta');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');

  let key = e.key;
  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return;
  if (key === ' ') key = 'space';
  parts.push(key.toLowerCase());

  pendingKeys.value = [parts.join('+')];
  // 实时显示
  const shortcut = model.value.shortcuts.find((s: any) => s.id === editingId.value);
  if (shortcut) {
    shortcut.keys = [...pendingKeys.value];
  }
}

function confirmEditing(shortcut?: any) {
  window.removeEventListener('keydown', captureKeys);
  const target = shortcut || model.value.shortcuts.find((s: any) => s.id === editingId.value);
  if (target && pendingKeys.value.length > 0) {
    target.keys = [...pendingKeys.value];
    checkConflicts();
    onChange();
  }
  editingId.value = null;
  pendingKeys.value = [];
}

function cancelEditing() {
  window.removeEventListener('keydown', captureKeys);
  // 恢复原值
  const target = model.value.shortcuts.find((s: any) => s.id === editingId.value);
  if (target) {
    target.keys = [...target.defaultKeys];
  }
  editingId.value = null;
  pendingKeys.value = [];
}

function clearShortcut(id: string) {
  const shortcut = model.value.shortcuts.find((s: any) => s.id === id);
  if (shortcut) {
    shortcut.keys = [];
    onChange();
  }
}

function checkConflicts() {
  const keyMap = new Map<string, any[]>();
  for (const s of model.value.shortcuts) {
    for (const k of s.keys) {
      const normalized = k.toLowerCase();
      if (!keyMap.has(normalized)) keyMap.set(normalized, []);
      keyMap.get(normalized)!.push(s);
    }
  }

  conflicts.value = [];
  for (const [keys, actions] of keyMap) {
    if (actions.length > 1) {
      conflicts.value.push({
        id: `conflict-${keys}`,
        keys,
        actions: actions.map(a => a.action),
      });
    }
  }
}

function resolveConflict(conflictId: string) {
  // 自动解决冲突：保留第一个，清空其他的
  const conflict = conflicts.value.find(c => c.id === conflictId);
  if (conflict) {
    const key = conflict.keys;
    let first = true;
    for (const s of model.value.shortcuts) {
      const idx = s.keys.findIndex(k => k.toLowerCase() === key);
      if (idx > -1) {
        if (first) {
          first = false;
        } else {
          s.keys.splice(idx, 1);
        }
      }
    }
    checkConflicts();
    onChange();
  }
}

function onChange() {
  emit('update:modelValue', model.value);
  settingsStore.updateSettings('shortcuts', model.value);
}

function resetAllShortcuts() {
  model.value.shortcuts = JSON.parse(JSON.stringify(defaultShortcuts));
  checkConflicts();
  onChange();
}

function exportShortcuts() {
  // 导出为 JSON 文件
  const blob = new Blob([JSON.stringify(model.value.shortcuts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shortcuts-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importShortcuts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          model.value.shortcuts = data;
          checkConflicts();
          onChange();
        } catch {
          alert('文件格式错误');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function saveAsScheme() {
  if (!newSchemeName.value.trim()) return;
  // 保存到本地存储
  const schemes = JSON.parse(localStorage.getItem('shortcut-schemes') || '{}');
  schemes[newSchemeName.value] = JSON.parse(JSON.stringify(model.value.shortcuts));
  localStorage.setItem('shortcut-schemes', JSON.stringify(schemes));
  newSchemeName.value = '';
  model.value.scheme.current = 'custom';
  model.value.scheme.customName = newSchemeName.value;
  onChange();
}

function deleteScheme() {
  if (model.value.scheme.current !== 'custom') return;
  const schemes = JSON.parse(localStorage.getItem('shortcut-schemes') || '{}');
  delete schemes[model.value.scheme.customName];
  localStorage.setItem('shortcut-schemes', JSON.stringify(schemes));
  model.value.scheme.current = 'default';
  model.value.shortcuts = JSON.parse(JSON.stringify(defaultShortcuts));
  checkConflicts();
  onChange();
}

watch(() => props.modelValue, (newVal) => {
  model.value = JSON.parse(JSON.stringify(newVal));
  checkConflicts();
}, { deep: true });

onMounted(() => {
  checkConflicts();
});
</script>

<style scoped>
.settings-shortcuts {
  max-width: 1000px;
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

.shortcuts-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.shortcuts-table-wrapper {
  max-height: 500px;
  overflow: auto;
}

.key-display {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  white-space: nowrap;
}

.key-display:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.key-display.editing {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
  50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4); }
}

.key-display.default {
  color: var(--text-tertiary);
  background: transparent;
  border-color: transparent;
  cursor: default;
}

.action-buttons {
  display: flex;
  gap: 4px;
  white-space: nowrap;
}

.shortcuts-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.shortcuts-hint kbd {
  padding: 2px 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 11px;
}

.scheme-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conflict-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
}

.conflict-keys {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #f59e0b;
  min-width: 140px;
}

.conflict-actions {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.conflict-actions span {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
}

.no-conflicts {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #10b981;
  font-size: 13px;
}
</style>