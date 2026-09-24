/**
 * 项目工作区路由解析回归测试
 *
 * 缺陷（真实打包应用冒烟复现，单测此前漏网）：HomeView / ProjectsView / DashboardView /
 * ProjectCreateView 都用 `router.push({ name: 'project', params: { id } })` 进工作区。
 * vue-router 按 name 命中具名父记录时，matched 只含父记录本身，ProjectView 里的嵌套
 * <router-view> 解析不到子组件 ⇒ .main-area 只剩一个空注释节点：没有画布、没有工具栏、
 * 没有图纸标签。而按路径导航会带上默认子路由，所以表现为"从列表点卡片必现空白、
 * F5 刷新后又正常" —— 看着像偶发，实际是确定性 bug。
 *
 * 修复是父路由加 redirect。注意 resolve() 不跟随 redirect，只有真实导航（push）才生效，
 * 因此本文件用 push 后读 currentRoute 的方式断言。
 */
import { describe, it, expect } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import router from './index';
import routerSource from './index.ts?raw';

// 只测路由表解析/导航行为，视图组件用轻量替身（真实组件走懒加载 chunk）。
const Stub = { name: 'RouteStub', template: '<div />' };

/**
 * 直接用应用真实路由表（不再镜像一份）：镜像表会让"测试通过但线上仍空白"成为可能。
 * jsdom 下 location.protocol 为 http ⇒ router 走 web history，可安全 push。
 */
async function goto(target: Parameters<typeof router.push>[0]) {
  await router.replace('/');
  await router.push(target as any);
  return router.currentRoute.value;
}

describe('项目工作区导航（真实路由表）', () => {
  it('按 name 导航到父记录会落到默认子路由（否则工作区空白）', async () => {
    const cur = await goto({ name: 'project', params: { id: 'p1' } });
    expect(cur.name).toBe('project-drawing');
    // 关键断言：matched 必须含子记录，嵌套 <router-view> 才有组件可渲染
    expect(cur.matched.length).toBe(2);
  });

  it('按路径导航与按 name 导航解析到同一子路由', async () => {
    const byName = await goto({ name: 'project', params: { id: 'p1' } });
    const byPath = await goto('/project/p1');
    expect(byPath.name).toBe(byName.name);
    expect(byPath.matched.length).toBe(byName.matched.length);
  });

  it('redirect 透传项目 id 与 query', async () => {
    const cur = await goto({ name: 'project', params: { id: 'p9' }, query: { from: 'home' } });
    expect(cur.params.id).toBe('p9');
    expect(cur.query.from).toBe('home');
  });

  it('无 id 的 /project 也能解析（沿用内存态当前项目的入口不报错）', async () => {
    const cur = await goto({ name: 'project' });
    expect(cur.name).toBe('project-drawing');
  });

  it('显式指定子路由名时不被父级 redirect 干扰', async () => {
    const cur = await goto({ name: 'project-export', params: { id: 'p1' } });
    expect(cur.name).toBe('project-export');
    expect(cur.path).toBe('/project/p1/export');
  });

  it('其余带 children 的具名父路由也不得留空白态', () => {
    const parents = router.getRoutes().filter(r => r.children?.length && r.name);
    for (const rec of parents) {
      const hasDefault = rec.children.some(c => c.path === '' || c.path === '/');
      expect(hasDefault || !!rec.redirect, `路由 ${String(rec.name)} 既无 redirect 也无默认子路由`).toBe(true);
    }
  });
});

describe('真实路由表自检', () => {
  it('project 父路由自带 redirect', () => {
    // 直接读源文件文本（?raw 由 vite 提供，绕开 jsdom 下 import.meta.url 不是 file: 的问题）
    const code = routerSource as unknown as string;
    const at = code.indexOf("path: '/project/:id?'");
    expect(at).toBeGreaterThan(-1);
    const head = code.slice(at, code.indexOf('children: [', at));
    expect(head).toContain("name: 'project'");
    expect(head).toContain('redirect:');
  });
});
