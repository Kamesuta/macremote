import RFB from '/vendor/novnc/core/rfb.js';

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

  rfb.addEventListener('connect', () => {
    connected = true;
    retries = 0;
    status('');
    acquireWakeLock();
  });
  rfb.addEventListener('credentialsrequired', () => {
    // The saved credentials were missing fields; ask again.
    authFailed = true;
    showForm('Enter your Mac username and password.');
  });
  rfb.addEventListener('securityfailure', () => {
    authFailed = true;
    forgetCreds();
    showForm('The Mac rejected that username or password.');
  });
  rfb.addEventListener('disconnect', () => {
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

// --- pinch to zoom, two-finger pan ---------------------------------------------
// The viewer is scaled to fit #zoom, so zooming just makes #zoom bigger than #screen and
// scrolls it. Pointer maths stay correct because nothing is CSS-transformed.
const MAX_ZOOM = 5;
let zoom = 1;
const screenEl = $('screen');
const zoomEl = $('zoom');
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
}
let pinch = null;
const midpoint = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
// Capture phase, so two-finger gestures never reach noVNC's own touch handling.
screenEl.addEventListener('touchstart', (e) => {
  if (e.touches.length >= 2) {
    const m = midpoint(e.touches);
    pinch = { dist: spread(e.touches), zoom, x: m.x, y: m.y };
    e.preventDefault(); e.stopPropagation();
  }
}, { capture: true, passive: false });
screenEl.addEventListener('touchmove', (e) => {
  if (!pinch) return;
  e.preventDefault(); e.stopPropagation();
  if (e.touches.length < 2) return;
  const m = midpoint(e.touches);
  screenEl.scrollLeft -= m.x - pinch.x;
  screenEl.scrollTop -= m.y - pinch.y;
  pinch.x = m.x; pinch.y = m.y;
  applyZoom(pinch.zoom * (spread(e.touches) / pinch.dist), m.x, m.y);
}, { capture: true, passive: false });
function endPinch(e) {
  if (!pinch) return;
  e.preventDefault(); e.stopPropagation();
  if (e.touches.length === 0) pinch = null;
}
screenEl.addEventListener('touchend', endPinch, { capture: true, passive: false });
screenEl.addEventListener('touchcancel', endPinch, { capture: true, passive: false });
$('btn-zoom').addEventListener('click', () => { const r = screenEl.getBoundingClientRect(); applyZoom(1, r.left, r.top); });

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
