import http from 'node:http';
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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    const addr = req.socket.remoteAddress ?? '';

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
