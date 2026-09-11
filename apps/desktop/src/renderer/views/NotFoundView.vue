<template>
  <div class="not-found-view">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <h1 class="error-title">页面未找到</h1>
      <p class="error-desc">您访问的页面不存在，或已被移动/删除</p>

      <div class="error-actions">
        <el-button type="primary" @click="goHome" icon="House">
          返回首页
        </el-button>
        <el-button @click="goBack" icon="Back">
          返回上一页
        </el-button>
        <el-button @click="openHelp" icon="QuestionFilled">
          查看帮助
        </el-button>
      </div>

      <div class="error-suggestions">
        <h4>可能有帮助的页面：</h4>
        <div class="suggestion-links">
          <el-button size="small" text @click="navigateTo('Dashboard')">仪表盘</el-button>
          <el-button size="small" text @click="navigateTo('Drawing')">图纸设计</el-button>
          <el-button size="small" text @click="navigateTo('DeviceLibrary')">设备库</el-button>
          <el-button size="small" text @click="navigateTo('Export')">导出报告</el-button>
          <el-button size="small" text @click="navigateTo('Settings')">设置</el-button>
          <el-button size="small" text @click="navigateTo('Help')">帮助文档</el-button>
        </div>
      </div>

      <div class="error-decoration">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="80" fill="url(#glow)"/>
          <g stroke="#3b82f6" stroke-width="2" fill="none" opacity="0.3">
            <circle cx="100" cy="100" r="30">
              <animate attributeName="r" values="30;60" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="100" cy="100" r="30">
              <animate attributeName="r" values="30;60" dur="2s" repeatCount="indefinite" begin="1s"/>
              <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" begin="1s"/>
            </circle>
          </g>
          <path d="M100 60 L100 100 L130 130" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.5"/>
          <circle cx="130" cy="130" r="4" fill="#3b82f6" opacity="0.5"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { House, Back, QuestionFilled } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();

function goHome() {
  router.push({ name: 'Dashboard' });
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    goHome();
  }
}

function openHelp() {
  router.push({ name: 'Help' });
}

function navigateTo(name: string) {
  router.push({ name });
}
</script>

<style scoped>
.not-found-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.not-found-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
  max-width: 480px;
  position: relative;
  z-index: 1;
}

.error-code {
  font-size: 96px;
  font-weight: 800;
  color: var(--border-color);
  line-height: 1;
  margin-bottom: 16px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  background: linear-gradient(135deg, var(--border-color), var(--text-tertiary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.error-title {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.error-desc {
  margin: 0 0 32px;
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 40px;
  flex-wrap: wrap;
  justify-content: center;
}

.error-suggestions {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
  width: 100%;
  text-align: left;
}

.error-suggestions h4 {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.suggestion-links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.error-decoration {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
}

@media (max-width: 600px) {
  .error-code {
    font-size: 64px;
  }

  .error-title {
    font-size: 22px;
  }

  .error-actions {
    flex-direction: column;
    width: 100%;
  }

  .error-actions .el-button {
    width: 100%;
  }
}
</style>