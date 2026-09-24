/**
 * 图纸视图渲染回归测试
 *
 * 背景（真实打包应用冒烟 R9 发现，单测此前完全漏网）：
 * 状态栏模板写的是 `viewport.worldX.toFixed(1)`，而 ViewportState.worldX 是可选字段，
 * 全仓库没有任何写入点 ⇒ 运行时恒为 undefined ⇒ 渲染期抛
 * "TypeError: Cannot read properties of undefined (reading 'toFixed')"。
 * Vue 在渲染异常时会放弃挂载该组件，于是 /project/:id 的整个工作区（工具栏、
 * 图纸标签、画布）都不出现，用户看到的是只有侧栏和步骤条的空白页 —— 相当于
 * "项目打不开"。落盘 .survey 里 viewport 只有 transform/center/zoom/showGrid/
 * showRuler，所以只要真实读盘打开项目就必崩；内存 fixture 恰好带了同名字段时才不崩。
 *
 * 本文件用真实 store 形状（viewport 不含 worldX/worldY）挂载 DrawingView，
 * 断言渲染不抛错且工具栏/撤销入口确有宿主。子组件里与渲染无关的重依赖
 * （canvas 渲染循环、Context Menu、Element Plus 弹层）以 stub 替换。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import { createRouter, createWebHashHistory } from 'vue-router';
import type { Drawing, Project } from '@security-survey/shared-types';

// 渲染循环依赖 canvas 2d 与 rAF，jsdom 下无意义；本测试只关心 DrawingView 自身模板。
vi.mock('@/components/canvas/CanvasViewport.vue', () => ({
  default: { name: 'CanvasViewportStub', template: '<div class="canvas-viewport-stub" />' },
}));
vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: { name: 'ContextMenuStub', template: '<div />' },
}));

import DrawingView from '@/views/DrawingView.vue';
import { useProjectStore } from '@/stores/project';

/** 与 .survey 落盘文件一致的 viewport 形状：没有 worldX / worldY */
function makeDrawing(id: string): Drawing {
  return {
    id,
    projectId: 'proj-r1',
    name: '1F平面图',
    floor: '1F',
    order: 0,
    file: { originalName: 'plan.dxf', format: 'dxf', size: 1, path: 'x', thumbnailPath: '' } as Drawing['file'],
    calibration: {
      isCalibrated: false,
      point1: { x: 0, y: 0 },
      point2: { x: 0, y: 0 },
      realDistance: 0,
      scale: 1,
      unit: 'm',
    },
    layers: [],
    entities: [],
    viewport: {
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      center: { x: 0, y: 0 },
      zoom: 1,
      showGrid: true,
      showRuler: false,
    },
    devices: [],
    wiring: { id: 'w1', drawingId: id, weakPoints: [], trays: [], cables: [], topology: [] },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Drawing;
}

const noop = () => Promise.resolve();

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/project/:id?', name: 'project', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  const router = makeRouter();
  const wrapper = mount(DrawingView, {
    global: {
      plugins: [router, ElementPlus],
      stubs: { transition: false as unknown as boolean },
      mocks: {
        $router: router,
      },
    },
    attachTo: document.body,
  });
  await router.isReady();
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

describe('DrawingView 渲染', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.stubGlobal('scrollTo', noop);
    (window as any).api = (window as any).api || {};
  });

  it('落盘 viewport（无 worldX/worldY）也能完整渲染，不抛 TypeError', async () => {
    const store = useProjectStore();
    store.setProject({
      id: 'proj-r1',
      name: '渲染回归',
      createdAt: 1,
      updatedAt: 1,
      drawings: [makeDrawing('d1')],
      settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
    } as Project);

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper } = await mountView();

    // 渲染期异常若发生，Vue 会记录 console.error 且 DOM 为空（真实应用里工作区整片消失）
    const errors = errSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(errors).not.toMatch(/toFixed/);

    expect(wrapper.find('.drawing-view').exists()).toBe(true);
    expect(wrapper.find('.toolbar').exists()).toBe(true);
    expect(wrapper.find('.canvas-viewport-stub').exists()).toBe(true);
    expect(wrapper.find('.status-bar').exists()).toBe(true);
    expect(wrapper.text()).toContain('1F平面图');
    errSpy.mockRestore();
    wrapper.unmount();
  });

  it('撤销/重做按钮有真实宿主，且无历史时为禁用态', async () => {
    const store = useProjectStore();
    store.setProject({
      id: 'proj-r1',
      name: '渲染回归',
      createdAt: 1,
      updatedAt: 1,
      drawings: [makeDrawing('d1')],
      settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
    } as Project);

    const { wrapper } = await mountView();
    const undo = wrapper.findAll('button').find(b => (b.attributes('title') || '').includes('撤销'));
    const redo = wrapper.findAll('button').find(b => (b.attributes('title') || '').includes('重做'));
    expect(undo, '工具栏应存在撤销按钮').toBeTruthy();
    expect(redo, '工具栏应存在重做按钮').toBeTruthy();
    expect(undo!.attributes('disabled')).toBeDefined();
    expect(redo!.attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('有历史后撤销按钮转为可用（按钮与 store 能力确实相连）', async () => {
    const store = useProjectStore();
    store.setProject({
      id: 'proj-r1',
      name: '渲染回归',
      createdAt: 1,
      updatedAt: 1,
      drawings: [makeDrawing('d1')],
      settings: { defaultScale: 100, unit: 'm', gridSize: 10, snapEnabled: true, autoSaveInterval: 30000 },
    } as Project);
    store.addDevice({
      id: 'dev-1',
      drawingId: 'd1',
      modelId: 'cam-dome',
      label: '门口枪机',
      position: { x: 100, y: 200 },
      rotation: 0,
    } as any);

    const { wrapper } = await mountView();
    const undo = wrapper.findAll('button').find(b => (b.attributes('title') || '').includes('撤销'));
    expect(undo).toBeTruthy();
    expect(store.canUndo).toBe(true);
    expect(undo!.attributes('disabled')).toBeUndefined();
    expect(undo!.attributes('title')).toContain('添加设备');
    wrapper.unmount();
  });
});
