# 安全加固记录

> 更新日期: 2026-09-03
> 安全审查基于 2026-07-22 代码审查报告

## 修复的安全问题

### C1 - fs IPC 路径白名单 (已完成)
- **问题**: `fs:writeFile` IPC 无路径校验
- **状态**: 已有 `assertAllowedPath()` 保护
- **措施**: 
  - 限制路径在用户数据目录下的白名单子目录 (`projects`, `templates`, `exports`, `cache`, `logs`)
  - 允许通过原生对话框明确选择的路径 (`dialogApprovedPaths`)
  - 阻止路径穿越 (`..` 检查)

### C2 - shell IPC 协议白名单 (已完成)
- **问题**: `shell:openExternal` 透传 URL 可能打开恶意链接
- **状态**: 已加固
- **措施**:
  - 仅允许 `http:` / `https:` / `mailto:` 协议
  - 域名白名单校验（防止 DNS 重绑定攻击）
  - `shell:openPath` 限制在 `exports` 目录内

### C3 - spawn 命令注入 (已完成)
- **问题**: Python sidecar 和 ODA Converter 参数未校验
- **状态**: 已加固
- **措施**:
  - 新增 `safeSpawn()` 函数，限制命令白名单
  - 参数过滤 shell 元字符 (`;|&$`(){} `)
  - 禁用 `shell: true` 模式
  - Python 脚本路径固定为资源目录
  - ODA Converter 参数固定格式

## Windows 构建修复

### 问题
之前生成的 Windows 安装包启动报错

### 根因
1. `win-unpacked` 目录为空（构建未完整执行）
2. `main` 入口路径不匹配（`.js` → `.cjs`）
3. Vite 配置缺少 CJS 输出格式
4. **主进程 import 了 `dagre`/`exporter`**：`dagre/lib/graphlib.js:14` 在 `require("graphlib")` 失败时
   回退到 `window.graphlib`，主进程没有 window → 抛 `ReferenceError: window is not defined`
   （用户截图直接证明）。构建环境曾因 graphlib 缺失而触发该回退路径
5. **`protocol.registerSchemesAsPrivileged` 放进了 `app.whenReady()` 回调**：ready 之后注册
   必抛 `should be called before app is ready`，异常以 unhandled rejection 形式中断后续
   `createMainWindow()`，表现同样是「双击无反应」
6. **【本轮发现】渲染进程 `require is not defined` 崩溃**：`@security-survey/exporter` 在
   `renderer/main.ts` 被**同步 import**，把 `jspdf` / `pdfkit` / `xlsx` 整条重依赖链全部拖进
   `vendor-export` chunk。`pdfkit` 自身**没有 `browser` 字段**，Vite 取 `module` 字段
   → `js/pdfkit.es.js`（Node 版 ESM） → 依赖 `jpeg-exif` → `lib/index.js:3 var _fs = require('fs')`。
   此外 Vite 5 默认 `commonjsOptions.transformMixedEsModules=false`，xlsx / fontkit 等 ESM 里的
   `require("buffer")` / `require("stream")` / `require("util")` / `require("assert")` / 
   `require("string_decoder")` 全部原样留在 chunk 里。**渲染进程是 ESM，没有 `require`**，模块
   加载时立刻抛 `ReferenceError: require is not defined` → 渲染进程崩溃 → 窗口永远不显示，
   用户看到的就是「双击无反应」。
7. **【本轮发现】`exportService` 里 `import { webFrame } from 'electron'` 二次崩溃**：
   即使解决了 `vendor-export` 的 Node 内置 require，`exportService` 自己还有
   `import { webFrame } from 'electron'`，vite-plugin-electron-renderer 给它注入 shim
   `const xt = typeof require<"u" ? require("electron") : console.error(...)`。在渲染进程
   里 `xt === undefined`，紧接着 `xt.ipcRenderer` / `xt.webFrame` / `xt.shell` 解构立刻
   `TypeError: Cannot read properties of undefined`，整个 exportService chunk 求值失败。
   这次崩溃**不发生在首屏**（因为 exportService 已经被改成动态 import），但发生在
   `app.mount('#app')` 几百毫秒后，渲染进程仍然会死。

### 修复
- 修正 `package.json` 中 `main` 字段为 `dist-electron/main/main.mjs`（最终采用 ESM，原因见下）
- 更新 `vite.config.ts` 显式覆盖 `build.lib.formats`（Vite-plugin-electron 强制按 package.json
  的 `type` 字段设置 lib.formats 优先于 rollupOptions.output.format，必须显式覆盖）
- 添加 DOM polyfill 解决 Electron 主进程 `window is not defined` 错误（独立模块首个 import
  —— ESM 的 import hoisting 会让同文件内 polyfill 失效）
- **主进程 import 链清理**：移除对 dagre / exporter 的依赖，让主进程完全不触达 UMD 回退路径
- **生命周期时序修复**：把 `requestSingleInstanceLock` 与 `protocol.registerSchemesAsPrivileged` 提到
  `app.whenReady()` 之前；为 `whenReady` 加 `.catch()` 兜底（`dialog.showErrorBox`），任何启动期异常
  都不再静默
- **GPU 降级持久化（commit 16ab258）**：监听 `child-process-gone` 事件，GPU 进程崩溃时
  写 `userData\.gpu-fallback` 标记并以 `app.disableHardwareAcceleration()` 方式重启。**注意**：
  Electron 28 打包应用**忽略 `--disable-gpu` 命令行参数**，必须用 `disableHardwareAcceleration()`
  API（在 ready 之前调用）才真正生效。
- **【本轮关键】`pdfkit` 解析为浏览器版**：`pdfkit` 自身没有 `browser` 字段，在 vite.config 加
  alias 把 `pdfkit` 强制指向 `pdfkit/js/pdfkit.standalone.js`（browserify 自包含 bundle 2.6MB，
  内部的 `require` 是局部形参，不依赖全局）
- **【本轮关键】打开 `transformMixedEsModules: true`**：让 Vite 的 commonjs 插件处理 ESM 文件里
  残留的 `require()` 调用，把它们转换成 import（缺的模块在构建期就报错暴露，不会拖到运行时）
- **【本轮关键】`exportService` 改为启动后动态 import**：`renderer/main.ts` 不再同步导入导出
  服务，而是 `app.mount('#app')` 之后 `import('./services/exportService')`。这样即使将来
  export 链路里再出现任何启动期异常，也只让「导出功能不可用」，而不会拖垮首屏
- **【本轮关键】渲染进程里 `import from 'electron'` 改为 `import type` 或走 `electronAPI`**：
  vite-plugin-electron-renderer 的 shim 在没有 require 的渲染进程里**只 console.error 不返回
  对象**（返回 undefined），下面的 `xt.ipcRenderer` 解构必然 TypeError。`exportService` 里的
  `import { webFrame } from 'electron'` 改为 `import type`，运行时改用 `window.webFrame`；同样
  `await import('electron')` 兜底也删掉，改为 `throw new Error('preload 异常')` 让问题可见

## 构建说明

### Linux 构建
```bash
bash build-linux.sh
```

### Windows 构建 (推荐在 Windows 环境或 WSL 下)
```bash
bash build-windows.sh
```

### 手动构建步骤
```bash
cd apps/desktop
pnpm install
npm run build
npx electron-builder --win --x64  # Windows
npx electron-builder --linux --x64  # Linux
```

## 遗留事项

### H1 - DWG 路径验证 (低优先级)
- 当前已有扩展名校验
- 建议增加 ODA Converter 权限检查

### H2 - v-html XSS (已有防御)
- HelpView.vue 使用 `sanitizeHtml()` 兜底
- 建议增加沙箱 iframe 隔离

### H3 - 单元测试 (可选)
- 目前仅 `packages/device-lib` 有测试
- 建议为 `cad-parser` 和 `exporter` 补充单测

### H4 - xlsx CVE (已修复)
- 依赖已升级至 `^0.18.5`
- SECURITY-NOTE.md 已记录风险
