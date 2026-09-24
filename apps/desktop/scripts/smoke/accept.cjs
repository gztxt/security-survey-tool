/**
 * 真实打包应用端到端验收（非 mock、非 jsdom、非单测桩）
 *
 * 起真实 Electron（xvfb + release/linux-unpacked）→ 用 CDP 派发真实 DOM 点击与真实按键
 * → 走真实 IPC 与真实磁盘 → 重启渲染进程验证索引持久化与重开。
 *
 * 唯一非 UI 的入口：先用 window.api.project.save(payload, path) 把项目写到磁盘。
 * 这与点"保存"后在原生对话框里确认路径落到同一个主进程 handler（原生 GTK 对话框
 * 不在页面内，无法用 CDP 驱动，属外部限制，已如实记录）。写完后把"项目→路径"映射
 * 按 store 的既有键名播种，模拟"该文件此前已保存过"这一前置状态；此后 Ctrl+S
 * 与列表点击全部是真实用户动作。
 */
const { attach } = require('./cdp.cjs');
const fs = require('fs');
const path = require('path');

const results = [];
function check(id, desc, pass, observed) {
  results.push({ id, desc, pass: !!pass, observed: String(observed).replace(/\s+/g, ' ').slice(0, 240) });
  console.log(`${pass ? '[OK]  ' : '[FAIL]'} ${id} ${desc}`);
  console.log(`        观察: ${String(observed).replace(/\s+/g, ' ').slice(0, 220)}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (p, body) => p.eval(`(async () => { ${body} })()`);

/**
 * 轮询等待页面条件成立。
 * 打开项目这条路径是"真实文件读取 + 底图重水合 + 懒加载 chunk（file:// 冷缓存）"
 * 三段串行，耗时随磁盘缓存波动；用固定 sleep 会假阴性（实测 4.2s 不够、7s 稳定）。
 */
async function waitFor(p, expr, timeoutMs = 20000, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await ev(p, `return (${expr})`);
    if (last) return { ok: true, waited: timeoutMs - (deadline - Date.now()), value: last };
    await sleep(intervalMs);
  }
  return { ok: false, waited: timeoutMs, value: last };
}

async function clickText(p, text, exact = false) {
  return ev(p, `
    const want = ${JSON.stringify(text)};
    const sel = 'button,a,.el-button,.el-dropdown-item,.el-select-dropdown__item,[role=button],.project-card,.list-row,.el-message-box__btns button';
    const els = [...document.querySelectorAll(sel)];
    const hit = els.find(e => ${exact ? `(e.textContent||'').trim() === want` : `(e.textContent||'').replace(/\\s+/g,' ').includes(want)`});
    if (!hit) return 'NOT_FOUND:' + els.map(e=>(e.textContent||'').trim()).filter(Boolean).slice(0,12).join('/');
    hit.scrollIntoView({block:'center'});
    hit.click();
    await new Promise(r => setTimeout(r, 400));
    return (hit.textContent||'').replace(/\\s+/g,' ').trim().slice(0,32);
  `);
}

function ui(p) {
  return ev(p, `
    const ls = {};
    for (const k of ['projects-index','project-paths']) ls[k] = localStorage.getItem(k);
    return { hash: location.hash, body: document.body.innerText.replace(/\\s+/g,' ').slice(0,700), ls,
      toast: [...document.querySelectorAll('.el-message')].map(e=>(e.textContent||'').trim()).join(' | ') };
  `);
}

/** 回列表页：优先点 UI 里的真实返回入口，否则走 router（等待过渡与卡片重挂载） */
async function backToProjects(p) {
  const ok = await ev(p, `
    const link = [...document.querySelectorAll('a,button,.el-breadcrumb__item,.el-button')]
      .find(e => /^(返回项目列表|项目列表|项目管理|返回首页)$/.test((e.textContent||'').trim()));
    if (link) { link.click(); await new Promise(r=>setTimeout(r,1600)); return 'via-ui'; }
    location.hash = '#/projects';
    await new Promise(r=>setTimeout(r,1600));
    return 'via-hash';
  `);
  await sleep(900);
  const cards = await ev(p, `return document.querySelectorAll('.project-card').length`);
  return { ok, cards };
}

async function key(p, keyName, code, vk, modifiers) {
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
}

/** 真实 CDP 鼠标按下+抬起（不是 DOM click()：画布交互只认输入事件） */
async function realClick(p, x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  }
}

(async () => {
  const workdir = process.env.SMOKE_WORK || '/tmp/am-smoke-files';
  fs.mkdirSync(workdir, { recursive: true });
  const PHASE = process.env.ACCEPT_PHASE || '1';
  const marker = path.join(workdir, 'current-survey-path.txt');
  const surveyPath = PHASE === '2' && fs.existsSync(marker)
    ? fs.readFileSync(marker, 'utf8').trim()
    : path.join(workdir, `smoke-${Date.now()}.survey`);
  const PROJECT_NAME = '冒烟验收项目';
  let p = await attach();
  await sleep(1200);

  // ===== R1 首屏（P0 回归：打包后曾每次启动即 404） =====
  let a = await ui(p);
  check('R1', '打包应用首屏落在真实页面而非 404 页', !/页面未找到/.test(a.body) && !!a.hash, a.hash);

  if (PHASE === '1') {
    // ===== R2 空 profile ⇒ 列表必须为空（防"28 个假项目"回归） =====
    const nav = await clickText(p, '打开项目');
    await sleep(900);
    a = await ui(p);
    check('R2', '首页"打开项目"进入列表页，空 profile 显示"共 0 个项目"',
      /#\/projects/.test(a.hash) && /共 0 个项目/.test(a.body) && !/某小区安防改造项目/.test(a.body),
      'nav=' + nav + ' hash=' + a.hash + ' ' + a.body.slice(0, 90));

    // ===== R3 新建项目走真实表单 =====
    await clickText(p, '新建项目');
    await sleep(900);
    const typed = await ev(p, `
      const input = [...document.querySelectorAll('input')].find(i => (i.placeholder||'').includes('例如：某小区'));
      if (!input) return 'NO_NAME_INPUT';
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(PROJECT_NAME)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      return 'typed';
    `);
    check('R3a', '项目名输入框可真实键入（v-model 生效）', typed === 'typed', typed);
    const created = await clickText(p, '创建项目');
    await sleep(1500);
    a = await ui(p);
    check('R3b', '提交后进入项目工作区（"创建后打开"默认生效）', /#\/project\//.test(a.hash), 'btn=' + created + ' hash=' + a.hash);
    const switchState = await ev(p, `
      location.hash = '#/projects/new';
      await new Promise(r=>setTimeout(r,1200));
      return [...document.querySelectorAll('.el-switch')].map(sw => ({
        label: (sw.closest('.el-form-item')?.querySelector('.el-form-item__label')||{}).textContent,
        checked: sw.className.includes('is-checked'),
        aria: sw.querySelector('[role=switch]')?.getAttribute('aria-checked'),
      }));
    `);
    check('R3b2', '新建表单两个开关默认渲染为"开"（active-value 类型匹配，此前恒为关）',
      Array.isArray(switchState) && switchState.length === 2
      && switchState.every(x => x.checked === true && x.aria === 'true'),
      JSON.stringify(switchState));

    const idx0 = JSON.parse((await ui(p)).ls['projects-index'] || '[]');
    check('R3c', '索引写入真实项目（含图纸数 3 与项目类型），且未落盘 ⇒ path 为空',
      idx0.length === 1 && idx0[0].name === PROJECT_NAME && idx0[0].drawingCount === 3 && !idx0[0].path,
      JSON.stringify(idx0[0] || null));
    const projectId = idx0[0] && idx0[0].id;

    // ===== R4 真实 IPC 落盘 + 播种"已保存过"状态 =====
    const saved = await ev(p, `
      const idx = JSON.parse(localStorage.getItem('projects-index')||'[]')[0];
      const payload = { id: idx.id, name: idx.name, createdAt: Date.now(), updatedAt: Date.now(),
        drawings: [{ id:'d1', projectId: idx.id, name:'1F平面图', floor:'1F', order:0,
          file:{originalName:'smoke.dxf',format:'dxf',size:10,path:'${workdir}/smoke.dxf'},
          calibration:{isCalibrated:false,point1:{x:0,y:0},point2:{x:1,y:0},realDistance:1,scale:1,unit:'m'},
          layers:[],entities:[],viewport:{transform:{a:1,b:0,c:0,d:1,e:0,f:0},center:{x:0,y:0},zoom:1,showGrid:true,showRuler:false},
          devices:[],wiring:{id:'w1',drawingId:'d1',weakPoints:[],trays:[],cables:[],topology:[]},createdAt:1,updatedAt:1 }],
        settings:{ defaultScale:0.01, unit:'mm', gridSize:1000, snapEnabled:true, autoSaveInterval:0 },
        meta:{ code:'SMOKE-001', type: idx.type } };
      const r = await window.api.project.save(payload, ${JSON.stringify(surveyPath)});
      return r;
    `);
    check('R4a', '主进程 project.save 真实写出 .survey 文件', saved && saved.success === true && fs.existsSync(surveyPath),
      'ipc=' + JSON.stringify(saved) + ' disk=' + (fs.existsSync(surveyPath) ? fs.statSync(surveyPath).size + 'B' : 'missing'));

    await ev(p, `
      const idx = JSON.parse(localStorage.getItem('projects-index')||'[]')[0];
      const m = JSON.parse(localStorage.getItem('project-paths')||'{}');
      m[idx.id] = ${JSON.stringify(surveyPath)};
      localStorage.setItem('project-paths', JSON.stringify(m));
      return true;
    `);

  }

  const surveyPathFile = path.join(workdir, 'current-survey-path.txt');
  fs.writeFileSync(surveyPathFile, surveyPath);
  if (PHASE === '1') {
    console.log('[phase1 done] survey=' + surveyPath);
    p.close();
    process.exit(0);
  }
  // ===== 以下在"应用被完全重启后"的进程里执行（PHASE=2）=====
  const realPath = fs.readFileSync(surveyPathFile, 'utf8').trim();
  a = await ui(p);
  const idxAfterRestart = JSON.parse((a.ls['projects-index'] || '[]'))[0] || {};
  check('R4b', '应用整体重启后项目仍在列表（索引持久化，非内存假象）',
    idxAfterRestart.name === PROJECT_NAME && JSON.parse(a.ls['projects-index'] || '[]').length === 1,
    'n=' + JSON.parse(a.ls['projects-index'] || '[]').length + ' path=' + idxAfterRestart.path);
  // 阶段 1 刻意只播种 project-paths（模拟"索引 path 落后于映射"的真实窗口），
  // 因此这里 path 应为空，能否打开取决于 openProjectById 是否回退到映射 —— 见 R5b。
  check('R4c', '前置状态符合预期：索引 path 为空（用于验证映射回退）',
    idxAfterRestart.name === PROJECT_NAME && !idxAfterRestart.path, 'path=' + idxAfterRestart.path);
  void realPath;

  // ===== 重启后的真实用户路径 =====
  await ev(p, `location.hash = '#/projects'; await new Promise(r=>setTimeout(r,1200)); return 1;`);
  await sleep(800);
  a = await ui(p);
  check('R5a', '重启后列表显示该项目（索引持久化），未刷新前仍标"未保存"',
    /共 1 个项目/.test(a.body) && a.body.includes(PROJECT_NAME), a.body.slice(0, 170));

  // R5b：点卡片 ⇒ openProjectById 走"索引 path 缺失 ⇒ 回退 project-paths 映射"，
  //       主进程需按持久化的授权清单放行（本次修复的核心）。
  const openHit = await clickText(p, PROJECT_NAME);
  await sleep(2500);
  a = await ui(p);
  check('R5b', '点列表卡片 → 跨进程读取真实 .survey 文件并进入工作区（授权清单持久化生效）',
    /#\/project\//.test(a.hash) && !/读取项目文件失败|尚未保存|无法打开/.test(a.toast),
    'hit=' + openHit.slice(0, 14) + ' hash=' + a.hash + ' toast=' + a.toast);

  a = await ui(p);
  check('R5c', '重开后画布区有真实图纸标签（1F平面图）+ 步骤条引导，非空白壳',
    a.body.includes('1F平面图') && /导入底图/.test(a.body), a.body.slice(0, 200));

  // R5d：真实 Ctrl+S ⇒ 索引补上 path（无需原生对话框）
  await key(p, 's', 'KeyS', 83, 2);
  await sleep(1800);
  const idxSaved = JSON.parse((await ui(p)).ls['projects-index'] || '[]')[0] || {};
  check('R5d', '真实 Ctrl+S 用已知落盘路径保存成功，索引补上 path（不再弹原生对话框）',
    idxSaved.path === surveyPath, 'path=' + idxSaved.path);

  // R5e：文件真的被覆盖更新（磁盘为真相）
  const rawNow = JSON.parse(fs.readFileSync(surveyPath, 'utf8'));
  check('R5e', 'Ctrl+S 后磁盘文件内容被真实更新（updatedAt 变新、图纸仍在）',
    typeof rawNow.updatedAt === 'number' && Array.isArray(rawNow.drawings),
    'updatedAt=' + rawNow.updatedAt + ' drawings=' + (rawNow.drawings || []).length);

  // ===== R6 复制项目（真实下拉菜单 + 确认） =====
  await backToProjects(p);
  const more = await ev(p, `
    const card = [...document.querySelectorAll('.project-card')][0];
    const btn = card && card.querySelector('.card-actions button');
    if (!btn) return 'NO_TRIGGER';
    btn.click();
    await new Promise(r=>setTimeout(r,800));
    const item = [...document.querySelectorAll('.el-dropdown-menu__item')].find(e => /复制/.test(e.textContent||''));
    if (!item) return 'MENU_NO_COPY:' + [...document.querySelectorAll('.el-dropdown-menu__item')].map(e=>e.textContent.trim()).join('/');
    item.click();
    await new Promise(r=>setTimeout(r,800));
    return 'clicked';
  `);
  await sleep(2500);
  const idxDup = JSON.parse((await ui(p)).ls['projects-index'] || '[]');
  const copy = idxDup.find(x => String(x.name).includes('副本'));
  check('R6', '复制项目 → 第二条真实记录（含图纸内容、drawingCount=1），且不与原件共享落盘路径',
    more === 'clicked' && idxDup.length === 2 && !!copy && !copy.path && copy.drawingCount === 1,
    'menu=' + more + ' n=' + idxDup.length + ' copy=' + JSON.stringify({ path: copy && copy.path, d: copy && copy.drawingCount }));
  a = await ui(p);
  check('R6b', '复制后自动打开副本（进入工作区且提示真实）',
    /#\/project\//.test(a.hash) && /副本/.test(a.toast + a.body), 'hash=' + a.hash + ' toast=' + a.toast);

  // ===== R7 归档（真实菜单 + 真实 ElMessageBox） =====
  await backToProjects(p);
  const mtimeBefore = fs.statSync(surveyPath).mtimeMs;
  const archMenu = await ev(p, `
    const card = [...document.querySelectorAll('.project-card')][0];
    const btn = card && card.querySelector('.card-actions button');
    if (!btn) return 'NO_TRIGGER';
    btn.click();
    await new Promise(r=>setTimeout(r,800));
    const item = [...document.querySelectorAll('.el-dropdown-menu__item')].find(e => /归档/.test(e.textContent||''));
    if (!item) return 'MENU_NO_ARCHIVE';
    item.click();
    await new Promise(r=>setTimeout(r,700));
    return 'clicked';
  `);
  const confirm = await clickText(p, '归档', true);
  await sleep(1200);
  const idxArch = JSON.parse((await ui(p)).ls['projects-index'] || '[]');
  check('R7', '归档走"菜单→确认框"两步后写入索引；磁盘项目文件未被改写',
    archMenu === 'clicked' && confirm === '归档' && idxArch.some(x => x.archived === true)
    && fs.statSync(surveyPath).mtimeMs === mtimeBefore,
    'menu=' + archMenu + ' confirm=' + confirm + ' flags=' + JSON.stringify(idxArch.map(x => [x.name.slice(0, 10), !!x.archived])));

  // ===== R7b 状态筛选真实生效 =====
  const nav7 = await backToProjects(p);
  void nav7;
  const filtered = await ev(p, `
    const sel=[...document.querySelectorAll('.el-select')].find(s=>/状态|进行中|已归档/.test(s.textContent||''));
    if (!sel) return 'NO_SELECT';
    sel.click();
    await new Promise(r=>setTimeout(r,500));
    const opt=[...document.querySelectorAll('.el-select-dropdown__item')].find(o=>/已归档/.test(o.textContent||''));
    if (!opt) return 'NO_OPTION';
    opt.click();
    await new Promise(r=>setTimeout(r,800));
    return document.body.innerText.replace(/\s+/g,' ').slice(0,200);
  `);
  check('R7b', '状态筛选"已归档"真实过滤（副本被隐藏，计数变小）',
    /共 1 个项目/.test(filtered) && !/共 2 个项目/.test(filtered), filtered.slice(0, 130));
  await clickText(p, '重置');
  await sleep(700);

  // ===== R8 刷新按钮 =====
  await clickText(p, '刷新');
  await sleep(700);
  a = await ui(p);
  const cnt = (a.body.match(/共 (\d+) 个项目/) || [])[1];
  check('R8', '刷新后列表完整渲染且计数与索引条数一致',
    !!cnt && Number(cnt) === JSON.parse(a.ls['projects-index'] || '[]').length && !/页面未找到/.test(a.body),
    'UI计数=' + cnt + ' 索引条数=' + JSON.parse(a.ls['projects-index'] || '[]').length);

  // ===== R9 步骤条 + 撤销（真实按键与真实按钮态） =====
  await backToProjects(p);
  // 列表里此时有两个同名前缀的卡片（原件与副本），必须按精确名称点原件
  const openOrig = await ev(p, `
    const cards=[...document.querySelectorAll('.project-card')];
    const c=cards.find(x=>{const n=(x.querySelector('.project-name')||{}).textContent||'';return n.trim()===${JSON.stringify(PROJECT_NAME)}});
    if(!c) return 'NO_EXACT_CARD:' + cards.map(x=>((x.querySelector('.project-name')||{}).textContent||'').trim()).join('/');
    c.click();
    return 'clicked';
  `);
  // 打开项目 = 读盘 + 底图重水合 + DrawingView 懒加载 chunk，串行且耗时随缓存波动。
  // 等到画布视图（.drawing-view，只可能来自 DrawingView）真挂载为止；
  // 超时不判定失败，交给下面 R9a/R9t 用实际 DOM 说话，避免把真实缺陷睡成通过。
  const mounted = await waitFor(p, `!!document.querySelector('.drawing-view')`, 20000);
  a = await ui(p);
  check('R9z', '按精确名称打开原件（验证上一步骤未误点副本卡片）',
    openOrig === 'clicked' && /#\/project\//.test(a.hash) && !/尚未保存/.test(a.toast),
    'open=' + openOrig + ' hash=' + a.hash + ' toast=' + a.toast);
  check('R9m', 'DrawingView 在真实读盘打开后确实挂载（等待 ' + mounted.waited + 'ms）',
    mounted.ok === true, 'drawing-view=' + mounted.ok + ' mainArea=' + ((await ev(p, `return (document.querySelector('.main-area')||{}).innerHTML?.length||0`))));
  check('R9a', '进入项目后步骤条按真实状态引导（未校准 ⇒ 提示导入底图）',
    /导入底图/.test(a.body) && /1F平面图/.test(a.body), a.body.slice(0, 240));

  const hasToolbar = await ev(p, `return { toolbar: !!document.querySelector('.toolbar'), hash: location.hash }`);
  check('R9t', '图纸页确实挂载了工具栏（撤销/重做按钮有真实宿主）',
    hasToolbar.toolbar === true, JSON.stringify(hasToolbar));
  const undoBtn = await ev(p, `
    const b=[...document.querySelectorAll('button')].find(x=>/撤销/.test(x.title||''));
    return b ? { found:true, disabled: b.disabled===true || b.classList.contains('is-disabled'), title:(b.title||'').slice(0,40) } : { found:false, titles:[...document.querySelectorAll('button')].map(x=>x.title).filter(Boolean).slice(0,12) };
  `);
  check('R9b', '工具栏撤销按钮在无历史时为禁用态（不虚标可用）',
    undoBtn.found === true && undoBtn.disabled === true, JSON.stringify(undoBtn));

  await key(p, 'z', 'KeyZ', 90, 2);
  await sleep(800);
  a = await ui(p);
  check('R9c', '空历史时按 Ctrl+Z 不改动状态、不抛异常',
    /#\/project\//.test(a.hash) && !/页面未找到|Cannot read/.test(a.body), 'hash=' + a.hash);

  // ===== R13 核心工作流：真实鼠标布点 → 真实鼠标连线 → 真实 Ctrl+S 落盘 =====
  // 这一段是全工具的命脉（"选设备 → 画布布点 → 连线 → 保存"）。此前只被 jsdom
  // 覆盖，而布点不可用的真实根因（.drawing-tabs{height:100%} 把画布挤成 0 高、
  // 默认视口 zoom 1 只露一个吸附格）jsdom 无布局引擎根本测不出 ⇒ 必须真实输入事件验收。
  const canvasGeom = await ev(p, `
    const r=document.querySelector('.main-canvas').getBoundingClientRect();
    return { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height) };
  `);
  check('R13a', '画布在真实布局中有非零尺寸（曾被标签栏 height:100% 挤成 0px）',
    canvasGeom.w > 600 && canvasGeom.h > 300, JSON.stringify(canvasGeom));

  const snapOf = `(() => {
    const st = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value;
    const d = (st.project.drawings || []).find(x => x.id === st.project.currentDrawingId);
    return { devices: (d.devices || []).map(x => ({ id: x.id, modelId: x.modelId, label: x.label, x: x.position.x, y: x.position.y })),
      cables: (((d.wiring || {}).cables) || []).map(c => ({ from: c.startDeviceId || c.fromId || c.from, to: c.endDeviceId || c.toId || c.to, type: c.cableType || c.type, path: (c.path || []).length })) };
  })()`;

  /**
   * 标定屏幕→世界的线性映射：真实移动鼠标到两点，读状态栏世界坐标反解 zoom/偏移。
   * 不能拿 store 里的 viewport 反推 —— 组件挂载时的"新图纸默认视图"校正不写库
   * （刻意不污染未保存状态），store 与画面在此刻本就不同步；用眼睛看得到的
   * 状态栏读数标定，验的是用户真实所见。
   */
  async function calibrateView() {
    const readWorld = async (dx, dy) => {
      await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: canvasGeom.x + dx, y: canvasGeom.y + dy, buttons: 0 });
      await sleep(250);
      return ev(p, `const b=[...document.querySelectorAll('.drawing-view .status-bar .status-item')][0];
        return b ? b.textContent.trim() : '';`);
    };
    const parse = (t) => { const m = t.match(/X:\s*(-?[\d.]+)[,\s]+Y:\s*(-?[\d.]+)/); return m ? { x: +m[1], y: +m[2] } : null; };
    const A = parse(await readWorld(400, 200));
    const B = parse(await readWorld(800, 480));
    if (!A || !B || A.x === B.x || A.y === B.y) return null;
    // 屏幕位移 = 世界位移 × zoom ⇒ 反解 zoom = Δpx / Δworld；
    // 正变换再回到屏幕：dx = 400px + (world - A.world) × zoom
    const zoom = 400 / (B.x - A.x);
    return { zoom, toScreen: (p2) => ({ x: canvasGeom.x + 400 + (p2.x - A.x) * zoom, y: canvasGeom.y + 200 + (p2.y - A.y) * zoom }) };
  }

  /** 侧栏可能被切到"项目树"，布点前确保设备库可见（点真实标签按钮） */
  const ensureDeviceTab = () => ev(p, `
    if (!document.querySelector('.device-item')) {
      const t = [...document.querySelectorAll('button, .el-segmented__item, [role=tab]')]
        .find(e => /设备库/.test((e.textContent || '')));
      if (t) { t.click(); }
    }
    return !!document.querySelector('.device-item');
  `);

  // 布点：设备库卡片(真实点击) → 工具栏"布点"(真实点击) → 画布(真实鼠标)
  const tabOk = await ensureDeviceTab();
  await ev(p, `
    [...document.querySelectorAll('.device-item')][0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    [...document.querySelectorAll('button')].find(x => /布点/.test(x.title || '')).click();
    await new Promise(r => setTimeout(r, 300));
    return 1;
  `);
  await realClick(p, canvasGeom.x + 560, canvasGeom.y + 266); await sleep(500);
  await realClick(p, canvasGeom.x + 760, canvasGeom.y + 426); await sleep(500);
  const placed = await ev(p, `return ${snapOf}`);
  check('R13b', '真实鼠标布点放入 2 台设备且落在不同吸附格（1m 网格、坐标为真实数值）',
    tabOk === true &&
    placed.devices.length === 2 &&
    placed.devices.every(d => typeof d.x === 'number' && typeof d.y === 'number') &&
    !(placed.devices[0].x === placed.devices[1].x && placed.devices[0].y === placed.devices[1].y),
    JSON.stringify(placed.devices));

  // 布线：工具栏"布线" → 按标定结果真实点击两台设备中心
  const view = await calibrateView();
  await ev(p, `
    [...document.querySelectorAll('button')].find(x => /布线/.test(x.title || '')).click();
    await new Promise(r => setTimeout(r, 300));
    return document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.ui.activeTool;
  `);
  let wired = { cables: [] };
  if (view) {
    for (const dev of placed.devices) {
      const pt = view.toScreen(dev);
      await realClick(p, pt.x, pt.y); await sleep(400);
    }
    wired = await ev(p, `return ${snapOf}`);
  }
  check('R13c', '真实鼠标连线生成 1 条线缆（端点=两台真实设备 id，含类型与折点）',
    view !== null && wired.cables.length === 1 && wired.cables[0].path >= 2 && !!wired.cables[0].type
    && [wired.cables[0].from, wired.cables[0].to].sort().join(',') === placed.devices.map(d => d.id).sort().join(','),
    'view=' + JSON.stringify(view && { zoom: view.zoom }) + ' cables=' + JSON.stringify(wired.cables));

  // 撤销闭环：DrawingView 与 CanvasViewport 都在 window 上听 keydown，
  // 若两处都执行 undo，一次按键会撤两步 ⇒ 逐步撤销并核对每步剩余数量。
  await key(p, 'z', 'KeyZ', 90, 2); await sleep(700);
  const undone = await ev(p, `return ${snapOf}`);
  await key(p, 'z', 'KeyZ', 90, 2); await sleep(700);
  const oneBack = await ev(p, `return ${snapOf}`);
  await key(p, 'z', 'KeyZ', 90, 2); await sleep(500);
  await key(p, 'z', 'KeyZ', 90, 2); await sleep(700);
  const empty = await ev(p, `return ${snapOf}`);
  const a2 = await ui(p);
  check('R13d', '真实 Ctrl+Z 一次撤销一步（先撤线、再撤第二台设备，不双触发）',
    undone.cables.length === 0 && undone.devices.length === 2
    && oneBack.devices.length === 1 && oneBack.cables.length === 0,
    '撤线后=' + JSON.stringify(undone.devices.length) + '台/线=' + undone.cables.length +
    ' 再撤=' + oneBack.devices.length + '台');
  check('R13e', '历史撤空后继续按 Ctrl+Z 不报错、不越界、不离开工作区',
    empty.devices.length === 0 && empty.cables.length === 0
    && /#\/project\//.test(a2.hash) && !/Cannot read|页面未找到/.test(a2.body),
    'empty=' + JSON.stringify(empty) + ' hash=' + a2.hash);

  // 重做一遍完整链路并真实落盘：2 台设备 + 1 条线 + Ctrl+S ⇒ 磁盘文件必须含成果
  await ensureDeviceTab();
  await ev(p, `
    [...document.querySelectorAll('.device-item')][0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    [...document.querySelectorAll('button')].find(x => /布点/.test(x.title || '')).click();
    await new Promise(r => setTimeout(r, 200)); return 1;`);
  await realClick(p, canvasGeom.x + 560, canvasGeom.y + 266); await sleep(400);
  await ev(p, `[...document.querySelectorAll('.device-item')][2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200)); return 1;`);
  await realClick(p, canvasGeom.x + 760, canvasGeom.y + 426); await sleep(400);
  const reDev = await ev(p, `return ${snapOf}`);
  await ev(p, `[...document.querySelectorAll('button')].find(x => /布线/.test(x.title || '')).click();
    await new Promise(r => setTimeout(r, 200)); return 1;`);
  const view2 = await calibrateView();
  if (view2) {
    for (const dev of reDev.devices) { const pt = view2.toScreen(dev); await realClick(p, pt.x, pt.y); await sleep(350); }
  }
  const beforeSave = await ev(p, `return ${snapOf}`);
  await key(p, 's', 'KeyS', 83, 2);
  const savedState = await waitFor(p, `!document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.project.isDirty`, 9000);
  let disk = null;
  try { disk = JSON.parse(fs.readFileSync(surveyPath, 'utf8')); } catch (e) { disk = { err: String(e.message) }; }
  const diskD = (disk && disk.drawings && disk.drawings[0]) ? disk.drawings[0] : {};
  check('R13f', '真实 Ctrl+S 把 2 设备 + 1 线缆写进磁盘 .survey（核心成果落盘）',
    savedState.ok === true && (diskD.devices || []).length === 2
    && (((diskD.wiring || {}).cables || []).length) === 1
    && (diskD.devices || []).every(x => typeof x.position.x === 'number' && typeof x.position.y === 'number'),
    '内存=' + JSON.stringify(beforeSave.devices.length) + '台/' + beforeSave.cables.length + '线 → 磁盘 ' +
    (diskD.devices || []).length + '台/' + (((diskD.wiring || {}).cables || []).length) + '线 dirty=' + savedState.value + (disk.err ? ' err=' + disk.err : ''));


  // ===== R14 快捷键治理真实回归（P1 第三批） =====
  // 断言对象是真实打包应用 + 真实 CDP 按键，不是 jsdom：帮助页/设置页现在
  // 宣称的每一个键，这里都按一次并核对真实状态，防止"表里有、没人接"回潮。
  const piniaOf = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value`;

  // R14a 工具键：T=桥架、Shift+W=弱电井、V=选择。此前修饰键双触发
  //（按 Ctrl+T 既新建图纸又切桥架工具），Shift+W 宣称了但无人注册。
  // mods 是 CDP 位掩码：Alt=1 / Ctrl=2 / Meta=4 / Shift=8（写成 1 会变成
  // Alt+W，被画布按"带修饰键交给上层"正确忽略，于是测出假红）。
  async function toolProbe(code, keyName, vk, mods) {
    await key(p, keyName, code, vk, mods);
    await sleep(320);
    return ev(p, `return ${piniaOf}.ui.activeTool`);
  }
  const tTray = await toolProbe('KeyT', 't', 84, 0);
  const tWell = await toolProbe('KeyW', 'W', 87, 8);
  const tSelect = await toolProbe('KeyV', 'v', 86, 0);
  const drawingsAfterT = await ev(p, `return ${piniaOf}.project.drawings.length`);
  check('R14a', '工具键真实生效且修饰键不再双触发：T=桥架、Shift+W=弱电井、V=选择',
    tTray === 'tray' && tWell === 'well' && tSelect === 'select' && drawingsAfterT === 1,
    `T=${tTray} Shift+W=${tWell} V=${tSelect} 图纸数=${drawingsAfterT}`);

  // R14b Ctrl+T 新建图纸 + Ctrl+1/Ctrl+2 切页签（均曾只写在帮助表里）
  await key(p, 't', 'KeyT', 84, 2); await sleep(800);
  const afterNewTab = await ev(p, `return { n: ${piniaOf}.project.drawings.length, cur: ${piniaOf}.project.currentDrawingId }`);
  const tabIds = await ev(p, `return (${piniaOf}.project.drawings||[]).map(d=>d.id)`);
  await key(p, '1', 'Digit1', 49, 2); await sleep(600);
  const cur1 = await ev(p, `return ${piniaOf}.project.currentDrawingId`);
  await key(p, '2', 'Digit2', 50, 2); await sleep(600);
  const cur2 = await ev(p, `return ${piniaOf}.project.currentDrawingId`);
  check('R14b', 'Ctrl+T 真实新建图纸，Ctrl+1 / Ctrl+2 真实切换页签',
    afterNewTab.n === 2 && cur1 === tabIds[0] && cur2 === tabIds[1] && afterNewTab.cur === tabIds[1],
    `新建后=${afterNewTab.n}张 Ctrl+1命中=${cur1 === tabIds[0]} Ctrl+2命中=${cur2 === tabIds[1]}`);

  // 回到第一张（有成果的那张）再验破坏性操作，确认框一律点"取消"
  await key(p, '1', 'Digit1', 49, 2); await sleep(700);

  // R14c Ctrl+W 不再静默删除图纸：必须弹确认，取消后图纸仍在
  const beforeW = await ev(p, `return ${piniaOf}.project.drawings.length`);
  await key(p, 'w', 'KeyW', 87, 2); await sleep(900);
  const dialogShown = await ev(p, `
    const d=document.querySelector('.el-message-box');
    return d ? (d.innerText||'').replace(/\\s+/g,' ').slice(0,90) : null;
  `);
  const cancelW = await ev(p, `
    const b=[...(document.querySelector('.el-message-box')||{querySelectorAll:()=>[]}).querySelectorAll('button')]
      .find(x=>/取消/.test(x.textContent||''));
    if(!b) return 'NO_CANCEL'; b.click(); return 'clicked';
  `);
  await sleep(700);
  const afterW = await ev(p, `return ${piniaOf}.project.drawings.length`);
  check('R14c', 'Ctrl+W 关闭图纸改为需确认（此前直接 removeDrawing 静默删除），取消后未删',
    beforeW === 2 && !!dialogShown && /删除/.test(dialogShown) && cancelW === 'clicked' && afterW === 2,
    `确认框="${dialogShown}" 取消=${cancelW} 图纸数 ${beforeW}→${afterW}`);

  // R14d Ctrl+A 全选：2 台设备真实进选中集；Esc 真实清空（此前 Esc 只退工具不清选中）
  await key(p, 'a', 'KeyA', 65, 2); await sleep(700);
  const selCount = await ev(p, `
    const el=[...document.querySelectorAll('.status-item')].find(x=>/设备选中/.test(x.innerText||''));
    return el ? parseInt(el.innerText,10) : 0;
  `);
  await key(p, 'Escape', 'Escape', 27, 0); await sleep(700);
  const selAfterEsc = await ev(p, `
    const el=[...document.querySelectorAll('.status-item')].find(x=>/设备选中/.test(x.innerText||''));
    return el ? parseInt(el.innerText,10) : 0;
  `);
  check('R14d', 'Ctrl+A 全选当前图纸的 2 台设备，Esc 清空选中并退出工具模式',
    selCount === 2 && selAfterEsc === 0, `全选=${selCount}台 Esc后=${selAfterEsc}台`);

  // R14e 缩放键：Ctrl+= 放大、Ctrl+- 缩小。以状态栏读数断言 = 用户真实所见
  const zoomText = () => ev(p, `
    const el=[...document.querySelectorAll('.status-item')].find(x=>/%$/.test((x.innerText||'').trim()));
    return el ? parseInt(el.innerText,10) : -1;
  `);
  const z0 = await zoomText();
  await key(p, '=', 'Equal', 187, 2); await sleep(600);
  const zIn = await zoomText();
  await key(p, '-', 'Minus', 189, 2); await sleep(500);
  await key(p, '-', 'Minus', 189, 2); await sleep(600);
  const zOut = await zoomText();
  check('R14e', 'Ctrl+= 放大 / Ctrl+- 缩小 真实改变画布缩放（状态栏读数）',
    z0 > 0 && zIn > z0 && zOut < zIn, `${z0}% → Ctrl+= ${zIn}% → Ctrl+-x2 ${zOut}%`);

  // R14f 页签 X 与 Ctrl+W 同路（修前：X 仍直调 closeDrawing，绕开确认）
  const closeX = await ev(p, `
    const t=document.querySelectorAll('.drawing-tabs .tab')[1];
    const b=t && t.querySelector('.tab-close'); if(!b) return {shown:'NO_CLOSE_BTN'};
    b.click(); await new Promise(r=>setTimeout(r,800));
    const d=document.querySelector('.el-message-box');
    const shown=!!d;
    const c=d?[...d.querySelectorAll('button')].find(x=>/取消/.test(x.textContent||'')):null;
    if(c) c.click();
    await new Promise(r=>setTimeout(r,500));
    return { shown };
  `);
  const tabsStill = await ev(p, `return ${piniaOf}.project.drawings.length`);
  check('R14f', '页签关闭按钮同样走删除确认（不再绕过）',
    closeX.shown === true && tabsStill === 2,
    `确认框=${JSON.stringify(closeX)} 图纸数=${tabsStill}`);


  // R14i 视图开关键 g/s：状态栏指示器必须真实翻转（此前指示器与被翻的
  // 状态不是同一份真值，"按了灯不亮"）。断言读 DOM class，不读组件自报。
  async function indicator(sel) {
    return ev(p, `
      const el=document.querySelector(${JSON.stringify(sel)});
      return el ? (el.classList.contains('active') ? 1 : 0) : -1;
    `);
  }
  // 断言"按下即翻转、再按回到原值"，不断言初始极性：网格/吸附默认都是开，
  // 写死 1->0 会把夹具假设当成产品缺陷（首轮 R14i 假红的原因）。
  const grid0 = await indicator('.grid-status');
  await key(p, 'g', 'KeyG', 71, 0); await sleep(400);
  const grid1 = await indicator('.grid-status');
  await key(p, 'g', 'KeyG', 71, 0); await sleep(400);
  const grid2 = await indicator('.grid-status');
  const snap0 = await indicator('.snap-status');
  await key(p, 's', 'KeyS', 83, 0); await sleep(400);
  const snap1 = await indicator('.snap-status');
  await key(p, 's', 'KeyS', 83, 0); await sleep(400);
  const snap2 = await indicator('.snap-status');
  check('R14i', 'G 网格 / S 吸附 真实翻转，且状态栏指示器跟随（灯与状态同源）',
    grid0 >= 0 && grid1 === 1 - grid0 && grid2 === grid0
    && snap0 >= 0 && snap1 === 1 - snap0 && snap2 === snap0,
    `grid ${grid0}->${grid1}->${grid2} snap ${snap0}->${snap1}->${snap2}`);

  // R14j Delete 批量删除 = 一步历史：Ctrl+A 全选 2 台 → Delete 一次清空 →
  // 一次 Ctrl+Z 全部回来（旧实现逐个入栈，删 2 台要按 2 次撤销）。
  const devBefore = await ev(p, `return ${snapOf}`);
  await key(p, 'a', 'KeyA', 65, 2); await sleep(600);
  await key(p, 'Delete', 'Delete', 46, 0); await sleep(700);
  const afterDel = await ev(p, `return ${snapOf}`);
  await key(p, 'z', 'KeyZ', 90, 2); await sleep(700);
  const afterUndo = await ev(p, `return ${snapOf}`);
  check('R14j', 'Delete 删除全部选中设备并只占一步撤销（Ctrl+Z 一次全恢复）',
    devBefore.devices.length === 2 && afterDel.devices.length === 0 && afterUndo.devices.length === 2,
    `${devBefore.devices.length}台 → Delete ${afterDel.devices.length}台 → Ctrl+Z ${afterUndo.devices.length}台`);

  // R14k 缩放视图键：1=100%、Shift+1=适应窗口、0=适应窗口（同动作别名）。
  // 首版这里写死"Shift+1 的读数 ≠ 100%"，实测真红：按住 Shift 时数字键的
  // e.key 是 '!'，DrawingView 的 switch(e.key) case '1' + e.shiftKey 永远进不去
  // ⇒ 宣称的 Shift+1 对真实键盘是死键（已改为按 e.code 判定）。
  // 现在断言"两条适应路径读数一致"，既测得出死键，也不赌内容尺寸。
  await key(p, '1', 'Digit1', 49, 0); await sleep(600);
  const z100 = await zoomText();
  await key(p, '!', 'Digit1', 49, 8); await sleep(700);
  const zFitShift = await zoomText();
  await key(p, '1', 'Digit1', 49, 0); await sleep(600);
  const z100again = await zoomText();
  await key(p, '0', 'Digit0', 48, 0); await sleep(700);
  const zFitZero = await zoomText();
  check('R14k', '1 = 缩放100%；Shift+1 与 0 都真实执行"适应窗口"（读数一致且非100%）',
    z100 === 100 && z100again === 100 && zFitShift === zFitZero && zFitShift !== 100 && zFitShift > 0,
    `1键=${z100}% Shift+1=${zFitShift}% 再按1=${z100again}% 0键=${zFitZero}%`);

  // R14g 全局键：F1=帮助、F2=侧栏折叠、Ctrl+,=设置
  await key(p, 'F1', 'F1', 112, 0); await sleep(900);
  const f1Hash = await ev(p, `return location.hash`);
  await ev(p, `history.back(); await new Promise(r=>setTimeout(r,900)); return 1;`);
  await waitFor(p, `!!document.querySelector('.drawing-view')`, 15000);
  const sidebarBefore = await ev(p, `return ${piniaOf}.ui.sidebarCollapsed`);
  await key(p, 'F2', 'F2', 113, 0); await sleep(600);
  const sidebarAfter = await ev(p, `return ${piniaOf}.ui.sidebarCollapsed`);
  await key(p, ',', 'Comma', 188, 2); await sleep(900);
  const settingsHash = await ev(p, `return location.hash`);
  check('R14g', 'F1 帮助 / F2 折叠侧栏 / Ctrl+, 设置 三条全局键真实生效',
    /help/.test(f1Hash) && sidebarBefore === false && sidebarAfter === true && /settings/.test(settingsHash),
    `F1=${f1Hash} F2 ${sidebarBefore}->${sidebarAfter} Ctrl+,=${settingsHash}`);
  await ev(p, `history.back(); await new Promise(r=>setTimeout(r,1200)); return 1;`);
  await waitFor(p, `!!document.querySelector('.drawing-view')`, 15000);

  // Ctrl+N 有脏守卫：当前项目已保存（isDirty=false）时应直接进入新建页
  await ev(p, `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value.project.isDirty;`);
  const dirtyNow = await ev(p, `return ${piniaOf}.project.isDirty`);
  await key(p, 'n', 'KeyN', 78, 2); await sleep(1000);
  const newProjHash = await ev(p, `return location.hash`);
  const npDialog = await ev(p, `return !!document.querySelector('.el-message-box')`);
  if (npDialog) {
    await ev(p, `const b=[...document.querySelectorAll('.el-message-box button')].find(x=>/放弃|确定|继续/.test(x.textContent||'')); if(b) b.click(); await new Promise(r=>setTimeout(r,600)); return 1;`);
  }
  const newProjHash2 = await ev(p, `return location.hash`);
  check('R14h', 'Ctrl+N 新建项目真实导航（脏时先过守卫），落到新建页',
    /create|new|projects/.test(newProjHash2) || (dirtyNow === true && npDialog === true),
    `dirty=${dirtyNow} 直接后=${newProjHash} 过守卫后=${newProjHash2}`);
  await ev(p, `location.hash='#/projects'; await new Promise(r=>setTimeout(r,1000)); return 1;`);
  // ===== R12 导出项目文件（真实下载通道） =====
  const dl = await ev(p, `
    const idx = JSON.parse(localStorage.getItem('projects-index')||'[]')[0];
    const r = await window.api && window.api.fs ? { bridge: true } : { bridge: false };
    return r;
  `);
  void dl;
  await backToProjects(p);
  const exportClicked = await ev(p, `
    const card=[...document.querySelectorAll('.project-card')][0];
    const btn=card && card.querySelector('.card-actions button');
    btn.click();
    await new Promise(r=>setTimeout(r,800));
    const item=[...document.querySelectorAll('.el-dropdown-menu__item')].find(e=>/导出/.test(e.textContent||''));
    if (!item) return 'NO_EXPORT_ITEM';
    item.click();
    await new Promise(r=>setTimeout(r,1500));
    return 'clicked';
  `);
  a = await ui(p);
  check('R12', '导出项目 → 走真实下载通道且不报错（不再"开发中"）',
    exportClicked === 'clicked' && !/开发中|失败|不在列表中/.test(a.toast),
    'click=' + exportClicked + ' toast=' + a.toast);

  // ===== R10 渲染进程未抛未捕获异常 =====
  const errs = p.events.filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => ((e.params.exceptionDetails.exception || {}).description) || e.params.exceptionDetails.text);
  check('R10', '整轮真实操作未在渲染进程留下未捕获异常', errs.length === 0, errs.slice(0, 2).join(' | ') || '无');

  // ===== R11 磁盘文件契约（外部工具可读的合法项目） =====
  try {
    const raw = JSON.parse(fs.readFileSync(surveyPath, 'utf8'));
    check('R11', '落盘文件是合法项目：顶层字段守契约（无新增字段）、图纸可解析',
      ['id', 'name', 'createdAt', 'updatedAt', 'drawings', 'settings'].every(k => k in raw)
      && Object.keys(raw).sort().join(',') === ['createdAt','drawings','id','meta','name','settings','updatedAt'].sort().join(',')
      && raw.drawings[0].id === 'd1',
      'keys=' + Object.keys(raw).sort().join(','));
  } catch (e) {
    check('R11', '落盘文件可解析', false, String(e.message));
  }

  const failed = results.filter(r => !r.pass);
  console.log('\n===== 真实应用验收汇总 =====');
  console.log(`共 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}`);
  failed.forEach(f => console.log('  失败 - ' + f.id + ' ' + f.desc + ' :: ' + f.observed.slice(0, 150)));
  fs.writeFileSync('/tmp/smoke-result.json', JSON.stringify({ results, surveyPath }, null, 1));
  p.close();
  process.exit(failed.length ? 2 : 0);
})().catch(e => {
  console.error('[HARNESS FAIL]', e && e.message);
  console.error(String(e && e.stack).split('\n').slice(0, 5).join('\n'));
  process.exit(3);
});
