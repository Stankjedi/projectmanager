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

