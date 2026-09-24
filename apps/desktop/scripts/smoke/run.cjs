// 两阶段真实验收：阶段 1（起 app → 建项目 + 落盘 → 关 app）
//                阶段 2（重新起一个全新进程 → 验证重启后的重开/复制/归档/撤销/导出）
// 分阶段的理由：授权清单与索引持久化只能在"进程真的重启"后验证，页面内 reload 不足以证明。
const { spawn } = require('child_process');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 运行时前提显式化：CDP 客户端（cdp.cjs）用全局 WebSocket。node ≥22 默认可用，
// node 20 需要 --experimental-websocket。曾因 harness 隐式依赖 node 版本，在
// 系统默认 node 20 上以 "WebSocket is not defined" 崩在 attach()，并把整套产品
// 验收误报为失败（假红：真机 39 项报 2 红、单测报 9 红，全部与产品无关）。
//
// 真正需要该 flag 的是 accept.cjs（它 require cdp.cjs），所以必须做两件事：
//   1) 子进程统一用 process.execPath 起，避免父进程用 A 版本 node、子进程按 PATH
//      找到 B 版本 node 的错代；
//   2) 把 flag 经 NODE_OPTIONS 传给子进程（NODE_OPTIONS 对 node 20 该 flag 有效）。
// 检测 + 一次性自我重启，使验收不再依赖"恰好用了哪个 node"。
const wsFlag = '--experimental-websocket';
const needsWsFlag = typeof WebSocket === 'undefined';
if (needsWsFlag && !process.env.SMOKE_WS_REEXEC) {
  const child = spawn(process.execPath, [wsFlag, __filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SMOKE_WS_REEXEC: '1',
      NODE_OPTIONS: process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ${wsFlag}` : wsFlag,
    },
  });
  child.on('exit', code => process.exit(code == null ? 1 : code));
  return;
}
const ready = () => new Promise(res => {
  http.get('http://127.0.0.1:9222/json', r => { r.on('data', () => res(true)); }).on('error', () => res(false)); });

async function phase(n) {
  // 子进程用 process.execPath 而非 PATH 上的 'node'：否则父进程（可能已带
  // --experimental-websocket 重启）与 accept.cjs 会落到不同版本的 node 上。
  const app = spawn(process.execPath, ['scripts/smoke/launch.cjs'], { stdio: ['ignore', 'inherit', 'inherit'] });
  for (let i = 0; i < 40; i++) { if (await ready()) break; await sleep(500); }
  const code = await new Promise(res => {
    const t = spawn(process.execPath, ['scripts/smoke/accept.cjs'], { stdio: 'inherit', env: { ...process.env, ACCEPT_PHASE: String(n) } });
    t.on('exit', c => res(c));
  });
  app.kill('SIGKILL');
  await sleep(1500); // 等 CDP 端口释放
  return code;
}
(async () => {
  // Electron userData（含 localStorage：projects-index 等）必须在阶段 1 之前清空。
  // 曾因只清 SMOKE_WORK 而留着上轮 profile，索引里叠了 3 条陈旧项目，
  // R4b/R5a/R6/R7b 这类"精确计数"断言全部假红 —— 断言的是真实持久化语义，
  // 错的是夹具隔离，故此处补隔离而不是放宽断言。阶段 2 必须复用同一 profile，
  // 才能验证"进程重启后仍在"。
  const { rmSync } = require('fs');
  const profile = process.env.PROFILE || '/tmp/am-smoke-profile';
  rmSync(profile, { recursive: true, force: true });
  console.log('[fixture] 清空 userData profile:', profile);

  console.log('===== 阶段 1：新建项目并真实落盘（随后关闭应用） =====');
  const c1 = await phase(1);
  console.log('[phase1 exit]', c1);
  if (c1 !== 0) process.exit(c1 === 2 ? 2 : 3);
  console.log('\n===== 阶段 2：全新进程接续验收 =====');
  const c2 = await phase(2);
  console.log('[phase2 exit]', c2);
  process.exit(c2);
})();
