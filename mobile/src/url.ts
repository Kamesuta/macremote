// The server must be reached over HTTPS (iOS and Android both refuse plain http by default).
export function normalizeServerUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// True when `url` is on exactly the same https origin as `server` (a prefix check would let
// https://my-mac.ts.net.evil.com through). Plain regex: React Native's URL has no `origin`.
export function isSameOrigin(url: string, server: string): boolean {
  if (url === 'about:blank') return true;
  const origin = /^https:\/\/[^/?#]+/i.exec(url)?.[0];
  return !!origin && origin.toLowerCase() === server.toLowerCase();
}
