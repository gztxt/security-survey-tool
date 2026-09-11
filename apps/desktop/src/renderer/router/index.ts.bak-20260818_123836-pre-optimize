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
      path: '/project/:id?',
      name: 'project',
      component: () => import('@/views/ProjectView.vue'),
      meta: { title: '项目编辑', requiresProject: true },
      children: [
        {
          path: '',
          name: 'project-dashboard',
          component: () => import('@/views/project/DashboardView.vue'),
        },
        {
          path: 'drawing/:drawingId?',
          name: 'project-drawing',
          component: () => import('@/views/project/DrawingView.vue'),
          props: true,
        },
        {
          path: 'settings',
          name: 'project-settings',
          component: () => import('@/views/project/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/device-library',
      name: 'device-library',
      component: () => import('@/views/DeviceLibraryView.vue'),
      meta: { title: '设备库管理' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('@/views/HelpView.vue'),
      meta: { title: '帮助文档' },
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