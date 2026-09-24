/**
 * 测试夹具（fixtures）—— 为 exporter 包内单测提供确定性的 Project / Drawing /
 * DeviceInstance / Cable / CableTray / WeakPoint 构造器。
 *
 * 设计约束：
 * - 纯函数、无 DOM、无副作用，vitest 与 Node 环境均可直接 import。
 * - 不依赖真实设备库：设备型号以最小 DeviceModel 形状内联构造，
 *   仅填充导出链路真正读取的字段（id/name/category/type/specs.icon/specs.price）。
 * - 所有含中文的 label/name 显式书写，用于验证 DXF 的 \U+XXXX 转义往返。
 */

import type {
  Cable,
  CableTray,
  DeviceInstance,
  DeviceModel,
  Drawing,
  GraphicEntity,
  Point2D,
  Project,
  WeakPoint,
} from '@security-survey/shared-types';

/** 夹具统一基准时间，保证产物字符串（文件名等）可复现 */
export const FIXTURE_NOW = 1725000000000;

/** 默认测试图纸/项目 id，便于断言时直接引用 */
export const FIXTURE_PROJECT_ID = 'proj-fixture-1';
export const FIXTURE_DRAWING_ID = 'drawing-fixture-1';

/** 常用坐标别名 */
export const PT = {
  origin: { x: 0, y: 0 } as Point2D,
  a: { x: 1000, y: 2000 } as Point2D,
  b: { x: 5000, y: 2000 } as Point2D,
  c: { x: 5000, y: 6000 } as Point2D,
  d: { x: 9000, y: 6000 } as Point2D,
};

// ============ 设备型号 ============

/** 最小可用 DeviceModel：摄像头（枪机） */
export function makeCameraModel(overrides: Partial<DeviceModel> = {}): DeviceModel {
  return {
    id: 'model-bullet-4mp',
    name: '海康威视 DS-2CD3T45WD-I5 枪机',
    vendor: 'hikvision',
    category: 'bullet',
    type: 'varifocal_bullet',
    specs: {
      horizontalFOV: 110,
      verticalFOV: 60,
      maxDistance: 30,
      mountHeight: 3.5,
      powerConsumption: 8,
      voltage: 'PoE',
      resolution: '4MP',
    },
    icon: { type: 'builtin', width: 24, height: 24, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 680,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  };
}

/** 最小可用 DeviceModel：机柜 */
export function makeRackModel(overrides: Partial<DeviceModel> = {}): DeviceModel {
  return {
    id: 'model-rack-42u',
    name: '标准 42U 弱电机柜',
    vendor: 'generic',
    category: 'other',
    type: 'custom',
    specs: {
      dimensions: { w: 600, h: 2000, d: 800 },
      powerConsumption: 0,
    },
    icon: { type: 'builtin', width: 32, height: 32, anchor: { x: 0.5, y: 0.5 }, rotationOffset: 0 },
    price: 2400,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  };
}

// ============ 领域对象构造器 ============

/** 构造设备布点实例 */
export function makeDevice(overrides: Partial<DeviceInstance> = {}): DeviceInstance {
  return {
    id: 'dev-001',
    drawingId: FIXTURE_DRAWING_ID,
    modelId: 'model-bullet-4mp',
    position: { x: 1000, y: 2000 },
    rotation: 0,
    label: 'C001 大门口',
    remarks: '朝向入口',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  };
}

/** 构造线缆（默认 3 点折线，长度按坐标推得） */
export function makeCable(overrides: Partial<Cable> = {}): Cable {
  const path: Point2D[] = [
    { x: 1000, y: 2000 },
    { x: 1000, y: 6000 },
    { x: 5000, y: 6000 },
  ];
  return {
    id: 'cable-001',
    type: 'cat6',
    path,
    length: 8,
    correctedLength: 8.4,
    startDeviceId: 'dev-001',
    endDeviceId: 'dev-002',
    trayIds: [],
    status: 'manual',
    color: '#3b82f6',
    label: 'C001→NVR1',
    ...overrides,
  };
}

/** 构造桥架 */
export function makeTray(overrides: Partial<CableTray> = {}): CableTray {
  return {
    id: 'tray-001',
    path: [
      { x: 500, y: 5800 },
      { x: 9000, y: 5800 },
    ],
    width: 300,
    height: 100,
    type: 'trough',
    layers: 2,
    ...overrides,
  };
}

/** 构造弱电井 */
export function makeWell(overrides: Partial<WeakPoint> = {}): WeakPoint {
  return {
    id: 'well-001',
    position: { x: 9000, y: 6000 },
    name: '1#弱电井',
    type: 'floor',
    devices: ['dev-002'],
    notes: '',
    ...overrides,
  };
}

/** 构造 CAD 图元（默认 LINE） */
export function makeEntity(overrides: Partial<GraphicEntity> = {}): GraphicEntity {
  return {
    id: 'ent-001',
    type: 'LINE',
    layer: '0',
    color: 7,
    lineType: 'Continuous',
    lineWeight: 25,
    visible: true,
    data: { start: { x: 0, y: 0 }, end: { x: 10000, y: 0 } } as any,
    bounds: { minX: 0, maxX: 10000, minY: 0, maxY: 0, width: 10000, height: 0 },
    ...overrides,
  };
}

/** 构造图纸 */
export function makeDrawing(overrides: Partial<Drawing> = {}): Drawing {
  return {
    id: FIXTURE_DRAWING_ID,
    projectId: FIXTURE_PROJECT_ID,
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: {
      originalName: 'floor1.dxf',
      format: 'dxf',
      size: 123456,
      path: '/tmp/floor1.dxf',
    },
    calibration: {
      isCalibrated: true,
      point1: { x: 0, y: 0 },
      point2: { x: 10000, y: 0 },
      realDistance: 10,
      // scale = 图上模型单位 / 实际毫米 = 10000 / 10000 = 1（模型按 1:1 毫米绘制）
      scale: 1,
      unit: 'm',
    },
    layers: [
      { name: '0', color: 7, visible: true, locked: false, lineType: 'Continuous', lineWeight: 25 },
      { name: 'WALL', color: 8, visible: true, locked: false, lineType: 'Continuous', lineWeight: 25 },
    ],
    entities: [
      makeEntity(),
      makeEntity({
        id: 'ent-002',
        type: 'CIRCLE',
        layer: 'WALL',
        data: { center: { x: 5000, y: 5000 }, radius: 100 } as any,
        bounds: { minX: 4900, maxX: 5100, minY: 4900, maxY: 5100, width: 200, height: 200 },
      }),
    ],
    viewport: {
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      center: { x: 0, y: 0 },
      zoom: 1,
      showGrid: true,
      showRuler: false,
    },
    devices: [
      makeDevice(),
      makeDevice({ id: 'dev-002', modelId: 'model-rack-42u', position: { x: 5000, y: 6000 }, label: 'NVR1 机房' }),
    ],
    wiring: {
      id: 'wiring-fixture-1',
      drawingId: FIXTURE_DRAWING_ID,
      weakPoints: [makeWell()],
      trays: [makeTray()],
      cables: [makeCable()],
      topology: [],
    },
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  };
}

/** 构造项目 */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: FIXTURE_PROJECT_ID,
    name: '某某园区安防勘点',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    drawings: [makeDrawing()],
    settings: {
      defaultScale: 100,
      unit: 'm',
      gridSize: 1000,
      snapEnabled: true,
      autoSaveInterval: 30000,
    },
    ...overrides,
  };
}

/** 夹具配套的设备型号集合 */
export function makeFixtureModels(): DeviceModel[] {
  return [makeCameraModel(), makeRackModel()];
}
