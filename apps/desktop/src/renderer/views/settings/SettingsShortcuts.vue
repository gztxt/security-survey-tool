<template>
  <div class="settings-shortcuts">
    <div class="setting-group">
      <h4>当前可用的快捷键</h4>

      <p class="note">
        本表由代码中的按键注册表（keymap）自动生成，与真实行为一一对应：
        表里出现的按键一定有事发生；表里没有的按键说明该功能尚未提供快捷键。
        暂不支持自定义改键 —— 此前的"改键/方案/导入导出"只写入一张没有任何
        运行时代码读取的表，属于无效宣称，已移除（登记于 PENDING-TASKS 待真做）。
      </p>

      <div class="shortcuts-toolbar">
        <el-input v-model="searchText" placeholder="搜索动作或按键..." size="small" style="width: 240px" prefix-icon="Search" clearable />
        <el-select v-model="filterScope" placeholder="全部作用域" style="width: 160px" size="small">
          <el-option label="全部作用域" value="" />
          <el-option v-for="s in SCOPES" :key="s.id" :label="SCOPE_LABELS[s.id]" :value="s.id" />
        </el-select>
      </div>

      <div class="shortcuts-table-wrapper">
        <el-table :data="filtered" border size="small" style="width: 100%" row-key="id">
          <el-table-column label="作用域" width="120">
            <template #default="scope">
              <el-tag :type="scopeTagType(scope.row.scope)" size="small">
                {{ SCOPE_LABELS[scope.row.scope] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="快捷键" width="200">
            <template #default="scope">
              <kbd v-for="k in scope.row.keys" :key="k" class="key-display">{{ describeKey(k) }}</kbd>
            </template>
          </el-table-column>
          <el-table-column prop="action" label="动作" min-width="140" />
          <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="shortcuts-hint">
        <span class="hint-item">作用域 = 该按键在哪个界面层生效；同一键位全应用只有一个所有者</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 快捷键设置页（只读，真相源 = @/keymap）
 *
 * 旧版是一张 ~50 行手抄表 + 改键录入 + "方案保存/导入/导出" + "冲突自动
 * 解决"。经 P1 审计：表内绝大多数键没有任何处理器；录入的新键写入
 * settings.shortcuts 后无人读取（全仓检索无消费方），"恢复默认/导出
 * 配置"操作的也是这张死表 ⇒ 整套 UI 是剧场，且它自己就是第 5 个
 * window keydown 监听器（录入捕获），与其它层互相干扰。
 * 现已重写为 keymap 的只读投影：keymap 里登记的都是真实接线的动作，
 * 因此"表里有的键必可用"这一承诺成立。改键能力作为真实功能另行排期。
 */
import { ref, computed } from 'vue';
import { KEYMAP, describeKey, type KeyScope } from '@/keymap';

const SCOPES: Array<{ id: KeyScope }> = [
  { id: 'global' }, { id: 'project' }, { id: 'tabs' }, { id: 'drawing' }, { id: 'canvas' },
];
const SCOPE_LABELS: Record<KeyScope, string> = {
  global: '全局',
  project: '项目工作区',
  tabs: '图纸页签',
  drawing: '图纸视图',
  canvas: '画布',
};

const searchText = ref('');
const filterScope = ref('');

const filtered = computed(() =>
  KEYMAP.filter((b) => {
    if (filterScope.value && b.scope !== filterScope.value) return false;
    if (!searchText.value) return true;
    const q = searchText.value.toLowerCase();
    return b.action.toLowerCase().includes(q)
      || b.description.toLowerCase().includes(q)
      || b.keys.some(k => k.includes(q));
  }),
);

function scopeTagType(scope: KeyScope): 'info' | 'primary' | 'success' | 'warning' | 'danger' {
  const map: Record<KeyScope, 'info' | 'primary' | 'success' | 'warning' | 'danger'> = {
    global: 'primary', project: 'success', tabs: 'info', drawing: 'warning', canvas: 'danger',
  };
  return map[scope];
}
</script>

<style scoped>
.settings-shortcuts { padding: 8px 0; }
.note {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
  border-left: 3px solid #3b82f6;
  padding: 8px 12px;
  margin: 0 0 12px;
}
.shortcuts-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.key-display {
  display: inline-block;
  padding: 2px 6px;
  margin-right: 4px;
  border: 1px solid var(--border-color, #d0d0d0);
  border-radius: 4px;
  background: var(--bg-secondary, #f5f5f5);
  font-family: monospace;
  font-size: 12px;
}
.shortcuts-hint { margin-top: 8px; }
.hint-item { font-size: 12px; color: var(--text-secondary); }
</style>
