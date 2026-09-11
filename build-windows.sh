#!/usr/bin/env bash
# Windows 构建脚本 - 在 Windows 环境或 WSL 下运行
# 需要 Node.js 20+ 和 pnpm

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/apps/desktop"

echo "=== 安装依赖 ==="
pnpm install --frozen-lockfile

echo "=== 跳过类型检查直接构建 ==="
# Linux 环境下 vue-tsc 可能 OOM，跳过类型检查
npm run build -- --skipLibCheck

echo "=== 构建 Windows 安装包 ==="
npx electron-builder --win --x64

echo "=== 构建完成 ==="
ls -la ../release/*.exe ../release/*.zip 2>/dev/null || echo "检查 release/ 目录"
