/**
 * 设备库内容契约测试
 *
 * 用户反馈：左侧面板「摄像头 / 交换机 / 机柜 / AP / 网线」这些图标元素没做完。
 * 本文件锁死"设备库里真的有这些东西"：
 *  1. 每个 DeviceCategory 都有中文标签（新增品类忘补标签会直接编译报错，
 *     这里再验一次运行时取值，避免空字符串出现在界面上）。
 *  2. AP 品类有可用型号，且是 PoE + wifi（AP 的基本盘）。
 *  3. 布线材料表覆盖所有真实线种：左侧「布线材料」区与画布拖放都依赖它，
 *     缺一种 = 面板少一个入口。
 */
import { describe, it, expect } from 'vitest';
import {
  BUILTIN_DEVICES,
  BUILTIN_CABLE_MATERIALS,
  getCableMaterial,
} from './index';
import { DEVICE_CATEGORY_LABELS } from '@security-survey/shared-types';
import type { DeviceCategory, CableType } from '@security-survey/shared-types';

/** 去掉 'custom' 的材料类型：custom 是"用户自定义"，不该有预置条目 */
const REAL_CABLE_TYPES: CableType[] = ['cat6', 'cat6a', 'cat7', 'fiber_sm', 'fiber_mm', 'power'];

describe('设备品类完整性', () => {
  it('① 每个品类都有非空中文标签', () => {
    for (const [cat, label] of Object.entries(DEVICE_CATEGORY_LABELS)) {
      expect(label, `品类 ${cat} 缺中文标签`).toBeTruthy();
      expect(label).toMatch(/[一-龥]/);
    }
  });

  it('② 用户点名的品类（摄像头/交换机/机柜/AP）都有内置型号', () => {
    const required: DeviceCategory[] = ['dome', 'switch', 'rack', 'ap'];
    for (const cat of required) {
      const hits = BUILTIN_DEVICES.filter(d => d.category === cat);
      expect(hits.length, `品类 ${cat} 在设备库里没有任何型号`).toBeGreaterThan(0);
    }
  });

  it('③ AP 型号是 PoE 供电 + 无线（AP 的基本盘）', () => {
    const aps = BUILTIN_DEVICES.filter(d => d.category === 'ap');
    expect(aps.length).toBeGreaterThanOrEqual(3);
    for (const ap of aps) {
      expect(ap.specs.voltage).toBe('PoE');
      expect(ap.specs.wifi).toBe(true);
      expect(ap.price).toBeGreaterThan(0);
      expect(ap.icon.type).toBeTruthy();
    }
  });
});

describe('布线材料表', () => {
  it('④ 覆盖全部真实线种，且每种都有名称/单价/最大段长', () => {
    const ids = BUILTIN_CABLE_MATERIALS.map(m => m.id);
    for (const t of REAL_CABLE_TYPES) {
      expect(ids, `材料表缺少线种 ${t}`).toContain(t);
    }
    for (const m of BUILTIN_CABLE_MATERIALS) {
      expect(m.name).toBeTruthy();
      expect(m.unitPrice).toBeGreaterThan(0);
      expect(m.maxRun).toBeGreaterThan(0);
      expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(['copper', 'fiber', 'power']).toContain(m.category);
    }
  });

  it('⑤ 网线单段不超过 100m（以太网硬约束），光纤/电源线更长', () => {
    for (const m of BUILTIN_CABLE_MATERIALS.filter(x => x.category === 'copper')) {
      expect(m.maxRun, `${m.name} 单段长度超过以太网 100m 约束`).toBeLessThanOrEqual(100);
    }
    for (const m of BUILTIN_CABLE_MATERIALS.filter(x => x.category === 'fiber')) {
      expect(m.maxRun).toBeGreaterThan(100);
    }
  });

  it('⑥ getCableMaterial 按线种查表；未知线种返回 undefined', () => {
    expect(getCableMaterial('cat6')?.name).toContain('六类');
    expect(getCableMaterial('fiber_sm')?.category).toBe('fiber');
    expect(getCableMaterial('custom')).toBeUndefined();
  });
});
