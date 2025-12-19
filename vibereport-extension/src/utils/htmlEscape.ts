/**
 * Escape a string for safe HTML insertion.
 *
 * Escapes: & < > " '
 * (Escapes & first to avoid double-escaping.)
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a string for safe insertion into an HTML attribute value.
 *
 * In addition to the basic HTML escapes, this escapes newlines to avoid
 * accidental attribute/value breaking in generated HTML.
 */
export function escapeHtmlAttribute(input: string): string {
  return escapeHtml(input).replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
}
