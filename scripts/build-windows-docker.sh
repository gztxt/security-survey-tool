#!/usr/bin/env bash
# 在 Linux 上交叉构建 Windows 便携版 + NSIS 安装版（docker + wine 容器，不依赖宿主机 wine）。
#
# 为什么需要它（2026-09-12 实测）：
#   1) 宿主机直跑 `electron-builder --win` 到 NSIS 一步必失败：electron-builder 需要
#      用 **32 位 wine** 运行一次安装器把卸载器提取出来，本机只有 wine64
#      （apt 装 wine32 会连带升级 systemd/libssl/libgcrypt，代价不可接受）。
#      失败形状：makensis 报 `__uninstaller-nsis-*.exe -> no files found`
#      ⇒ 产出一个 188KB 的空壳 Setup.exe（真产物应 ~115MB）。**只认体积，别只看退出码。**
#   2) Debian 只装 wine64 时没有 /usr/bin/wine 分发脚本，app-builder 以
#      `wine --ia32 A --x64 B --args '<json>'` 协议调用 ⇒ 直接软链 wine64 会报
#      "could not exec the wine loader"。本脚本走容器镜像，绕开这两个坑。
#   3) CI 通道（.github/workflows/desktop-build.yml）自 08-18 起没跑过：它只能构建
#      已推送到 GitHub 的代码，而待推提交里有 app.asar / AppImage / exe 等
#      >100MB blob（GitHub 单文件硬限 100MB）⇒ push 必被拒 ⇒ CI 看不到新代码。
#
# 用法：  bash scripts/build-windows-docker.sh
# 产物：  releases/<YYYYMMDD>/{安防勘点设计工具 Setup 0.0.1.exe, 安防勘点设计工具 0.0.1.exe}
#         以及 *.blockmap（差量更新用）+ 自动生成的 SHA256SUMS.txt
#         可用 OUT_DIR=<目录> 覆写落点；目标目录已有 exe 时拒绝覆盖（exit 5）。
#         勿改回落 apps/desktop/release/ —— 那目录有历史跟踪的 >100MB 产物，会被构建改脏。
#
# 前置：  docker 可用；镜像 electronuserland/builder:wine 可拉（走 daemon.json 镜像加速）。
# 缓存：  宿主 ~/.cache/{electron,electron-builder} 挂进容器复用，避免重复下载
#         electron-win32-x64.zip（116MB）与 nsis/winCodeSign。
set -euo pipefail

IMAGE="${IMAGE:-electronuserland/builder:wine}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 每次用独立时间戳隔离区：容器内以 root 写出的 node_modules/release 属主为 root，
# 复用同一目录会让下一次 rsync --delete 因权限失败。单次占用约 1.4GB（源码 2.2M
# + node_modules ~650M + 产物 ~700M），跑完按末尾提示清理旧目录。
STAGE="${STAGE:-/vol1/winbuild/app-$(date +%Y%m%d_%H%M%S)}"
# 产物**不要**落 apps/desktop/release/：那里历史上已被 git 跟踪（builder-debug.yml、
# linux-unpacked/resources/app.asar 202MB、*.AppImage 145MB 都在版本库里），构建会
# 把它们改脏，一旦顺手 commit 就又往历史里塞一个大 blob ⇒ 重复 PT-20260912-02 的
# GitHub 100MB 硬限事故。改落 releases/<日期>/，已被 .gitignore 的 *.exe 规则覆盖。
OUT_DIR="${OUT_DIR:-$REPO_ROOT/releases/$(date +%Y%m%d)}"
if ls "$OUT_DIR"/*.exe >/dev/null 2>&1; then
  echo "!! $OUT_DIR 已存在 exe 产物，拒绝覆盖（覆盖会让同目录 SHA256SUMS.txt/BUILD-INFO 失配）。" >&2
  echo "   重跑验证请显式指定输出目录，例：OUT_DIR=/vol1/winbuild/out-verify $0" >&2
  echo "   确要重做这一批：先把该目录改名留档，再不带 OUT_DIR 重跑。" >&2
  exit 5
fi

echo "[1/5] 复制源码到隔离构建区 $STAGE（排除 node_modules/dist/release 等）"
mkdir -p "$STAGE"
rsync -a --delete \
  --exclude node_modules --exclude '*/node_modules' \
  --exclude dist --exclude dist-electron --exclude release --exclude releases \
  --exclude _archive --exclude .repo-memory --exclude .workbuddy \
  --exclude 'packages/*/tsconfig.tsbuildinfo' \
  "$REPO_ROOT/" "$STAGE/"

# 工作区 .npmrc 里 script-shell 指向 Windows PortableGit 路径（UNC 网络盘专用），
# 容器内不存在 ⇒ pnpm 起不了子进程。此处删掉它，只影响隔离副本。
rm -f "$STAGE/.npmrc"

echo "[2/5] 容器内构建（pnpm install → packages build → vue-tsc + vite + electron-builder --win）"
docker run --rm \
  -v "$STAGE":/project \
  -v "$REPO_ROOT/scripts/container-win-build.sh":/build.sh:ro \
  -v "$HOME/.cache/electron":/cache/electron \
  -v "$HOME/.cache/electron-builder":/cache/electron-builder \
  "$IMAGE" bash /build.sh

echo "[3/5] 取回产物到 $OUT_DIR（只取 exe/blockmap，win-unpacked 留在隔离区做校验参照）"
mkdir -p "$OUT_DIR"
cp -a "$STAGE"/apps/desktop/release/*.exe "$STAGE"/apps/desktop/release/*.blockmap "$OUT_DIR/"

echo "[4/5] 体积闸门（防 188KB 空壳，见文件头说明 1）"
fail=0
for f in "$OUT_DIR/安防勘点设计工具 Setup 0.0.1.exe" "$OUT_DIR/安防勘点设计工具 0.0.1.exe"; do
  if [ ! -f "$f" ]; then echo "  缺失: $f"; fail=1; continue; fi
  sz=$(stat -c%s "$f")
  if [ "$sz" -lt 50000000 ]; then echo "  体积异常($sz B)疑似空壳: $f"; fail=1;
  else echo "  OK $sz B  $(basename "$f")"; fi
done
[ "$fail" = 0 ] || { echo "产物未通过体积闸门，检查上面 electron-builder 日志"; exit 1; }

echo "[5/5] 载荷级校验（解出内嵌 7z，与 win-unpacked 逐文件比哈希 + 断言包内含最新接线）"
docker run --rm \
  -v "$STAGE":/project \
  -v "$REPO_ROOT/scripts/container-win-verify.sh":/verify.sh:ro \
  "$IMAGE" bash /verify.sh

echo "[归档] 写校验和（.exe/.blockmap 已被 .gitignore 排除，只有 SHA256SUMS.txt 等文本入库）"
( cd "$OUT_DIR" && sha256sum ./*.exe ./*.blockmap > SHA256SUMS.txt && ls -la )

cat <<NOTE

构建完成。产物在 $OUT_DIR
  · 只提交文本档案（SHA256SUMS.txt / BUILD-INFO.md），勿 git add 任何 exe/AppImage/asar；
    >100MB blob 一旦进入待推历史，本仓 push 与 CI 会被 GitHub 硬限永久堵死（见 PT-20260912-02）。
  · 交付前请在真实 Windows 上做一次安装→启动→操作冒烟（wine 无法替代该验证）。

本次隔离区可清理（容器内以 root 写出，需 sudo）：
  sudo rm -rf $STAGE
NOTE
