// 路由配置
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';

/**
 * 打包后的 Electron 走 file:// 协议加载 dist/index.html。此时若用 web history，
 * vue-router 会把"当前 pathname"（…/app.asar/dist/index.html）当作初始路径去匹配路由，
 * 什么都匹配不上 ⇒ 每次启动都落在 404 页（实测：AppImage 首屏即"页面未找到"）。
 * file:// 下也没有可用的 history.pushState 语义，因此打包环境必须用 hash history。
 * 浏览器/PWA 环境（http/https）仍用 web history，保持短链与既有深链不变。
 */
const isFileProtocol = typeof location !== 'undefined' && location.protocol === 'file:';

const router = createRouter({
  history: isFileProtocol ? createWebHashHistory() : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/projects',
      name: 'Projects',
      component: () => import('@/views/ProjectsView.vue'),
      meta: { title: '项目列表', advanced: true, hidden: true },
    },
    {
      path: '/projects/new',
      name: 'ProjectCreate',
      component: () => import('@/views/ProjectCreateView.vue'),
      meta: { title: '新建项目' },
    },
    {
      // project-new 为历史命名别名，指向同一新建页
      path: '/projects/new',
      name: 'project-new',
      component: () => import('@/views/ProjectCreateView.vue'),
      meta: { title: '新建项目' },
    },
    {
      path: '/project/:id?',
      name: 'project',
      component: () => import('@/views/ProjectView.vue'),
      meta: { title: '项目编辑', requiresProject: true },
      // 按 name 导航到父记录（router.push({ name: 'project' })）时，matched 只含本条，
      // ProjectView 里的嵌套 <router-view> 因此解析不到任何子组件 ⇒ .main-area 只剩
      // 一个空注释节点：没有画布、没有工具栏、没有图纸标签，用户看到"项目打开了但是空白"。
      // 直接改地址栏（hash/路径）不受影响，因为按路径解析会带上默认子路由 —— 这也是
      // 该缺陷在真实应用里"从列表点卡片必现、刷新后正常"的原因。
      // 加 redirect 让两种导航方式都落到默认子路由（图纸编辑），从根上消除空白态。
      redirect: (to) => ({ name: 'project-drawing', params: to.params, query: to.query, hash: to.hash }),
      children: [
        {
          // 默认子路由：打开项目直接进图纸编辑（架构决策 5.6），不再进概览
          path: '',
          name: 'project-drawing',
          component: () => import('@/views/DrawingView.vue'),
          props: true,
          meta: { title: '图纸编辑' },
        },
        {
          path: 'dashboard',
          name: 'project-dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '项目概览' },
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '项目概览', advanced: true, hidden: true },
        },
        {
          path: 'drawing/:drawingId?',
          name: 'Drawing',
          component: () => import('@/views/DrawingView.vue'),
          props: true,
          meta: { title: '图纸编辑' },
        },
        {
          path: 'settings',
          name: 'project-settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: '项目设置' },
        },
        {
          path: 'export',
          name: 'project-export',
          component: () => import('@/views/ExportView.vue'),
          meta: { title: '导出与报告' },
        },
        {
          path: 'export/:drawingId?',
          name: 'export',
          component: () => import('@/views/ExportView.vue'),
          props: true,
          meta: { title: '导出与报告' },
        },
      ],
    },
    {
      path: '/device-library',
      name: 'DeviceLibrary',
      component: () => import('@/views/DeviceLibraryView.vue'),
      meta: { title: '设备库管理', advanced: true, hidden: true },
    },
    {
      // device-library 为历史命名别名
      path: '/device-library',
      name: 'device-library',
      component: () => import('@/views/DeviceLibraryView.vue'),
      meta: { title: '设备库管理', advanced: true, hidden: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('@/views/HelpView.vue'),
      meta: { title: '帮助文档', advanced: true, hidden: true },
    },
    {
      path: '/help',
      name: 'Help',
      component: () => import('@/views/HelpView.vue'),
      meta: { title: '帮助文档', advanced: true, hidden: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面未找到' },
    },
  ],
});

// 路由守卫
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '安防勘点设计工具'} - 安防勘点设计工具`;

  if (to.meta.requiresProject) {
    // 实际项目中检查项目是否加载
    // const projectStore = useProjectStore();
    // if (!projectStore.currentProject) {
    //   next({ name: 'home' });
    //   return;
    // }
  }

  next();
});

export default router;
