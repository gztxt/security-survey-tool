/**
 * 比例尺校准链（决策 5.2 / AC-3）
 *
 * 两点取距 → scale = 图上模型单位 / 实际毫米 → setCalibration → 通知主进程（回显桩，不阻塞）。
 *
 * 单位换算（PRD AC-3.3）：模型坐标单位是 **毫米**，realDistance 先折算为毫米再参与除法，
 * 因此 **scale 是无量纲比值**（图上 1 单位 ↔ 实际 1/scale 单位）。
 * 例：1:100 图纸上量得 100 单位、实测 10m ⇒ scale = 100/10000 = 0.01。
 *
 * 任何"模型单位 ↔ 米"的换算一律走 shared-types 的 modelUnitsToMeters / metersToModelUnits，
 * 不得手写 `* scale`（历史缺陷：线缆长度被放大 scale² 倍，材料表全错）。
 * 显示工程比例尺用 1/scale，即 "1:N"。
 *
 * 与架构文档的口径差异已记入偏差清单：架构 §5.2 写 `scale = pixelDistance / realDistance`，
 * 本文沿用其"图上距离 / 实际距离"语义，但图上距离取**模型坐标距离**而非屏幕像素，
 * 否则缩放窗口会改变 scale。
 */
import { ref, computed, readonly } from 'vue';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/project';
import type { CalibrationData, Point2D } from '@security-survey/shared-types';

export type CalibrationStep = 'point1' | 'point2' | 'distance' | 'idle';

const MM_PER_UNIT: Record<CalibrationData['unit'], number> = { mm: 1, cm: 10, m: 1000 };

export function emptyCalibration(): CalibrationData {
  return {
    isCalibrated: false,
    point1: { x: 0, y: 0 },
    point2: { x: 0, y: 0 },
    realDistance: 0,
    scale: 1,
    unit: 'm',
  };
}

/** 模型坐标两点间距离（模型单位 = 毫米） */
export function modelDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * 由两点与实测距离推导 CalibrationData。
 * 距离非法（0/负/NaN）时返回 null，调用方据此提示而不写入脏数据。
 */
export function deriveCalibration(
  point1: Point2D,
  point2: Point2D,
  realDistanceInUnit: number,
  unit: CalibrationData['unit'] = 'm',
): CalibrationData | null {
  const modelDist = modelDistance(point1, point2);
  const realMm = realDistanceInUnit * MM_PER_UNIT[unit];
  if (!Number.isFinite(modelDist) || modelDist <= 0) return null;
  if (!Number.isFinite(realMm) || realMm <= 0) return null;
  const scale = modelDist / realMm;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    isCalibrated: true,
    point1: { x: point1.x, y: point1.y },
    point2: { x: point2.x, y: point2.y },
    realDistance: realDistanceInUnit,
    scale,
    unit,
  };
}

export function useCalibration() {
  const projectStore = useProjectStore();

  const active = ref(false);
  const step = ref<CalibrationStep>('idle');
  const point1 = ref<Point2D | null>(null);
  const point2 = ref<Point2D | null>(null);
  const realDistance = ref(0);
  const unit = ref<CalibrationData['unit']>('m');

  const previewDistance = computed(() =>
    point1.value && point2.value ? modelDistance(point1.value, point2.value) : 0,
  );

  const hint = computed(() => {
    switch (step.value) {
      case 'point1': return '点击图纸上已知长度的第一个端点';
      case 'point2': return '点击该已知长度的第二个端点';
      case 'distance': return '输入这两点之间的实际距离';
      default: return '';
    }
  });

  function start() {
    if (!projectStore.currentDrawing) {
      ElMessage.warning('请先导入或选择一张图纸');
      return;
    }
    active.value = true;
    step.value = 'point1';
    point1.value = null;
    point2.value = null;
    realDistance.value = 0;
  }

  function cancel() {
    active.value = false;
    step.value = 'idle';
    point1.value = null;
    point2.value = null;
  }

  /** 画布上报的世界坐标点击 */
  function addPoint(p: Point2D): void {
    if (!active.value) return;
    if (step.value === 'point1') {
      point1.value = { x: p.x, y: p.y };
      step.value = 'point2';
      return;
    }
    if (step.value === 'point2') {
      point2.value = { x: p.x, y: p.y };
      step.value = 'distance';
    }
  }

  /** 确认写入校准数据；payload 来自浮层输入，缺省则用 composable 内的当前值 */
  async function apply(payload?: { realDistance: number; unit: CalibrationData['unit'] }): Promise<boolean> {
    const drawing = projectStore.currentDrawing;
    if (!drawing) {
      ElMessage.error('图纸已关闭，校准取消');
      cancel();
      return false;
    }
    if (!point1.value || !point2.value) {
      ElMessage.warning('请先在图纸上拾取两个校准点');
      return false;
    }
    const dist = payload ? payload.realDistance : realDistance.value;
    const u = payload ? payload.unit : unit.value;
    realDistance.value = dist;
    unit.value = u;
    const data = deriveCalibration(point1.value, point2.value, dist, u);
    if (!data) {
      ElMessage.warning('校准失败：两点距离或实际长度必须大于 0');
      return false;
    }

    projectStore.setCalibration(drawing.id, data);

    // 主进程 drawing:calibrate 目前是回显桩（main.ts），调用仅为契约完整；
    // 失败不得阻断本地校准结果，故整体 try/catch 吞掉。
    if (projectStore.hasBridge()) {
      try {
        await window.api.drawing.calibrate(drawing.id, data);
      } catch (e) {
        console.warn('主进程校准回显失败（不影响本地结果）:', e instanceof Error ? e.message : e);
      }
    }

    ElMessage.success('比例尺已校准');
    active.value = false;
    step.value = 'idle';
    return true;
  }

  function reset() {
    const drawing = projectStore.currentDrawing;
    if (!drawing) return;
    projectStore.setCalibration(drawing.id, emptyCalibration());
    cancel();
  }

  return {
    active: readonly(active),
    step: readonly(step),
    point1,
    point2,
    realDistance,
    unit,
    hint,
    previewDistance,
    start,
    cancel,
    addPoint,
    apply,
    reset,
  };
}
