#!/usr/bin/env bash
# 容器内执行：把两个 Windows 产物当作黑盒拆开验，确认"包是对的"而不只是"构建没报错"。
# 验证等级：载荷级（解内嵌 7z → 与 win-unpacked 逐文件 SHA256 比对 → 断言包内前端
# chunk 含本轮修复的接线证据）。不依赖 wine 运行 GUI 安装器 —— 实测 NSIS /S 在
# wine + Xvfb 下会长时间挂等（提权交互），不适合作为 CI 闸门。
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
which 7z >/dev/null 2>&1 || { apt-get update -qq >/dev/null 2>&1; apt-get install -y --no-install-recommends p7zip-full >/dev/null 2>&1; }
which 7z >/dev/null 2>&1 || { echo "缺 7z，无法做载荷级校验"; exit 1; }

cd /project/apps/desktop/release
REF=win-unpacked
[ -d "$REF" ] || { echo "缺参照目录 $REF（应与产物同批产出）"; exit 1; }
( cd "$REF" && find . -type f | sed 's|^\./||' | sort ) > /tmp/ref.list
echo "参照 win-unpacked 文件数: $(wc -l < /tmp/ref.list)"

fail=0
for f in "安防勘点设计工具 Setup 0.0.1.exe" "安防勘点设计工具 0.0.1.exe"; do
  [ -f "$f" ] || { echo "缺失: $f"; fail=1; continue; }
  echo "===== $f ($(( $(stat -c%s "$f") / 1048576 )) MB) ====="
  rm -rf /tmp/v && mkdir -p /tmp/v/outer /tmp/v/app
  7z x -y "$f" -o/tmp/v/outer >/dev/null 2>&1
  inner=$(find /tmp/v/outer -name "*.7z" | head -1)
  [ -n "$inner" ] || { echo "  未找到内嵌载荷"; fail=1; continue; }
  7z x -y "$inner" -o/tmp/v/app >/dev/null 2>&1
  ( cd /tmp/v/app && find . -type f | sed 's|^\./||' | sort ) > /tmp/v/app.list

  miss=$(comm -23 /tmp/ref.list /tmp/v/app.list | wc -l)
  extra=$(comm -13 /tmp/ref.list /tmp/v/app.list | wc -l)
  echo "  文件集对比 win-unpacked: 缺失 $miss / 多余 $extra"
  [ "$miss" = 0 ] && [ "$extra" = 0 ] || { comm -23 /tmp/ref.list /tmp/v/app.list | head -3; fail=1; }

  mism=0; tot=0
  while read -r p; do
    tot=$((tot+1))
    a=$(sha256sum "$REF/$p" | cut -d' ' -f1)
    b=$(sha256sum "/tmp/v/app/$p" 2>/dev/null | cut -d' ' -f1)
    [ "$a" = "$b" ] || { mism=$((mism+1)); [ $mism -le 3 ] && echo "  哈希不一致: $p"; }
  done < <(comm -12 /tmp/ref.list /tmp/v/app.list)
  echo "  逐文件 SHA256: 比对 $tot 个，不一致 $mism 个"
  [ "$mism" = 0 ] || fail=1

  # 包内前端产物必须含本轮修复的接线证据（e.code 判定 Digit0/Digit1 的缩放键、
  # 状态栏网格/吸附指示灯），防止"构建绿但打了旧 dist"。
  python3 - <<'PY' || fail=1
import json, struct, sys, glob, os
p = '/tmp/v/app/resources/app.asar'
with open(p, 'rb') as f:
    f.read(4); hsz = struct.unpack('<I', f.read(4))[0]; f.read(4)
    jsz = struct.unpack('<I', f.read(4))[0]; hdr = json.loads(f.read(jsz).decode())
def walk(n, pre=''):
    o = []
    for k, v in n.get('files', {}).items():
        pp = pre + '/' + k
        o += walk(v, pp) if 'files' in v else [(pp, int(v['offset']), int(v['size']))]
    return o
fl = walk(hdr)
names = [x[0] for x in fl if x[0].startswith('/dist/assets/') and 'DrawingView' in x[0] and x[0].endswith('.js')]
if not names:
    print('  !! asar 内找不到 DrawingView chunk'); sys.exit(1)
n = names[0]
off, size = [(x[1], x[2]) for x in fl if x[0] == n][0]
with open(p, 'rb') as f:
    f.seek(8 + hsz + off); d = f.read(size)
ok = (b'Digit0' in d) and (b'grid-status' in d) and (b'snap-status' in d)
print(f'  包内接线证据 {os.path.basename(n)}: Digit0缩放={b"Digit0" in d} 网格/吸附指示器={b"grid-status" in d and b"snap-status" in d}')
sys.exit(0 if ok else 1)
PY
done

# Setup 版必须真的带卸载器（这正是宿主机直构失败的那一步）
echo "===== 卸载器存在性 ====="
if 7z l "安防勘点设计工具 Setup 0.0.1.exe" 2>/dev/null | grep -q "Uninstall 安防勘点设计工具.exe"; then
  echo "  OK：安装器内含卸载器"
else
  echo "  !! 安装器缺卸载器 ⇒ 该包是空壳（见 build-windows-docker.sh 文件头说明 1）"; fail=1
fi

echo "VERIFY_RC=$fail"
exit $fail
