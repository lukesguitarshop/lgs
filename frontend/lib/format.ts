/**
 * Flatten a stored listing description to plain text for the card blurb.
 *
 * Descriptions are authored as HTML — paragraphs, spec lists, the occasional emoji
 * heading — which reads as raw markup when dropped into a two-line clamp. Block tags
 * become spaces so sentences don't run together, and the handful of entities the
 * editor emits are decoded.
 *
 * Display only: the result goes into a text node, which React escapes.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole-dollar price formatting, shared by the listing grid and the sold strip. */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
