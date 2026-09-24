<script setup lang="ts">
/**
 * 全局快捷键宿主（app 级、跨页面）
 *
 * 背景（P1 键位审计）：设置快捷键表与帮助页宣称 Ctrl+N=新建项目、
 * Ctrl+O=打开项目、F1=帮助、Ctrl+,=设置，但此前全应用没有任何一处
 * 注册这些键 ⇒ 在首页按它们零反应（假宣称）。既有键位分层保持不变：
 * 项目级（保存/另存/导入/导出/回首页）在 ProjectView，图纸编辑级
 * （缩放/网格/吸附/校准）在 DrawingView，画布工具键在 CanvasViewport，
 * 图纸页签键（Ctrl+T/W/Tab/1~9）在 DrawingTabs。本组件只补"任何页面
 * 都该生效"的 app 级键，且每个键位有唯一所有者：
 *   Ctrl+N  新建项目（先过脏守卫）
 *   Ctrl+O  打开项目文件（先过脏守卫）
 *   F1      帮助页
 *   F2      折叠/展开侧栏
 *   Ctrl+,  设置页
 *   Ctrl+A  全选当前图纸设备（委托画布 selectAll，仅工作区内有效）
 *
 * 未接线的宣称键（F11 全屏、Ctrl+B 批量部署、Ctrl+R 标尺、F3 右面板、
 * Ctrl+Shift+* 快速导出等）一律不在此处假装注册；对应宣称已从
 * 帮助页/设置表删除（见同批提交）。
 */
import { onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const projectStore = useProjectStore();
const uiStore = useUiStore();

/** 未保存修改守卫：true = 允许继续。静默丢弃用户数据是红线。 */
async function dirtyGuard(): Promise<boolean> {
  if (!projectStore.isDirty) return true;
  try {
    await ElMessageBox.confirm(
      '当前项目有未保存的修改，继续将丢失这些修改。建议先 Ctrl+S 保存。',
      '未保存的修改',
      { type: 'warning', confirmButtonText: '放弃修改并继续', cancelButtonText: '留在当前项目' },
    );
    return true;
  } catch {
    return false;
  }
}

async function newProject() {
  if (!(await dirtyGuard())) return;
  void router.push({ name: 'ProjectCreate' });
}

/** 与首页"打开项目文件"同一条链：原生对话框 → readFile → loadProject */
async function openProject() {
  if (!(await dirtyGuard())) return;
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
    const path = res?.canceled ? null : (res?.filePaths?.[0] || null);
    if (!path) return; // 用户取消对话框：不是错误
    const text = await api.fs.readFile(path);
    if (!text) throw new Error('无法读取文件');
    const project = JSON.parse(text);
    if (!project?.drawings) throw new Error('不是有效的勘点项目文件');
    await projectStore.loadProject(path);
    void router.push({ name: 'project', params: { id: project.id } });
  } catch (e: any) {
    ElMessage.error(`打开失败：${e?.message || e}`);
  }
}

function inTextInput(t: EventTarget | null): boolean {
  return !!t && (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    ((t as HTMLElement).isContentEditable ?? false)
  );
}

function onKeydown(e: KeyboardEvent) {
  if (inTextInput(e.target)) return;

  if (e.key === 'F1' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    void router.push({ name: 'help' });
    return;
  }
  if (e.key === 'F2' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    uiStore.toggleSidebar();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'n' && !e.shiftKey) {
      e.preventDefault();
      void newProject();
    } else if (k === 'o' && !e.shiftKey) {
      e.preventDefault();
      void openProject();
    } else if (e.key === ',') {
      e.preventDefault();
      void router.push({ name: 'settings' });
    } else if (k === 'a' && !e.shiftKey) {
      // 全选只在画布在场时生效（CanvasViewport 挂载时注册进 uiStore，
      // 卸载即失效）；首页/设置页不劫持浏览器默认全选。
      if (uiStore.canvasSelectAll) {
        e.preventDefault();
        uiStore.canvasSelectAll();
      }
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <!-- 无 UI：纯按键宿主，挂载于 App.vue -->
</template>
