// 路由配置
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
