import { describe, it, expect, vi } from 'vitest';

const mockConfigGet = vi.fn();
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (...args: any[]) => mockConfigGet(...args),
    }),
  },
}));

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

    it('renders headings as block elements outside of any table', () => {
      const markdown = [
        '# Title',
        '',
        '| Category | Score |',
        '| --- | --- |',
        '| A | 1 |',
      ].join('\n');

      const html = buildPreviewHtml(markdown, {
        bg: '#fff',
        fg: '#000',
        border: '#ccc',
        link: '#00f',
      });

      expect(html).toContain('<h1>Title</h1>');

      const tableStart = html.indexOf('<table>');
      const tableEnd = html.indexOf('</table>');
      const tableBlock =
        tableStart >= 0 && tableEnd >= 0
          ? html.slice(tableStart, tableEnd + '</table>'.length)
          : '';
      expect(tableBlock).toContain('<tr>');
      expect(tableBlock).not.toContain('<h1>');

      expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('<table>'));
    });
  });

  describe('ShareReportCommand redaction', () => {
    it('redacts sensitive content when enabled', async () => {
      mockConfigGet.mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'sharePreviewRedactionEnabled') return true;
        return defaultValue;
      });

      const evalContent = [
        '<!-- TLDR-START -->',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **Session** | session_abc123_def456 |',
        '| **Path** | /Users/alice/secrets.txt |',
        '| **Link** | [src/file.ts](command:vibereport.openFunctionInFile?%5B%22%2Fabs%2Fpath%2Fsrc%2Ffile.ts%22%5D) |',
        '<!-- TLDR-END -->',
        '',
        '<!-- AUTO-SCORE-START -->',
        '| 항목 | 점수 |',
        '| --- | --- |',
        '| 코드 품질 | 90 |',
        '',
        '### 점수-등급 기준표',
      ].join('\n');

      const { ShareReportCommand } = await import('../shareReport.js');
      const command = new ShareReportCommand({ appendLine: vi.fn() } as any);

      const preview = (command as any).generatePreviewReport(evalContent, '/workspace/demo', 'devplan/Project_Evaluation_Report.md');

      expect(preview).toContain('[REDACTED_PATH]');
      expect(preview).toContain('session_[REDACTED]');
      expect(preview).not.toContain('command:');
    });

    it('does not change output when disabled', async () => {
      mockConfigGet.mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'sharePreviewRedactionEnabled') return false;
        return defaultValue;
      });

      const evalContent = [
        '<!-- TLDR-START -->',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **Session** | session_abc123_def456 |',
        '| **Path** | /Users/alice/secrets.txt |',
        '| **Link** | [src/file.ts](command:vibereport.openFunctionInFile?%5B%22%2Fabs%2Fpath%2Fsrc%2Ffile.ts%22%5D) |',
        '<!-- TLDR-END -->',
        '',
        '<!-- AUTO-SCORE-START -->',
        '| 항목 | 점수 |',
        '| --- | --- |',
        '| 코드 품질 | 90 |',
        '',
        '### 점수-등급 기준표',
      ].join('\n');

      const { ShareReportCommand } = await import('../shareReport.js');
      const command = new ShareReportCommand({ appendLine: vi.fn() } as any);

      const preview = (command as any).generatePreviewReport(evalContent, '/workspace/demo', 'devplan/Project_Evaluation_Report.md');

      expect(preview).toContain('/Users/alice/secrets.txt');
      expect(preview).toContain('command:vibereport.openFunctionInFile');
      expect(preview).toContain('session_abc123_def456');
      expect(preview).not.toContain('[REDACTED_PATH]');
    });
  });
});
