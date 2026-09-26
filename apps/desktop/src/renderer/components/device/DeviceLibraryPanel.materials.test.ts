/**
 * 左侧设备面板「布线材料」区回归测试
 *
 * 用户反馈：左侧面板只有设备，网线/光纤没有入口。
 * 现要求面板顶部有可点、可拖的材料列表，点/拖都会切到布线工具并锁定线种
 * （此前线缆类型被硬编码成 cat6，图纸上根本选不了线种）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';

import DeviceLibraryPanel from '@/components/device/DeviceLibraryPanel.vue';
import { useUiStore } from '@/stores/ui';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

function mountPanel() {
  return mount(DeviceLibraryPanel, { attachTo: document.body });
}

describe('设备面板 · 布线材料', () => {
  it('① 面板渲染出材料列表，网线/光纤/电源线都在', () => {
    const w = mountPanel();
    const items = w.findAll('.material-item');
    expect(items.length).toBeGreaterThanOrEqual(5);
    const text = w.text();
    expect(text).toContain('六类网线');
    expect(text).toContain('单模光纤');
    expect(text).toContain('电源线');
    w.unmount();
  });

  it('② 点击材料 ⇒ 切到布线工具并锁定线种', async () => {
    const w = mountPanel();
    const ui = useUiStore();
    expect(ui.activeTool).toBe('select');
    expect(ui.activeCableType).toBe('cat6');

    const fiber = w.findAll('.material-item').find(i => i.text().includes('单模光纤'))!;
    await fiber.trigger('click');
    await nextTick();

    expect(ui.activeTool).toBe('wire');
    expect(ui.activeCableType).toBe('fiber_sm');
    w.unmount();
  });

  it('③ 拖拽材料携带 application/cable 载荷', async () => {
    const w = mountPanel();
    const ui = useUiStore();
    const setData = vi.fn();
    const cat6 = w.findAll('.material-item').find(i => i.text().includes('六类网线'))!;
    const evt = { dataTransfer: { setData } } as unknown as DragEvent;
    // 直接触发组件的 dragstart 处理器（jsdom 无原生 DataTransfer）
    (cat6.element as HTMLElement).dispatchEvent(new Event('dragstart'));
    // 走 Vue 的事件绑定
    await cat6.trigger('dragstart', { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith('application/cable', 'cat6');
    expect(ui.activeCableType).toBe('cat6');
    void evt;
    w.unmount();
  });

  it('④ AP 品类出现在分类标签里（用户点名的图标元素之一）', () => {
    const w = mountPanel();
    const tabs = w.findAll('.category-tab').map(t => t.text());
    expect(tabs.some(t => t.includes('无线AP'))).toBe(true);
    expect(tabs.some(t => t.includes('机柜'))).toBe(true);
    expect(tabs.some(t => t.includes('交换机'))).toBe(true);
    w.unmount();
  });
});
