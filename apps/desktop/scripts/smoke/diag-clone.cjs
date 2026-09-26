// 一次性的 IPC 克隆机制探针（诊断用，非验收项）
//
// 目的：判定 "An object could not be cloned" 的真实触发条件 ——
// 究竟是「Vue reactive Proxy 不能跨 IPC」，还是某个具体字段不可序列化。
//
// 方法：在同一个真实 Electron 进程里，用同一条 export:pointMap IPC 通道，
// 分别发送 ① reactive Proxy 形态的对象 ② 同内容的纯对象，比较返回/报错差异。
const { spawn } = require('child_process');
const http = require('http');
const { attach } = require('./cdp.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PORT = process.env.CDP_PORT || '9223';
// attach() 内部读的是**本进程**的 CDP_PORT，必须在这里也设上
process.env.CDP_PORT = PORT;
const ready = () => new Promise(res => {
  http.get('http://127.0.0.1:' + PORT + '/json', r => { r.on('data', () => res(true)); }).on('error', () => res(false));
});

(async () => {
  const app = spawn(process.execPath, ['scripts/smoke/launch.cjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CDP_PORT: PORT, PROFILE: '/tmp/am-diag-profile' },
  });
  app.stderr.on('data', d => process.stderr.write('[app] ' + d));
  let up = false;
  for (let i = 0; i < 60; i++) { if (await ready()) { up = true; break; } await sleep(500); }
  if (!up) { console.log('FAILED: app did not open devtools port'); app.kill('SIGKILL'); process.exit(1); }

  await sleep(2500); // 等渲染进程首屏挂载（pinia stores 注册）
  const p = await attach(t => (t.url || '').indexOf('file://') === 0 || /localhost|index/.test(t.url || ''));

  const out = await p.eval(`
    (async () => {
      const appEl = document.querySelector('#app');
      const vueApp = appEl && appEl.__vue_app__;
      const pinia = vueApp && vueApp.config.globalProperties.$pinia;
      const pStore = pinia && pinia._s.get('project');
      const results = {};
      const probe = async (label, payload) => {
        try {
          await window.api.export.pointMap(payload);
          results[label] = 'NO_THROW';
        } catch (e) {
          results[label] = String(e && e.message || e).slice(0, 120);
        }
      };
      const base = { drawingIds: [], formats: ['png'], include: {}, canvasSnapshots: {}, resolution: 300, outputDir: '' };
      // ① 纯对象（对照组）
      await probe('1_plain_project', { ...base, project: { id: 'p', name: 'n', drawings: [], settings: {} } });
      // ② reactive Proxy 形态：project store 的 $state（一定存在且为响应式）
      if (pStore) {
        await probe('2_reactive_marker', { ...base, project: { id: 'p', name: 'n', drawings: [], settings: {} }, marker: pStore.$state });
        await probe('3_plain_marker', { ...base, project: { id: 'p', name: 'n', drawings: [], settings: {} }, marker: JSON.parse(JSON.stringify(pStore.$state)) });
      } else {
        results['2_reactive_marker'] = 'no project store';
      }
      return results;
    })()
  `, true);

  console.log('=== DIAG RESULT ===');
  console.log(JSON.stringify(out, null, 2));
  p.close();
  app.kill('SIGKILL');
  process.exit(0);
})().catch(e => { console.error('DIAG ERROR', e); process.exit(1); });
