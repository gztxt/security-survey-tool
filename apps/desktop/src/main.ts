// Electron 主进程入口
//
// 第一个 import 必须是 polyfill：ESM 的 import 声明会被提升到模块顶部，写在同一个文件
// import 之前的 polyfill 语句实际会在所有被导入模块之后才执行。放进独立模块并首个引入，
// 才能保证它先于 workspace 包（cad-parser → dxf-parser 等 UMD 依赖）求值。
import './main-polyfill';

// electron 本身是 CommonJS 模块。在 ESM 里使用具名导入依赖 cjs-module-lexer 的静态
// 分析，它只能识别部分导出（实测 shell 就识别不到，会抛
// "SyntaxError: Named export 'shell' not found"），因此改用默认导入后解构，最稳妥。
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = electron;
import { join, resolve, sep, parse, dirname, basename } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, statSync } from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

// 工作区包：设备库 / CAD 解析器（主进程可用）
import { DeviceLibrary, BUILTIN_DEVICES } from '@security-survey/device-lib';
import type { DeviceModel, ExportInclude, Project } from '@security-survey/shared-types';
import { cadParser } from '@security-survey/cad-parser';
// 导出引擎只在 export:dxf 时按需 dynamic import：它会连带加载 pdfkit/xlsx/pdf-lib 等
// 重型 CJS 依赖，静态引入会拖慢主进程启动（甚至复现"双击无反应"类故障）。
import type { Exporter as ExporterType } from '@security-survey/exporter';

// 主进程产物是 ESM（Electron 28 原生支持），没有 CommonJS 的 __dirname。
// 直接用 __dirname 会得到 undefined，导致 path.join(__dirname, ...) 抛 TypeError，
// 因此这里从 import.meta.url 推导当前目录。
const __dirname = dirname(fileURLToPath(import.meta.url));

// ============ 环境判断 ============

const isDev = !app.isPackaged;
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// ============ 路径工具 ============

function getResourcePath(...paths: string[]): string {
  const base = isDev ? resolve(__dirname, '..') : process.resourcesPath;
  return resolve(base, ...paths);
}

function getUserDataPath(...paths: string[]): string {
  return resolve(app.getPath('userData'), ...paths);
}

// 仅允许访问用户数据目录下的白名单子目录，防止 fs IPC 任意路径读写
// 另允许通过原生对话框明确选择过的路径（dialogApprovedPaths）
//
// 这个集合必须落盘：历史缺陷是它只存在内存里 ⇒ 用户把项目保存到"文档"目录后，
// 下次启动应用时 fs.readFile 会以"拒绝访问允许目录之外的路径"失败，
// 表现为"项目明明在列表里，点开却说文件读不到"（实测：AppImage 重启后无法重开自己的项目）。
// 只有用户在对话框里主动选过的路径才进这个清单，语义等同于"用户授权过这些文件"。
const DIALOG_APPROVED_FILE = 'approved-paths.json';
const APPROVED_PATHS_LIMIT = 200;

function loadApprovedPaths(): Set<string> {
  try {
    const file = getUserDataPath(DIALOG_APPROVED_FILE);
    if (!existsSync(file)) return new Set<string>();
    const list = JSON.parse(readFileSync(file, 'utf8'));
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

const dialogApprovedPaths = loadApprovedPaths();

function rememberApprovedPath(filePath: string): void {
  const resolved = resolve(filePath);
  if (dialogApprovedPaths.has(resolved)) return;
  dialogApprovedPaths.add(resolved);
  try {
    // 有界清单：防止长期使用后无限膨胀
    const list = [...dialogApprovedPaths].slice(-APPROVED_PATHS_LIMIT);
    dialogApprovedPaths.clear();
    for (const x of list) dialogApprovedPaths.add(x);
    writeFileSync(getUserDataPath(DIALOG_APPROVED_FILE), JSON.stringify(list), 'utf8');
  } catch {
    /* 写不下不影响本次会话内的授权生效 */
  }
}

// 安全白名单：允许读取的 CAD 文件扩展名
const ALLOWED_CAD_EXTENSIONS = new Set(['.dxf', '.dwg', '.pdf', '.png', '.jpg', '.jpeg', '.svg']);

// 安全的 spawn 执行：限制命令为内置路径，禁用 shell 模式
function safeSpawn(command: string, args: string[]): Promise<{ success: boolean; error?: string }> {
  // 白名单命令路径
  const allowedCommands = new Set([
    getPythonPath(),
    getOdaConverterPath(),
  ]);
  if (!allowedCommands.has(command)) {
    return Promise.resolve({ success: false, error: `禁止执行的命令: ${command}` });
  }
  // 参数白名单：只允许文件路径和固定选项
  const safeArgs = args.filter(a => !a.includes(';') && !a.includes('&') && !a.includes('|'));
  return new Promise((resolve) => {
    const proc = spawn(command, safeArgs, { stdio: 'pipe', shell: false });
    proc.on('error', (err) => resolve({ success: false, error: err.message }));
    proc.on('close', (code) => resolve({ success: code === 0 }));
  });
}

function assertAllowedPath(p: string): string {
  const resolved = resolve(p);
  // 安全检查：阻止路径穿越
  if (resolved.includes('..')) {
    throw new Error('路径包含非法字符: ' + resolved);
  }
  const roots = ['projects', 'templates', 'exports', 'cache', 'logs'].map(d => getUserDataPath(d));
  if (roots.some(root => resolved === root || resolved.startsWith(root + sep))) {
    return resolved;
  }
  if (dialogApprovedPaths.has(resolved)) {
    return resolved;
  }
  throw new Error('拒绝访问允许目录之外的路径: ' + resolved);
}

function getPythonPath(): string {
  if (isWin) {
    return getResourcePath('python', 'python.exe');
  }
  return getResourcePath('python', 'bin', 'python3');
}

function getOdaConverterPath(): string {
  // 优先环境变量指定的路径（支持自定义安装位置）
  if (process.env.ODA_PATH) {
    return resolve(process.env.ODA_PATH);
  }
  // 常见系统安装位置
  const systemPaths = isWin
    ? [
        'C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
        'C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
      ]
    : isMac
      ? ['/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter']
      : [
          '/usr/local/bin/ODAFileConverter',
          '/opt/ODA/ODAFileConverter/ODAFileConverter',
          '/opt/ODA/ODAFileConverter',
        ];
  for (const p of systemPaths) {
    if (existsSync(p)) return p;
  }
  // 回退到应用资源目录
  if (isWin) {
    return getResourcePath('oda', 'ODAFileConverter.exe');
  }
  return getResourcePath('oda', 'ODAFileConverter');
}

// ============ 窗口管理 ============

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let splashWindow: InstanceType<typeof BrowserWindow> | null = null;

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    webPreferences: {
      // 启动画面为纯静态页，无需 Node 能力；关闭 nodeIntegration 以降低攻击面
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    splashWindow.loadURL('http://localhost:5173/splash.html');
  } else {
    splashWindow.loadFile(join(__dirname, '../../dist/splash.html'));
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // 开发模式同样保持 webSecurity 开启；
      // Vite dev server 同源加载不需要关闭 web 安全
    },
  });

  // 加载页面
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }

  // 窗口就绪后显示，关闭启动画面
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    splashWindow?.close();
    splashWindow = null;
  });

  // 超时强制显示窗口（防止渲染进程崩溃导致窗口永远隐藏）
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.warn('[Main] 渲染进程加载超时，强制显示窗口');
      mainWindow.show();
      splashWindow?.close();
      splashWindow = null;
    }
  }, 5000);

  mainWindow.on('closed', () => {
    clearTimeout(showTimeout);
    mainWindow = null;
  });

  // 渲染进程崩溃处理
  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[Main] 渲染进程崩溃:', details);
  });

  // 页面加载错误处理
  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('[Main] 页面加载失败:', errorCode, errorDescription);
  });

  // 外部链接在浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ============ 应用生命周期 ============

// 以下两件事必须在 app ready **之前**完成：
// 1) 单实例锁：ready 之后才申请会错过第二实例的启动参数传递；
// 2) registerSchemesAsPrivileged：ready 之后调用会直接抛
//    "protocol.registerSchemesAsPrivileged should be called before app is ready"，
//    该异常发生在 whenReady 的 async 回调里，会变成 unhandled rejection，
//    导致后面的 createMainWindow() 一行都执行不到 —— 表现就是「双击无反应」。
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([{ scheme: 'survey', privileges: { secure: true, standard: true } }]);

// GPU 进程不可用时的降级：某些显卡驱动 / 虚拟机 / 远程桌面 / Electron 28 在
// `--disable-gpu` 命令行参数被忽略的环境下，GPU 进程会连续崩溃，Chromium
// 若干次后直接 FATAL 退出整个应用（同样是「双击无反应」的表象）。
// 策略：
//   1. 启动时若检测到上次留下的降级标记（或本次命令行已带标记），在 ready 之前
//      调用 app.disableHardwareAcceleration()，直接不启动 GPU 进程，绕开 FATAL。
//   2. 运行期 child-process-gone 监听到 GPU 崩溃时，写下持久化标记并以
//      --gpu-disabled-by-fallback 重启，下次启动就能在 ready 之前禁用硬件加速。
//   3. 写标记失败（如只读文件系统）也不影响降级流程本身，只是下次启动会重试。
function resolveUserDataDir(): string {
  // app.getPath('userData') 在 ready 前某些 Electron 版本会抛；fallback 用 APPDATA + app.getName()
  try { return app.getPath('userData'); } catch { /* fall through */ }
  const appData = process.env.APPDATA || '';
  let name = '';
  try { name = app.getName(); } catch { name = '@security-survey/desktop'; }
  return join(appData, name);
}

const GPU_FALLBACK_FLAG = '--gpu-disabled-by-fallback';
const gpuFallbackMarkerPath = join(resolveUserDataDir(), '.gpu-fallback');

const gpuFallbackAlreadyOn =
  process.argv.includes(GPU_FALLBACK_FLAG) || existsSync(gpuFallbackMarkerPath);

if (gpuFallbackAlreadyOn) {
  // ready 之前调用才有效
  app.disableHardwareAcceleration();
  console.warn('[main] 已启用 GPU 降级（disableHardwareAcceleration）');
}

app.on('child-process-gone', (_event, details) => {
  // Electron 28 推荐用 child-process-gone 取代已废弃的 gpu-process-crashed
  if (details.type !== 'GPU' || details.reason !== 'crashed') return;
  if (gpuFallbackAlreadyOn) return;
  try { writeFileSync(gpuFallbackMarkerPath, '1'); } catch { /* 标记写不下也走命令行回退 */ }
  console.warn('[main] GPU 进程崩溃，正在以禁用硬件加速的方式重启…');
  app.relaunch({ args: process.argv.slice(1).concat([GPU_FALLBACK_FLAG]) });
  app.exit(0);
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  createSplashWindow();

  // 预加载资源
  await preloadResources();

  createMainWindow();

  // 注册 IPC 处理器
  registerIpcHandlers();

  // macOS dock 点击重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch((err) => {
  // 启动链上任何未捕获异常都在这里兜底：弹出可见的错误提示，而不是让进程静默退出，
  // 否则用户看到的只会是「双击没反应」。
  const detail = err instanceof Error ? (err.stack || err.message) : String(err);
  console.error('[main] 启动失败:', detail);
  try {
    dialog.showErrorBox(
      '安防勘点设计工具启动失败',
      detail.length > 1500 ? detail.slice(0, 1500) + '\n…（已截断）' : detail
    );
  } catch {
    // 对话框本身不可用时（如无图形环境）忽略，日志已输出
  }
  app.quit();
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

// ============ 资源预加载 ============

async function preloadResources(): Promise<void> {
  // 检查 Python sidecar
  const pythonPath = getPythonPath();
  if (!existsSync(pythonPath)) {
    console.warn('Python sidecar not found at:', pythonPath);
    // 可选：下载/解压内嵌 Python
  }

  // 检查 ODA Converter
  const odaPath = getOdaConverterPath();
  if (!existsSync(odaPath)) {
    console.warn('ODA File Converter not found at:', odaPath);
  }

  // 确保用户数据目录存在
  const dirs = ['projects', 'templates', 'exports', 'cache', 'logs'];
  for (const dir of dirs) {
    const p = getUserDataPath(dir);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
}

// ============ IPC 处理器注册 ============

function registerIpcHandlers(): void {
  // --- 项目管理 ---
  ipcMain.handle('project:new', async (_, name: string) => {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('项目名称必须是非空字符串');
    }
    const project = await createNewProject(name);
    return project;
  });

  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '打开项目',
      // 追加"所有文件"便于打开历史遗留的 .ssproj / .json 项目文件（向后兼容）
      filters: [
        { name: '安防勘点项目', extensions: ['survey'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return await openProject(result.filePaths[0]);
  });

  ipcMain.handle('project:save', async (_, projectData: any, filePath?: string) => {
    // filePath 为空时主进程弹保存对话框（见决策 4：保存链由主进程统一负责）
    if (typeof filePath !== 'string' || filePath.length === 0) filePath = undefined;
    return await saveProject(projectData, filePath);
  });

  ipcMain.handle('project:saveAs', async (_, projectData: any) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '另存为项目',
      filters: [{ name: '安防勘点项目', extensions: ['survey'] }],
      defaultPath: `${projectData.name}.survey`,
    });
    if (result.canceled || !result.filePath) return null;
    return await saveProject(projectData, result.filePath);
  });

  ipcMain.handle('project:recent', async () => {
    return getRecentProjects();
  });

  // --- 图纸管理 ---
  ipcMain.handle('drawing:import', async (_, filePaths: string[]) => {
    return await importDrawings(filePaths);
  });

  ipcMain.handle('drawing:calibrate', async (_, drawingId: string, calibration: any) => {
    return await calibrateDrawing(drawingId, calibration);
  });

  // --- CAD 解析（Python sidecar） ---
  ipcMain.handle('cad:parse', async (_, filePath: string) => {
    return await parseCadFile(filePath);
  });

  ipcMain.handle('cad:convertDwg', async (_, dwgPath: string) => {
    return await convertDwgToDxf(dwgPath);
  });

  // --- 导出（委托给渲染进程，主进程仅负责文件保存） ---
  ipcMain.handle('export:pointMap', async (_, options: any) => {
    return await delegateExportToRenderer('export:pointMap', options);
  });

  ipcMain.handle('export:fovMap', async (_, options: any) => {
    return await delegateExportToRenderer('export:fovMap', options);
  });

  ipcMain.handle('export:topology', async (_, options: any) => {
    return await delegateExportToRenderer('export:topology', options);
  });

  ipcMain.handle('export:deviceList', async (_, options: any) => {
    return await delegateExportToRenderer('export:deviceList', options);
  });

  ipcMain.handle('export:cableSchedule', async (_, options: any) => {
    return await delegateExportToRenderer('export:cableSchedule', options);
  });

  ipcMain.handle('export:report', async (_, options: any) => {
    return await delegateExportToRenderer('export:report', options);
  });

  /**
   * DXF overlay 导出（架构决策 2）：纯文本、不需要 canvas，
   * 故**不走** delegateExportToRenderer（那条 120s 往返握手），直接在主进程
   * new Exporter(project, models).exportDxfOverlay()，再复用 export:saveFile 的写盘逻辑。
   * 少一层异步握手 = 少一类时序 bug。
   */
  ipcMain.handle('export:dxf', async (_, options: any) => {
    const project: Project | null = options?.project || null;
    if (!project) return { success: false, files: [], errors: ['DXF 导出缺少项目数据'] };
    try {
      const { Exporter: ExporterCtor } = await import('@security-survey/exporter');
      const exporter: ExporterType = new ExporterCtor(project, getDeviceLibraryInstance().getAll());
      const file = await exporter.exportDxfOverlay({
        drawingIds: Array.isArray(options.drawingIds) && options.drawingIds.length
          ? options.drawingIds
          : (project.drawings || []).map(d => d.id),
        dxfLayers: options.dxfLayers || undefined,
        project,
      });
      if (!file) return { success: false, files: [], errors: ['没有可导出的图纸'] };
      const files = [file];
      // 未指定落盘路径时直接弹保存框（与 export:saveFile 同一交互）
      if (options?.autoSave !== false) {
        const saved = await saveExportFile(file.path, file.dataBase64 || '');
        if (!saved.success) {
          return { success: false, files, errors: [saved.error || '保存被取消'] };
        }
        return { success: true, files: [{ ...file, path: saved.path }], errors: [], canceled: !!saved.canceled };
      }
      return { success: true, files, errors: [] };
    } catch (e) {
      return { success: false, files: [], errors: [e instanceof Error ? e.message : String(e)] };
    }
  });

  // --- 设备库 ---
  ipcMain.handle('device:getLibrary', async () => {
    return getDeviceLibrary();
  });

  ipcMain.handle('device:addCustom', async (_, device: any) => {
    return addCustomDevice(device);
  });

  ipcMain.handle('device:importLibrary', async (_, json: string) => {
    return importDeviceLibrary(json);
  });

  ipcMain.handle('device:exportLibrary', async () => {
    return exportDeviceLibrary();
  });

  // --- 设置 ---
  ipcMain.handle('settings:get', async () => {
    return getSettings();
  });

  ipcMain.handle('settings:set', async (_, key: string, value: any) => {
    return setSetting(key, value);
  });

  // --- 窗口控制 ---
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // --- 文件系统 ---
  ipcMain.handle('fs:readFile', async (_, path: string) => {
    try {
      return readFileSync(assertAllowedPath(path), 'utf8');
    } catch {
      return null;
    }
  });

  // 读取二进制文件（位图底图 / PDF 栅格化用），返回 base64，不经渲染进程 fs 权限
  ipcMain.handle('fs:readFileBase64', async (_, path: string) => {
    try {
      return readFileSync(assertAllowedPath(path)).toString('base64');
    } catch {
      return null;
    }
  });

  // 为拖拽 / 手动输入来源的文件路径申请一次性读取授权（决策 3）
  // 只接受白名单扩展名，且文件必须真实存在；不放宽目录级权限。
  ipcMain.handle('fs:grantPaths', async (_, paths: any) => {
    const granted: string[] = [];
    const rejected: Array<{ path: string; reason: string }> = [];
    const list = Array.isArray(paths) ? paths.filter(p => typeof p === 'string') : [];
    if (!Array.isArray(paths)) {
      return { granted, rejected: [{ path: String(paths), reason: '参数必须是路径数组' }] };
    }
    for (const p of list) {
      try {
        const resolved = resolve(p);
        const ext = parse(resolved).ext.toLowerCase();
        if (!ALLOWED_CAD_EXTENSIONS.has(ext)) {
          rejected.push({ path: p, reason: `不支持的文件类型: ${ext || '(无扩展名)'}` });
          continue;
        }
        if (!existsSync(resolved)) {
          rejected.push({ path: p, reason: '文件不存在' });
          continue;
        }
        rememberApprovedPath(resolved);
        granted.push(resolved);
      } catch (e) {
        rejected.push({ path: String(p), reason: e instanceof Error ? e.message : String(e) });
      }
    }
    return { granted, rejected };
  });

  ipcMain.handle('fs:writeFile', async (_, path: string, content: string, encoding?: 'utf8' | 'base64') => {
    try {
      writeFileSync(assertAllowedPath(path), content, encoding === 'base64' ? 'base64' : 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('fs:showOpenDialog', async (_, options: any) => {
    const result = await dialog.showOpenDialog(mainWindow!, options);
    if (!result.canceled) {
      for (const fp of result.filePaths) rememberApprovedPath(fp);
    }
    return result;
  });

  ipcMain.handle('fs:showSaveDialog', async (_, options: any) => {
    const result = await dialog.showSaveDialog(mainWindow!, options);
    if (!result.canceled && result.filePath) {
      rememberApprovedPath(result.filePath);
    }
    return result;
  });

  // --- 外部链接 ---
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      const parsed = new URL(url);
      // 协议白名单
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
        return new Error('仅允许打开 http/https/mailto 链接');
      }
      // 域名白名单（允许内网域名和已备案域名）
      const allowedDomains = new Set(['localhost', '127.0.0.1']);
      if (!allowedDomains.has(parsed.hostname) && !/^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]+)*$/.test(parsed.hostname)) {
        return new Error('不允许访问该域名');
      }
      return shell.openExternal(url);
    } catch (e) {
      return new Error('无效的 URL: ' + String(e));
    }
  });

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    const resolved = resolve(path);
    const exportsRoot = getUserDataPath('exports');
    if (resolved !== exportsRoot && !resolved.startsWith(exportsRoot + sep)) {
      return new Error('仅允许打开 exports 目录内的路径');
    }
    return shell.openPath(resolved);
  });
}

// ============ 业务逻辑实现（存根，实际应在渲染进程或单独 Service 中） ============

async function createNewProject(name: string) {
  const project = {
    id: randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    drawings: [],
    settings: {
      defaultScale: 100,
      unit: 'm',
      gridSize: 1000,
      snapEnabled: true,
      autoSaveInterval: 30000,
    },
  };
  return project;
}

async function openProject(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const project = JSON.parse(content);
    if (typeof project !== 'object' || project === null || !('id' in project) || !('name' in project)) {
      throw new Error('项目文件格式无效');
    }
    addRecentProject(filePath);
    return project;
  } catch (e) {
    throw new Error(`打开项目失败: ${e}`);
  }
}

async function saveProject(projectData: any, filePath?: string) {
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存项目',
      filters: [{ name: '安防勘点项目', extensions: ['survey'] }],
      defaultPath: `${projectData.name}.survey`,
    });
    if (result.canceled || !result.filePath) return false;
    filePath = result.filePath;
  }

  try {
    projectData.updatedAt = Date.now();
    writeFileSync(filePath, JSON.stringify(projectData, null, 2), 'utf8');
    addRecentProject(filePath);
    // 保存成功后把该路径记入授权清单：否则下次启动读取自己的项目文件会被
    // assertAllowedPath 拒（"项目在读完之前就打不开"）。显式路径来自渲染进程
    // 已知的落盘路径（源自对话框/授权），记入清单不扩大授权面。
    rememberApprovedPath(filePath);
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function getRecentProjects(): string[] {
  const file = getUserDataPath('recent-projects.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function addRecentProject(path: string): void {
  const file = getUserDataPath('recent-projects.json');
  let list = getRecentProjects();
  list = [path, ...list.filter(p => p !== path)].slice(0, 10);
  writeFileSync(file, JSON.stringify(list), 'utf8');
}

async function importDrawings(filePaths: string[]) {
  const results = [];
  for (const rawPath of filePaths) {
    let filePath: string;
    try {
      // 只接受对话框/授权过的路径（拖拽需先经 fs:grantPaths）
      filePath = assertReadableCadPath(rawPath);
    } catch (err) {
      console.warn('拒绝导入未授权路径:', err instanceof Error ? err.message : err);
      continue;
    }
    const extRaw = parse(filePath).ext.toLowerCase().replace(/^\./, '');
    // .survey 兼容性：DrawingFile.format 联合类型无 'jpeg'，统一归一为 'jpg'
    const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
    let size = 0;
    try {
      size = statSync(filePath).size;
    } catch {
      size = 0;
    }
    const drawing: any = {
      id: randomUUID(),
      name: basename(filePath, parse(filePath).ext),
      floor: '',
      order: 0,
      file: {
        originalName: basename(filePath),
        format: ext as any,
        size,
        path: filePath,
      },
      calibration: { isCalibrated: false, point1: { x: 0, y: 0 }, point2: { x: 0, y: 0 }, realDistance: 0, scale: 1, unit: 'm' },
      layers: [],
      entities: [],
      viewport: { transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, center: { x: 0, y: 0 }, zoom: 1, showGrid: true, showRuler: true },
      devices: [],
      wiring: { id: '', drawingId: '', weakPoints: [], trays: [], cables: [], topology: [] },
    };

    // CAD 格式尝试真实解析，失败不阻断导入（保留空图纸记录）
    if (ext === 'dxf' || ext === 'dwg') {
      try {
        const parsed: any = await parseCadFile(filePath);
        if (parsed?.drawing) {
          drawing.entities = parsed.drawing.entities || [];
          drawing.layers = parsed.drawing.layers || [];
          if (parsed.drawing.viewport) drawing.viewport = parsed.drawing.viewport;
        }
      } catch (err) {
        console.warn('CAD 解析失败，导入为空图纸:', err instanceof Error ? err.message : err);
      }
    }
    // 位图/PDF：不在此处解析，交由渲染进程底图链（T5）按 path 加载引用，
    // 二进制内容绝不写进 .survey。

    results.push(drawing);
  }
  return results;
}

async function calibrateDrawing(drawingId: string, calibration: any) {
  return { success: true, scale: calibration.scale };
}

// 校验 CAD 文件路径：仅允许用户数据目录或通过原生对话框选择过的路径
function assertReadableCadPath(p: string): string {
  const resolved = resolve(p);
  if (!existsSync(resolved)) {
    throw new Error('文件不存在: ' + resolved);
  }
  try {
    return assertAllowedPath(resolved);
  } catch {
    throw new Error('拒绝解析允许目录之外且未经对话框选择的文件: ' + resolved);
  }
}

async function parseCadFile(filePath: string) {
  const safePath = assertReadableCadPath(filePath);
  const ext = parse(safePath).ext.toLowerCase();

  // 首选 TypeScript 解析器（@security-survey/cad-parser，内置 DXF 解析与 DWG 转换）
  try {
    const { drawing, stats } = await cadParser.parse({
      filePath: safePath,
      fileType: ext === '.dwg' ? 'dwg' : 'dxf',
    });
    return { success: true, drawing, stats };
  } catch (err) {
    const tsError = err instanceof Error ? err.message : String(err);
    // 回退：Python sidecar（如可用）
    try {
      return await parseCadFileViaPython(safePath);
    } catch {
      throw new Error(`CAD 解析失败: ${tsError}`);
    }
  }
}

async function parseCadFileViaPython(filePath: string) {
  // 调用 Python sidecar 解析
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const scriptPath = getResourcePath('python', 'parse_dxf.py');

    if (!existsSync(pythonPath) || !existsSync(scriptPath)) {
      reject(new Error('Python sidecar not found'));
      return;
    }

    // 参数白名单：脚本路径 + 单个文件路径，禁止 shell 元字符
    const safeFilePath = filePath.replace(/[;|&$`(){}]/g, '');
    if (!existsSync(safeFilePath)) {
      reject(new Error(`文件不存在: ${filePath}`));
      return;
    }

    safeSpawn(pythonPath, [scriptPath, safeFilePath])
      .then(result => {
        if (result.success) {
          resolve({ success: true, data: null });
        } else {
          reject(new Error(`Python 解析失败: ${result.error}`));
        }
      })
      .catch(err => reject(new Error(`Python 执行错误: ${err.message}`)));
  });
}

async function convertDwgToDxf(dwgPath: string) {
  return new Promise((resolve, reject) => {
    const odaPath = getOdaConverterPath();
    if (!existsSync(odaPath)) {
      reject(new Error('ODA File Converter 未找到：请安装，或通过环境变量 ODA_PATH 指定可执行文件路径'));
      return;
    }

    if (!existsSync(dwgPath)) {
      reject(new Error('DWG 文件不存在'));
      return;
    }
    if (parse(dwgPath).ext.toLowerCase() !== '.dwg') {
      reject(new Error('仅支持 .dwg 格式文件'));
      return;
    }

    // ODA File Converter CLI 为目录式参数：
    // <输入目录> <输出目录> <输出版本> <输出格式> <递归> <审计> <过滤文件>
    const { dir, name } = parse(dwgPath);
    const dxfPath = join(dir, `${name}.dxf`);
    const outDir = mkdtempSync(join(tmpdir(), 'oda-conv-'));
    // 参数白名单：固定格式参数 + 干净的目录名
    const safeArgs = [
      dir.replace(/[;|&$`(){}]/g, ''),
      outDir,
      'ACAD2018',
      'DXF',
      '0',
      '1',
      `${name.replace(/[;|&$`(){}]/g, '')}.dwg`,
    ];

    safeSpawn(odaPath, safeArgs)
      .then(result => {
        if (result.success) {
          const produced = join(outDir, `${name}.dxf`);
          if (existsSync(produced)) {
            copyFileSync(produced, dxfPath);
            resolve({ success: true, dxfPath });
          } else {
            reject(new Error('ODA 转换失败：未生成 DXF 文件'));
          }
        } else {
          reject(new Error(`ODA 转换失败: ${result.error}`));
        }
      })
      .catch(err => reject(new Error(`ODA 执行错误: ${err.message}`)));
  });
}

// ============ 导出引擎（接入 @security-survey/exporter）============

// ============ 导出委托给渲染进程 ============

function delegateExportToRenderer(channel: string, options: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      reject(new Error('主窗口未就绪'));
      return;
    }
    const requestId = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // 监听渲染进程返回结果
    function handleResponse(event: Electron.IpcMainInvokeEvent, response: any) {
      if (response.requestId !== requestId) return;
      ipcMain.removeListener('export:response', handleResponse);
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
      }
    }
    ipcMain.on('export:response', handleResponse);
    
    // 发送导出请求到渲染进程
    mainWindow.webContents.send('export:request', { requestId, channel, options });
    
    // 超时保护
    setTimeout(() => {
      ipcMain.removeListener('export:response', handleResponse);
      reject(new Error('导出超时（120s）'));
    }, 120000);
  });
}

// 渲染进程请求文件保存对话框
ipcMain.handle('export:saveFile', async (_, fileName: string, dataBase64: string) => {
  const res = await saveExportFile(fileName, dataBase64);
  if (res.canceled) return { success: false, canceled: true };
  return res.success ? { success: true, path: res.path } : { success: false, error: res.error };
});

/**
 * 弹出保存框并写盘（export:saveFile 与 export:dxf 共用）。
 * 返回体保留 canceled / error 细节，供上层区分"用户取消"与"真失败"。
 */
async function saveExportFile(
  fileName: string,
  dataBase64: string,
): Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }> {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '保存导出文件',
    defaultPath: fileName,
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    const buffer = Buffer.from(dataBase64, 'base64');
    writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ============ 设备库（接入 @security-survey/device-lib）============

const builtinIds = new Set(BUILTIN_DEVICES.map((d) => d.id));
let deviceLibraryInstance: DeviceLibrary | null = null;

function deviceLibraryFile(): string {
  return getUserDataPath('device-library.json');
}

function loadCustomDevices(): DeviceModel[] {
  try {
    if (!existsSync(deviceLibraryFile())) return [];
    const data = JSON.parse(readFileSync(deviceLibraryFile(), 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persistCustomDevices(lib: DeviceLibrary): void {
  const customs = lib.getAll().filter((d) => !builtinIds.has(d.id));
  mkdirSync(getUserDataPath(), { recursive: true });
  writeFileSync(deviceLibraryFile(), JSON.stringify(customs, null, 2), 'utf8');
}

function getDeviceLibraryInstance(): DeviceLibrary {
  if (!deviceLibraryInstance) {
    deviceLibraryInstance = new DeviceLibrary(loadCustomDevices());
  }
  return deviceLibraryInstance;
}

function getDeviceLibrary() {
  const lib = getDeviceLibraryInstance();
  return {
    devices: lib.getAll(),
    categories: lib.getCategories(),
    stats: lib.getStats(),
  };
}

function addCustomDevice(device: any) {
  if (!device || !device.id || !device.name || !device.category || !device.specs) {
    return { success: false, error: '设备字段不完整（需要 id/name/category/specs）' };
  }
  const lib = getDeviceLibraryInstance();
  lib.add(device);
  persistCustomDevices(lib);
  return { success: true };
}

function importDeviceLibrary(json: string) {
  const lib = getDeviceLibraryInstance();
  const result = lib.importFromJson(json);
  if (result.success > 0) persistCustomDevices(lib);
  return result;
}

function exportDeviceLibrary() {
  const lib = getDeviceLibraryInstance();
  return lib.exportToJson();
}

function getSettings() { return {}; }
function setSetting(key: string, value: any) { return true; }

// ============ 导出供测试使用 ============

export { app, mainWindow, getResourcePath, getUserDataPath, getPythonPath, getOdaConverterPath };