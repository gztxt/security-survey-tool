#!/usr/bin/env bash
# 容器内（electronuserland/builder:wine）执行：装依赖 → 构建包 → typecheck → vite → electron-builder --win。
# 由 scripts/build-windows-docker.sh 挂载调用，不要在宿主机直接跑。
set -uo pipefail

export ELECTRON_CACHE=/cache/electron
export ELECTRON_BUILDER_CACHE=/cache/electron-builder
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
export CSC_IDENTITY_AUTO_DISCOVERY=false
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree=,mshtml="
export NODE_OPTIONS=--max-old-space-size=4096
# 只出 win 包，跳过 linux electron 二进制下载（省 100MB+ 与一次网络往返）
export ELECTRON_SKIP_BINARY_DOWNLOAD=1

cd /project

echo "== 环境 =="; node -v; wine --version
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@11.22.0 --activate >/dev/null 2>&1 || true
pnpm -v

echo "JCODE_CHECKPOINT {\"message\":\"容器内 pnpm install\"}"
pnpm install --frozen-lockfile 2>&1 | tail -8

# 注意：packages/* 之间存在编译期依赖（wiring-engine 需要 shared-types 的 dist/*.d.ts），
# 而 rsync 若把过期的 tsconfig.tsbuildinfo 带进来，tsc 会误判"已构建"而跳过产出 dist
# ⇒ 下游 vue-tsc 大面积 TS2307。故显式清掉增量状态再全量构建。
echo "JCODE_CHECKPOINT {\"message\":\"workspace 包构建\"}"
find packages -name tsconfig.tsbuildinfo -delete 2>/dev/null || true
pnpm -r --filter "./packages/*" run build 2>&1 | tail -12

echo "JCODE_CHECKPOINT {\"message\":\"desktop typecheck + vite build + electron-builder --win\"}"
pnpm --filter @security-survey/desktop exec vue-tsc --noEmit 2>&1 | tail -12
pnpm --filter @security-survey/desktop exec vite build 2>&1 | tail -8
cd apps/desktop && npx electron-builder --win --x64 2>&1 | tail -30
RC=${PIPESTATUS[0]}

echo "== 产物 =="; ls -la release/*.exe release/*.blockmap 2>/dev/null
echo "BUILD_RC=$RC"
exit $RC
