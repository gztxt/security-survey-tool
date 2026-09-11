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

## `.survey` 数据格式与向后兼容

- 项目文件扩展名统一为 `.survey`（JSON，主进程 `project:save` 写盘）。
- **向后兼容承诺**：本次收敛重构不新增必填字段、不改变已有字段语义；
  旧 `.survey`（含历史 `.ssproj` 文件，经"所有文件"过滤器）可原样打开。
- 位图底图以 `entities` 中 `type:'IMAGE'` 合成实体承载，且 **base64 不落入 `.survey`**
  （走 userData/cache 引用 + `file.path` 重链接），避免工程文件体积暴涨。
- `knownPath`（当前项目文件路径）只存在于渲染进程 store 状态，绝不写入 payload。

## DWG / DXF 能力边界（诚实声明）

- **DXF**：导入解析（dxf-parser，失败回退 Python sidecar）与导出（R12 ASCII overlay，
  图层统一 `SS-` 前缀，仅矢量标注层）均已实现。
- **DWG**：需外部 **ODA File Converter** 转换为 DXF 后方可导入；本机未安装时提供
  三选一降级引导（另存 DXF 指引 / 作为图片底图 / 安装 ODA）。
- **产品内不宣传"DWG 转换"为默认可用能力**；界面文案统一"导出 DXF"
  （在 CAD 软件中打开 DXF 后可另存为 DWG）。DWG 直接回写明确不做。
- `docx` 导出为类型预留、未实现，UI 标注"即将上线"。

## 待收敛事项

- **双份 Python sidecar**：`apps/desktop/resources/python/` 与仓库根 `resources/python/`
  为历史遗留的两份重复副本（dev 走前者、打包 `extraResources` 走后者）。
  本次重构**未动这两份代码**，待后续单独收敛，避免误伤构建。
- 路由重复别名（13 个大写 name）全部保留 —— 均有现存引用；仅加 `meta.hidden` 停菜单入口。
