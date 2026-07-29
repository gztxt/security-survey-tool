// 主应用入口
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './styles/main.scss';

// 创建应用
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err, info);
  // 可上报到 Sentry 等
};

// 挂载
app.mount('#app');

// 注册 Service Worker (PWA)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}