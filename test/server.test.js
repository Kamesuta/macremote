import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createApp } from '../src/server.js';
import { startFakeRfb } from './fake-rfb.js';

let app, base, host, fake;
const PASSWORD = 'correct horse';

before(async () => {
  fake = await startFakeRfb();
  app = createApp({ password: PASSWORD, secret: 's3cret', vncPort: fake.port, secureCookie: false });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  host = `127.0.0.1:${app.address().port}`;
  base = `http://${host}`;
});
after(async () => { app.closeAllConnections(); app.close(); await fake.close(); });

async function login(password = PASSWORD) {
  const res = await fetch(`${base}/login`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }),
  });
  return res;
}

test('app pages require sign-in; login page does not', async () => {
  const res = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login.html');
  assert.equal((await fetch(`${base}/login.html`)).status, 200);
  assert.equal((await fetch(`${base}/vendor/novnc/core/rfb.js`, { redirect: 'manual' })).status, 303);
});

test('wrong password is rejected, right password sets a long-lived cookie', async () => {
  const bad = await login('nope');
  assert.equal(bad.headers.get('location'), '/login.html?error=1');
  assert.equal(bad.headers.get('set-cookie'), null);
  const good = await login();
  const cookie = good.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=31536000/);
});

test('signed-in user gets the app and noVNC; path traversal is blocked', async () => {
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${base}/`, { headers: { cookie } })).status, 200);
  assert.equal((await fetch(`${base}/vendor/novnc/core/rfb.js`, { headers: { cookie } })).status, 200);
  const evil = await fetch(`${base}/vendor/novnc/..%2f..%2fpackage.json`, { headers: { cookie } });
  assert.notEqual(evil.status, 200);
  const evil2 = await fetch(`${base}/..%2fpackage.json`, { headers: { cookie } });
  assert.notEqual(evil2.status, 200);
});

test('tampered or expired tokens are refused', async () => {
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const forged = cookie.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  assert.equal((await fetch(`${base}/`, { headers: { cookie: forged }, redirect: 'manual' })).status, 303);
});

test('websocket: refused without cookie or with a foreign Origin', async () => {
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const attempt = async (headers) => {
    const ws = new WebSocket(`ws://${host}/vnc`, ['binary'], { headers });
    const [err] = await Promise.race([once(ws, 'error'), once(ws, 'open').then(() => [null])]);
    ws.terminate();
    return err;
  };
  assert.ok(await attempt({ origin: `http://${host}` }), 'no cookie');
  assert.ok(await attempt({ cookie, origin: 'http://evil.example' }), 'foreign origin');
  assert.ok(await attempt({ cookie }), 'missing origin');
});

test('websocket: signed-in same-origin client reaches the VNC server', async () => {
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const ws = new WebSocket(`ws://${host}/vnc`, ['binary'], { headers: { cookie, origin: `http://${host}` } });
  const [data] = await once(ws, 'message');
  assert.equal(data.toString(), 'RFB 003.008\n');
  assert.equal(ws.protocol, 'binary');
  ws.close();
});

test('five wrong passwords lock the address out', async () => {
  for (let i = 0; i < 5; i++) await login('wrong');
  assert.equal((await login()).status, 429);
});
