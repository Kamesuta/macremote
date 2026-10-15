import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from './url.ts';

test('adds https and strips paths', () => {
  assert.equal(normalizeServerUrl('my-mac.tail1234.ts.net'), 'https://my-mac.tail1234.ts.net');
  assert.equal(normalizeServerUrl('  https://my-mac.tail1234.ts.net/login.html?x=1 '), 'https://my-mac.tail1234.ts.net');
});
test('rejects plain http, empty and nonsense', () => {
  assert.equal(normalizeServerUrl('http://my-mac.tail1234.ts.net'), null);
  assert.equal(normalizeServerUrl(''), null);
  assert.equal(normalizeServerUrl('localhost'), null);
  assert.equal(normalizeServerUrl('not a url'), null);
});

import { isSameOrigin } from './url.ts';

test('isSameOrigin matches the exact origin only', () => {
  const s = 'https://my-mac.tail1234.ts.net';
  assert.equal(isSameOrigin(s, s), true);
  assert.equal(isSameOrigin(`${s}/`, s), true);
  assert.equal(isSameOrigin(`${s}/login.html?error=1`, s), true);
  assert.equal(isSameOrigin('about:blank', s), true);
  assert.equal(isSameOrigin('https://my-mac.tail1234.ts.net.evil.com/', s), false);
  assert.equal(isSameOrigin('http://my-mac.tail1234.ts.net/', s), false);
  assert.equal(isSameOrigin('https://other.ts.net/', s), false);
});
