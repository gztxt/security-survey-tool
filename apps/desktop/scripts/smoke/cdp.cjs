// 最小 CDP 客户端：Electron 的 CDP 不支持 Playwright connectOverCDP 所需的
// Browser.setDownloadBehavior，故直连 page target 用 Runtime.evaluate 驱动真实 UI。
const http = require('http');

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
  });
}

async function attach(pageFilter) {
  const targets = await getJson('http://127.0.0.1:' + (process.env.CDP_PORT || '9222') + '/json');
  const pages = targets.filter(t => t.type === 'page' || (t.url || '').startsWith('file://') || (t.url || '').startsWith('http'));
  const t = (pageFilter ? pages.find(pageFilter) : null)
    || pages.find(p => !/splash/.test(p.url || '')) || pages[0];
  if (!t) throw new Error('没有可用的 page target: ' + JSON.stringify(pages.map(p => p.url)));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  return {
    url: t.url, ws, send, events,
    async eval(expr, awaitPromise = true) {
      const r = await send('Runtime.evaluate', {
        expression: expr, returnByValue: true, awaitPromise,
        allowUnsafeEvalBlockedByCSP: true,
      });
      const res = (r && r.result) || {};
      if (r && r.error) throw new Error('CDP 错误: ' + JSON.stringify(r.error).slice(0, 300));
      if (res.exceptionDetails) {
        const d = res.exceptionDetails;
        throw new Error('页面内异常: ' + (d.exception && (d.exception.className + ': ' + d.exception.description) || d.text || JSON.stringify(d)).replace(/\s+/g, ' ').slice(0, 400));
      }
      return res.result ? res.result.value : undefined;
    },
    close() { try { ws.close(); } catch {} },
  };
}

module.exports = { attach };
