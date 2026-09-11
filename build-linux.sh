#!/usr/bin/env bash
# Linux 构建脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/apps/desktop"

echo "=== 安装依赖 ==="
pnpm install --frozen-lockfile

echo "=== 构建 Linux AppImage ==="
npx electron-builder --linux --x64

echo "=== 构建完成 ==="
ls -la ../release/*.AppImage 2>/dev/null || echo "检查 release/ 目录"
