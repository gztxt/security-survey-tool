#!/usr/bin/env node
/**
 * win-smoke.mjs —— 在**真实 Windows**（或 wine）上验收本品的 Windows 产物
 *
 * 为什么用 Node 而不是 PowerShell：PowerShell 脚本在本机（NAS/Linux）无法做任何
 * 语法或逻辑校验，等于交付一段没人验过的代码。Node 脚本可以在交付前完成三重验证：
 *   1) node --check 语法；
 *   2) 判定逻辑用抓到的真实 CDP 载荷做单测（scripts/win-smoke-selftest.mjs）；
 *   3) 在 electronuserland/builder:wine 容器里对着**真 Windows exe** 实跑一遍。
 *
 * 门禁刻意只用 **CDP 的 HTTP 端点**（/json/version、/json/list）—— 这两个在任何
 * Node 版本、任何 Windows 机器上都可用，不需要 WebSocket。DOM 检查（需要 WS）
 * 作为加分项，缺能力时明确报 SKIP，不假装通过。
 *
 * 用法（在 Windows 上，PowerShell 或 cmd）：
 *   node scripts\win-smoke.mjs --exe "C:\Program Files\安防勘点设计工具\安防勘点设计工具.exe"
 *   node scripts\win-smoke.mjs --exe "D:\dl\安防勘点设计工具 0.0.1.exe" --keep-open
 * 已手动启动应用时只连不启动：
 *   node scripts\win-smoke.mjs --attach-only
 *
 * 退出码：0 = 门禁全绿；1 = 有红项；2 = 用法/环境错误，或脚本自身异常
 * （异常走 2 是因为它同样属于"这次没测成"，不是被测对象的失败；两者靠
 *  stderr 上的 `脚本自身异常` 前缀区分）。
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_NAME = '安防勘点设计工具.exe';
const APP_ID = '@security-survey';
const ROUTER_TITLE_SUFFIX = ' - 安防勘点设计工具';

function parseArgs(argv) {
  const a = { port: 9222, waitSec: 120, attachOnly: false, keepOpen: false, exe: null, wsWaitSec: 20, runner: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--exe') a.exe = argv[++i];
    // --runner：把 exe 用某个前缀命令拉起，例 `--runner wine`。
    // 存在的意义是**让本脚本可以在 Linux 上端到端自测**（wine 里跑真 Windows exe），
    // 而不是只测纯判定函数。真 Windows 上不需要这个参数。
    else if (t === '--runner') a.runner = argv[++i];
    else if (t === '--port') a.port = Number(argv[++i]);
    else if (t === '--wait') a.waitSec = Number(argv[++i]);
    else if (t === '--ws-wait') a.wsWaitSec = Number(argv[++i]);
    else if (t === '--attach-only') a.attachOnly = true;
    else if (t === '--keep-open') a.keepOpen = true;
    else if (t === '--help' || t === '-h') a.help = true;
    else { console.error(`未知参数: ${t}`); process.exit(2); }
  }
  return a;
}

/** 纯 HTTP GET JSON：不用 fetch，兼容任何 Node ≥ 12。 */
function getJson(port, path, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = httpGet({ host: '127.0.0.1', port, path, timeout: timeoutMs }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ ok: true, json: JSON.parse(buf) }); }
        catch (e) { resolve({ ok: false, error: 'JSON 解析失败: ' + e.message, body: buf.slice(0, 200) }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '超时' }); });
  });
}

/**
 * 判定层（与 IO 解耦，便于用真实抓到的载荷做单测）。
 * 输入 CDP 的 version/list 两个 JSON，输出各项结论。
 */
export function judge(version, list) {
  const out = {};
  const ua = (version && version['User-Agent']) || '';
  out.browser = (version && version.Browser) || '';
  out.ua = ua;

  // W1 运行时栈：必须是 Windows。真机上这条几乎必然成立（我们不在 wine 里），
  // 但保留判据 —— 若某天误连到本机浏览器/别的 Electron，能立刻发现。
  out.W1_winStack = /Windows NT/i.test(ua);

  // W2 必须是本品的 Electron，而非机器上其它 Electron 应用冒充。
  out.W2_thisApp = ua.includes(APP_ID);

  // W2b 顺带记录 Electron/Chrome 版本，便于对照预期（Electron 28.2.0 / Chrome 120）
  const mE = ua.match(/Electron\/([\d.]+)/);
  const mC = (out.browser || '').match(/Chrome\/([\d.]+)/);
  out.electronVersion = mE ? mE[1] : null;
  out.chromeVersion = mC ? mC[1] : null;

  // W3 页面目标 + router 后缀标题：证明渲染层 JS 真执行过
  //（index.html 里的静态 <title>安防勘点设计工具</title> 不含 " - " 后缀，
  //  所以只判"非空"会假绿 —— 必须判后缀形式）。
  const pages = Array.isArray(list) ? list.filter((t) => t && t.type === 'page') : [];
  // 应用同时列出 dist/index.html（主窗口）与 dist/splash.html（启动画面）两个 page
  // 目标（wine 实测两者都在列），splash 没有 router、标题恒为空。
  // 原先 `pages.find(type==='page')` / `|| pages[0]` 会随机落到 splash ⇒ 正常渲染报成红。
  // 两个量必须分开取，不能互相顶替：
  //   W3（渲染层 JS 执行过）＝ **任一** page 带 router 后缀标题。
  //     后缀只可能由 router/index.ts 设置（静态 <title> 没有 " - " 前缀），
  //     所以"任一带后缀"仍是有效证据，不会假绿；而"只有主窗口带后缀才算"会假红
  //     （例如主窗口 url 变了形态、或标题出现在另一个真页面）。
  //   DOM 探针目标 ＝ 优先主窗口，其次任意带后缀标题的 page；绝不回落到 splash。
  const main = pages.find((t) => /dist\/index\.html/.test(t.url || ''));
  const titled = pages.find((t) => (t.title || '').endsWith(ROUTER_TITLE_SUFFIX));
  out.allPages = pages.map((p) => `${(p.url || '').split('/').slice(-2).join('/')}="${p.title}"`);
  out.W3_routerTitle = !!titled;
  const page = main || titled || null;
  out.pageTitle = page ? page.title || '' : '';
  out.pageUrl = page ? page.url || '' : '';
  out.W3_fromAsar = !!page && /app\.asar/.test(page.url || '');
  out.pageWsUrl = page && page.webSocketDebuggerUrl ? page.webSocketDebuggerUrl : null;
  return out;
}

/**
 * W4 业务子目录：由 main.ts 的 preloadResources() 显式 mkdirSync 的五个目录。
 * 判据用业务目录而非 AppData 根 —— 根目录与 Cache/Local Storage 都是 Electron
 * 自建的，只能证明"Electron 跑过"，证明不了本品的 main.ts 执行过。
 *
 * 大小写注意：Windows 文件系统大小写不敏感。main.ts 要建 `cache`，但 Chromium
 * 可能已先建 `Cache` ⇒ 落盘名是 `Cache`。必须按大小写不敏感匹配，否则会误报红
 * （这个假红在 wine 上实测踩过）。
 */
export function judgeUserData(appDataAppDir) {
  const BIZ = ['projects', 'templates', 'exports', 'cache', 'logs'];
  const res = { dir: appDataAppDir, present: [], missing: [], caseAliased: [] };
  let entries = [];
  if (existsSync(appDataAppDir)) {
    try { entries = readdirSync(appDataAppDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
    catch (e) { res.readError = e.message; }
  }
  for (const want of BIZ) {
    const hit = entries.find((e) => e.toLowerCase() === want);
    if (hit) { res.present.push(hit); if (hit !== want) res.caseAliased.push(`${want}→${hit}`); }
    else res.missing.push(want);
  }
  res.allPresent = res.missing.length === 0;
  return res;
}

function userDataDir() {
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), APP_ID, 'desktop');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', APP_ID, 'desktop');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), APP_ID, 'desktop');
}

function launch(exe, port, runner) {
  const args = ['--no-sandbox', '--disable-gpu', '--remote-debugging-port=' + port];
  const cmd = runner || exe;
  const allArgs = runner ? [exe, ...args] : args;
  const child = spawn(cmd, allArgs, { detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = [];
  const cap = (s) => (x) => { s.push(String(x).replace(/\r?\n$/, '')); if (s.length > 400) s.shift(); };
  child.stdout.on('data', cap(log));
  child.stderr.on('data', cap(log));
  child.on('error', (e) => log.push('SPAWN_ERROR ' + e.message));
  return { child, log };
}

/** DOM 层检查：需要 WebSocket（Node ≥ 22 才有全局）。缺能力时返回 SKIP 而非失败。 */
async function domCheck(wsUrl, waitSec) {
  if (!wsUrl) return { status: 'SKIP', why: '无 page webSocketDebuggerUrl' };
  if (typeof globalThis.WebSocket !== 'function') {
    return { status: 'SKIP', why: `当前 Node ${process.version} 无全局 WebSocket（需 ≥22，或 v20 加 --experimental-websocket）` };
  }
  return await new Promise((resolve) => {
    const finish = (r) => { try { ws.close(); } catch (e) {} resolve(r); };
    let ws;
    try { ws = new WebSocket(wsUrl); } catch (e) { return finish({ status: 'SKIP', why: 'WS 连接异常: ' + e.message }); }
    // 口径统一：只有"本脚本能力不足"才是 SKIP；连上/取不到数据在真机上都是故障证据。
    // 原先超时记 SKIP ⇒ 真机渲染层卡死会被读成"没测"而不是"测出问题"。
    const timer = setTimeout(() => finish({ status: 'FAIL', why: `WS 在 ${waitSec}s 内无响应（真机上渲染层应能应答）` }), waitSec * 1000);
    let id = 1;
    const pending = new Map();
    const errs = [];
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error).slice(0, 200))) : p.res(m.result); }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        errs.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0].slice(0, 200));
      }
    };
    // 注意别写成"wine 下必崩属预期"：本脚本是给**真实 Windows** 用的，真机上渲染层
    // 不该崩 ⇒ 连不上 WS 要如实报红/存疑，不能拿 wine 的已知缺陷当免死金牌。
    ws.onerror = () => { clearTimeout(timer); finish({ status: 'FAIL', why: 'WS 连接失败：真机上渲染层不应崩，请连同上方 title/url 一起回报' }); };
    ws.onopen = async () => {
      try {
        const call = (method, params = {}) => new Promise((res, rej) => { const my = id++; pending.set(my, { res, rej }); ws.send(JSON.stringify({ id: my, method, params })); });
        await call('Runtime.enable');
        const r = await call('Runtime.evaluate', {
          expression: `(() => {
            const q = (s) => document.querySelectorAll(s);
            const text = (document.body && (document.body.innerText || document.body.textContent) || '');
            return {
              title: document.title,
              appMounted: !!(document.querySelector('#app') && document.querySelector('#app').firstElementChild),
              featureCards: q('.feature-card').length,
              canvasCount: q('canvas').length,
              textLen: text.trim().length,
              textSample: text.replace(/\\s+/g,' ').trim().slice(0,120),
              hasHomeCopy: /多格式图纸导入|智能比例尺校准|完全离线可用/.test(text)
            };
          })()`,
          returnByValue: true,
        });
        clearTimeout(timer);
        if (r.exceptionDetails) return finish({ status: 'SKIP', why: '页面求值异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 200) });
        const v = r.result.value;
        const pass = v.appMounted && v.featureCards > 0 && v.hasHomeCopy && v.textLen > 30;
        finish({ status: pass ? 'PASS' : 'FAIL', probe: v, exceptions: [...new Set(errs)].slice(0, 5) });
      } catch (e) { clearTimeout(timer); finish({ status: 'SKIP', why: 'CDP 调用失败: ' + e.message }); }
    };
  });
}

const GATE = [
  ['W1_winStack', '运行时栈为 Windows（CDP UA 含 Windows NT）'],
  ['W2_thisApp', '本品 Electron（UA 含 @security-survey/desktop）'],
  ['W3_routerTitle', '渲染层 JS 执行过（router 后缀标题）'],
  ['W4_businessDirs', 'main.ts 建齐 5 个业务子目录'],
];

async function main() {
  const A = parseArgs(process.argv.slice(2));
  if (A.help) {
    console.log('用法: node scripts/win-smoke.mjs --exe "<安防勘点设计工具.exe 完整路径>" [--port 9222] [--wait 120] [--attach-only] [--keep-open]');
    process.exit(0);
  }
  console.log(`== 环境 == node ${process.version} | ${process.platform} ${process.arch} | exe=${A.exe || '(attach-only)'} | port=${A.port}${A.runner ? ' | runner=' + A.runner : ''}`);
  if (!A.attachOnly && !A.exe) { console.error('!! 必须给 --exe <路径>，或用 --attach-only 连已启动的应用'); process.exit(2); }
  if (!A.attachOnly && !existsSync(A.exe)) { console.error(`!! exe 不存在: ${A.exe}`); process.exit(2); }
  if (A.runner && A.runner !== 'wine' && !existsSync(A.runner)) { console.error(`!! runner 不存在: ${A.runner}`); process.exit(2); }

  let child = null, log = [];
  if (!A.attachOnly) { const l = launch(A.exe, A.port, A.runner); child = l.child; log = l.log; }

  console.log(`== 等 CDP 就绪（最多 ${A.waitSec}s）==`);
  let version = null, list = null;
  const t0 = Date.now();
  while (Date.now() - t0 < A.waitSec * 1000) {
    if (child && child.exitCode !== null) { console.log(`!! 应用进程已退出 code=${child.exitCode} signal=${child.signalCode}`); break; }
    const v = await getJson(A.port, '/json/version');
    if (v.ok) {
      const l = await getJson(A.port, '/json/list');
      if (l.ok && Array.isArray(l.json)) {
        version = v.json; list = l.json;
        const pages = list.filter((x) => x.type === 'page');
        if (pages.some((x) => (x.title || '').endsWith(ROUTER_TITLE_SUFFIX))) break;
        if (pages.length && child && child.exitCode === null && Date.now() - t0 > 15000) break; // 渲染崩了也别死等
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!version) {
    console.log(`FAIL: ${A.waitSec}s 内 CDP 未就绪`);
    if (log.length) console.log('--- 应用输出尾部 ---\n' + log.slice(-25).join('\n'));
    if (child) child.kill();
    process.exit(1);
  }

  const J = judge(version, list);
  console.log(`  Browser=${J.browser} Electron=${J.electronVersion} Chrome=${J.chromeVersion}`);
  console.log(`  page title="${J.pageTitle}"`);
  console.log(`  page url=${J.pageUrl.slice(0, 100)}`);

  const UD = judgeUserData(userDataDir());
  console.log(`  用户数据目录 ${UD.dir}`);
  console.log(`    存在: ${UD.present.join(' ') || '(无)'}${UD.caseAliased.length ? '（大小写别名: ' + UD.caseAliased.join(', ') + '）' : ''}`);
  if (UD.missing.length) console.log(`    缺失: ${UD.missing.join(' ')}`);
  J.W4_businessDirs = UD.allPresent;

  console.log('== DOM 层检查（需 WebSocket，加分项）==');
  const dom = await domCheck(J.pageWsUrl, A.wsWaitSec);
  if (dom.status !== 'PASS') console.log(`  ${dom.status}: ${dom.why || ''}`);
  else {
    console.log(`  PASS: #app 已挂载、首页卡片 ${dom.probe.featureCards} 个、文案命中、文本 ${dom.probe.textLen} 字`);
    console.log(`    样本: ${dom.probe.textSample}`);
    if (dom.exceptions && dom.exceptions.length) console.log('    页面异常: ' + dom.exceptions.join(' | '));
  }

  console.log('== 门禁汇总 ==');
  let fail = 0;
  for (const [k, desc] of GATE) {
    const ok = !!J[k];
    if (!ok) fail++;
    console.log(`  ${ok ? '绿' : '红'} ${k.padEnd(18)} ${desc}`);
  }
  console.log(`  ${dom.status === 'PASS' ? '绿' : '—'} ${'DOM(加分)'.padEnd(18)} 首页真实渲染 ${dom.status === 'PASS' ? '' : '· ' + dom.status}`);
  if (J.W3_fromAsar === false) console.log('  注意: page url 不含 app.asar ⇒ 可能连到了开发服务器而非打包产物');

  if (A.keepOpen) console.log('== --keep-open：保留应用进程，手动验证后可自行关闭 ==');
  else if (child) { try { child.kill(); } catch (e) {} }

  console.log(fail === 0
    ? '\nRESULT: PASS —— Windows 产物主进程与渲染层门禁全绿' + (dom.status === 'PASS' ? '，且首页 DOM 真实渲染' : '（DOM 层为 ' + dom.status + '）')
    : `\nRESULT: FAIL —— ${fail} 项红`);
  if (!A.keepOpen && child) process.exit(fail === 0 ? 0 : 1);
  process.exit(fail === 0 ? 0 : 1);
}

// 直接运行才执行；被单测 import 时不执行（判定用 realpath，避免相对路径/软链误判）。
const isMain = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) {
  main().catch((e) => { console.error('脚本自身异常: ' + (e && e.stack || e)); process.exit(2); });
}
