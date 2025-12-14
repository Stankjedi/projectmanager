import { describe, it, expect } from 'vitest';

import {
  extractScoreTable,
  markdownToPreviewRows,
  buildPreviewHtml,
} from '../shareReportPreview.js';

describe('shareReportPreview', () => {
  describe('extractScoreTable', () => {
    it('extracts the score table and stops at the first non-table, non-empty line', () => {
      const markdown = [
        '| Category | Score |',
        '| --- | --- |',
        '| A | 1 |',
        '',
        'Not a table line',
        '| B | 2 |',
      ].join('\n');

      expect(extractScoreTable(markdown)).toBe(
        ['| Category | Score |', '| --- | --- |', '| A | 1 |'].join('\n')
      );
    });

    it('supports a Korean header row (\\uD56D\\uBAA9)', () => {
      const markdown = [
        `| \uD56D\uBAA9 | \uC810\uC218 |`,
        '| --- | --- |',
        '| A | 1 |',
        'Done.',
      ].join('\n');

      expect(extractScoreTable(markdown)).toBe(
        [`| \uD56D\uBAA9 | \uC810\uC218 |`, '| --- | --- |', '| A | 1 |'].join('\n')
      );
    });
  });

  describe('markdownToPreviewRows', () => {
    it('filters out markdown table separator rows (cells containing ---)', () => {
      const markdown = [
        '| Category | Score |',
        '| --- | --- |',
        '| A | 1 |',
      ].join('\n');

      const rows = markdownToPreviewRows(markdown);
      const trCount = (rows.match(/<tr>/g) ?? []).length;

      expect(trCount).toBe(2);
      expect(rows).not.toContain('---');
    });

    it('escapes HTML injection attempts in headings and table cells', () => {
      const markdown = [
        '# <script>alert(1)</script>',
        '',
        '| Category | Score |',
        '| --- | --- |',
        '| A | <script>alert(1)</script> |',
      ].join('\n');

      const rows = markdownToPreviewRows(markdown);

      expect(rows).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(rows).not.toContain('<script>');
    });
  });

  describe('buildPreviewHtml', () => {
    it('includes a strict CSP meta tag and does not allow script tags via content', () => {
      const markdown = '# <script>alert(1)</script>';
      const html = buildPreviewHtml(markdown, {
        bg: '#fff',
        fg: '#000',
        border: '#ccc',
        link: '#00f',
      });

      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });
  });
});

