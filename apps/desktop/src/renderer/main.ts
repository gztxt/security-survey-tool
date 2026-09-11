// 主应用入口
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import router from './router';
import App from './App.vue';
import './styles/main.scss';

// 创建应用
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err, info);
  // 可上报到 Sentry 等
};

// 挂载
app.mount('#app');

// 初始化导出服务（必须在 pinia 挂载后，确保 store 可用）。
//
// 这里刻意用**动态 import** 而不是顶层 import：exportService 会连带拉起
// @security-survey/exporter → pdfkit / xlsx / jspdf 一整条重依赖链
// （vendor-export chunk 约 1.3MB+）。同步 import 会让它们在首屏渲染前就求值，
// 一旦这些包里有任何启动期异常（历史上就是残留的 require("fs") 抛
// ReferenceError），整个渲染进程会直接崩溃，用户看到的只是「双击无反应」。
// 改成异步加载后，导出功能只是延后几百毫秒可用，首屏不再被它绑架。
import('./services/exportService')
  .then(({ exportService }) => {
    // exportService 在模块导入时自动构造并注册 IPC 监听
    void exportService;
  })
  .catch((err) => {
    console.error('[renderer] 导出服务加载失败（导出功能将不可用，其余功能不受影响）:', err);
  });

// 注册 Service Worker (PWA)
//
// 只在**真实 Web 环境**（http/https）下注册。Electron 打包后页面走 file:// 协议，
// ServiceWorker 规范不支持 file: origin，注册必然失败并在控制台刷
// "Failed to register a ServiceWorker ... An unknown error occurred when fetching the script"。
// 这个错误虽然不致命，但每次启动都刷一遍会掩盖真正的问题，也让人误以为启动失败。
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}