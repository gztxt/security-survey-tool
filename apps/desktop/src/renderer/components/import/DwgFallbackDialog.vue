<template>
  <!-- DWG 无 ODA 降级引导（AC-2.2 三选一 + 「稍后再说」，非阻塞、可关闭） -->
  <Teleport to="body">
    <div v-if="files.length" class="dwg-fallback-mask" @click.self="later">
      <div class="dwg-fallback" role="dialog" aria-modal="true" aria-labelledby="dwg-fb-title">
        <header class="df-head">
          <h3 id="dwg-fb-title">DWG 文件需要转换</h3>
          <button class="df-close" title="关闭" @click="later">×</button>
        </header>

        <p class="df-lead">
          以下 DWG 文件无法直接解析（DWG 需转换，推荐另存 DXF）：
        </p>
        <ul class="df-files">
          <li v-for="p in files" :key="p" :title="p">{{ base(p) }}</li>
        </ul>

        <ol class="df-options">
          <li>
            <div class="df-opt-title">
              <span class="df-rec">推荐</span>
              在 CAD 软件中把该 DWG <b>另存为 DXF（R2010+）</b>，然后重新导入
            </div>
            <div class="df-opt-actions">
              <button class="df-btn" @click="openGuide">查看操作图示</button>
              <button class="df-btn df-btn-primary" @click="pickDxf">选择 DXF 文件</button>
            </div>
          </li>
          <li>
            <div class="df-opt-title">作为图片底图导入（仅描图用，不可编辑图元）</div>
            <div class="df-opt-hint">可先用系统的「打印为图片」或截图，再导入生成的 PNG/JPG</div>
            <div class="df-opt-actions">
              <button class="df-btn" @click="asRaster">选择图片文件</button>
            </div>
          </li>
          <li>
            <div class="df-opt-title">安装 ODA File Converter 以启用直接转换</div>
            <div class="df-opt-hint">
              安装后重启应用即可自动识别；也可通过环境变量 <code>ODA_PATH</code> 指定可执行文件路径
            </div>
            <div class="df-opt-actions">
              <button class="df-btn" @click="openOdaSite">前往 ODA 下载页</button>
            </div>
          </li>
        </ol>

        <footer class="df-foot">
          <span class="df-note">任何选择都不会丢失当前项目内容</span>
          <button class="df-btn" @click="later">稍后再说</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * DwgFallbackDialog —— DWG 降级引导（决策 3.2 / US-02）。
 *
 * 由 useBaselineImport().fallbackFiles 驱动：非空即显示，不阻塞主线程。
 * 三个出口：
 *   - 选项 1 → 跳帮助文档（"查看操作图示"）或直接重新走对话框选 DXF
 *   - 选项 2 → 走位图链（用户选图片后按 basemap 导入）
 *   - 选项 3 → 外链 ODA 下载页（走桥的 shell.openExternal，协议受主进程白名单约束）
 *   - 「稍后再说」→ 仅清空 files，项目与画布不动（AC-2.3）
 *
 * 文案红线：不承诺 DWG 默认可转换（AC-2.4），统一"DWG 需转换，推荐另存 DXF"。
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/project';
import { ALL_IMPORT_EXTENSIONS, basenameOf } from '@/composables/useBaselineImport';

const props = defineProps<{
  /** 待决策的 DWG 路径（空数组 = 不显示） */
  files: string[];
}>();

const emit = defineEmits<{
  /** 用户改选 DXF 路径（父级转交 importPaths） */
  (e: 'import', paths: string[]): void;
  /** 用户选择图片作为描图底图 */
  (e: 'asRaster', paths: string[]): void;
  /** 关闭：父级清空 fallbackFiles */
  (e: 'dismiss'): void;
}>();

const projectStore = useProjectStore();
const router = useRouter();

const visibleFiles = computed(() => (Array.isArray(props.files) ? props.files : []));
const bridgeReady = computed(() => projectStore.hasBridge());

function base(p: string): string {
  return basenameOf(p);
}

function later() {
  emit('dismiss');
}

async function pickDxf() {
  const picked = await pickByExtensions(['dxf']);
  if (picked.length) {
    emit('import', picked);
    emit('dismiss');
  }
}

async function asRaster() {
  const picked = await pickByExtensions(['png', 'jpg', 'jpeg']);
  if (picked.length) {
    emit('asRaster', picked);
    emit('dismiss');
  }
}

/** 用原生对话框按指定扩展名再选一次文件 */
async function pickByExtensions(exts: string[]): Promise<string[]> {
  if (!bridgeReady.value) {
    ElMessage.warning('当前环境不支持文件选择，请在桌面应用中操作');
    return [];
  }
  try {
    const result = await window.api.fs.showOpenDialog({
      title: '选择可导入的底图',
      filters: [
        { name: '底图', extensions: exts.length ? exts : [...ALL_IMPORT_EXTENSIONS] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    return (result?.filePaths || []).slice();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '文件选择失败');
    return [];
  }
}

/** 操作图示走内置帮助路由（AC-2.2 要求可达，且 P2 归档后仍可用） */
function openGuide() {
  try {
    router.push({ name: 'help' });
  } catch {
    ElMessage.info('帮助文档暂不可达，请查阅项目 README 中的导入说明');
  }
  emit('dismiss');
}

/** 外链走桥（主进程有 http/https 协议白名单；无桥时不伪装成功） */
async function openOdaSite() {
  const url = 'https://www.opendesign.com/guestfiles/oda_file_converter';
  if (!bridgeReady.value) {
    ElMessage.info('请在浏览器中打开：' + url);
    return;
  }
  try {
    await window.api.shell.openExternal(url);
  } catch {
    ElMessage.info('请手动访问：' + url);
  }
  emit('dismiss');
}
</script>

<style scoped>
.dwg-fallback-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.dwg-fallback {
  width: min(640px, 100%);
  max-height: 86vh;
  overflow: auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.24);
  padding: 18px 20px 16px;
}

.df-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.df-head h3 {
  margin: 0;
  font-size: 16px;
}

.df-close {
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: #9ca3af;
}

.df-lead {
  margin: 0 0 6px;
  font-size: 13px;
  color: #4b5563;
}

.df-files {
  margin: 0 0 12px;
  padding-left: 20px;
  font-size: 12px;
  color: #6b7280;
  max-height: 84px;
  overflow: auto;
}

.df-options {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}

.df-opt-title {
  color: #111827;
}

.df-rec {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 8px;
  background: #dcfce7;
  color: #166534;
  font-size: 11px;
}

.df-opt-hint {
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}

.df-opt-actions {
  margin-top: 6px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.df-btn {
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}

.df-btn:hover {
  border-color: #9ca3af;
}

.df-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.df-btn-primary:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.df-foot {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.df-note {
  font-size: 12px;
  color: #9ca3af;
}

code {
  background: #f3f4f6;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
