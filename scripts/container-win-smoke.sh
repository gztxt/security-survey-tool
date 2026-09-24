#!/usr/bin/env bash
# container-win-smoke.sh —— 在容器内用 wine 真实启动 Windows 产物，经 CDP 验证渲染层
#
# 为什么需要它：载荷级校验（逐文件 SHA256）只能证明"包里的字节和 dist 一致"，
# 证明不了"这个 exe 在 Windows 运行时能起窗口、Vue 应用能挂载"。
# 上次尝试 NSIS 静默安装（/S）在容器内无限挂等而放弃；本脚本改走
# win-unpacked/*.exe（NSIS/portable 的载荷与它逐文件哈希已证一致），
# 并用 --remote-debugging-port 把 Chromium 的 CDP 口暴露到 127.0.0.1
# （wine 的网络是直接复用宿主栈的，容器内 curl 得到），
# 从而拿到与 Linux 真机验收同级别的"应用真的跑起来了"证据。
#
# 五项检查，**不把 wine 的无能伪装成通过**：
#   W1 进程拉起（门禁）：wine 启动 安防勘点设计工具.exe，UA 报 Windows NT
#   W2 CDP 可达（门禁）：/json/version 的 UA 含 @security-survey/desktop
#   W4 主进程业务代码（门禁）：AppData/…/desktop 下 5 个业务子目录由应用自建
#      —— projects/templates/exports/cache/logs 由 main.ts preloadResources() mkdirSync，
#      是"我们写的 main.ts 在 Windows 运行时上执行了"的硬证据。
#   W3 渲染层跑到 router（参考，三态）：主窗口 page 目标出现 router 专属后缀标题
#   S5 渲染层 DOM 完整度（参考，三态）：canvas / #app / 文本量
#
# W3h/W3/S5 为何不进门禁 —— 结论来自多轮实测（详见 releases/20260912/BUILD-INFO.md）：
#   1) wine 下渲染进程会**自发**崩溃：noattach.sh 全程只发 HTTP、一个 WS 都不连，
#      3/3 轮仍出现 main.ts:240 的"渲染进程崩溃 exitCode -2147483645(0x80000003
#      STATUS_BREAKPOINT，非 0xC0000005)" ⇒ 观察者效应假设被否。
#   2) 但渲染层确实跑到过 router：W3h 累计 9/9 命中后缀标题（该串只有
#      renderer/router/index.ts:150 的 document.title 会写出，浏览器进程每轮全新）。
#   3) 早先"ab3 W3 仅 1/5 绿"是**测量伪影**：当时探针有未修的所有等待无界问题
#      （裸 fetch 挂 300s、Runtime.enable 不回包），把整轮拖到被 timeout 240 杀掉。
#      修好并全部有界化后，W3h 稳定命中。
#   ⇒ W3/S5 依赖 wine 下不可靠的 CDP 命令通道，非确定性 ⇒ 降为参考，不当门禁。
#   注意口径：这里能说的是"wine 下渲染层不稳定 / CDP 通道不可靠"，**不是**
#   "产品渲染层有问题"—— 同一批渲染层字节在 Linux 真机 smoke 39/39 全绿；
#   Windows 真机仍未测（PT-20260912-04）。
# 退出码：W1/W2/W4 全绿 → 0；任一红 → 1；探针 JS 语法坏 → 3（测量层自杀，不算产品红）。
#
# 用法（一般由 scripts/build-windows-smoke-docker.sh 调用）：
#   bash /smoke.sh <win-unpacked 目录>
set -uo pipefail

UNPACKED="${1:?用法: smoke.sh <win-unpacked 目录>}"
APP="$UNPACKED/安防勘点设计工具.exe"
PORT=9222
LOG=/tmp/win-smoke.log
export WINEPREFIX="${WINEPREFIX:-/root/.wine-sec}"
# 全新 prefix 的 wineboot 默认要装 Gecko/MSHTML（wine-gecko/wine-mono cab 下载），
# 受限网络下会无限挂等 —— 实测 wineboot.exe --init 与 rundll32 setupapi 的 CPU 时间
# 长时间零增长，prefix 已建到 793M 仍不返回。Electron 不需要这两者，用空实现跳过。
# prefix 不要 bind mount 宿主目录：wine 会校验 prefix 属主必须等于当前用户，
# 而挂载会保留宿主 uid（实测报 "'/root/.wine-sec' is not owned by you" rc=1）。
# 容器内新建 prefix 在跳过 gecko/mono 后约 1~2 分钟，可接受。
export WINEDLLOVERRIDES="mscoree=,mshtml=,winemenubuilder.exe=d${WINEDLLOVERRIDES:+,$WINEDLLOVERRIDES}"
export WINEDEBUG=-all
export DISPLAY=:99
export DISPLAY_NUM=99

[ -f "$APP" ] || { echo "找不到待测 exe: $APP"; exit 2; }

# electronuserland/builder:wine 镜像不含 X server（与 p7zip 一样需要现装；
# 该镜像构建期网络可用，沿用 container-win-verify.sh 里 apt 现装 p7zip 的同款做法）。
if ! command -v Xvfb >/dev/null 2>&1; then
  echo "== [S0] 安装 xvfb + curl（镜像未自带）=="
  apt-get update -qq >/dev/null 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends xvfb x11-utils curl >/dev/null 2>&1
  command -v Xvfb >/dev/null 2>&1 || { echo "  !! xvfb 安装失败（离线/源不可用？）"; exit 3; }
  command -v curl >/dev/null 2>&1 || { echo "  !! curl 安装失败，无法轮询 CDP"; exit 3; }
fi

echo "== [S0] 起虚拟显示 =="
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
XVFB=$!
# 注意：xdpyinfo 没有 -a 选项，`xdpyinfo -a :99` 会以用法错误返回非 0 ——
# 上一版据此误判"Xvfb 未就绪"，而 Xvfb 与 /tmp/.X11-unix/X99 其实都正常。
for i in $(seq 1 30); do DISPLAY=:99 xdpyinfo >/dev/null 2>&1 && break; sleep 0.5; done
if DISPLAY=:99 xdpyinfo >/dev/null 2>&1; then
  # 原文案把 $2(="1280x800") 再拼一个 "x" 再接 $3(="pixels")，打成 "1280x800xpixels"，
  # 会让人以为屏幕参数配错了。xdpyinfo 那行形如 `dimensions:    1280x800 pixels`。
  echo "  Xvfb OK ($(DISPLAY=:99 xdpyinfo | awk '/dimensions:/{print $2}'))"
else
  echo "  !! X 未就绪: $(head -3 /tmp/xvfb.log)"
  kill $XVFB 2>/dev/null; exit 4
fi

echo "== [S0] wineboot 初始化 prefix（跳过 gecko/mono，最多 240s）=="
timeout 240 wineboot -u >/tmp/wineboot.log 2>&1
wrc=$?
if [ "$wrc" != 0 ]; then
  echo "  !! wineboot rc=$wrc（rc=124 即超时）: $(tail -3 /tmp/wineboot.log)"
  exit 5
fi
echo "  wineboot OK"

echo "== [W1] wine 启动 Windows 产物 =="
# --no-sandbox：容器内无 user namespace；--disable-gpu：避免 wine 的 D3D 适配层成为不确定性来源。
# 曾假设 --disable-features=CalculateNativeWinOcclusion 能治 wine 下渲染进程崩溃
# （假设来源是我自己，无人提出过此参数），并为此跑了每臂 3 次的 A/B。
# A/B 结论：**参数不构成差别** —— 加与不加都是 6/6 观测到 "首页 - 安防勘点设计工具"。
# 故不保留该 flag（没有可信证据说明它有用，就不留无法解释的玄学参数）。
# 说明一处容易误读的输出：ab2.sh 在 case 命中时先 break、后才把该轮写入 seen，
# 且 seen 只打印前 4 行 ⇒ 命中的那一轮不出现在输出里，看上去像"6/6 与打印矛盾"。
# 判定层本身无误：plist.cjs 用 " || " 拼接 title，匹配串不可能来自分隔符文本。
# 真正修好的是时序：渲染层要数秒才跑到 router，单次早取必时绿时红 ⇒ 改为限时轮询，
# 并自检"探针是否真的跑完"（node rc + 结论行），避免把测量层失效当成产品红。
# EXTRA_FLAGS 只服务于 A/B 实测：同一份脚本、同一二进制，仅差这一个参数，
# 避免维护两份会互相漂移的变体。默认空 ⇒ 常规流程不带任何实验性 flag。
# 应用输出必须**直接重定向到文件**，不要套时间戳管道。
# 曾用 `> >(ts_pipe >> "$LOG")` 给每行前缀 epoch ms，交错 A/B 实测
# （/vol1/winbuild/bisect.log，两臂交替执行以排除环境随时间漂移）：
#   v2  原始写法        2/2 通过
#   v5  加 ts_pipe      3/3 失败：W2 阶段 "DevTools listening" 后约 0.7s wine 进程退出
#   v5b v5 去掉 ts_pipe  2/2 通过
# ⇒ 元凶确定是那个进程替换：stdout 从文件变成 FIFO 后 wine/Electron 早退。
# 结论：测量层不得改写被测进程的 stdout。时间对齐改用 EPOCH_FILE 锚点换算。
EPOCH_FILE=/tmp/win-smoke-epoch.txt
timeout 240 wine "$APP" --no-sandbox --disable-gpu --disable-dev-shm-usage \
  ${EXTRA_FLAGS:-} --remote-debugging-port=$PORT >> "$LOG" 2>&1 &
APP_PID=$!

# t0 锚点：applog 保持原样（无时间戳前缀），探针输出自带绝对 epoch ms 与
# `t+` 相对量，两者加 t0 换算到同一时间轴，crash 行仍可落到具体观测窗口内。
node -e '
const fs = require("fs");
const t0 = Date.now();
try {
  fs.writeFileSync(process.argv[1],
    "t0_wine_launch_epoch_ms=" + t0 + "\n" +
    "t0_human=" + new Date(t0).toISOString() + "\n");
} catch (e) { /* 锚点缺失只影响时间对齐，不影响判据 */ }
' "$EPOCH_FILE" 2>/dev/null || true

echo "== [W2] 等 CDP 就绪并校验是本品 Electron（最多 180s）=="
ready=0
for i in $(seq 1 180); do
  if ! kill -0 $APP_PID 2>/dev/null; then echo "  !! wine 进程已退出（见下面日志尾部）"; break; fi
  if curl -sf "http://127.0.0.1:$PORT/json/version" >/tmp/ver.json 2>/dev/null; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "  FAIL(W2): CDP 未就绪"
  echo "----- wine/应用日志尾部 -----"; tail -30 "$LOG"
  kill $XVFB 2>/dev/null; exit 1
fi
# 必须用 ["User-Agent"]：写成 .User-Agent 会被 JS 解析成 j.User - Agent
# （undefined 相减 ⇒ NaN/ReferenceError），UA 恒为空，把明明合格的运行误判成红。
UA=$(node -e 'const j=require("/tmp/ver.json");console.log(j["User-Agent"]||"")')
BROWSER=$(node -e 'console.log(require("/tmp/ver.json").Browser||"")')
echo "  CDP OK: $BROWSER"
case "$UA" in
  *"@security-survey/desktop"*) echo "  W2 绿：UA 含 @security-survey/desktop（本品 Electron 在跑）"; W2=1 ;;
  *) echo "  W2 红：UA 非本品 → ${UA:0:120}"; W2=0 ;;
esac
case "$UA" in
  *"Windows NT"*) echo "  W1 绿：运行时栈为 Windows（wine 里 UA 报 Windows NT）"; W1=1 ;;
  *) echo "  W1 红：UA 未报 Windows NT"; W1=0 ;;
esac

echo "== [W3/W4/S5] 经 CDP 检查页面目标与运行时（S5 仅参考）=="
# node 子进程无法直接改父 shell 变量，故把结论以 "KEY=0|1" 形式打到输出里，
# 由下方 grep 回收。早期版本直接 ${W3:-0} 会恒为 0 ⇒ 假红。
# 先做语法自检：JS 段靠 sed 从本文件抽出，改坏语法过去只在**运行时**暴露，
# 症状还是"探针一行都不打"，极易误读成产品缺陷（实测踩过）。
awk '/^node >\/tmp\/probe.out/,/^JS$/' "$0" | sed '1d;$d' > /tmp/probe.cjs
if ! node --check /tmp/probe.cjs 2>/tmp/probe.check; then
  echo "  !! 探针 JS 语法错误（测量层坏了，不是产品问题）:"; cat /tmp/probe.check
  kill $XVFB 2>/dev/null; exit 3
fi
node >/tmp/probe.out 2>&1 <<'JS'
const fs = require('fs');
const ver = JSON.parse(fs.readFileSync('/tmp/ver.json', 'utf8'));
// 探针超时预算。heredoc 用引号形式只是阻止 **shell** 插值，JS 里读 process.env
// 正常有效（node 继承 bash 环境）。放大它可区分"wine 只是慢"与"渲染层已崩"。
const PROBE_MS = Number(process.env.S5_TIMEOUT_MS) || 15000;
console.log(`  DOM 探针超时预算 = ${PROBE_MS}ms`);
// **所有** HTTP 取 target 列表都必须限时。上一版这里是裸 fetch：wine 下 CDP 的
// WS 传输坏掉之后，/json/list 这个 HTTP 接口也会挂住，undici 默认要 300s 才超时
// ⇒ 实测 attach 尝试 2 落在 +239876ms（一直挂到 wine 自己的 `timeout 240` 把应用
// 杀掉），于是 W3p 测的是"被探针自己拖死的尸体"，这个 0 无效（three3.log 两轮同形）。
const httpJson = async (path, ms = 5000) => {
  const r = await fetch('http://127.0.0.1:9222' + path, { signal: AbortSignal.timeout(ms) });
  return await r.json();
};
(async () => {
  let targets = [];
  for (let i = 0; i < 60; i++) {
    try { targets = await httpJson('/json/list'); } catch (e) { /* 本轮取不到，继续等 */ }
    if (targets.some(t => t.type === 'page')) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  // 应用同时列出两个 page 目标：dist/index.html（主窗口）与 dist/splash.html
  // （启动画面，本身没有 router、标题恒为空）。targets.find(type==='page') 命中的
  // 是列表里任意一个 ⇒ 挑到 splash 就稳定得到 title=""，把正常渲染误判成红。
  // 必须按 url 显式选主窗口，并把全部 page 目标打出来便于核对。
  const pages = targets.filter(t => t.type === 'page');
  console.log(`  page 目标 ${pages.length} 个: ` +
    pages.map(p => `${(p.url || '').split('/').slice(-2).join('/')}="${p.title}"`).join(' | '));
  const page = pages.find(p => /dist\/index\.html/.test(p.url || ''));
  if (!page) { console.log('  W3 红：没有主窗口(dist/index.html)页面目标'); console.log(JSON.stringify(targets, null, 1).slice(0, 800)); console.log('W3=0'); process.exit(0); }

  // —— 同轮内配对观测（W3h）：先**只用 HTTP** 轮询 /json/list 一段，再挂 WS。
  // 初衷是判"挂 CDP WebSocket 会不会把 wine 渲染层搞崩"（观察者效应）。
  // 该假设后来被更干净的实验否掉了：noattach.sh 全程只发 HTTP、一个 WS 都不连，
  // 3/3 轮仍崩溃 ⇒ wine 渲染层自发不稳，与 attach 无关。这里保留 W3h 是因为它
  // 是**目前唯一可靠**的"本轮渲染层跑到过 router"证据（不依赖 CDP 命令通道）。
  //
  // ⚠ 口径：/json/list 的 title 是浏览器进程**缓存**值，渲染进程死后不清空。
  // 所以 W3h=1 的准确含义是"本轮渲染层**曾经**跑到 router"（浏览器进程每轮全新，
  // 该串只能由本轮 renderer JS 经 router/index.ts:150 写出），
  // **不是**"轮询那一刻渲染进程还活着"。W3p 同理。
  const RE = / - 安防勘点设计工具$/;
  const mainUrl = (t) => /dist\/index\.html/.test(t.url || '');
  // 仍打印每段起止时间：虽然崩溃行（main.ts:240）不带时间戳、无法精确对齐，
  // 但 app.log 里相邻的 Chromium 行带 UTC 时间戳，至少能把崩溃夹在两个有戳行
  // 之间做**定序**（注意 Chromium 是 UTC，换算本地要 +8h；且只能取下界不能当时刻）。
  const T0 = Date.now();
  // 同时打相对量与**绝对 epoch 毫秒**。$LOG 现在是原样输出（不能加前缀，见
  // 上面 ts_pipe 的实测教训），所以只能靠锚点换算：探针的绝对 epoch 减去
  // /tmp/win-smoke-epoch.txt 的 t0 得到"距 wine 启动多少毫秒"，再用 Chromium
  // 自带时间戳的行（如 [400:0912/094705.397]）作为中间参照，把 main.ts:240
  // 那条无时间戳的"渲染进程崩溃"夹到两个有戳行之间 —— 只能定序，不能精确到 ms。
  const el = () => `+${Date.now() - T0}ms(epoch ${Date.now()})`;
  console.log(`  探针起点 T0 epoch=${T0}ms`);
  const httpTitles = [];
  let httpSawRouter = false;
  for (let i = 0; i < 25; i++) {
    let ts = [];
    try { ts = await httpJson('/json/list'); } catch (e) { /* 本轮取不到，继续 */ }
    const mp = (ts || []).filter(t => t.type === 'page' && mainUrl(t))[0];
    const tt = mp ? (mp.title || '') : '';
    if (tt && !httpTitles.includes(tt)) httpTitles.push(tt);
    if (tt && RE.test(tt)) { httpSawRouter = true; break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`  W3h(HTTP-only，未挂 WS，窗口 0→${el()}) 观测到的主窗口标题 = ${JSON.stringify(httpTitles)}`);
  console.log(`W3h=${httpSawRouter ? 1 : 0}`);

  // —— WS 段：失败**不得中止探针**。
  // three2 系列 3/3 的实测形态是 W3h=1 之后 "CDP ws 已关闭" ⇒ W3=e，而 W3p 因为
  // 探针提前退出根本没测到 —— 偏偏 W3p 才是能分辨下面两种解释的那一项：
  //   (i) 渲染层在 attach 后崩了 ⇒ W3p 也会掉回无 router 标题
  //   (ii) target 换代（splash→主窗口切换会重建 page target）使**先前抓到的
  //        webSocketDebuggerUrl 失效**、旧 WS 被关闭 ⇒ 渲染层其实活得好好的，W3p 仍为 1
  // 上一版在 attach 之前一次性抓定 page，正是 (ii) 的成因候选。这里改为：
  // 每次连接前重新查表取**新鲜** target，失败后重试一轮，并记录 target id 是否变化。
  let pageNow = page;
  const refreshPage = async () => {
    try {
      const ts = await httpJson('/json/list');
      const p = (ts || []).filter(t => t.type === 'page' && mainUrl(t))[0];
      return { list: ts || [], page: p || null };
    } catch (e) { return { list: null, page: null }; }
  };
  const idOf = (p) => (p && p.id) || '(无)';
  const attachOnce = async (target) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const send = (mid, method, params = {}) => ws.send(JSON.stringify({ id: mid, method, params }));
    let mid = 1; const pending = new Map();
    // **每一次 CDP 调用都必须自带超时**。three3.log 的实测教训：wine 接受页面级
    // WS 连接但**不回** Runtime.enable，当时这里是无界 await ⇒ 探针一直挂到外层
    // `timeout 240` 把应用杀掉（日志上表现为 attach 尝试 2 落在 +239876ms），
    // 于是紧随其后的 W3p 测的是"被探针自己拖死的尸体" ⇒ 那个 W3p=0 无效。
    // 探针挂死还会把整轮的时间预算吃光，属于"观察者污染被观察对象"。
    const CALL_MS = 15000;
    const call = (method, params, ms = CALL_MS) => new Promise((res, rej) => {
      const my = mid++;
      const timer = setTimeout(() => {
        if (pending.has(my)) { pending.delete(my); rej(new Error(method + ' 无回复（>' + ms + 'ms，wine CDP 传输嫌疑）')); }
      }, ms);
      pending.set(my, {
        res: (v) => { clearTimeout(timer); res(v); },
        rej: (e) => { clearTimeout(timer); rej(e); }
      });
      send(my, method, params);
    });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      }
    };
    const failAllPending = (why) => { for (const [, p] of pending) p.rej(new Error(why)); pending.clear(); };
    let settleOpen = null, settleFail = null;
    const opened = new Promise((res, rej) => { settleOpen = res; settleFail = rej; });
    ws.onopen = () => { settleOpen(); ws.onclose = () => failAllPending('CDP ws 已关闭'); };
    ws.onerror = () => { if (settleFail) { const f = settleFail; settleFail = null; f(new Error('CDP ws 连接出错')); } else failAllPending('CDP ws 出错'); };
    const withTimeout = (p, ms, tag) => Promise.race([
      p,
      // 不要 .unref()：unref 后事件循环无句柄时 Node 会静默退出（正是要修的病）。
      new Promise((_, rej) => setTimeout(() => rej(new Error(tag + ' 超时 ' + ms + 'ms')), ms))
    ]);
    try {
      await withTimeout(opened, 20000, 'WS 连接');
      await call('Runtime.enable');
      const ev = async (expr) => {
        const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
        return r.result.value;
      };
      return { ok: true, ws, ev, call, withTimeout };
    } catch (e) {
      try { ws.close(); } catch (e2) { /* 忽略 */ }
      return { ok: false, err: e.message };
    }
  };

  // W3 判据必须是 **router 专属标题**（形如 "xx - 安防勘点设计工具"）：
  // index.html 里静态 <title>安防勘点设计工具</title> 恒存在，只判"非空"会假绿
  // （页面骨架载入即可满足，证明不了任何 JS 跑过）。router/index.ts:150 的
  // document.title = `${to.meta.title} - 安防勘点设计工具` 只有渲染层 JS 真执行才会出现。
  // **必须轮询**：渲染层跑到 router 需要数秒，之前"立即一次 + 3s 一次"的写法会因
  // 单次早取而假红（这正是我把 wine 下的时绿时红误判成"参数在修崩溃"的原因 ——
  // 早先每臂 3 次的 A/B 曾报"两臂都 6/6 拿到 router 标题"，**该数据已作废**：
  // 它只用 HTTP 轮询、且判定层存在下述覆盖 bug。用修好的探针重跑（ab3，6 轮）
  // 结果是 W3 仅 1/5 轮为绿，参数两臂无统计差别 ⇒ 参数不保留，效果判定=未定。
  // —— 挂 WS：失败**只降级 W3 为 e，不中止探针**（中止就会丢掉 W3p 这个关键量）。
  const appUrl = (pageNow && pageNow.url) || page.url || '';
  let att = null, attachErr = null;
  const firstId = idOf(page);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await refreshPage();
    if (r.page) pageNow = r.page;
    const nowId = idOf(pageNow);
    console.log(`  attach 尝试 ${attempt}（${el()}）target id: 初始 ${firstId} → 本次 ${nowId}` +
      (nowId !== firstId ? ' ⇒ **target 已换代**，先前抓到的 webSocketDebuggerUrl 必然失效' : ''));
    if (!pageNow || !pageNow.webSocketDebuggerUrl) { attachErr = '查不到主窗口 target（页面已销毁？）'; break; }
    const a = await attachOnce(pageNow);
    if (a.ok) { att = a; break; }
    attachErr = a.err;
    console.log(`  attach 尝试 ${attempt} 失败: ${a.err}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  let title0 = null;
  const titles = [];
  let w3 = 'e';
  if (att) {
    const WS_T0 = Date.now();
    // 总时长上限：单次 ev 超时 4s，若无上限，渲染层半死时 25 次可耗掉 100s+，
    // 实测一轮被拖到 14 分钟以上。60s 足够覆盖"跑到 router 需要几秒"的量级。
    const WS_POLL_MS = 60000;
    for (let i = 0; i < 60; i++) {
      // 每次取标题都限时；否则渲染层半死状态下这一句就能让整个探针静默挂掉
      title0 = await att.withTimeout(att.ev('document.title'), 4000, '取标题').catch(() => null);
      if (title0 && !titles.includes(title0)) titles.push(title0);
      if (RE.test(title0 || '')) break;
      if (Date.now() - WS_T0 > WS_POLL_MS) { console.log(`  挂 WS 轮询到 ${WS_POLL_MS}ms 上限退出`); break; }
      await new Promise(r => setTimeout(r, 1000));
    }
    // 相对 T0 打 WS 段的起止（不是两个"现在"，那样等于把结束时间印两遍）。
    console.log(`  挂 WS 后的标题轮询窗口: +${WS_T0 - T0}ms → +${Date.now() - T0}ms（探针起点=T0）`);
    console.log(`  期间观测到的标题序列: ${JSON.stringify(titles)}`);
    // 判"整个观测过程是否出现过"，而非只看最后一次取值：渲染层可能在跑到 router
    // 之后才崩，只看末次会把成功读成失败。
    w3 = titles.some(t => RE.test(t)) ? 1 : 0;
    console.log(`  W3: 观测到的标题 = ${JSON.stringify(titles)}；router 后缀标题 = ${w3 ? '是（渲染层 JS 真执行过）' : '否（仅静态骨架）'}；url 来自 app.asar = ${/app\.asar/.test(appUrl)}`);
  } else {
    console.log(`  WS 段未完成（${attachErr}）⇒ W3 不可判；**继续**做 detach 后的 HTTP 复检。`);
    console.log(`  注意：W3 依赖 WS 传输，wine 下 WS 断开不代表渲染层崩 —— 判渲染层死活请看 W3h/W3p。`);
  }

  // DOM 探针失败**只降级 S5，不得改动 W3**：W3 的依据是已经观测到的标题序列，
  // 是既成事实；探针超时/连接断只说明"此刻取不到 DOM"。
  // 超时可由 S5_TIMEOUT_MS 覆盖 —— 用来区分"wine 只是慢"与"渲染层已崩"：
  // 放大超时后若探针能成功返回，说明前面测到的是慢而非崩。
  let probe = null, probeErr = null;
  if (att) {
    try {
      probe = await att.withTimeout(att.ev(`(() => {
    const canvases = document.querySelectorAll('canvas');
    const app = document.querySelector('#app');
    return {
      title: document.title,
      appChildren: app ? app.childElementCount : -1,
      bodyLen: (document.body && document.body.innerText || '').length,
      canvasCount: canvases.length,
      canvasSize: canvases[0] ? (canvases[0].width + 'x' + canvases[0].height) : null,
      vueMounted: !!(app && app.firstElementChild),
      htmlLang: document.documentElement.lang || null,
      // 本轮修复的接线证据是否真出现在运行时 DOM 里
      hasGridOrSnapUi: !!Array.from(document.querySelectorAll('*')).find(e => /grid-status|snap-status/.test(e.className + ' ' + e.id)),
      sampleText: (document.body && document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 160)
    };
  })()`), PROBE_MS, '探针');
    } catch (e) { probeErr = e.message; }
  } else {
    probeErr = '未挂上 WS（' + attachErr + '）';
  }

  // W3 结论的**唯一**出口（放在两处分支之后，确保前面任何分支都不会抢先打印；
  // 上一版就是在 catch 里另打 W3=0，把真实结论覆盖掉）。
  console.log(`W3=${w3}`);

  // —— 第三段观测 W3p：**关掉 WS 之后**再用纯 HTTP 复检主窗口标题 ——
  // ⚠ W3p **不能当作"渲染层仍存活"的证据**：/json/list 的 title 是**浏览器进程
  // 缓存**的页面标题，渲染进程死掉后缓存标题并不会清空（实测 three4 rep1：
  // main.ts:240 记录"渲染进程崩溃"后约 18s，W3p 仍=1）。
  // main.ts:239 的崩溃处理**只 console.error、不 reload**，所以崩后 DOM 冻结、
  // 缓存标题长期残留。⇒ 真正能证明"渲染层跑到过 router"的只有 W3h/W3：
  // 后缀标题是 router/index.ts:150 的 document.title 才会写出的字符串，取到它
  // 就说明那一刻渲染 JS 执行过；W3p 只用来判断"detach 是否顺带把页面弄没了"。
  // 三段合起来能测出的东西（都在同一进程同一次运行内，排除跨轮噪声）：
  //   W3h=1 ⇒ 渲染层跑到 router（这是核心结论，与 W3/W3p 无关）
  //   W3=e 且 W3h=1 ⇒ attach 前渲染层活着、挂 WS 后取不到 ⇒ wine CDP 命令传输不可靠
  //     或渲染层在两步之间崩 ⇒ 需与 app.log 的 render-process-gone 定序才能分辨
  //   W3h=0 ⇒ 渲染层本轮没跑到 router（wine 下更可能，但 ab3 未见、three2/3/4 全 1）
  if (att) { try { att.ws.close(); } catch (e) { /* 已关则忽略 */ } }
  await new Promise(r => setTimeout(r, 3000));
  const postTitles = [];
  let postSawRouter = false;
  let postPageGone = false;
  for (let i = 0; i < 15; i++) {
    let ts2 = null;
    try { ts2 = await httpJson('/json/list'); } catch (e) { /* 本轮 HTTP 失败，不算 target 消失 */ }
    const mp2 = (ts2 || []).filter(t => t.type === 'page' && mainUrl(t))[0];
    const tt2 = mp2 ? (mp2.title || '') : '';
    if (mp2) { postPageGone = false; if (tt2 && !postTitles.includes(tt2)) postTitles.push(tt2); }
    // 只有 HTTP 成功返回、列表里却没有主窗口 target，才算"target 消失"。
    else if (Array.isArray(ts2)) { postPageGone = true; }
    if (tt2 && RE.test(tt2)) { postSawRouter = true; break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  // target id 是否已换代：换代 ⇒ 旧 WS 被关闭属正常，不能当成渲染层崩溃的证据。
  const postR = await refreshPage();
  console.log(`  W3p(已 detach，HTTP-only，至 ${el()}) 主窗口标题 = ${JSON.stringify(postTitles)}` +
    `；id 现值 ${idOf(postR.page)}（初始 ${firstId}）` + (postPageGone ? '；中途主窗口 target 一度消失' : ''));
  console.log(`W3p=${postSawRouter ? 1 : 0}`);

  if (probe) {
    console.log('  运行时探针:');
    for (const [k, v] of Object.entries(probe)) console.log(`    ${k} = ${JSON.stringify(v)}`);
    // S5 参考项：不计入成败，且不下"必崩"这类超出观测的断言。
    const notes = [];
    if (!probe.vueMounted) notes.push('#app 未挂载');
    if (probe.canvasCount < 1) notes.push('无 canvas');
    if (probe.bodyLen < 20) notes.push('body 文本过短');
    console.log(notes.length
      ? '  S5 SKIP（仅参考，不计成败）: ' + notes.join('；') + ' —— 需真实 Windows 复验'
      : '  S5 参考: 渲染层 DOM 完整（仍以真实 Windows 为准）');
  } else {
    console.log('  S5 不可判：DOM 探针未完成（' + probeErr + '）—— 与 W3 结论无关');
  }
  process.exit(0);
})().catch(e => {
  // 走到这里说明连 W3 的前置（连上渲染层/取标题）都没做到 ⇒ W3 不可判，记 e，
  // 绝不写成 0（0 的含义是"跑完了但没观测到 router 标题"，那是产品结论）。
  console.log('  探针前置失败: ' + e.message);
  console.log('W3=e');
  process.exit(0);
});
JS
rc=$?
cat /tmp/probe.out
# 必须先报 rc：上一版只把 W3 缺省成 0，于是"node 被 OOM/信号杀掉、探针一行都没打"
# 与"探针跑完但确实没拿到 router 标题"这两种完全不同的故障被合并成同一个 W3=0，
# 我因此连续两次把前者当成后者来下结论（先是误信参数有效，后又误信参数无效）。
if [ "$rc" != 0 ]; then
  echo "  !! 探针进程异常退出 rc=$rc（$( [ "$rc" -gt 128 ] && echo '被信号 '$((rc-128))' 终止，疑 OOM/kill' || echo '非零退出' )）"
  echo "  !! 此时 W3 不可判（不是产品红，是测量层失效）"
  W3=e
else
  W3=$(grep -oE '^W3=[01e]$' /tmp/probe.out | tail -1 | cut -d= -f2)
  if [ -z "$W3" ]; then echo "  !! 探针 rc=0 但未输出 W3 结论行 ⇒ 测量层失效，W3 记为不可判"; W3=e
  else echo "  （探针正常完成，W3=$W3）"; fi
fi
# W3h = 挂 WS **之前**、W3p = 关掉 WS **之后**，各自只用 HTTP 观测（判据与 W3 同）。
W3H=$(grep -oE '^W3h=[01]$' /tmp/probe.out | tail -1 | cut -d= -f2); W3H="${W3H:-e}"
W3P=$(grep -oE '^W3p=[01]$' /tmp/probe.out | tail -1 | cut -d= -f2); W3P="${W3P:-e}"
echo "  三段观测（同一进程同一轮）：W3h(attach前)=$W3H  W3(挂WS期间)=$W3  W3p(detach后)=$W3P"
# 判读表按"改探针后能测出什么"来写，而不是按"我希望结论是什么"。
# 关键限定：**W3p 只反映 /json/list 的缓存标题**，浏览器进程在渲染进程死后仍会
# 返回最后一次设置的标题 ⇒ W3p=1 **不等于**渲染层此刻活着（three4 rep1 实测：
# render-process-gone 之后 18s，W3p 依然 1）。能证明"渲染层跑到过 router"的
# 只有 W3h/W3 取到后缀标题那一刻；W3=e 的含义是"WS 命令传输没拿到回复"。
case "$W3H/$W3/$W3P" in
  1/1/*) echo "  ⇒ 经 WS 实读到 router 后缀标题 ⇒ 渲染层 JS 执行到 router（W3p 另说，见上）" ;;
  1/e/*) echo "  ⇒ 渲染层跑到 router（W3h=1 已证），但 WS 命令无回复 ⇒ wine CDP 传输不可靠；"
    echo "     W3p=$W3P 只是缓存标题，不能据此判渲染层是否仍活着" ;;
  1/0/*) echo "  ⇒ W3h=1 但挂 WS 期间始终没读到后缀标题；需与 app.log 的 render-process-gone"
    echo "     时刻定序，分辨是 WS 传输问题还是渲染层在此期间崩了" ;;
  0/*) echo "  ⇒ attach 前就没到 router ⇒ wine 下渲染层本轮未跑到 router（或更早退出）" ;;
  *) echo "  ⇒ 组合 $W3H/$W3/$W3P：样本累积中，不作单一归因" ;;
esac

echo "== [W4] 应用自建**业务**子目录（main.ts 业务代码在 Windows 上执行的证据）=="
UD="$WINEPREFIX/drive_c/users/root/AppData/Roaming/@security-survey"
sleep 2
# 判据必须是业务子目录而非 AppData 根：根目录与 desktop/、Cache、Local Storage 等
# 都是 Electron/Chromium 自身建的，只能证明"Electron 跑过"（W1/W2 已覆盖），
# 不能证明"我们的 main.ts 跑过"。projects/templates/exports/cache/logs 五个目录
# 由 main.ts 的 preloadResources()（约 356 行起）显式 mkdirSync，才是本品的证据。
BIZ="projects templates exports cache logs"
hit=0; miss=""
for d in $BIZ; do
  # 必须大小写不敏感地判存在：Chromium 启动时会先自建 `Cache`（大写 C），
  # 而 main.ts 的 dirs 里有小写 `cache`。Windows/wine 的查找是大小写不敏感的 ⇒
  # main.ts 的 existsSync('cache') 命中已存在的 `Cache` 于是**不再 mkdir**，
  # 落盘名保持 `Cache`。若像早版那样用大小写敏感的 `[ -d .../cache ]`，
  # 就会把"本品代码正常跑完"误判成 4/5 未走完 —— 实测踩过这个假红。
  if find "$UD/desktop" -maxdepth 1 -iname "$d" -type d 2>/dev/null | grep -q .; then
    hit=$((hit+1))
  else
    miss="$miss $d"
  fi
done
if [ "$hit" = 5 ]; then
  echo "  W4 绿：5 个业务子目录全部由应用创建（$UD/desktop）"; W4=1
elif [ "$hit" -gt 0 ]; then
  echo "  W4 红：业务子目录仅 $hit/5，缺:$miss"; W4=0
elif [ -d "$UD" ]; then
  echo "  W4 红：AppData 根存在（Electron 建）但无业务子目录 ⇒ 无法证明本品 main.ts 执行"; W4=0
else
  echo "  W4 红：AppData 根都不存在"; W4=0
fi
# 诊断输出不再用 head -N 截断：上一版 head -14 恰好把第 5 个业务目录切掉，
# 让人误读成"缺失"。这里只列业务目录本身，条数固定、不会误导。
for d in $BIZ; do
  m=$(find "$UD/desktop" -maxdepth 1 -iname "$d" -type d 2>/dev/null | head -1)
  # 用 basename 而非 ${m#$UD/desktop/}：参数展开的模式里带 / 时，POSIX 允许把
  # 第一个 / 当定界符，不同 bash 版本行为不一致 ⇒ 别踩。
  if [ -z "$m" ]; then echo "    缺失: $d"; continue; fi
  got=$(basename "$m")
  if [ "$got" = "$d" ]; then echo "    存在: $got"; else
    # 实测：期望 cache、落盘 Cache —— 说明该目录被 Chromium 先建，main.ts 的
    # existsSync 因 Windows/wine 大小写不敏感而命中并跳过 mkdir（不是失败，但值得看见）。
    echo "    存在: $got（期望 $d，名字大小写不同 ⇒ 被 Chromium 抢先创建）"
  fi
done

echo "== 汇总 =="
# 容器是 --rm 的，$LOG 随容器一起消失；原先只在失败时 tail，会让成功轮里
# "渲染进程崩溃"的 epoch 时刻永久丢失 ⇒ 这里默认导出全文（行数有限：
# wine 噪声 + 我们的 console 行），SHOW_APP_LOG=0 可关。
[ "${SHOW_APP_LOG:-1}" = 1 ] && { echo "----- [applog] wine/应用输出（每行前缀 epoch 毫秒）-----"; cat "$LOG" 2>/dev/null; echo "----- [/applog] -----"; }
[ $W1 = 1 ] && echo "  W1 绿 进程以 Windows 栈运行" || echo "  W1 红 运行时栈非 Windows"
[ $W2 = 1 ] && echo "  W2 绿 Electron 主进程为本品" || echo "  W2 红 UA 非本品"
# 三种状态分开报，绝不把"没测到"写成"测到不合格"：
#   1 = 渲染层跑到 router（观测到后缀标题）
#   0 = 跑到超时仍未观测到
#   e = 测量层失效（探针进程被杀/未给结论），此时任何一侧的结论都不成立
case "${W3:-e}" in
  1) echo "  W3 参考（不计成败）：页面目标载入且 router 后缀标题已设" ;;
  0) echo "  W3 参考（不计成败）：轮询到超时仍未取到 router 后缀标题" ;;
  *) echo "  W3 不可判：测量层失效（见上面 rc / 探针输出），本项不作为任何结论的依据" ;;
esac
[ ${W4:-0} = 1 ] && echo "  W4 绿 应用创建 5 个业务子目录" || echo "  W4 红 业务子目录缺失"
# 不再硬写"wine 下必崩"：那是我从有限样本外出的断言。S5 只复述探针实际给出的行。
if grep -q "S5 SKIP\|S5 参考" /tmp/probe.out 2>/dev/null; then
  grep -h "S5 " /tmp/probe.out | sed 's/^/  /'
else
  echo "  S5 不可判：探针未产出 DOM 数据（见上面 W3 不可判原因）"
fi

taskkill //F //IM "安防勘点设计工具.exe" >/dev/null 2>&1
pkill -f "安防勘点设计工具.exe" >/dev/null 2>&1
kill $APP_PID $XVFB 2>/dev/null

if [ "$W1" = 1 ] && [ "$W2" = 1 ] && [ "${W4:-0}" = 1 ]; then
  echo "wine 层验收 PASS（门禁 W1/W2/W4）。这不等于 Windows 实机通过 —— 渲染层、UI 与交互仍需真实 Windows。"
  exit 0
else
  echo "wine 层验收 FAIL（门禁红项见上面）。node rc=$rc"
  exit 1
fi
