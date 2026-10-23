import http from 'node:http';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import {
  COOKIE_NAME, loadSecret, passwordMatches, makeToken, tokenValid,
  parseCookies, sessionCookie, clearCookie, makeLimiter,
} from './auth.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};
// Pages that must load before sign-in.
const PUBLIC_PATHS = new Set(['/login.html', '/login.js', '/style.css', '/manifest.webmanifest', '/icon-180.png', '/icon-512.png']);

export function createApp({
  password,
  secret,
  vncHost = '127.0.0.1',
  vncPort = 5900,
  secureCookie = true,
  publicDir = join(root, 'public'),
  novncDir = join(root, 'node_modules', '@novnc', 'novnc'),
}) {
  if (!password) throw new Error('MACREMOTE_PASSWORD is required');
  const limiter = makeLimiter();
  const signedIn = (req) => tokenValid(secret, parseCookies(req.headers.cookie)[COOKIE_NAME]);

  async function sendFile(res, base, rel) {
    const full = normalize(join(base, rel));
    if (full !== base && !full.startsWith(base + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(full);
      res.writeHead(200, {
        'content-type': TYPES[extname(full)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }

  async function readForm(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) break; }
    return new URLSearchParams(raw);
  }

  // Handoffs: a tool on the Mac (bin/macremote-ask) asks the phone user to act on one window.
  // It authenticates with the cookie-signing secret, which only the Mac user can read.
  const handoffs = new Map(); // id -> { message, region, app, expires, done, waiters }
  const HANDOFF_MS = 30 * 60_000;
  const hasKey = (req) => passwordMatches(req.headers['x-macremote-key'] ?? '', secret);
  const json = (res, code, body) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
  function liveHandoff(id) {
    const h = handoffs.get(id);
    if (h && h.expires < Date.now()) { handoffs.delete(id); h.waiters.forEach((w) => w()); return null; }
    return h ?? null;
  }
  async function readJson(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return null; }
    try { return JSON.parse(raw); } catch { return null; }
  }
  // Returns true when it answered the request.
  async function handleHandoff(req, res, path) {
    if (path === '/api/handoff' && req.method === 'POST') {
      if (!hasKey(req)) { json(res, 403, { error: 'forbidden' }); return true; }
      const b = await readJson(req);
      const r = b?.region;
      const frac = (v) => typeof v === 'number' && v >= 0 && v <= 1;
      if (!b || typeof b.message !== 'string' || !r || ![r.x, r.y, r.w, r.h].every(frac)) {
        json(res, 400, { error: 'need message and region {x,y,w,h} as fractions of the screen' });
        return true;
      }
      const id = randomBytes(16).toString('base64url');
      handoffs.set(id, {
        message: b.message.slice(0, 500), app: String(b.app ?? '').slice(0, 100),
        region: { x: r.x, y: r.y, w: r.w, h: r.h }, expires: Date.now() + HANDOFF_MS, done: false, waiters: [],
      });
      json(res, 200, { id, path: `/?h=${id}` });
      return true;
    }
    const m = /^\/api\/handoff\/([\w-]+)(\/done|\/wait)?$/.exec(path);
    if (!m) return false;
    const [, id, action] = m;
    if (action === '/wait' && req.method === 'GET') {        // long poll for the Mac-side tool
      if (!hasKey(req)) { json(res, 403, { error: 'forbidden' }); return true; }
      const h = liveHandoff(id);
      if (!h || h.done) { json(res, 200, { done: !!h?.done, expired: !h }); return true; }
      const finish = () => { clearTimeout(timer); json(res, 200, { done: h.done, expired: !handoffs.has(id) }); };
      const timer = setTimeout(() => { h.waiters = h.waiters.filter((w) => w !== finish); finish(); }, 25_000);
      h.waiters.push(finish);
      req.on('close', () => { clearTimeout(timer); h.waiters = h.waiters.filter((w) => w !== finish); });
      return true;
    }
    if (!signedIn(req)) { json(res, 403, { error: 'sign in' }); return true; }
    const h = liveHandoff(id);
    if (!h) { json(res, 404, { error: 'expired' }); return true; }
    if (!action && req.method === 'GET') { json(res, 200, { message: h.message, app: h.app, region: h.region, done: h.done }); return true; }
    if (action === '/done' && req.method === 'POST') {
      h.done = true;
      h.waiters.splice(0).forEach((w) => w());
      json(res, 200, { done: true });
      return true;
    }
    json(res, 405, { error: 'method' });
    return true;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    const addr = req.socket.remoteAddress ?? '';

    if (path.startsWith('/api/handoff') && await handleHandoff(req, res, path)) return;
    if (path === '/login' && req.method === 'POST') {
      if (limiter.blocked(addr)) { res.writeHead(429, { 'retry-after': '60' }).end('Too many attempts'); return; }
      const form = await readForm(req);
      if (passwordMatches(form.get('password') ?? '', password)) {
        limiter.reset(addr);
        res.writeHead(303, { location: '/', 'set-cookie': sessionCookie(makeToken(secret), { secure: secureCookie }) }).end();
      } else {
        limiter.fail(addr);
        res.writeHead(303, { location: '/login.html?error=1' }).end();
      }
      return;
    }
    if (path === '/logout' && req.method === 'POST') {
      res.writeHead(303, { location: '/login.html', 'set-cookie': clearCookie({ secure: secureCookie }) }).end();
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }

    if (PUBLIC_PATHS.has(path)) return sendFile(res, publicDir, path);
    if (!signedIn(req)) { res.writeHead(303, { location: '/login.html' }).end(); return; }
    if (path.startsWith('/vendor/novnc/')) return sendFile(res, novncDir, path.slice('/vendor/novnc/'.length));
    return sendFile(res, publicDir, path === '/' ? 'index.html' : path.slice(1));
  });

  // WebSocket -> raw TCP pipe to the Mac's built-in VNC server.
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has('binary') ? 'binary' : false),
  });

  server.on('upgrade', (req, socket, head) => {
    const sameOrigin = (() => {
      try { return new URL(req.headers.origin ?? '').host === req.headers.host; } catch { return false; }
    })();
    if (new URL(req.url, 'http://x').pathname !== '/vnc' || !sameOrigin || !signedIn(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const vnc = net.connect(vncPort, vncHost);
      vnc.setNoDelay(true);
      // Backpressure: ws has no drain event, so pause on a full buffer and poll to resume.
      vnc.on('data', (d) => {
        ws.send(d);
        if (ws.bufferedAmount > 1 << 20) vnc.pause();
      });
      const poll = setInterval(() => { if (ws.bufferedAmount < 1 << 18) vnc.resume(); }, 50);
      vnc.on('close', () => { clearInterval(poll); ws.close(); });
      vnc.on('error', () => ws.close(1011, 'VNC server unreachable'));
      ws.on('message', (d) => vnc.write(d));
      ws.on('close', () => { clearInterval(poll); vnc.destroy(); });
      ws.on('error', () => vnc.destroy());
    });
  });

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const password = process.env.MACREMOTE_PASSWORD;
  if (!password) { console.error('Set MACREMOTE_PASSWORD (the password the web app asks for).'); process.exit(1); }
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 8080);
  const server = createApp({
    password,
    secret: process.env.MACREMOTE_SECRET ?? loadSecret(process.env.MACREMOTE_DIR),
    vncHost: process.env.VNC_HOST ?? '127.0.0.1',
    vncPort: Number(process.env.VNC_PORT ?? 5900),
    secureCookie: process.env.MACREMOTE_SECURE_COOKIE !== '0',
  });
  server.listen(port, host, () => console.log(`macremote listening on http://${host}:${port}`));
}
