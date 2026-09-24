#!/usr/bin/env node
/**
 * win-smoke-selftest.mjs —— 校验 win-smoke.mjs 的判定逻辑
 *
 * 为什么需要：交付给用户的 Windows 冒烟脚本，如果判定逻辑本身有 bug，
 * 要么把坏的说成好（假绿），要么把好的说成坏（假红）—— 两种都比没有脚本更糟。
 * 本机没有 Windows 也跑不了 PowerShell，但可以：**用真实抓到的 CDP 载荷**
 * 把纯判定函数单测掉。载荷是从 wine 里跑真 Windows exe 抓的（见
 * scripts/container-win-smoke.sh），不是手写的假数据。
 *
 * 跑法： node scripts/win-smoke-selftest.mjs
 */
import { judge, judgeUserData } from './win-smoke.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : `\n       got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

// ---- 真实载荷：从 wine 中运行的 Windows 产物抓取 ----
const REAL_VERSION = {
  "Browser": "Chrome/120.0.6099.227",
  "Protocol-Version": "1.3",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) @security-survey/desktop/0.0.1 Chrome/120.0.6099.227 Electron/28.2.0 Safari/537.36",
  "V8-Version": "12.0.267.17",
  "WebKit-Version": "537.36 (@b6b08bf95d3f4e3bb9cb06c94870fc156877b413)",
  "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/9df31a40-7d12-4797-a4cf-db76748ec287",
};
const REAL_LIST = [{
  "description": "",
  "id": "47E37FD5683A144BC23FC11DC0231E7C",
  "title": "首页 - 安防勘点设计工具",
  "type": "page",
  "url": "file:///Z:/uw/resources/app.asar/dist/index.html#/",
  "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/47E37FD5683A144BC23FC11DC0231E7C",
}];

console.log('=== 真实载荷应判全绿 ===');
{
  const j = judge(REAL_VERSION, REAL_LIST);
  eq('W1 运行时栈 = Windows', j.W1_winStack, true);
  eq('W2 是本品 Electron', j.W2_thisApp, true);
  eq('W3 router 后缀标题', j.W3_routerTitle, true);
  eq('W3 来自 app.asar', j.W3_fromAsar, true);
  eq('解析出 Electron 版本', j.electronVersion, '28.2.0');
  eq('解析出 Chrome 版本', j.chromeVersion, '120.0.6099.227');
  eq('取到 page WS 地址', typeof j.pageWsUrl, 'string');
}

console.log('=== 假绿陷阱：静态 index.html 标题必须判为不合格 ===');
{
  // index.html 里有 <title>安防勘点设计工具</title>，页面骨架一载入就有值；
  // 若判据是"标题非空"则这里会被误判成通过。
  const listStatic = [{ ...REAL_LIST[0], title: '安防勘点设计工具', url: 'file:///C:/app/resources/app.asar/dist/index.html' }];
  const j = judge(REAL_VERSION, listStatic);
  eq('无 router 后缀 ⇒ W3 必须为 false', j.W3_routerTitle, false);
  eq('但 title 非空（说明"非空"判据无信息量）', j.pageTitle.length > 0, true);
}

console.log('=== 双 page 目标（wine 实测 index.html 与 splash.html 同时在列）===');
{
  // 启动画面 splash.html 没有 router、标题恒为空。把它排在前面时，判定与 DOM
  // 探针都必须锁定主窗口，不能被它带偏（这是本项改判据的真实原因）。
  const SPLASH = { id: 'S', type: 'page', title: '', url: 'file:///C:/app/resources/app.asar/dist/splash.html', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/S' };
  const MAIN_OK = { ...REAL_LIST[0], webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/M' };
  const both = judge(REAL_VERSION, [SPLASH, MAIN_OK]);
  eq('两个目标都被列出（便于人工核对）', both.allPages.length, 2);
  eq('W3 绿：主窗口有 router 后缀标题', both.W3_routerTitle, true);
  eq('DOM 探针指向主窗口而非 splash', /page\/M$/.test(both.pageWsUrl || ''), true);
  eq('主窗口判出来自 app.asar', both.W3_fromAsar, true);

  // 渲染层完全没跑起来：两个目标标题都为空 ⇒ 不得假绿
  const dead = judge(REAL_VERSION, [SPLASH, { ...MAIN_OK, title: '' }]);
  eq('W3 红：主窗口也没拿到 router 标题', dead.W3_routerTitle, false);
  eq('仍选中主窗口做后续诊断', /dist\/index\.html/.test(dead.pageUrl), true);

  // 主窗口目标不在列表里（尚未创建/已关），但另一个 page 带了 router 后缀标题。
  // 语义按实现固定：W3 只回答"是否有渲染层 JS 跑到 router"（后缀标题只可能由
  // router/index.ts 设置，splash 页没有 router），因此仍判 true；但 pageUrl 必须
  // 如实反映"这不是主窗口"，供人工判断，不得伪装成主窗口证据。
  const noMain = judge(REAL_VERSION, [SPLASH, { ...SPLASH, title: '别的 - 安防勘点设计工具' }]);
  eq('没有主窗口目标时 pageUrl 不含 index.html', /dist\/index\.html/.test(noMain.pageUrl), false);
  eq('带后缀标题的其它 page 仍算渲染层跑过 router', noMain.W3_routerTitle, true);
  const noMain2 = judge(REAL_VERSION, [SPLASH]);
  eq('纯 splash（无后缀标题）⇒ W3 false', noMain2.W3_routerTitle, false);
}

console.log('=== 假绿陷阱：连到别的 Electron 应用必须判红 ===');
{
  const other = { ...REAL_VERSION, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) VSCode/1.85.0 Chrome/120.0.6099.227 Electron/28.2.0 Safari/537.36" };
  const j = judge(other, REAL_LIST);
  eq('UA 非本品 ⇒ W2 false', j.W2_thisApp, false);
  eq('Windows 栈本身仍成立', j.W1_winStack, true);
}

console.log('=== 假绿陷阱：非 Windows 栈（本机误连开发服务）必须判红 ===');
{
  const lin = { ...REAL_VERSION, "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) @security-survey/desktop/0.0.1 Chrome/120.0.6099.227 Electron/28.2.0 Safari/537.36" };
  const j = judge(lin, REAL_LIST);
  eq('Linux 栈 ⇒ W1 false', j.W1_winStack, false);
  eq('但仍是本品 ⇒ W2 true', j.W2_thisApp, true);
}

console.log('=== 空/异常输入不得抛异常 ===');
{
  eq('version 为 null', judge(null, null).W1_winStack, false);
  eq('list 为 null', judge(REAL_VERSION, null).W3_routerTitle, false);
  eq('list 空数组', judge(REAL_VERSION, []).pageTitle, '');
  eq('list 无 page 类型', judge(REAL_VERSION, [{ type: 'other', title: 'x - 安防勘点设计工具' }]).W3_routerTitle, false);
}

console.log('=== W4：大小写别名不得判成缺失（实测踩过的假红）===');
{
  const dir = mkdtempSync(join(tmpdir(), 'w4t-'));
  const base = join(dir, 'desktop');
  // 真机现象：Chromium 先建 Cache（大写），main.ts 的小写 cache 因 Windows
  // 文件系统大小写不敏感而 existsSync 命中、跳过 mkdir ⇒ 落盘只有 Cache。
  for (const d of ['projects', 'templates', 'exports', 'Cache', 'logs']) mkdirSync(join(base, d), { recursive: true });
  const r = judgeUserData(base);
  eq('5/5 判为齐备', r.allPresent, true);
  eq('缺失列表为空', r.missing, []);
  eq('报告 cache→Cache 大小写别名', r.caseAliased, ['cache→Cache']);

  const empty = mkdtempSync(join(tmpdir(), 'w4e-'));
  const r2 = judgeUserData(join(empty, 'desktop'));
  eq('目录不存在 ⇒ 全缺', r2.missing, ['projects', 'templates', 'exports', 'cache', 'logs']);
  eq('且判为不齐备', r2.allPresent, false);
  rmSync(dir, { recursive: true, force: true }); rmSync(empty, { recursive: true, force: true });
}

console.log(`\n_selftest: ${pass} 通过 / ${fail} 失败_`);
process.exit(fail ? 1 : 0);
