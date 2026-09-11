// 渲染进程单元测试配置（T2 起引入）
// 独立于 vite.config.ts：后者带 electron-builder / electron-renderer 插件，
// 在 vitest 的 node+jsdom 环境下会尝试打包主进程入口，故单列一份精简配置。
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../packages/shared-types/src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'dist-electron', '**/*.bak-*'],
  },
});
