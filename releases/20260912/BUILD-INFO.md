# Windows 构建 2026-09-12 12:54~13:31 (+08:00)

平台：Windows x64（便携版 + NSIS 安装版）
源码基线：`安防勘点工具` @ `09838c6`（master）。
打包输入为纯源码（apps/desktop/src + packages/**），与该提交一致；
本次同时改动的 `apps/desktop/scripts/smoke/run.cjs`（验收 harness）与
`scripts/*-win-*.sh`（构建脚本）**不进入** app.asar，故不影响产物内容等价性。
应用版本：0.0.1 ｜ Electron 28.2.0 ｜ electron-builder 24.9.0

## 产物

| 文件 | 体积 | 用途 |
|---|---|---|
| `安防勘点设计工具 Setup 0.0.1.exe` | 114,760,700 B | 安装版（NSIS，可选目录、桌面/开始菜单快捷方式、带卸载器） |
| `安防勘点设计工具 0.0.1.exe` | 114,532,474 B | 便携版（portable，双击即用，不写注册表） |
| `安防勘点设计工具 Setup 0.0.1.exe.blockmap` | 120,112 B | 差量更新索引 |

SHA256 见同目录 `SHA256SUMS.txt`。

## 构建方式

本机（飞牛 NAS Debian 12）无法直跑 `electron-builder --win`：NSIS 目标需要用 **32 位 wine**
运行一次安装器提取卸载器，而本机只有 wine64；`apt install wine32` 会连带升级
systemd / libssl / libgcrypt 等核心库，代价不可接受。

故走容器：`electronuserland/builder:wine`（wine-11.0 + node v24.15.0），
脚本 `安防勘点工具/scripts/build-windows-docker.sh`
（容器内步骤 `scripts/container-win-build.sh`，产物校验 `scripts/container-win-verify.sh`）。

坑位记录（均已写进脚本注释，避免下次重踩）：
1. 宿主机直构时 makensis 报 `__uninstaller-nsis-*.exe -> no files found`，
   产出一个 **188KB 空壳 Setup.exe**，但进程退出码仍为 0 ⇒ 必须用体积闸门，不能只看退出码。
2. 只装 wine64 时 Debian 不提供 `/usr/bin/wine` 分发脚本，而 app-builder 以
   `wine --ia32 A --x64 B --args '<json>'` 协议调用 ⇒ 软链 wine64 会报
   "could not exec the wine loader"。
3. rsync 复制源码时若带上 `packages/*/tsconfig.tsbuildinfo` 而不带 `dist/`，
   tsc 会误判"已构建"跳过产出 ⇒ 下游 `vue-tsc` 大面积 TS2307。容器构建脚本已显式清增量状态。
4. 工作区 `.npmrc` 的 `script-shell` 指向 Windows PortableGit 路径（UNC 网络盘专用），
   容器内不存在 ⇒ 隔离副本需删除该文件。

## 验证（载荷级，非"构建没报错"）

- 两个包的**全部 77 个**内嵌文件与 `win-unpacked` 参照目录逐文件 SHA256 比对：**0 差异**。
- 内层 `app.asar`（217,157,862 B）内 `dist/assets` 共 71 个 chunk，与最新 `dist/` 集合一致；
  `DrawingView-DZkF8VaA.js` 内确认含本轮修复的接线证据：`e.code` 判定 `Digit0`（缩放适应）、
  `grid-status` / `snap-status` 状态栏指示灯。⇒ 排除"打了旧 dist"的风险。
- 安装器内确认存在 `Uninstall 安防勘点设计工具.exe`（145,382 B）—— 正是宿主机直构失败的那一步。
- PE 版本资源解析确认：`ProductName=安防勘点设计工具`、`FileDescription=…桌面端 Electron 应用`、
  `FileVersion/ProductVersion=0.0.1`、`CompanyName=gztxt`（rcedit 经 wine 生效）。
- 真机端到端验收（Linux 同批产物）：`npm run smoke` **39/39 全绿**，
  且在 node v20.20.2 与 v24.18.0 双版本下各跑一次均全绿（修复了 harness 对 node 版本的隐式依赖）。
- 单测：desktop 91 + exporter 16 + device-lib 13 = **120 全绿**。

### 构建脚本端到端复跑验证（2026-09-12 14:06~14:10，+08:00）

上表结论不是手工命令的产物：`bash scripts/build-windows-docker.sh` 已按最终形态
从零复跑一次（`OUT_DIR=/vol1/winbuild/out-verify`，236 秒，exit 0），5 步全通过
（staging → 容器构建 → 取回 → 体积闸门 → 载荷校验），结果与手工构建一致：
77 文件逐 SHA256 比对不一致 0、缺失 0 / 多余 0、卸载器存在、接线证据命中。

**可复现性实测**：复跑产物的 `win-unpacked/resources/app.asar` 与本归档批次同尺寸
（217,157,862 B）且**全长** SHA256 完全相同
（`86eaade49d1ba417135d0a4eb1b8683df825b6e86e468e09dbef651bbef9ffa1`），
即**应用载荷是确定性的**；两个外层 exe 与归档批次差 41 B / 1 B，
差异仅来自 NSIS/portable 外壳内的构建时间戳，不影响载荷一致性结论。

防误用闸门（复跑中实测生效）：
- 默认落点 `releases/<日期>/` 已有 exe 时 **exit 5 拒绝覆盖**，
  避免覆盖后让同目录 `SHA256SUMS.txt` / 本文件记录的哈希失配成假档案；
- 产物不再默认落 `apps/desktop/release/` —— 该目录有历史跟踪的 >100MB 产物
  （app.asar / AppImage），构建会把它们改脏，顺手 commit 即重演 PT-20260912-02。

## Windows 产物真启动验收（wine 层，`scripts/container-win-smoke.sh`）

本节结论的原始日志在 **`wine-evidence/`**（含各实验对应关系与读数注意事项）。

用 wine **真实启动** `win-unpacked/安防勘点设计工具.exe`（NSIS/portable 的同一载荷）
并接 CDP 查运行时。**门禁只保留主进程级三项，全绿（最终脚本连跑 3 轮可复现）**：

| 项 | 判据 | 是否门禁 | 最终 3 轮（`three4`）结果 |
|---|---|---|---|
| W1 | CDP UA 报 `Windows NT` —— 真在 Windows 运行时栈上 | 是 | 3/3 绿 |
| W2 | CDP UA 含 `@security-survey/desktop` —— 本品 Electron 主进程 | 是 | 3/3 绿 |
| W4 | 应用建齐 `AppData/…/desktop/` 下 5 个业务子目录（`preloadResources()` 的 mkdirSync） | 是 | 3/3 绿 |
| W3h | **只用 HTTP**（挂 WS 前）读到主窗口 router 后缀标题（"首页 - …"） | 否，仅参考 | 3/3 命中（累计 9/9） |
| W3 | 挂 WS 后经 WS 读到 router 后缀标题 | 否，仅参考 | 绿 1 / 不可判 2 |
| S5 | 渲染层 DOM 完整度（canvas / #app / 文本量） | 否，仅参考 | 3/3 不可判 |

### 结论（仅陈述实测支撑的部分）

1. **wine 下渲染进程会自发崩溃，与 CDP attach 无关。**
   判据实验：`scripts/container-win-noattach.sh` 全程**只发 HTTP、一个 WebSocket 都不连**，
   连跑 3 轮，app.log 仍 3/3 出现 `main.ts:240`（`render-process-gone` 处理在 239）的
   `渲染进程崩溃 { reason: 'crashed', exitCode: -2147483645 }`
   （= `0x80000003` STATUS_BREAKPOINT，调试断点/CHECK 失败；
   **不是** ACCESS_VIOLATION —— 那是 `0xC0000005`，对应十进制 `-1073741819`）。
   ⇒ 观察者效应假设**被否**：崩溃是 wine 自身渲染层不稳定，不取决于有没人挂调试器。
2. **同一轮里渲染层确实跑到过 router。** W3h 累计 9/9、noattach 的纯 HTTP 观测 3/3
   读到后缀标题。该标题只有 `renderer/router/index.ts:150` 的 `document.title` 会写出，
   且浏览器进程每轮全新 ⇒ 必由**本轮**渲染 JS 执行产生。
   限定：W3h 读的也是 `/json/list` 的**缓存**标题，所以它证明的是"本轮渲染层
   **曾经**跑到 router"，**不是**"轮询那一刻仍活着"（理由同 W3p）。
   ⇒ "wine 渲染层从没起来过"这种说法不成立。
3. **崩溃与"跑到 router"在同轮可共存**（noattach 里既 saw_router=1 又 crash=1），
   与"到达 router 后才崩"的时序一致，但因崩溃行无时间戳，**不能**据此定出毫秒级先后。

### 口径边界：为什么这些都不能给 Windows 实机结论

崩溃行 `main.ts:240` 自身**不带时间戳**，app.log 里只有相邻的 Chromium 行带
（且 Chromium 用 **UTC**，换算本地要 +8h）⇒ 只能取"前一条带戳行"作**下界**，
无法判断单次崩溃相对观测窗口的精确先后。我此前一度据下界早于探针起点就写
"自发、非观察者效应"，那是把下界当实测时刻 —— 该断言当时**不成立**；现在的
0-attach 实验才把它**独立证明**为真（且顺带否掉了另一条错误假设，见下）。
更要紧的是：以上全部只说明"**wine 下**渲染层不稳"，**不是**"产品渲染层有问题"——
同一批渲染层字节在 Linux 真机 smoke 39/39 全绿，Windows 真机尚未测（PT-20260912-04）。
W3h/W3/S5 因此一律**不进门禁**：wine 下它们非确定性，当门禁等于不可信的灯。

### S5 不可判的确切原因（已归因，非"DOM 不存在"）

`three4` 明细：`Runtime.evaluate 无回复（>15000ms）`。wine 接受 page 级 WS 连接，
但对 CDP **命令**不回包（`Runtime.enable` / `evaluate` 皆无响应）⇒ 探针取不到 DOM。
⇒ 只能说"这条通道拿不到数据"，**不能**推断"渲染层 DOM 不完整"。

### 顺带排除的一个假设：CDP Origin 校验

wine/Electron 的 Chromium 120 确实启用 DevTools WebSocket 的 Origin 校验
（`wine-evidence/origin.log`：带 `Origin: null` 或 `Origin: http://127.0.0.1:9222`
均 `403 Rejected an incoming WebSocket connection`；不带 Origin 则 `101`）。
**但这不是本用例故障的原因**：抓包实测 Node 内建 `WebSocket` 发送的握手头里
**根本没有 Origin**（见原始头转写），握手本可成功。真正的元凶是**探针自身的
无界等待**（下一节），与 Origin 无关。记录以免下次又被 403 现象带偏。

### 测量层自身缺陷史（三次都是我把测量当结论）

- **ts_pipe 打死 W2**：给 app stdout 套时间戳管道（`> >(ts_pipe …)`）会让 wine 在
  "DevTools listening" 后约 0.7s 退出。交错 A/B（`wine-evidence/bisect.log`）：
  原始写法 2/2 过、加 ts_pipe 3/3 挂、去掉 2/2 过 ⇒ 元凶确定，已回退。
  教训：**测量层不得改写被测进程的 stdout**。
- **无界等待吃掉整轮预算**：裸 `fetch('/json/list')` 在 WS 断后也会挂
  （undici 默认 300s）；CDP `Runtime.enable` 在 wine 下不回包。二者叠加使单轮
  拖到 ~250s、且 attach 重试挂在 +239876ms 直到被 wine 的 `timeout 240` 杀掉
  ⇒ 那一版的 **W3p=0 测的是"探针自己拖死的尸体"，属无效数据**。
  修：`httpJson()` 统一 `AbortSignal.timeout(5000)` + `call()` 默认 15s 超时，
  单轮降至 ~97s。教训：**所有**等待必须有界（这条我早先写下过，又在别处违反）。
- **缓存标题冒充存活**：`/json/list` 的 title 是浏览器进程缓存值，渲染进程死后
  不清空；`main.ts:239` 只 `console.error`、不 reload ⇒ 崩后标题长期残留。
  故 **W3p=1 不能证明渲染层仍活着**，只用来判断 detach 有没有把页面弄没。
- **作废 1**：早先写 W3"时绿时红"、S5"必崩"，只依据零星两三轮，样本太小且判定层有缺陷。
- **作废 2**：一组"每臂 3 次"的 A/B（测 `--disable-features=CalculateNativeWinOcclusion`，
  该参数是我自己的假设、**无人提出过**）报"两臂都 6/6 拿到 router 标题"。不成立：
  它只用 HTTP 轮询且探针有"结论被覆盖"的缺陷。
- **作废 3**：ab3 的"W3 仅 1/5 绿"同样不作数 —— 当时探针尚无三段观测、也无界等待修复，
  1/5 是**无界等待导致的测量伪影**，非渲染层的真实性质。现行 W3h 9/9 才是干净数据。
  ab3 关于"参数无统计差别 ⇒ 不保留"的处置**仍然有效**（那是两臂相对比较，不受此影响）。

### 附带发现：`cache` 目录被 Chromium 的 `Cache` 大小写遮蔽（仅 Windows/wine 侧）

`main.ts:371` 的 `dirs` 含小写 `cache`，Chromium 启动时已自建大写 `Cache`；
Windows/wine 查找大小写不敏感 ⇒ `existsSync('cache')` 命中已存在的 `Cache`，
main.ts **跳过 mkdir**，落盘名保持 `Cache`（实测 5 个业务目录里只有这一个名字不同）。
现状无害：全仓只有 `main.ts:117` 与 `:371` 引用 `cache`，没有任何业务代码往该目录写文件。
但它是"目录清单与实际落盘不一致"的隐患 —— 若将来有代码按小写 `cache` 读写，
在 Linux 与 Windows 上会指向不同目录。建议改名避开 Chromium 的 `Cache`（如 `asset-cache`）。

（写脚本时另踩两个假判据，已进注释：静态 `<title>安防勘点设计工具</title>` 使"title 非空"
毫无信息量；大小写敏感的 `[ -d …/cache ]` 会把上面这个正常现象误判成"初始化未走完"。）

## Linux 真机 39/39 能否外推到 Windows 包（补齐推论漏洞）

此前"载荷一致 ⇒ Windows 包等价于已验收产物"有一处未验：Windows `app.asar`
（217,157,862 B）与做真机验收那份 Linux 的（217,175,796 B）**哈希不同、差 17,934 B**。
已逐文件查明：

- 清单差异只 2 项，且都只在 **Linux 侧**：`dist-electron/main/main.js`(14,910 B)、
  `dist-electron/preload/index.js`(2,480 B)，时间戳均为 **2026-08-18**，
  是 `.mjs`/`.cjs` 改名前的过期残留（14,910 + 2,480 + 544 头部索引 = 17,934，恰好对账）。
- 实际加载入口以 `package.json` 的 `"main": "dist-electron/main/main.mjs"` 与
  `build.files` 为准 ⇒ 这两个 `.js` **永不被加载**。
- 两份包内**真正执行**的入口逐字节比对，全部一致：`package.json`(1,021 B)、
  `main.mjs`(20,897 B)、`index.cjs`(2,490 B)、`dist/index.html`(898 B)、
  `DrawingView-DZkF8VaA.js`(68,692 B) —— SHA256 两两相同。

⇒ Linux 真机所验的主进程与渲染层代码与 Windows 包内是同一批字节，推论链闭合。
（附带发现：本机 Linux 打包会把 08-18 残留一并打进去，Windows 侧因走干净隔离副本反而没有；
属工作区 `dist-electron/` 陈旧产物未清，非缺陷，建议 `rm` 后重建。）

## 未验证项（如实声明）

- **wine 层已达主进程级门禁 W1/W2/W4 全绿（ab3 有效 5/5 轮），但这不等于真实 Windows。**
  wine 下渲染层不稳定（W3 仅 1/5 绿）且 DOM 一律测不到（S5 5/5 不可判），
  故窗口显示、鼠标键盘交互、D3D/打印、杀软与 SmartScreen 行为均未证；
  NSIS 安装→卸载闭环也未证（wine 里 `/S` 静默安装无限挂等）。
  **交付前仍需一次真实 Windows 冒烟**，脚本已备好可直接复用：
  `node scripts/win-smoke.mjs --exe "C:\Program Files\安防勘点设计工具\安防勘点设计工具.exe"`
  （判定层回归自测 31/31 通过，含"静态标题不得算 router 标题""splash 目标不得带偏
  主窗口""其它 Electron 应用必须判红"等假绿/假红陷阱）。
- **未代码签名**（`CSC_IDENTITY_AUTO_DISCOVERY=false`）：Windows SmartScreen 会拦截，
  首次运行需"仍要运行"；企业环境可能被 AV 直接隔离。
- 载荷比对集为 `win-unpacked` 的 77 个文件，`app.asar` 作为**整体单一对象**参与比对
  （其内部 71 个 chunk 另按 `dist/` 集合与接线字符串单独断言），不是逐 chunk 独立比对。
- **内嵌 Python sidecar 未打包**（wine 日志实测）：`Python sidecar not found at:
  resources/python/python.exe` —— 包内只有 `convert_dwg.py` / `parse_dxf.py` 两个脚本，
  无解释器；`main.ts:357-362` 是 `console.warn` 级降级，不阻塞启动，但意味着
  **Windows 上 DXF 解析的 Python 回退路径不可用**（ODA File Converter 同理未内嵌）。
  属已知能力缺口，需在发布说明中告知或补打包。

## 与上一批产物的差异

上一批 Windows 包为 2026-09-06（`releases/*.exe`），此后源码有 **29 个提交**，包含：
画布被标签栏挤成 0 高、新图纸默认视口居中、整轮 P1 快捷键治理（keymap 唯一真相源、
Shift+1/Shift+2 死键、Ctrl+W/页签✕ 删除确认、Delete 批量删除单步撤销）、
新建图纸契约字段补齐、导出走真实下载通道等。旧包不含这些修复，应视为过期。
