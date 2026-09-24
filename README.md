# 安防勘点设计工具（Security Survey Tool）

安防图纸勘点设计工具：导入 CAD 图纸（DXF/DWG）/ 图片 / PDF 作为底图，在其上标注摄像头点位、
网络走线、机柜位置等，导出为图片 / PDF / DXF 图纸。

技术形态：Electron 28 + Vue 3 + Pinia + Element Plus + TypeScript 的 pnpm monorepo。

## 项目结构

```
survey-tool/
├─ apps/desktop/            Electron 桌面应用（主进程 + preload + Vue 渲染进程）
│  └─ src/
│     ├─ main.ts            主进程（33+ IPC handler、路径白名单安全策略）
│     ├─ preload/index.ts   contextBridge（同时暴露 electronAPI 与 api 两个名字）
│     └─ renderer/          Vue3 渲染进程（views / components / stores / composables / services）
├─ packages/
│  ├─ shared-types/         全栈共享领域模型类型（Project/Drawing/Device/Cable/Export…）
│  ├─ cad-parser/           DXF/DWG 解析（dxf-parser + Python sidecar 回退）
│  ├─ cad-renderer/         Canvas 2D 渲染引擎（图元/网格/标尺/拾取/位图底图）
│  ├─ device-lib/           内置设备库与 FOV 视野几何
│  ├─ wiring-engine/        自动布线与拓扑计算
│  └─ exporter/             多格式导出引擎（PNG/JPG/PDF/SVG/XLSX/CSV/ZIP + DXF overlay）
├─ scripts/                 验证闸门与归档脚本
├─ docs/                    交付与回流说明
└─ _archive/                重构前历史备份（.bak-*/，不参与构建）
```

## 环境与命令

要求：Node ≥ 20，pnpm ≥ 9（packageManager: pnpm@11.22.0）。

```bash
pnpm install                          # 安装依赖（Electron 二进制下载失败时可设 ELECTRON_SKIP_BINARY_DOWNLOAD=1）
pnpm -r --filter "./packages/**" build  # 先构建 workspace 包（desktop 类型检查依赖 dist/*.d.ts）
pnpm --filter @security-survey/desktop run build:app   # 渲染进程闸门：vue-tsc --noEmit && vite build
pnpm --filter @security-survey/exporter exec vitest run  # 单测（含 dxf-writer 往返测试）
```

一键验证：`powershell -File scripts/verify.ps1`（退出码非 0 即阻断）。

> 注意：desktop 的 `build` 脚本带 electron-builder，无 Electron 二进制环境会失败；
> 日常验证一律用 `build:app`。desktop 的 `test:unit` 是 watch 模式，脚本化请显式 `vitest run`。

## 打包与发布

| 目标 | 命令 | 产物落点 |
|---|---|---|
| Linux（本机） | `pnpm --filter @security-survey/desktop run build` | `apps/desktop/release/`（AppImage + linux-unpacked） |
| **Windows（交叉构建，走 Docker）** | `bash scripts/build-windows-docker.sh` | `releases/<YYYYMMDD>/` 下 Setup.exe + Portable.exe + blockmap + SHA256SUMS.txt |
| 真机端到端验收 | `pnpm --filter @security-survey/desktop run smoke`（脚本内部走 `xvfb-run`；需 X/虚拟显示） | 控制台 39 项断言 |
| Windows 产物真启动冒烟（wine 层） | `bash scripts/build-windows-smoke-docker.sh` | 门禁 W1/W2/W4 三项绿；W3/S5 属渲染层，wine 下不可信⇒仅参考 |

`smoke` 的 CDP harness 用到全局 `WebSocket`：node ≥ 22 自带，node 20 需要
`--experimental-websocket`。`scripts/smoke/run.cjs` 会在缺失时自动带该 flag 重新
拉起自己并把 `NODE_OPTIONS` 透传给子进程，因此 v20.20.2 与 v24.18.0 实测均 39/39 全绿。

Windows 为什么不能在本机直跑 `electron-builder --win`：NSIS 目标要用 **32 位 wine**
跑一次安装器以提取卸载器；本机只有 wine64，而 `apt install wine32` 会连带升级
systemd / libssl / libgcrypt 等核心库，代价不可接受。故用 `electronuserland/builder:wine`
容器（wine-11 + node 24）。四个已知坑（空壳 Setup 退出码仍为 0、缺 `/usr/bin/wine` 分发脚本、
`tsbuildinfo` 导致 tsc 误判已构建、`.npmrc` 的 `script-shell` 指向 Windows 路径）
已在 `scripts/build-windows-docker.sh` 与 `scripts/container-win-build.sh` 注释中逐条记录。

wine 层冒烟（`container-win-smoke.sh`）能证到：exe 在 Windows 运行时栈上真起来、
CDP UA 为本品、`app.asar` 里的 index.html 载入、router 执行过（后缀标题）、主进程落盘
AppData 业务目录。**证不到**窗口显示与交互 —— Electron 28 渲染进程在 wine 下稳定
`0xC0000005` 崩溃（`--disable-gpu`/`--no-zygote` 等组合同样），故该层刻意不把渲染层 DOM
计入成败，避免假绿。UI/交互仍需真实 Windows。

> **产物一律不入 git**。`releases/*/*.exe|zip|AppImage|blockmap` 已在仓库根 `.gitignore`
> 排除（此前 `!安防勘点工具/**` 反向规则会把它们重新纳入跟踪）。>100MB 的 blob 一旦进入
> 待推历史，本仓 `git push` 与 `desktop-build.yml` CI 会被 GitHub 单文件硬限永久堵死，
> 详见 `PENDING-TASKS.md` PT-20260912-02。交付批次只提交 `SHA256SUMS.txt` 与 `BUILD-INFO.md`。
> 另：**wine 层已达主进程级门禁 W1/W2/W4 全绿，但不等于真实 Windows**（渲染层在 wine
> 下必崩，窗口/UI/交互未证，详见 `releases/<日期>/BUILD-INFO.md`）；
> 也未代码签名（SmartScreen 会拦）；内嵌 Python sidecar 未打包（`resources/python/` 无
> `python.exe`，DXF 解析的 Python 回退路径在 Windows 不可用）。发布前需补这三项。

## `.survey` 数据格式与向后兼容

- 项目文件扩展名统一为 `.survey`（JSON，主进程 `project:save` 写盘）。
- **向后兼容承诺**：本次收敛重构不新增必填字段、不改变已有字段语义；
  旧 `.survey`（含历史 `.ssproj` 文件，经"所有文件"过滤器）可原样打开。
- **位图底图**以 `entities` 中 `type:'IMAGE'`（`layer:'BASEMAP'`）合成实体承载：
  会话内以 dataURL 内联渲染；**保存时剥离 dataURL、仅保留 `sourcePath`/`pageIndex`/尺寸引用**，
  避免 `.survey` 体积暴涨（决策 3.3）。打开项目时按 `sourcePath` 重新栅格化（重水合）；
  原图缺失则提示"底图文件已移动，请重新链接"，标注数据不受影响。
- **PDF 底图**经 pdfjs-dist 栅格化（scale=2），多页 PDF 默认取首页并弹选页对话框（AC-1.3）。
- `knownPath`（当前项目文件路径）只存在于渲染进程 store 状态，绝不写入 payload。

## DWG / DXF 能力边界（诚实声明）

- **DXF**：导入解析（dxf-parser，失败回退 Python sidecar）与导出（R12 ASCII overlay，
  图层统一 `SS-` 前缀，仅矢量标注层）均已实现。
  - **注意：上面这句"失败回退 Python sidecar"目前全平台都不成立**，已登记
    `PENDING-TASKS.md` PT-20260912-03。实测三处断链（**非 Windows 专属**）：
    1. `getPythonPath()` 只找应用内 `resources/python/{python.exe|bin/python3}`，
       **不会**回退到系统 Python；而 `resources/python/` 实际只有 `parse_dxf.py` /
       `convert_dwg.py` 两个脚本、无解释器 ⇒ 两平台都走不进 sidecar
       （wine 日志 `Python sidecar not found at: ...` 为实证）。
    2. 即使解释器就位：`safeSpawn` 未收集 stdout，`parseCadFileViaPython` 仍
       `resolve({success:true, data:null})` —— `parse_dxf.py` 的输出（默认打到 stdout）
       被整个丢弃。
    3. 消费方按 `parsed?.drawing` 取值，拿到 `undefined` 就**静默跳过**填充实体，
       既不报错也不提示 ⇒ 用户看到的是"导入成功但是空图纸"，属**假成功**。
    修向：要么内嵌解释器并把 stdout 收回、解析结果如实返回；要么删掉"回退 sidecar"
    这条宣传并把解析失败如实报错。**二者必居其一，不得维持现状。**
- **DWG**：需外部 **ODA File Converter** 转换为 DXF 后方可导入；本机未安装时提供
  三选一降级引导（另存 DXF 指引 / 作为图片底图 / 安装 ODA）。
- **产品内不宣传"DWG 转换"为默认可用能力**；界面文案统一"导出 DXF"
  （在 CAD 软件中打开 DXF 后可另存为 DWG）。DWG 直接回写明确不做。
- **DXF 导出的底图边界**：底图为图片/PDF 时，导出的 DXF 只含矢量标注层（`SS-*`），
  不含底图；导出前 UI 会明确告知，需在 CAD 中 XATTACH 原图叠加（AC-7.4）。
- `docx` 导出为类型预留、未实现，UI 标注"即将上线"。

## 待收敛事项

- **双份 Python sidecar**：`apps/desktop/resources/python/` 与仓库根 `resources/python/`
  为历史遗留的两份重复副本（dev 走前者、打包 `extraResources` 走后者）。
  本次重构**未动这两份代码**，待后续单独收敛，避免误伤构建。
- 路由重复别名（13 个大写 name）全部保留 —— 均有现存引用；仅加 `meta.hidden` 停菜单入口。
