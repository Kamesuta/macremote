import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const COOKIE_NAME = 'macremote';
// One year: the app stays signed in until you press Close in it.
export const SESSION_SECONDS = 365 * 24 * 3600;

export function loadSecret(dir = join(homedir(), '.macremote')) {
  const file = join(dir, 'secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const sha = (s) => createHash('sha256').update(s).digest();

export function passwordMatches(given, expected) {
  return timingSafeEqual(sha(String(given)), sha(String(expected)));
}

export function makeToken(secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const sig = createHmac('sha256', secret).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

export function tokenValid(secret, token, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!/^\d+$/.test(exp ?? '') || !sig) return false;
  if (Number(exp) < Math.floor(now / 1000)) return false;
  const want = createHmac('sha256', secret).update(exp).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, { secure }) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_SECONDS}`,
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function clearCookie({ secure }) {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

// Slows password guessing: after 5 failures from one address, lock it out for a minute.
export function makeLimiter({ max = 5, windowMs = 60_000 } = {}) {
  const fails = new Map();
  return {
    blocked(key, now = Date.now()) {
      const f = fails.get(key);
      return !!f && f.count >= max && now - f.last < windowMs;
    },
    fail(key, now = Date.now()) {
      const f = fails.get(key);
      const fresh = !f || now - f.last >= windowMs;
      fails.set(key, { count: fresh ? 1 : f.count + 1, last: now });
    },
    reset(key) { fails.delete(key); },
  };
}
