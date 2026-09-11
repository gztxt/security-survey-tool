#!/usr/bin/env bash
# NAS 端归档执行脚本（决策 8【4】）
#
# 作用：按 _archive/pre-refactor-20260911/MANIFEST.sha256 中记录的相对路径清单，
#       把仓库内仍残留在原位置的 .bak-* / __pycache__/*.pyc 逐条 mv 到 _archive/ 下
#       （保持原有相对目录结构）。tar 覆盖不会删除旧位置，故需要本脚本显式执行。
#
# 用法：bash scripts/apply-archive-list.sh [repo_root]
#       repo_root 缺省为脚本所在目录的上一级。
#
# 安全性：
#   - 只移动清单中列出的路径，绝不 glob 删除；
#   - 目标已存在 => 跳过并告警（幂等，可重复执行）；
#   - 源不存在   => 视为已归档，静默跳过。

set -u

REPO_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
ARCHIVE_DIR="$REPO_ROOT/_archive/pre-refactor-20260911"
MANIFEST="$ARCHIVE_DIR/MANIFEST.sha256"

if [ ! -f "$MANIFEST" ]; then
  echo "[apply-archive] ERROR: 缺少清单 $MANIFEST" >&2
  exit 1
fi

moved=0
skipped=0
warned=0

# MANIFEST 行格式（sha256sum 标准）：<hash>␣␣<archive-relative-path>
# archive-relative-path = 原始仓库相对路径（保持目录结构）
while IFS= read -r line; do
  [ -z "$line" ] && continue
  rel=$(printf '%s' "$line" | sed -E 's/^[0-9a-f]{64}[ \t]+//')
  [ -z "$rel" ] && continue
  src="$REPO_ROOT/$rel"
  dst="$ARCHIVE_DIR/$rel"
  if [ -e "$dst" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  if [ ! -e "$src" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  mkdir -p "$(dirname "$dst")"
  if mv "$src" "$dst"; then
    moved=$((moved + 1))
    echo "[apply-archive] moved: $rel"
  else
    warned=$((warned + 1))
    echo "[apply-archive] WARN: 无法移动 $rel" >&2
  fi
done < "$MANIFEST"

echo "[apply-archive] done. moved=$moved skipped=$skipped failed=$warned"
[ "$warned" -eq 0 ] || exit 2
exit 0
