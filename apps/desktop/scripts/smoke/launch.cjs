// 启动打包后的真实 Electron 应用（独立 userData，不污染用户数据），开 CDP 端口。
const { spawn } = require('child_process');
const bin = process.env.BIN || './release/linux-unpacked/@security-surveydesktop';
const profile = process.env.PROFILE || '/tmp/am-smoke-profile';
const child = spawn(bin, [
  '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--user-data-dir=' + profile, '--remote-debugging-port=' + (process.env.CDP_PORT || '9222'),
], { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', d => { if (process.env.VERBOSE) process.stdout.write('[out] ' + d); });
child.stderr.on('data', d => { if (process.env.VERBOSE) process.stderr.write('[err] ' + d); });
child.on('exit', (c, s) => { console.log('[app exit]', c, s); });
process.on('SIGTERM', () => child.kill('SIGKILL'));
process.on('SIGINT', () => child.kill('SIGKILL'));
console.log('[launched] pid=' + child.pid + ' profile=' + profile);
