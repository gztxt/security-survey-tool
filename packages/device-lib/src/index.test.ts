import { describe, it, expect } from 'vitest';
import {
  calculateFieldOfView,
  generateFovPolygon,
  isPointInFov,
  calculateOverlapZones,
} from './index';
import type { DeviceSpecs, Point2D } from '@security-survey/shared-types';

// ============ isPointInFov（射线法点在多边形内判断，纯确定性） ============
describe('isPointInFov', () => {
  // 一个单位正方形 (0,0)-(10,10)
  const square: Point2D[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('点在多边形内部时返回 true', () => {
    // Arrange
    const point: Point2D = { x: 5, y: 5 };
    // Act
    const result = isPointInFov(point, square);
    // Assert
    expect(result).toBe(true);
  });

  it('点在多边形外部时返回 false', () => {
    const point: Point2D = { x: 20, y: 20 };
    expect(isPointInFov(point, square)).toBe(false);
  });

  it('点在多边形左侧外部时返回 false', () => {
    expect(isPointInFov({ x: -5, y: 5 }, square)).toBe(false);
  });

  it('空多边形时返回 false', () => {
    expect(isPointInFov({ x: 5, y: 5 }, [])).toBe(false);
  });

  it('三角形内的点返回 true，外的点返回 false', () => {
    const triangle: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(isPointInFov({ x: 5, y: 2 }, triangle)).toBe(true);
    expect(isPointInFov({ x: 9, y: 9 }, triangle)).toBe(false);
  });
});

// ============ calculateFieldOfView（视野锥体几何计算） ============
describe('calculateFieldOfView', () => {
  const specs: DeviceSpecs = {
    horizontalFOV: 90,
    verticalFOV: 50,
    maxDistance: 30,
  };

  it('返回包含四个角点的结果结构', () => {
    // Act
    const result = calculateFieldOfView(specs, 3);
    // Assert
    expect(result).toHaveProperty('corners');
    expect(result.corners).toHaveLength(4);
    expect(result).toHaveProperty('coverageArea');
    expect(result).toHaveProperty('horizontalRadius');
    expect(result).toHaveProperty('verticalRadius');
    expect(result).toHaveProperty('blindZoneRadius');
  });

  it('覆盖面积为非负数', () => {
    const result = calculateFieldOfView(specs, 3);
    expect(result.coverageArea).toBeGreaterThanOrEqual(0);
  });

  it('缺省 specs 字段时使用默认值且不抛错', () => {
    const result = calculateFieldOfView({}, 3);
    expect(result.corners).toHaveLength(4);
    expect(Number.isFinite(result.coverageArea)).toBe(true);
  });

  it('rotation=0 与 rotation=2π 结果近似相等', () => {
    const a = calculateFieldOfView(specs, 3, undefined, 0);
    const b = calculateFieldOfView(specs, 3, undefined, Math.PI * 2);
    expect(b.corners[0].x).toBeCloseTo(a.corners[0].x, 5);
    expect(b.corners[0].y).toBeCloseTo(a.corners[0].y, 5);
  });
});

// ============ generateFovPolygon（未知设备模型返回空数组） ============
describe('generateFovPolygon', () => {
  it('modelId 不存在于内置设备库时返回空数组', () => {
    // Arrange
    const device: any = {
      id: 'dev-1',
      modelId: '__not_a_real_model__',
      position: { x: 0, y: 0 },
      rotation: 0,
    };
    // Act
    const result = generateFovPolygon(device);
    // Assert
    expect(result).toEqual([]);
  });
});

// ============ calculateOverlapZones（网格采样覆盖/重叠统计） ============
describe('calculateOverlapZones', () => {
  it('空多边形集合返回 covered=0 且 overlap 为空', () => {
    // Act
    const result = calculateOverlapZones(new Map());
    // Assert
    expect(result.covered).toBe(0);
    expect(result.overlap.size).toBe(0);
  });

  it('单个多边形时 covered>0 且无重叠', () => {
    const polygons = new Map<string, Point2D[]>([
      ['a', [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ]],
    ]);
    const result = calculateOverlapZones(polygons, 1);
    expect(result.covered).toBeGreaterThan(0);
    expect(result.overlap.size).toBe(0);
  });

  it('两个重叠多边形时 overlap 记录重叠网格', () => {
    const polygons = new Map<string, Point2D[]>([
      ['a', [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 6 },
        { x: 0, y: 6 },
      ]],
      ['b', [
        { x: 3, y: 3 },
        { x: 9, y: 3 },
        { x: 9, y: 9 },
        { x: 3, y: 9 },
      ]],
    ]);
    const result = calculateOverlapZones(polygons, 1);
    expect(result.covered).toBeGreaterThan(0);
    expect(result.overlap.size).toBeGreaterThan(0);
  });
});
