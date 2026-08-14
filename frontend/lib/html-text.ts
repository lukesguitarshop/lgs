/**
 * Shared listing-text helpers used by the marketplace bulk exports.
 */

/**
 * Converts a listing's stored HTML description to plain text, dropping the
 * trailing return-policy block so each marketplace can append its own.
 */
export function htmlToPlainText(html: string): string {
  const cleaned = html.replace(
    /(<b>|<strong>)*\s*Return Policy\s*:?\s*(<\/b>|<\/strong>)*[\s\S]*/i,
    '',
  );
  let text = cleaned;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<li>/gi, '- ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/?(ul|ol)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Strips Reverb CDN resize parameters so the original upload is served. */
export function getFullQualityUrl(url: string): string {
  if (url.includes('rvb-img.reverb.com')) {
    return url.replace(/\/[^/]*=[^/]*/g, '');
  }
  return url;
}
