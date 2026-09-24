// 工作流步骤条：新建项目 → ①导入底图 → ②添加点位设备 → ③标注线路 → ④生成导出
// 设计原则（对标 Axis Design Tool / 海康设计工具的任务流）：
//  - 步骤状态从项目数据实时派生（projectStore.hasBasemap/hasDevices/hasCables），不手填
//  - 点击步骤 = 切换到该步骤对应的工具 + 侧栏面板 + 视图（引导操作而非跳转迷宫）
//  - 未完成的必要步骤以主色高亮为"当前要做的事"，并给出可执行引导文案
<template>
  <nav class="workflow-stepper" role="navigation" aria-label="工作流程">
    <button
      v-for="(step, i) in steps"
      :key="step.id"
      class="step"
      :class="{
        'is-active': i === activeIndex,
        'is-done': step.done,
        'is-locked': step.locked,
      }"
      :disabled="step.locked"
      :title="stepHint(step)"
      @click="goStep(i)"
    >
      <span class="step-badge">
        <svg v-if="step.done" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span v-else>{{ i + 1 }}</span>
      </span>
      <span class="step-meta">
        <span class="step-label">{{ step.label }}</span>
        <span class="step-count" v-if="step.countLabel">{{ step.countLabel }}</span>
      </span>
      <span v-if="i < steps.length - 1" class="step-arrow" aria-hidden="true">›</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { useDeviceLibraryStore } from '@/stores/deviceLibrary';

const props = defineProps<{
  /** 触发底图导入链（原生对话框），由 ProjectView 提供 */
  onImportBasemap?: () => void;
}>();

const router = useRouter();
const projectStore = useProjectStore();
const uiStore = useUiStore();
const deviceLibraryStore = useDeviceLibraryStore();

interface StepDef {
  id: 'basemap' | 'devices' | 'wiring' | 'export';
  label: string;
  hint: string;
  done: boolean;
  locked: boolean;
  countLabel?: string;
}

/**
 * steps 的 done 直接由 projectStore.workflowStep 推出（下标早于当前步骤 = 已完成），
 * 不再各步自己写一遍判定 —— 否则会出现"高亮在第 3 步，第 2 步却已打勾"这类自相矛盾。
 * countLabel/hint 仍读原始数据：它们只是展示，不参与进度判定。
 */
const STEP_IDS = ['basemap', 'devices', 'wiring', 'export'] as const;

const steps = computed<StepDef[]>(() => {
  const currentIndex = STEP_IDS.indexOf(projectStore.workflowStep as typeof STEP_IDS[number]);
  const deviceCount = projectStore.currentDrawing?.devices?.length || 0;
  const cableCount = projectStore.currentDrawing?.wiring?.cables?.length || 0;
  const hasBasemap = projectStore.hasBasemap;
  const calibrated = !!projectStore.currentDrawing?.calibration?.isCalibrated;
  const exported = exportHistoryCount.value > 0;
  const doneAt = (i: number) => currentIndex > i;
  // 无底图不锁定后续步骤（现场可能无图纸需徒手布置），仅以"当前步骤高亮 + 文案"引导
  return [
    {
      id: 'basemap',
      label: '导入底图',
      hint: hasBasemap && calibrated
        ? '底图已就绪（比例尺已校准）'
        : hasBasemap
          ? '底图已导入，点击开始校准比例尺'
          : '导入 CAD / 图片 / PDF 平面图作为底图',
      done: doneAt(0),
      locked: false,
      countLabel: hasBasemap ? (calibrated ? '已校准' : '待校准') : undefined,
    },
    {
      id: 'devices',
      label: '添加点位',
      hint: deviceCount < 2
        ? '从设备库拖放摄像头、交换机到图纸上（至少 2 台才能连线）'
        : '已布点，可继续补充设备',
      done: doneAt(1),
      locked: false,
      countLabel: deviceCount ? `${deviceCount} 台设备` : undefined,
    },
    {
      id: 'wiring',
      label: '标注线路',
      hint: '用布线工具连接设备，标注网络线路走向',
      done: doneAt(2),
      locked: false,
      countLabel: cableCount ? `${cableCount} 条线路` : undefined,
    },
    {
      id: 'export',
      label: '生成导出',
      hint: '导出点位图 / 系统图 / 设备清单 / 方案报告',
      // 末步：workflowStep 到 'export' 只表示"可以导出了"，打勾要看是否真的导过
      done: exported,
      locked: false,
      countLabel: exported ? '已导出' : undefined,
    },
  ];
});

const exportHistoryCount = computed(() => {
  try {
    const raw = JSON.parse(localStorage.getItem('export-history-v2') || '[]');
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
});

const activeIndex = computed(() => {
  const i = STEP_IDS.indexOf(projectStore.workflowStep as typeof STEP_IDS[number]);
  return i === -1 ? 0 : i;
});

function stepHint(step: StepDef) {
  return step.locked ? '请先导入底图' : step.hint;
}

function goStep(i: number) {
  const step = steps.value[i];
  if (!step || step.locked) return;

  switch (step.id) {
    case 'basemap':
      // 回到画布并拉起导入链（已导入则直接进入校准引导）
      backToCanvas();
      if (projectStore.hasBasemap) {
        // 已有底图 = 这一步剩下的唯一事情就是校准，直接开校准取点，
        // 不再弹一句"请去工具栏找校准"让用户自己绕路
        uiStore.requestCalibrate();
      } else {
        props.onImportBasemap?.();
      }
      break;
    case 'devices':
      backToCanvas();
      uiStore.setSidebarTab('devices');
      if (deviceLibraryStore.selectedDeviceId) uiStore.setTool('device');
      break;
    case 'wiring':
      backToCanvas();
      uiStore.setSidebarTab('wiring');
      uiStore.setTool('wire');
      break;
    case 'export':
      void router.push({ name: 'project-export', params: { id: projectStore.currentProject?.id } });
      break;
  }
}

function backToCanvas() {
  const route = router.currentRoute.value;
  if (route.name !== 'project-drawing' && route.name !== 'Drawing') {
    void router.push({ name: 'project-drawing', params: { id: projectStore.currentProject?.id } });
  }
}
</script>

<style scoped>
.workflow-stepper {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  background: var(--bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  overflow-x: auto;
  flex-shrink: 0;
}

.step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.step:hover:not(:disabled) {
  background: var(--bg-tertiary, #f3f4f6);
  color: var(--text-primary, #111827);
}

.step:disabled,
.step.is-locked {
  cursor: not-allowed;
  opacity: 0.45;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.step.is-done .step-badge {
  background: var(--success-color, #10b981);
  border-color: var(--success-color, #10b981);
  color: #fff;
}

.step.is-active {
  background: var(--primary-alpha-8, rgba(59, 130, 246, 0.1));
  color: var(--primary-color, #3b82f6);
  font-weight: 600;
}

.step.is-active .step-badge {
  border-color: var(--primary-color, #3b82f6);
}

.step-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.step-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-tertiary, #f3f4f6);
  color: var(--text-secondary, #6b7280);
}

.step.is-active .step-count {
  background: var(--primary-color, #3b82f6);
  color: #fff;
}

.step-arrow {
  color: var(--border-color, #d1d5db);
  font-size: 14px;
  margin-left: 2px;
}
</style>
