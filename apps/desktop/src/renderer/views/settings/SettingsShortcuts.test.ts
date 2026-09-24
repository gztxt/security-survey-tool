/**
 * 快捷键设置页 = keymap 的只读投影（P1 改键剧场拆除后的防线）
 *
 * 旧实现在组件里手抄一张 ~50 行 defaultShortcuts 表，另加改键录入 /
 * 方案保存 / 导入导出 / 冲突自动解决；实测没有任何运行时代码读取写回的
 * settings.shortcuts ⇒ 用户改的键没人听，表里多数键也没有处理器。
 * 现在整页只从 @/keymap 渲染，"表里出现的键一定可用"这一承诺才成立。
 *
 * 锁三件事：
 *  1. 喂给表格的数据就是 KEYMAP 本身（引用同一数组，过滤后是它的子集）——
 *     一旦有人往组件里再塞硬编码表（漂移的根源），这里会红。
 *     注：el-table 在 jsdom 下不做布局，行单元格不渲染，故断言数据契约
 *     而不是断言 DOM 文本（后者会假绿）。
 *  2. 默认态（无搜索/无筛选）必须逐条覆盖全表，不得藏行。
 *  3. 改键入口不得复辟：无录入捕获、无方案保存/导入导出，且本页不再是
 *     window keydown 监听者（旧版它就是第 5 个监听器，与其它层互相干扰）。
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { ElTable } from 'element-plus';
import SettingsShortcuts from '@/views/settings/SettingsShortcuts.vue';
import { KEYMAP, describeKey, type KeyBinding } from '@/keymap';

function mountPage() {
  return mount(SettingsShortcuts, { global: { plugins: [ElementPlus] } });
}

/**
 * el-table 的行单元格在 jsdom 下不渲染（组件依赖真实布局），所以只能从组件
 * 实例上取它拿到的 data prop —— 断的是"页面喂给表格的数据"，即投影本身。
 * findComponent 的重载在 ElTable（导出为 WithInstall 包装）上会退化成
 * DOMWrapper，故显式取 VueWrapper 形状。
 */
function tableData(w: ReturnType<typeof mountPage>): KeyBinding[] {
  const table = w.findComponent(ElTable) as unknown as { props: (k: string) => unknown };
  return table.props('data') as KeyBinding[];
}

describe('SettingsShortcuts 只读投影', () => {
  it('表格数据就是 KEYMAP（默认态逐条覆盖全表，不自行增减动作）', () => {
    const w = mountPage();
    const data = tableData(w);
    expect(data.length).toBe(KEYMAP.length);
    expect(data.map(d => d.id)).toEqual(KEYMAP.map(b => b.id));
    // 引用同一批对象：页面没有重新造表（没有第二份文案/键位）
    expect(data[0]).toBe(KEYMAP[0]);
  });

  it('页面渲染的键位集合与 KEYMAP 完全一致（表外幽灵键不得回流）', () => {
    const w = mountPage();
    const rendered = new Set(tableData(w).flatMap(b => b.keys.map(describeKey)));
    const declared = new Set(KEYMAP.flatMap(b => b.keys.map(describeKey)));
    expect([...rendered].sort()).toEqual([...declared].sort());
    // 历史手抄表里那些从未接线的键，不得借道回来
    for (const ghost of ['Ctrl+B', 'F3', 'F11', 'Ctrl+Shift+W', 'Ctrl+Shift+E', 'Ctrl+R']) {
      expect(rendered.has(ghost), `出现表外按键 ${ghost}`).toBe(false);
    }
  });

  it('搜索与筛选只做减法，不引入表外动作', async () => {
    const w = mountPage();
    await w.vm.$nextTick();
    const all = tableData(w).length;
    // 输入不存在的关键词 ⇒ 空表（而不是回落到某张内置表）
    (w.vm as any).searchText = 'zzz-不存在的动作-zzz';
    await w.vm.$nextTick();
    expect(tableData(w).length).toBe(0);
    (w.vm as any).searchText = '';
    (w.vm as any).filterScope = 'global';
    await w.vm.$nextTick();
    const scoped = tableData(w);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(all);
    expect(scoped.every(b => b.scope === 'global')).toBe(true);
  });

  it('改键剧场不得复辟：无录入/方案/导入导出入口，且本页不注册 keydown', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    const w = mountPage();
    const keyListeners = spy.mock.calls.filter(([type]) => type === 'keydown');
    spy.mockRestore();
    expect(keyListeners, '设置页不应成为又一个 window keydown 监听者').toHaveLength(0);

    const html = w.html();
    const text = w.text();
    expect(html).not.toContain('按新快捷键');
    expect(text).not.toMatch(/保存方案|导入方案|导出配置|恢复默认快捷键|冲突/);
    // 能力边界必须写明，而不是让用户以为可以改
    expect(text).toMatch(/暂不支持自定义改键/);
  });
});
