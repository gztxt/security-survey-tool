#!/usr/bin/env bash
# container-win-noattach.sh —— 判定 wine 下"渲染进程崩溃"是自发还是 CDP attach 引起
#
# 背景：container-win-smoke 的每轮 app.log 都有 main.ts:240 的"渲染进程崩溃"
# （处理函数在 239）。但该日志行**不带时间戳**，只能取"前一条带 Chromium 时间戳的
# 行"作为**下界** ⇒ 无法判断崩溃发生在挂 WS 之前还是之后。
# 此前我曾据 rep2 下界早于探针起点就断言"自发、非观察者效应" —— 那是把下界当成
# 实测时刻，**该断言当时不成立**，需要一条不依赖时间对齐的判据。
#
# 干净判据：**全程只用 HTTP（/json/version、/json/list），一个 WebSocket 都不连**。
#   崩溃照样出现 ⇒ 与 attach 无关（wine 自身渲染层不稳定）
#   0 attach 不崩、有 attach 才崩 ⇒ 才支持观察者效应
# 崩溃检测读 app.log 文本，不依赖 CDP ⇒ 不会被"CDP 挂了看不到"污染。
#
# === 实测结果（2026-09-12，容器 electronuserland/builder:wine，3 轮）===
#   3/3 轮：saw_router=1（HTTP 读到 "首页 - 安防勘点设计工具"）
#           crash=1（app.log 出现渲染进程崩溃，exitCode 全部 -2147483645）
#           http_fail=0、进程存活=1（观测窗口各约 62s）
#   ⇒ **观察者效应假设被否**：零 attach 仍崩，wine 渲染层自发不稳定。
#   ⇒ 同时说明 wine 下"渲染层跑到过 router"是稳的（与 smoke 的 W3h 9/9 一致）。
#   原始日志：releases/20260912/wine-evidence/noattach.log
#
# 用法（在容器内跑，参数是 win-unpacked 里的 exe）：
#   docker run --rm --shm-size=2g \
#     -v <repo>/apps/desktop/release/win-unpacked:/uw:ro \
#     -v <repo>/scripts/container-win-noattach.sh:/na.sh:ro \
#     electronuserland/builder:wine bash /na.sh "/uw/安防勘点设计工具.exe"
# 退出码：0 完成检测（无论是否崩，崩溃本身不是本脚本的失败）；
#         1 CDP HTTP 不可达 ⇒ 测量层没跑成，结论无效；
#         2 用法错误（缺参数）。
set -uo pipefail
APP="${1:-}"
[ -n "$APP" ] || { echo "用法: $0 <win-unpacked 里的 exe 绝对路径>"; exit 2; }
WIN=$(date +%s)   # 本窗口起点（epoch 秒），用于把崩溃落到相对时间轴
export WINEPREFIX=/root/.wine-sec
export WINEDLLOVERRIDES="mscoree=,mshtml=,winemenubuilder.exe=d"
export WINEDEBUG=-all DISPLAY=:99 DISPLAY_NUM=99
apt-get update -qq >/dev/null 2>&1
command -v xdpyinfo >/dev/null || apt-get install -y -qq xvfb x11-utils >/dev/null 2>&1
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/tmp/xvfb.log 2>&1 & sleep 3
timeout 240 wineboot -u >/tmp/wineboot.log 2>&1; echo "wineboot rc=$?"
timeout 150 wine "$APP" --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-port=9222 >/tmp/app.log 2>&1 &
APP_PID=$!
# 就绪判定必须用**显式标志**：早先这里写的是 `echo "...rc=$?"`，而 $? 取的是
# for 循环最后一条命令（sleep 或 break 后的 &&）的状态 —— 循环正常走完时它恒为 0，
# 于是"CDP 到底通没通"被一个假读数代替（正是本次一路在修的那类自欺测量）。
cdp_ok=0
for i in $(seq 1 60); do
  kill -0 $APP_PID 2>/dev/null || { echo "!! wine 进程在 CDP 就绪前退出"; break; }
  if curl -sf --max-time 3 -o /dev/null http://127.0.0.1:9222/json/version; then cdp_ok=1; break; fi
  sleep 1
done
if [ "$cdp_ok" != 1 ]; then
  echo "==> 测量层失败：CDP HTTP 不可达（结论无效，不是产品结论）"; tail -20 /tmp/app.log; exit 1
fi
echo "CDP HTTP 就绪（等待 $(( $(date +%s) - WIN ))s）"

# 60s 纯 HTTP 观测，**绝不** new WebSocket / 绝不连 ws://
T1=$(date +%s)
saw_router=0; http_fail=0; alive=1
for i in $(seq 1 60); do
  kill -0 $APP_PID 2>/dev/null || { alive=0; echo "  wine 进程在 +$(( $(date +%s) - T1 ))s 退出"; break; }
  if curl -sf --max-time 3 -o /tmp/l.json http://127.0.0.1:9222/json/list; then
    if grep -q ' - 安防勘点设计工具' /tmp/l.json; then saw_router=1; fi
  else
    http_fail=$((http_fail+1))
    [ "$http_fail" = 1 ] && echo "  首次 HTTP 失败于 +$(( $(date +%s) - T1 ))s（进程仍活 ⇒ CDP HTTP 层不稳）"
  fi
  sleep 1
done
echo "  60s 纯 HTTP：看到 router 标题=$saw_router HTTP失败次数=$http_fail 进程存活=$alive"

sleep 1
echo "== app.log 崩溃检测（全程 0 次 WebSocket 连接）=="
if grep -aq "渲染进程崩溃" /tmp/app.log; then
  echo "  ==> 无 attach 仍崩溃 ⇒ 观察者效应**不成立**，wine 渲染层自发不稳定"
  sed 's/\x1b\[[0-9;]*m//g' /tmp/app.log | grep -a "渲染进程崩溃" | head -3
  NOATTACH_CRASH=1
else
  echo "  ==> 本轮（60s 内、0 attach）未记录到崩溃行"
  NOATTACH_CRASH=0
fi
echo "@@@NOATTACH crash=$NOATTACH_CRASH saw_router=$saw_router http_fail=$http_fail alive=$alive"
# 崩溃行若未出现，需知窗口多长：给出 wine 进程存活秒数作为"未崩窗口"下界
echo "@@@NOATTACH 观测窗口 ≈ $(( $(date +%s) - T1 ))s"
pkill -f "安防勘点设计工具.exe" 2>/dev/null
taskkill //F //IM "安防勘点设计工具.exe" >/dev/null 2>&1
echo "=== 关键 app.log 片段（含 Chromium 时间戳，便于定序） ==="
sed 's/\x1b\[[0-9;]*m//g' /tmp/app.log | grep -aE "\[[0-9]+:0912/|渲染进程崩溃|DevTools listening" | tail -12
