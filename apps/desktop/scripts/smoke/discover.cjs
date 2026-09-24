const { attach } = require('./cdp.cjs');
(async () => {
  const p = await attach();
  await new Promise(r => setTimeout(r, 2000));
  const info = await p.eval(`(() => {
    const txt = el => (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,26);
    const click = [...document.querySelectorAll('button,a,.el-button,[role=button]')].map(txt).filter(Boolean);
    const ls = {}; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); ls[k]=(localStorage.getItem(k)||'').slice(0,80);} 
    return { url: location.href, title: document.title,
      hasApi: !!window.api, hasProjectApi: !!(window.api&&window.api.project),
      hasFsApi: !!(window.api&&window.api.fs),
      lsKeys: Object.keys(ls), ls: ls,
      clickables: click.slice(0,40),
      body: document.body.innerText.replace(/\\s+/g,' ').slice(0,260) };
  })()`);
  console.log(JSON.stringify(info, null, 1));
  p.close();
})().catch(e => { console.error('[FAIL]', e && e.message, '\n', e && e.stack && e.stack.split('\n').slice(0,4).join(' | ')); process.exit(1); });
