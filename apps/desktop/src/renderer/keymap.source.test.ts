/**
 * keymap ⇄ 处理器源码 的静态自证（不靠手维护清单）
 *
 * keymap.test.ts 里的 registered 清单是手维护的登记面：能防"漏抄"，但防不了
 * "表里写了某个键、处理器其实早被删/从没写" —— 那正是本次 P1 审计最大的
 * 假宣称类别（设置页 ~50 行表里绝大多数键无人注册）。
 *
 * 本文件把这一方向改为自动：直接读各作用域所有者的源码，要求每个登记键
 * 在源码里留下可识别的证据 token（case 'KeyW' / e.key === '=' / case 'Tab' …）。
 * 表里有、源码没证据 ⇒ 红。
 *
 * 边界（诚实声明）：这是文本证据检查，不是可达性证明 —— 证据可能出现在
 * 注释或被别的分支挡在前面。它能挡住"完全没接线"这一类（最常见、最致命），
 * 挡不住"接了但走不到"（例如 d1f1474 那类 switch(e.key) 遇 Shift 键值漂移，
 * 只能靠真机冒烟 R14k 抓）。两条防线互补，故都要有。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KEYMAP, type KeyScope, type KeyBinding } from '@/keymap';
/** 每个作用域的唯一所有者（与 keymap.ts 头注释的键位所有权划分一致） */
const OWNER: Record<KeyScope, string> = {
  global: 'src/renderer/components/layout/GlobalKeys.vue',
  project: 'src/renderer/views/ProjectView.vue',
  tabs: 'src/renderer/components/layout/DrawingTabs.vue',
  drawing: 'src/renderer/views/DrawingView.vue',
  canvas: 'src/renderer/components/canvas/CanvasViewport.vue',
};

const cache = new Map<KeyScope, string>();
function ownerSource(scope: KeyScope): string {
  if (!cache.has(scope)) {
    cache.set(scope, readFileSync(resolve(process.cwd(), OWNER[scope]), 'utf8'));
  }
  return cache.get(scope)!;
}

/**
 * 某键在所有者源码里的证据。返回 true = 找得到接线痕迹。
 * 逐类列明判定依据，避免"看着像正则魔法"。
 */
function hasEvidence(binding: KeyBinding, key: string): boolean {
  return evidenceIn(ownerSource(binding.scope), binding, key);
}

function evidenceIn(src: string, binding: KeyBinding, key: string): boolean {
  const parts = key.toLowerCase().split('+');
  // 鼠标/滚轮类：源码证据是事件绑定而非按键分支
  if (parts.includes('wheel') || key === 'middle') {
    return src.includes('@wheel') || src.includes("addEventListener('wheel'") || src.includes('button === 1');
  }
  const main = parts[parts.length - 1];
  // 键名大小写形态各层不同：单字母写作 'W' / KeyW，特殊键写作 'Space' /
  // 'Delete' / 'Escape' / 'Enter' / 'Tab'。全部生成出来再找，避免
  // toUpperCase() 把 'space' 变成 'SPACE' 这种自己造出来找不到的 token。
  const upper = main.length === 1 ? main.toUpperCase() : main[0].toUpperCase() + main.slice(1);
  const code = `Key${upper}`;
  const digitCode = `Digit${upper}`;
  const codeName = /^[a-z]$/.test(main) ? code : /^[0-9]$/.test(main) ? digitCode : upper;
  // 主键证据：switch(e.code) 的 case、e.key 比较、或 isKey(e,'x') 式封装
  const mainEvidence = [
    `case '${codeName}'`,
    `case '${upper}'`,
    `case '${main}'`,
    `=== '${upper}'`,
    `=== '${main}'`,
    `=== '${codeName}'`,
    `includes('${upper}')`,
    `'${upper}':`,
    `'${main}':`,
    // 数字区间写法：/^[1-9]$/.test(e.key) 或 /^Digit([1-9])$/ 一次覆盖 1~9
    ...(/^[0-9]$/.test(main) ? ['[1-9]'] : []),
  ].some(t => src.includes(t));
  if (!mainEvidence) return false;
  // 修饰键：所有者必须真的读了对应修饰位（否则该组合走不到）
  if (parts.includes('ctrl') && !(src.includes('ctrlKey') || src.includes('metaKey'))) return false;
  if (parts.includes('alt') && !src.includes('altKey')) return false;
  if (parts.includes('shift')) {
    if (!src.includes('shiftKey')) return false;
    // Shift+字母：真实键盘 e.key 变成大写 ⇒ 能容纳它的路径有三种：判 e.code、
    // 直接比大写、或对 e.key 做过 toLowerCase()（把 'W' 归一回 'w'）。三者皆无
    // 却写 `=== 'w'` 配 shiftKey 的分支才是死键。
    const letterAlive = src.includes(code) || src.includes(`=== '${upper}'`) || src.includes('toLowerCase()');
    if (/^[a-z]$/.test(main) && !letterAlive) return false;
    // Shift+数字同理：e.key 会漂移成 '!'/'@'，必须按 Digit 判定
    if (/^[0-9]$/.test(main) && !(src.includes(digitCode) || src.includes('[1-9]'))) return false;
  }
  return true;
}

describe('keymap 键位必须在所有者源码留有接线证据', () => {
  const keyboardBindings = KEYMAP.filter(b => b.keys.length);

  it('五个作用域的所有者文件都可读', () => {
    for (const scope of Object.keys(OWNER) as KeyScope[]) {
      expect(() => ownerSource(scope), `读不到 ${scope} 的所有者源码`).not.toThrow();
    }
  });

  it('每个登记键都能在所有者源码找到证据（防"表里有、没人接"回潮）', () => {
    const orphans: string[] = [];
    for (const b of keyboardBindings) {
      for (const k of b.keys) {
        if (!hasEvidence(b, k)) orphans.push(`${b.scope}:${k} (${b.id}/${b.action}) 应见于 ${OWNER[b.scope]}`);
      }
    }
    expect(orphans, `以下宣称的键位找不到接线证据:\n${orphans.join('\n')}`).toHaveLength(0);
  });

  it('每个作用域至少有一个键被证明（防所有者路径搬家后检查空转）', () => {
    for (const scope of Object.keys(OWNER) as KeyScope[]) {
      const inScope = KEYMAP.filter(b => b.scope === scope);
      expect(inScope.length, `${scope} 作用域没有任何登记键`).toBeGreaterThan(0);
      const proven = inScope.flatMap(b => b.keys).filter(k => hasEvidence(inScope[0], k));
      expect(proven.length, `${scope} 全部登记键都找不到证据`).toBeGreaterThan(0);
    }
  });

  it('反向：所有者文件若改了键位归属，手维护清单与本自动检查同时生效', () => {
    // 自检：故意拿一个肯定没接线的键去查，证明检查器不是恒真
    const fake: KeyBinding = {
      id: 'fake', action: 'x', description: 'x', keys: ['ctrl+j'], scope: 'canvas', category: 'edit',
    };
    expect(hasEvidence(fake, 'ctrl+j'), '检查器恒真 —— 它没在真的找证据').toBe(false);
    const fake2: KeyBinding = { ...fake, keys: ['ctrl+shift+q'] };
    expect(hasEvidence(fake2, 'ctrl+shift+q')).toBe(false);
  });
});

/**
 * 变异自证：检查器必须抓得住本次 P1 审计真实踩过的缺陷形状。
 * 抓不住就说明它在放水（恒真）—— 那比没有这条测试更糟。
 */
describe('keymap 接线证据检查器自身的杀伤力', () => {
  const zoomFit: KeyBinding = { id: 'zoom-fit', action: '缩放适应', description: 'x', keys: ['shift+1'], scope: 'drawing', category: 'view' };
  const toolWell: KeyBinding = { id: 'tool-well', action: '弱电井', description: 'x', keys: ['shift+w'], scope: 'canvas', category: 'device' };
  const saveAs: KeyBinding = { id: 'save-as', action: '另存为', description: 'x', keys: ['ctrl+shift+s'], scope: 'project', category: 'file' };

  it('形状1：宣称的键在源码里根本没有分支（设置页假表的典型形状）', () => {
    expect(evidenceIn(`function onKey(e){ if (e.key === 'z') {} }`, saveAs, 'ctrl+shift+s')).toBe(false);
    expect(evidenceIn('', zoomFit, 'shift+1')).toBe(false);
  });

  it("形状2：Shift+数字只比 e.key ⇒ 真机打的是 '!' 走不到（d1f1474 修的死键）", () => {
    const dead = `function h(e){ if (e.key.toLowerCase() === '1' && e.shiftKey) { zoomFit(); } }`;
    expect(evidenceIn(dead, zoomFit, 'shift+1'), 'e.key 遇 Shift 漂移成 ! —— 必须判红').toBe(false);
    const alive = `function h(e){ const d=/^Digit([1-9])$/.exec(e.code)?.[1]; if (d === '1' && e.shiftKey) zoomFit(); }`;
    expect(evidenceIn(alive, zoomFit, 'shift+1')).toBe(true);
  });

  it('形状3：Shift+字母既不判 code、也不比大写、也没归一 ⇒ 死键', () => {
    const dead = `function h(e){ if (e.key === 'w' && e.shiftKey) tool.value = 'well'; }`;
    expect(evidenceIn(dead, toolWell, 'shift+w'), "只比小写 'w' 配 shiftKey：真机打的是 'W'").toBe(false);
    const alive = `function h(e){ switch (e.code) { case 'KeyW': tool.value = e.shiftKey ? 'well' : 'wire'; } }`;
    expect(evidenceIn(alive, toolWell, 'shift+w')).toBe(true);
  });

  it('正常形状必须判绿（防误杀，否则测试只会一路放行红灯）', () => {
    expect(evidenceIn(`if (!(e.ctrlKey || e.metaKey)) return; const key = e.key.toLowerCase(); if (key === 's' && e.shiftKey) saveProjectAs();`, saveAs, 'ctrl+shift+s')).toBe(true);
    expect(evidenceIn(`@wheel.prevent="onWheel"`, { ...zoomFit, scope: 'canvas', keys: ['wheel'] }, 'wheel')).toBe(true);
  });
});
