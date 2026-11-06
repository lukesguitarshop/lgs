// Android app for each marketplace whose links should open in its app.
const ANDROID_APPS: Record<string, string> = {
  'reverb.com': 'com.reverb.app',
  'sweetwater.com': 'com.sweetwater.sweetwater',
};

/**
 * Link that opens in the marketplace's app when it's installed.
 *
 * Some Android browsers (Opera) load app links as ordinary web pages, so on
 * Android the link becomes an intent: URL naming the app's package, which
 * opens the app directly and falls back to the web page when the app is
 * missing or doesn't handle that page. On iPhone the https link already opens
 * the app from Safari (universal links), so it's left as it is, as are links
 * to other sites.
 */
export function appLink(url: string): string;
export function appLink(url: string | null | undefined): string | undefined;
export function appLink(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  const pkg = ANDROID_APPS[host];
  if (!pkg || parsed.protocol !== 'https:') return url;
  return (
    `intent://${parsed.host}${parsed.pathname}${parsed.search}` +
    `#Intent;scheme=https;package=${pkg};` +
    `S.browser_fallback_url=${encodeURIComponent(url)};end`
  );
}
