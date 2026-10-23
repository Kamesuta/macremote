import RFB from '/vendor/novnc/core/rfb.js';
import { releaseCapture } from '/vendor/novnc/core/util/events.js';

const $ = (id) => document.getElementById(id);
const STORE = 'macremote.credentials';
const RESUME_RECONNECT_AFTER_MS = 3000; // a tab hidden this long has a dead socket on iOS

let rfb = null;
let connected = false;
let closed = true;      // true until the user connects; set again by Close
let authFailed = false;
let retries = 0;
let retryTimer = null;
let hiddenAt = 0;
let wakeLock = null;
let creds = loadCreds();
const activeMods = new Set();

function loadCreds() {
  try { return JSON.parse(localStorage.getItem(STORE)) ?? null; } catch { return null; }
}
function saveCreds(c) { try { localStorage.setItem(STORE, JSON.stringify(c)); } catch { /* private mode */ } }
function forgetCreds() { try { localStorage.removeItem(STORE); } catch { /* ignore */ } creds = null; }

function status(text) {
  $('status').hidden = !text;
  $('status').textContent = text ?? '';
}

function showForm(message = '') {
  $('connect').hidden = false;
  $('toolbar').hidden = true;
  $('connect-error').textContent = message;
  if (creds) $('user').value = creds.username ?? '';
  status('');
}

function connect() {
  clearTimeout(retryTimer);
  teardown();
  closed = false;
  authFailed = false;
  $('connect').hidden = true;
  $('toolbar').hidden = false;
  status(retries ? 'Reconnecting…' : 'Connecting…');

  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  rfb = new RFB($('zoom'), `${scheme}://${location.host}/vnc`, {
    credentials: creds ?? undefined,
    wsProtocols: ['binary'],
  });
  rfb.scaleViewport = true;
  rfb.resizeSession = false;
  rfb.showDotCursor = true;

  // teardown() disconnects the old instance asynchronously; its late events must not act on the new one.
  const me = rfb;
  rfb.addEventListener('connect', () => {
    if (rfb !== me) return;
    connected = true;
    retries = 0;
    status('');
    drawPtr();
    acquireWakeLock();
  });
  rfb.addEventListener('credentialsrequired', () => {
    if (rfb !== me) return;
    // The saved credentials were missing fields; ask again.
    authFailed = true;
    showForm('Enter your Mac username and password.');
  });
  rfb.addEventListener('securityfailure', () => {
    if (rfb !== me) return;
    authFailed = true;
    forgetCreds();
    showForm('The Mac rejected that username or password.');
  });
  rfb.addEventListener('disconnect', () => {
    if (rfb !== me) return;
    connected = false;
    releaseWakeLock();
    if (closed || authFailed) return;
    scheduleReconnect();
  });
}

function teardown() {
  if (!rfb) return;
  const old = rfb;
  rfb = null;
  connected = false;
  try { old.disconnect(); } catch { /* already gone */ }
}

function scheduleReconnect() {
  status('Reconnecting…');
  const delay = Math.min(500 * 2 ** retries, 5000);
  retries += 1;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, delay);
}

function closeSession() {
  closed = true;
  clearTimeout(retryTimer);
  teardown();
  releaseWakeLock();
  forgetCreds();
  fetch('/logout', { method: 'POST' }).finally(() => { location.href = '/login.html'; });
}

// --- coming back to the app --------------------------------------------------
function resume() {
  if (closed || authFailed) return;
  const away = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = 0;
  if (!connected || away > RESUME_RECONNECT_AFTER_MS) { retries = 0; connect(); }
  else acquireWakeLock();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else resume();
});
window.addEventListener('pageshow', (e) => { if (e.persisted) resume(); });
window.addEventListener('online', resume);

async function acquireWakeLock() {
  try {
    if (!('wakeLock' in navigator) || wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* unsupported or denied: harmless */ }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

// --- connect form ------------------------------------------------------------
$('connect').addEventListener('submit', (e) => {
  e.preventDefault();
  const entered = { username: $('user').value, password: $('pass').value };
  if ($('remember').checked) saveCreds(entered); else forgetCreds();
  creds = entered;
  retries = 0;
  connect();
});

// --- touch: pinch to zoom, two-finger pan, optional trackpad mode ---------------------
// The viewer is scaled to fit #zoom, so zooming just makes #zoom bigger than #screen and
// scrolls it. Pointer maths stay correct because nothing is CSS-transformed.
const MAX_ZOOM = 5;
const PAD_KEY = 'macremote.pad';
const PAD_SPEED = 1.6;       // pointer pixels per finger pixel
const TAP_MS = 300;          // shorter than this and barely moved = a tap
const HOLD_MS = 450;         // resting one finger this long starts a drag
const MOVE_SLOP = 8;         // px of travel before a touch stops counting as a tap
const ZOOM_SLOP = 24;        // px of finger-spread change before a two-finger gesture counts as a pinch
let zoom = 1;
const screenEl = $('screen');
const zoomEl = $('zoom');
const ptrEl = $('pointer');
let padMode = false;
try { padMode = localStorage.getItem(PAD_KEY) === '1'; } catch { /* private mode */ }
const ptr = { fx: 0.5, fy: 0.5 }; // pointer as a fraction of the remote screen

const canvasEl = () => zoomEl.querySelector('canvas');
function ptrClient() {
  const r = canvasEl()?.getBoundingClientRect();
  return r && r.width ? { x: r.left + ptr.fx * r.width, y: r.top + ptr.fy * r.height, w: r.width, h: r.height } : null;
}
function drawPtr() {
  const p = ptrClient();
  ptrEl.hidden = !(padMode && connected && p);
  if (ptrEl.hidden) return;
  const s = screenEl.getBoundingClientRect();
  ptrEl.style.transform = `translate(${p.x - s.left + screenEl.scrollLeft}px, ${p.y - s.top + screenEl.scrollTop}px)`;
}
// When zoomed in, pan the view so the pointer never sits outside it: pushing the pointer to a
// side of the Mac's screen brings that side into view.
const EDGE_MARGIN = 28;      // px from the visible edge at which the view starts following
function followPtr() {
  if (zoom === 1) return;
  const p = ptrClient();
  if (!p) return;
  const s = screenEl.getBoundingClientRect();
  const mx = Math.min(EDGE_MARGIN, s.width / 2), my = Math.min(EDGE_MARGIN, s.height / 2);
  if (p.x < s.left + mx) screenEl.scrollLeft -= s.left + mx - p.x;
  else if (p.x > s.right - mx) screenEl.scrollLeft += p.x - (s.right - mx);
  if (p.y < s.top + my) screenEl.scrollTop -= s.top + my - p.y;
  else if (p.y > s.bottom - my) screenEl.scrollTop += p.y - (s.bottom - my);
}
function fireMouse(type, buttons, button = 0) {
  const c = canvasEl(), p = ptrClient();
  if (!c || !p) return;
  c.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, buttons, button }));
  // noVNC's mousedown puts a full-page capture overlay up and expects a real mouseup on window
  // to take it down. Ours stops at the canvas, so the overlay would swallow the next tap.
  if (type === 'mouseup') releaseCapture();
}
function clickAtPointer(button) {            // 0 = left, 2 = right
  const down = button === 2 ? 2 : 1;
  fireMouse('mousemove', 0);
  fireMouse('mousedown', down, button);
  fireMouse('mouseup', 0, button);
}
function scrollRemote(dy) {
  const c = canvasEl(), p = ptrClient();
  if (!c || !p) return;
  c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, deltaY: -dy * 2, deltaMode: 0 }));
}
function setPad(on) {
  padMode = on;
  try { localStorage.setItem(PAD_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  $('btn-pad').classList.toggle('on', on);
  drawPtr();
}

function applyZoom(next, focalX, focalY) {
  next = Math.min(MAX_ZOOM, Math.max(1, next));
  const rect = screenEl.getBoundingClientRect();
  const fx = focalX - rect.left;
  const fy = focalY - rect.top;
  const contentX = (screenEl.scrollLeft + fx) / zoom;
  const contentY = (screenEl.scrollTop + fy) / zoom;
  zoom = next;
  zoomEl.style.width = `${zoom * 100}%`;
  zoomEl.style.height = `${zoom * 100}%`;
  screenEl.scrollLeft = contentX * zoom - fx;
  screenEl.scrollTop = contentY * zoom - fy;
  if (zoom === 1) { screenEl.scrollLeft = 0; screenEl.scrollTop = 0; }
  $('btn-zoom').textContent = zoom === 1 ? '1×' : `${zoom.toFixed(1)}×`;
  drawPtr();
}

let pinch = null;   // two fingers down
let pad = null;     // one finger down in trackpad mode
const midpoint = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
function endPad() {
  if (!pad) return;
  clearTimeout(pad.timer);
  if (pad.dragging) { fireMouse('mouseup', 0); ptrEl.classList.remove('down'); }
  pad = null;
}

// Capture phase, so these gestures never reach noVNC's own touch handling.
screenEl.addEventListener('touchstart', (e) => {
  if (e.touches.length >= 2) {
    endPad();
    const m = midpoint(e.touches);
    pinch = { dist: spread(e.touches), zoom, x: m.x, y: m.y, sx: m.x, sy: m.y, t0: Date.now(), moved: false, zooming: false };
    e.preventDefault(); e.stopPropagation();
  } else if (padMode && !pinch) {
    const t = e.touches[0];
    pad = { x: t.clientX, y: t.clientY, t0: Date.now(), moved: false, dragging: false, travel: 0 };
    pad.timer = setTimeout(() => {
      if (!pad || pad.moved) return;
      pad.dragging = true;
      ptrEl.classList.add('down');
      fireMouse('mousedown', 1);
    }, HOLD_MS);
    e.preventDefault(); e.stopPropagation();
  }
}, { capture: true, passive: false });

screenEl.addEventListener('touchmove', (e) => {
  if (pinch) {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length < 2) return;
    const m = midpoint(e.touches);
    const d = spread(e.touches);
    if (Math.abs(d - pinch.dist) > ZOOM_SLOP) pinch.zooming = true;
    if (Math.hypot(m.x - pinch.sx, m.y - pinch.sy) > MOVE_SLOP || Math.abs(d - pinch.dist) > MOVE_SLOP) pinch.moved = true;
    const dy = m.y - pinch.y;
    if (padMode && zoom === 1 && !pinch.zooming) {
      scrollRemote(dy);                       // two fingers scroll the Mac, like a trackpad
    } else {
      screenEl.scrollLeft -= m.x - pinch.x;
      screenEl.scrollTop -= dy;
    }
    pinch.x = m.x; pinch.y = m.y;
    if (!padMode || pinch.zooming) applyZoom(pinch.zoom * (d / pinch.dist), m.x, m.y);
    return;
  }
  if (pad) {
    e.preventDefault(); e.stopPropagation();
    const t = e.touches[0];
    const dx = t.clientX - pad.x, dy = t.clientY - pad.y;
    pad.x = t.clientX; pad.y = t.clientY;
    pad.travel += Math.hypot(dx, dy);
    if (pad.travel > MOVE_SLOP) pad.moved = true;
    const p = ptrClient();
    if (!p || !pad.moved) return;
    ptr.fx = Math.min(1, Math.max(0, ptr.fx + (dx * PAD_SPEED) / p.w));
    ptr.fy = Math.min(1, Math.max(0, ptr.fy + (dy * PAD_SPEED) / p.h));
    followPtr();
    fireMouse('mousemove', pad.dragging ? 1 : 0);
    drawPtr();
  }
}, { capture: true, passive: false });

function endTouch(e) {
  if (pinch) {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length === 0) {
      if (padMode && !pinch.moved && Date.now() - pinch.t0 < TAP_MS) clickAtPointer(2); // two-finger tap = right click
      pinch = null;
    }
    return;
  }
  if (pad) {
    e.preventDefault(); e.stopPropagation();
    if (!pad.dragging && !pad.moved && Date.now() - pad.t0 < TAP_MS) clickAtPointer(0); // tap = click
    endPad();
  }
}
screenEl.addEventListener('touchend', endTouch, { capture: true, passive: false });
screenEl.addEventListener('touchcancel', (e) => { endPad(); endTouch(e); }, { capture: true, passive: false });
$('btn-zoom').addEventListener('click', () => { const r = screenEl.getBoundingClientRect(); applyZoom(1, r.left, r.top); });
$('btn-pad').addEventListener('click', () => setPad(!padMode));
$('btn-pad').classList.toggle('on', padMode);
screenEl.addEventListener('scroll', drawPtr);
window.addEventListener('resize', drawPtr);
new ResizeObserver(drawPtr).observe(zoomEl);

// --- keyboard + toolbar ------------------------------------------------------
const kbd = $('kbd');
const keysymFor = (ch) => {
  const cp = ch.codePointAt(0);
  return cp < 0x100 ? cp : 0x01000000 + cp;
};

function press(keysym) {
  if (!rfb) return;
  const mods = [...activeMods];
  for (const m of mods) rfb.sendKey(m, null, true);
  rfb.sendKey(keysym, null);
  for (const m of mods.reverse()) rfb.sendKey(m, null, false);
  activeMods.clear();
  document.querySelectorAll('[data-mod]').forEach((b) => b.classList.remove('on'));
}

$('btn-kbd').addEventListener('click', () => {
  if (document.activeElement === kbd) kbd.blur(); else kbd.focus();
});
document.querySelectorAll('[data-key]').forEach((b) =>
  b.addEventListener('click', () => press(Number(b.dataset.key))));
document.querySelectorAll('[data-mod]').forEach((b) =>
  b.addEventListener('click', () => {
    const sym = Number(b.dataset.mod);
    if (activeMods.delete(sym)) b.classList.remove('on'); else { activeMods.add(sym); b.classList.add('on'); }
  }));
// --- text box: type or paste a whole string and send it to the Mac ----------------
const textbar = $('textbar');
$('btn-text').addEventListener('click', () => {
  textbar.hidden = !textbar.hidden;
  $('btn-text').classList.toggle('on', !textbar.hidden);
  if (!textbar.hidden) $('txt').focus();
});
async function sendText(text, thenReturn) {
  if (!rfb) return;
  let n = 0;
  for (const ch of text) {
    if (!rfb) return;
    if (ch === '\n') rfb.sendKey(0xFF0D, null);
    else if (ch === '\t') rfb.sendKey(0xFF09, null);
    else if (ch !== '\r') rfb.sendKey(keysymFor(ch), null);
    if (++n % 20 === 0) await new Promise((r) => setTimeout(r, 10)); // do not flood the Mac
  }
  if (thenReturn && rfb) rfb.sendKey(0xFF0D, null);
}
textbar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = $('txt').value;
  if (!t) return;
  $('txt').value = '';
  await sendText(t, false);
});
$('txt-return').addEventListener('click', async () => {
  const t = $('txt').value;
  $('txt').value = '';
  await sendText(t, true);
});
$('btn-close').addEventListener('click', () => {
  if (confirm('Close this session and sign out?')) closeSession();
});

const NAMED = { Backspace: 0xFF08, Enter: 0xFF0D, Tab: 0xFF09, Escape: 0xFF1B, ArrowLeft: 0xFF51, ArrowUp: 0xFF52, ArrowRight: 0xFF53, ArrowDown: 0xFF54, Delete: 0xFFFF };
kbd.addEventListener('keydown', (e) => {
  const sym = NAMED[e.key];
  if (sym) { e.preventDefault(); press(sym); }
  else if (e.key.length === 1 && (e.ctrlKey || e.metaKey || e.altKey)) {
    // hardware-keyboard shortcuts: forward as modified keypresses
    e.preventDefault();
    if (e.ctrlKey) activeMods.add(0xFFE3);
    if (e.altKey) activeMods.add(0xFFE9);
    if (e.metaKey) activeMods.add(0xFFEB);
    press(keysymFor(e.key));
  }
});
kbd.addEventListener('beforeinput', (e) => {
  if (e.inputType === 'insertText' || e.inputType === 'insertFromPaste') {
    e.preventDefault();
    for (const ch of e.data ?? '') press(keysymFor(ch));
  }
});

// Keep the toolbar above the iOS soft keyboard.
if (window.visualViewport) {
  const fit = () => {
    const vv = window.visualViewport;
    const app = $('app');
    app.style.top = `${vv.offsetTop}px`;
    app.style.height = `${vv.height}px`;
  };
  window.visualViewport.addEventListener('resize', fit);
  window.visualViewport.addEventListener('scroll', fit);
}

// --- start -------------------------------------------------------------------
if (creds?.username && creds?.password) connect(); else showForm();
