import { spawn } from 'node:child_process';
import { request } from 'node:http';
import assert from 'node:assert/strict';

// Match Azure/standalone: the socket is HTTP on an internal port, while Host
// and forwarded protocol identify the public HTTPS portal. A localhost-only
// request hides accidental external rewrites to the public domain on this port.
const publicHost = 'admin.tapkin.com.au';
const server = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', '3100',
], {
  env: { ...process.env, APP_ENV: 'development', DATABASE_URL: '', AI_ASSISTANTS_ORIGIN: `https://${publicHost}`, AI_ASSISTANTS_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', data => { logs += data; });
server.stderr.on('data', data => { logs += data; });
function read(path, host = publicHost, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1', port: 3100, path,
      headers: { host, 'x-forwarded-host': host, 'x-forwarded-proto': 'https', 'x-forwarded-port': '443', ...extraHeaders },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', data => { body += data; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      res.on('error', reject);
    });
    req.setTimeout(10000, () => req.destroy(new Error(`Timed out reading ${path}; check for an external portal rewrite`)));
    req.on('error', reject);
    req.end();
  });
}
try {
  for (let i = 0; i < 150 && !logs.includes('Ready'); i++) {
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(logs.includes('Ready'), 'Test server did not start');
  let count = 0;
  for (const [path, status] of [
    ['/', 200], ['/plans', 200], ['/how-it-works', 200], ['/help', 200], ['/help/website', 200],
    ['/help/instagram', 200], ['/help/facebook', 200], ['/help/whatsapp', 200], ['/faq', 200], ['/terms', 200], ['/privacy', 200], ['/login', 200], ['/register', 200],
    ['/account', 307], ['/ai-assistants', 307], ['/assistant-portal/account', 307],
    ['/api/admin/stores', 404], ['/not-a-real-page', 404], ['/robots.txt', 200], ['/assistant-widget.js', 200],
  ]) {
    const result = await read(path);
    assert.equal(result.status, status, `${path}: ${result.body.slice(0, 1000)}`);
    if(path==='/help/whatsapp'){assert.match(result.body,/Connect WhatsApp/);assert.match(result.body,/six-digit/);assert.match(result.headers['content-security-policy']||'',/https:\/\/connect\.facebook\.net/);}
    if (path === '/') {
      assert.match(result.body, /ai-shell/);
      assert.doesNotMatch(result.body, /data-store="tapkin"/);
    }
    count++;
  }
  const store = await read('/', 'localhost:3100');
  assert.equal(store.status, 200);
  assert.match(store.body, /data-store="tapkin"/);
  assert.doesNotMatch(store.body, /ai-shell/);
  assert.doesNotMatch(store.headers['content-security-policy']||'', /connect\.facebook\.net/);
  count++;
  const query = await read('/plans?locale=en-AU');
  assert.equal(query.status, 200);
  assert.match(query.body, /Start with one channel/);
  count++;
  const flight = await read('/plans?_rsc', publicHost, { rsc: '1' });
  assert.equal(flight.status, 200, JSON.stringify(flight.headers));
  assert.match(flight.headers['content-type'] || '', /text\/x-component/);
  count++;
  console.log(`${count} assistant/store HTTP checks passed behind simulated HTTPS ingress`);
} catch (error) {
  console.error(logs.slice(-10000));
  throw error;
} finally {
  server.kill('SIGTERM');
}
