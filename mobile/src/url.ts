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
