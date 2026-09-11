<template>
  <!-- 多页 PDF 选页对话框（AC-1.3 "PDF 取首页或让用户选页"）。非阻塞、可关闭。 -->
  <Teleport to="body">
    <div class="pdf-pick-mask" @click.self="dismiss">
      <div class="pdf-pick" role="dialog" aria-modal="true" aria-labelledby="pdf-pick-title">
        <header class="pp-head">
          <h3 id="pdf-pick-title">选择 PDF 底图页面</h3>
          <button class="pp-close" title="关闭" @click="dismiss">×</button>
        </header>

        <p class="pp-lead">
          「{{ name }}」共 <b>{{ pageCount }}</b> 页，请选择作为底图的一页（默认首页）：
        </p>

        <div class="pp-nav">
          <button class="pp-btn" :disabled="selected <= 0" @click="prev">‹ 上一页</button>
          <div class="pp-page">
            <input
              class="pp-num"
              type="number"
              min="1"
              :max="pageCount"
              :value="selected + 1"
              @input="onInput"
              aria-label="页码"
            />
            <span class="pp-total">/ {{ pageCount }} 页</span>
          </div>
          <button class="pp-btn" :disabled="selected >= pageCount - 1" @click="next">下一页 ›</button>
        </div>

        <footer class="pp-foot">
          <span class="pp-note">选择后立即重新栅格化该页并覆盖当前底图</span>
          <div class="pp-actions">
            <button class="pp-btn" @click="dismiss">稍后再说</button>
            <button class="pp-btn pp-btn-primary" @click="confirm">使用第 {{ selected + 1 }} 页</button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * PdfPagePicker —— 多页 PDF 选页（T5b-1）。
 * 由 useBaselineImport().pdfPagePick 驱动：非空即显示，选页后重栅格化并覆盖底图。
 * 不渲染缩略图（每页实时栅格化成本高且非核心诉求），仅提供页码导航。
 */
import { ref, watch } from 'vue';

const props = defineProps<{
  name: string;
  pageCount: number;
}>();

const emit = defineEmits<{
  (e: 'confirm', pageIndex: number): void;
  (e: 'dismiss'): void;
}>();

const selected = ref(0);

// 文件切换时回到首页
watch(
  () => props.name,
  () => {
    selected.value = 0;
  },
);

function clamp(v: number): number {
  const n = Math.round(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n - 1, 0), Math.max(props.pageCount - 1, 0));
}

function onInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  selected.value = clamp(val);
}

function prev() {
  if (selected.value > 0) selected.value -= 1;
}

function next() {
  if (selected.value < props.pageCount - 1) selected.value += 1;
}

function confirm() {
  emit('confirm', selected.value);
}

function dismiss() {
  emit('dismiss');
}
</script>

<style scoped>
.pdf-pick-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.pdf-pick {
  width: min(460px, 100%);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.24);
  padding: 18px 20px 16px;
}

.pp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.pp-head h3 {
  margin: 0;
  font-size: 16px;
}

.pp-close {
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: #9ca3af;
}

.pp-lead {
  margin: 0 0 14px;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}

.pp-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.pp-page {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.pp-num {
  width: 64px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.pp-total {
  font-size: 13px;
  color: #6b7280;
}

.pp-foot {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pp-note {
  font-size: 12px;
  color: #9ca3af;
}

.pp-actions {
  display: flex;
  gap: 8px;
}

.pp-btn {
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.pp-btn:hover:not(:disabled) {
  border-color: #9ca3af;
}

.pp-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pp-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.pp-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
}
</style>
