<template>
  <div class="home-view">
    <!-- Hero 区域 -->
    <section class="hero">
      <div class="hero-content">
        <h1>安防勘点设计工具</h1>
        <p class="subtitle">专业的弱电安防图纸勘点、布线设计与方案导出工具</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" @click="newProject">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            新建项目
          </button>
          <button class="btn btn-secondary btn-lg" @click="openProject()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            打开项目
          </button>
        </div>
      </div>
      <div class="hero-visual">
        <div class="dashboard-preview">
          <div class="preview-tabs">
            <span class="tab active">1F平面图</span>
            <span class="tab">2F平面图</span>
            <span class="tab">拓扑图</span>
          </div>
          <div class="preview-canvas">
            <div class="preview-grid"></div>
            <div class="preview-devices">
              <div class="device dome" style="left: 20%; top: 30%"></div>
              <div class="device bullet" style="left: 70%; top: 25%"></div>
              <div class="device ptz" style="left: 50%; top: 70%"></div>
              <div class="device well" style="left: 85%; top: 50%"></div>
            </div>
            <svg class="preview-wiring" viewBox="0 0 100 100">
              <path d="M20 30 L50 50 M70 25 L50 50 M50 50 L50 65 M50 65 L85 50" stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      </div>
    </section>

    <!-- 特性展示 -->
    <section class="features">
      <div class="feature-card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <h3>多格式图纸导入</h3>
        <p>支持 DWG/DXF/PDF/JPG/PNG，大文件流式解析，ODA 转换器离线转 DWG</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8"></polygon>
          </svg>
        </div>
        <h3>智能比例尺校准</h3>
        <p>两点标定自动计算比例，标尺实时显示，测量误差 <1%</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2"></path>
            <path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"></path>
            <path d="M2 12h2M20 12h2"></path>
            <path d="M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
          </svg>
        </div>
        <h3>视野仿真分析</h3>
        <p>锥体 FOV 实时渲染，盲区可视化，多设备覆盖叠加分析，批量部署一键完成</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"></rect>
            <path d="M8 21h8"></path>
            <path d="M12 17v4"></path>
          </svg>
        </div>
        <h3>自动/手动布线</h3>
        <p>最小生成树自动布线，正交路径手动调整，弱电井/桥架可视化，线缆长度自动统计</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <h3>多格式方案导出</h3>
        <p>点位图/视野图/拓扑图(PNG/PDF)，设备清单/线缆清单(Excel)，完整方案报告(PDF)</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <h3>完全离线可用</h3>
        <p>无需登录云端，本地文件存储，内网隔离环境可用，数据不出本地</p>
      </div>
    </section>

    <!-- 最近项目 -->
    <section class="recent-projects" v-if="recentProjects.length > 0">
      <div class="section-header">
        <h2>最近打开的项目</h2>
        <button class="btn btn-text" @click="clearRecent">清空</button>
      </div>
      <div class="project-list">
        <div class="project-card" v-for="proj in recentProjects" :key="proj.id" @click="openProject(proj.path)">
          <div class="project-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="project-info">
            <h4>{{ proj.name }}</h4>
            <p>{{ formatDate(proj.lastOpened) }}</p>
          </div>
          <div class="project-action">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部信息 -->
    <footer class="footer">
      <p>安防勘点设计工具 v0.0.1 | 完全开源免费 | <a href="https://github.com" target="_blank">GitHub</a> | <a href="#" @click.prevent="showHelp">帮助文档</a></p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';

const router = useRouter();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const recentProjects = ref<any[]>([]);

onMounted(() => {
  recentProjects.value = settingsStore.recentProjects || [];
});

function newProject() {
  router.push({ name: 'project-new' });
}

function openProject(path?: string) {
  if (path) {
    router.push({ name: 'project', params: { id: path } });
  } else {
    router.push({ name: 'project' });
  }
}

function clearRecent() {
  settingsStore.clearRecentProjects();
  recentProjects.value = [];
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function showHelp() {
  router.push({ name: 'help' });
}
</script>

<style scoped>
.home-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  padding: 4rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  align-items: center;
}

.hero-content h1 {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  max-width: 400px;
}

.hero-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-text {
  background: transparent;
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
}

.btn-text:hover {
  color: var(--text-primary);
}

.icon {
  width: 20px;
  height: 20px;
}

.hero-visual {
  display: flex;
  justify-content: center;
}

.dashboard-preview {
  width: 100%;
  max-width: 500px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.preview-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.preview-tabs .tab {
  flex: 1;
  padding: 0.75rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.preview-tabs .tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: var(--bg-secondary);
}

.preview-canvas {
  position: relative;
  height: 300px;
  background: var(--bg-primary);
}

.preview-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-color) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.3;
}

.preview-devices {
  position: absolute;
  inset: 0;
}

.preview-devices .device {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transform: translate(-50%, -50%);
}

.preview-devices .device.dome {
  background: #3b82f6;
}

.preview-devices .device.bullet {
  background: #3b82f6;
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  border-radius: 0;
}

.preview-devices .device.ptz {
  background: #8b5cf6;
  width: 20px;
  height: 20px;
}

.preview-devices .device.well {
  background: #6b7280;
  clip-path: polygon(0 0, 100% 0, 80% 100%, 20% 100%);
  border-radius: 0;
}

.preview-wiring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0 2rem 3rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.feature-card {
  padding: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s;
}

.feature-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.08);
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  color: white;
}

.feature-icon svg {
  width: 24px;
  height: 24px;
}

.feature-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.feature-card p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.recent-projects {
  padding: 0 2rem 3rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: #3b82f6;
  background: var(--bg-tertiary);
}

.project-icon {
  width: 40px;
  height: 40px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
}

.project-icon svg {
  width: 20px;
  height: 20px;
}

.project-info h4 {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.project-info p {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.project-action {
  margin-left: auto;
  color: var(--text-tertiary);
}

.project-action svg {
  width: 20px;
  height: 20px;
}

.footer {
  margin-top: auto;
  padding: 1.5rem 2rem;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.875rem;
  border-top: 1px solid var(--border-color);
}

.footer a {
  color: #3b82f6;
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .hero-actions {
    justify-content: center;
  }
  .hero-visual {
    order: -1;
  }
}
</style>