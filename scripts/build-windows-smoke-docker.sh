#!/usr/bin/env bash
# build-windows-smoke-docker.sh —— 在容器里用 wine 真启动 Windows 产物并做分层验收
#
# 前置：先跑过 scripts/build-windows-docker.sh。该脚本把 win-unpacked 留在隔离区
# （$STAGE/apps/desktop/release/win-unpacked）当校验参照，正是本脚本的输入。
#
# 用法：
#   bash scripts/build-windows-smoke-docker.sh                 # 自动取最近的隔离区
#   bash scripts/build-windows-smoke-docker.sh /path/to/win-unpacked
#
# 退出码 0 = 主进程级门禁 W1/W2/W4 全绿；非 0 = 有红项
# （W3/S5 属渲染层，wine 下不可信，仅作参考不计成败；详见 container-win-smoke.sh 头部）。
# 注意：本脚本**不能**替代真实 Windows 冒烟 —— wine 下 Electron 28 渲染进程必崩，
# 渲染层 DOM 一项刻意记 SKIP 而非 PASS。
set -euo pipefail

IMAGE="${IMAGE:-electronuserland/builder:wine}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

U="${1:-}"
if [ -z "$U" ]; then
  # 取最近一次构建隔离区里的 win-unpacked（按时间倒序）
  # 末尾 `|| true` 不能省：set -euo pipefail 下，若无 app-* 目录则 ls 失败 ⇒ 整条
  # 管道非 0 ⇒ 赋值语句直接终止脚本，下面"找不到目录"的友好报错永远打不出来。
  U=$(ls -1dt /vol1/winbuild/app-* 2>/dev/null | while read -r d; do
        [ -d "$d/apps/desktop/release/win-unpacked" ] && { echo "$d/apps/desktop/release/win-unpacked"; break; }
      done | head -1 || true)
fi
if [ -z "$U" ] || [ ! -d "$U" ]; then
  echo "!! 找不到 win-unpacked 目录。先跑 build-windows-docker.sh，或显式传路径。" >&2
  exit 2
fi
echo "[wine 冒烟] 被测目录: $U"

# 两个仅供实测用的开关，默认空/默认值 ⇒ 常规流程行为不变：
#   EXTRA_FLAGS      追加给 exe 的 Chromium 启动参数（A/B 用，如
#                    --disable-features=CalculateNativeWinOcclusion）
#   S5_TIMEOUT_MS    DOM 探针超时预算（放大它可区分"wine 只是慢"与"渲染层已崩"）
ENVARGS=()
[ -n "${EXTRA_FLAGS:-}" ] && ENVARGS+=(-e "EXTRA_FLAGS=$EXTRA_FLAGS")
[ -n "${S5_TIMEOUT_MS:-}" ] && ENVARGS+=(-e "S5_TIMEOUT_MS=$S5_TIMEOUT_MS")

docker run --rm --shm-size=2g \
  -v "$U":/uw:ro \
  -v "$REPO_ROOT/scripts/container-win-smoke.sh":/smoke.sh:ro \
  "${ENVARGS[@]}" \
  "$IMAGE" bash /smoke.sh /uw
