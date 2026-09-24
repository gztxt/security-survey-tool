/**
 * keymap 静态一致性测试（P1 键位治理的自动化防线）
 *
 * 保证"宣称"与"实现"不漂移的三道门：
 *  1. 表内键位互不冲突：同一键串最多属于一个动作（修饰键组合与裸键
 *     如 w / shift+w 不互斥，分别比较）。
 *  2. 表内动作与 scope 对应的所有权层一一对应（防"上层偷下层键"）：
 *     以各组件实际注册的键位清单为准 —— 清单在测试内硬编码，与代码
 *     同文件评审时一起改，改代码不改清单这里会红。
 *  3. 描述完整性：每个动作有中文名 + 说明 + 分类。
 */
import { describe, it, expect } from 'vitest';
import { KEYMAP, eventKeyString, describeKey, type KeyBinding } from '@/keymap';

/** 鼠标类键（滚轮/中键）不参与"键盘键位互斥"比较 */
function isKeyboardKey(k: string): boolean {
  return !k.includes('wheel') && !k.includes('middle');
}

describe('keymap 唯一真相源', () => {
  it('无重复动作 id', () => {
    const ids = KEYMAP.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('同一键串至多属于一个动作（键盘键位互斥）', () => {
    const owners = new Map<string, string[]>();
    for (const b of KEYMAP) {
      for (const k of b.keys.filter(isKeyboardKey)) {
        owners.set(k, [...(owners.get(k) ?? []), b.id]);
      }
    }
    const dupes = [...owners.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes, `键位重复登记: ${JSON.stringify(dupes)}`).toHaveLength(0);
  });

  it('每个动作有中文动作名/说明/分类/scope', () => {
    for (const b of KEYMAP) {
      expect(b.action, `动作 ${b.id} 缺中文名`).toBeTruthy();
      expect(b.description, `动作 ${b.id} 缺说明`).toBeTruthy();
      expect(b.category, `动作 ${b.id} 缺分类`).toBeTruthy();
      expect(['global', 'project', 'drawing', 'canvas', 'tabs'], `动作 ${b.id} scope 非法`).toContain(b.scope);
    }
  });

  // 下面的"实际注册清单"与组件源码逐条对应，评审改键时一起改。
  const registered: Record<string, string[]> = {
    global: ['ctrl+n', 'ctrl+o', 'ctrl+,', 'f2', 'f1', 'ctrl+a'],
    project: ['ctrl+s', 'ctrl+shift+s', 'ctrl+i', 'ctrl+e', 'ctrl+shift+h'],
    tabs: ['ctrl+t', 'ctrl+w', 'ctrl+tab', 'ctrl+shift+tab', 'ctrl+1', 'ctrl+9'],
    drawing: ['1', 'shift+1', '0', 'shift+2', 'g', 's', 'ctrl+k'],
    canvas: ['v', 'space', 'd', 'w', 'shift+w', 't', 'shift+t', 'z', 'delete', 'escape', 'enter', 'ctrl+z', 'ctrl+y', 'ctrl+shift+z', 'ctrl+=', 'ctrl+-', 'wheel', 'shift+wheel', 'middle'],
  };

  it('表中登记的键与对应组件注册的键一一对应（双向）', () => {
    for (const [scope, realKeys] of Object.entries(registered)) {
      const tableKeys = KEYMAP
        .filter((b: KeyBinding) => b.scope === scope)
        .flatMap(b => b.keys);
      // 表里登记的键（除展开的 ctrl+1~9 用代表键 ctrl+1/ctrl+9 外）都应在真实注册里
      const tableReals = tableKeys.filter(k => !/^ctrl\+[2-8]$/.test(k));
      const tableStr = new Set(tableReals);
      for (const k of tableStr) {
        expect(realKeys, `表宣称 ${scope}:${k}，但该层未注册`).toContain(k);
      }
      const realStr = new Set(realKeys);
      for (const k of realStr) {
        expect([...tableStr], `${scope} 注册了 ${k} 但表中未登记`).toContain(k);
      }
    }
  });
});

describe('eventKeyString 标准化', () => {
  const ev = (o: Partial<KeyboardEvent>) =>
    ({ key: o.key ?? '', code: o.code ?? '', ctrlKey: !!o.ctrlKey, shiftKey: !!o.shiftKey, altKey: !!o.altKey, metaKey: !!o.metaKey } as KeyboardEvent);

  it('修饰键顺序固定 ctrl→shift，主键小写', () => {
    expect(eventKeyString(ev({ key: 'S', ctrlKey: true }))).toBe('ctrl+s');
    expect(eventKeyString(ev({ key: 'S', ctrlKey: true, shiftKey: true }))).toBe('ctrl+shift+s');
    expect(eventKeyString(ev({ key: 'Tab', ctrlKey: true }))).toBe('ctrl+tab');
    expect(eventKeyString(ev({ key: ' ' }))).toBe('space');
    expect(eventKeyString(ev({ key: 'Delete' }))).toBe('delete');
  });

  it('describeKey 面向 UI 的输出可读', () => {
    expect(describeKey('ctrl+shift+s')).toBe('Ctrl+Shift+S');
    expect(describeKey('wheelup')).toBe('滚轮上');
    expect(describeKey('escape')).toBe('Esc');
  });
});
