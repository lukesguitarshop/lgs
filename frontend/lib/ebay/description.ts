import { RETURN_POLICY } from '../sweetwater/derive';

/**
 * Removes the stored return-policy block while leaving surrounding markup
 * intact. eBay renders HTML descriptions, so unlike the Facebook and Sweetwater
 * exports the tags are worth keeping.
 */
export function stripReturnPolicyHtml(html: string): string {
  return html
    .replace(/(<b>|<strong>)*\s*Return Policy\s*:?\s*(<\/b>|<\/strong>)*[\s\S]*/i, '')
    .trim();
}

/** The shop return policy rendered as HTML paragraphs. */
export function returnPolicyHtml(): string {
  return RETURN_POLICY.split('\n\n')
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
