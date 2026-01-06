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
        '<!-- AUTO-SCORE-END -->',
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
        '<!-- AUTO-SCORE-END -->',
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

  describe('ShareReportCommand localization', () => {
    it('renders an English preview when language is en', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));

      mockConfigGet.mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'sharePreviewRedactionEnabled') return false;
        if (key === 'language') return 'en';
        return defaultValue;
      });

      const evalContent = [
        '<!-- AUTO-TLDR-START -->',
        '| Item | Value |',
        '|------|------|',
        '| **Current Version** | 0.4.28 |',
        '| **Top Risk** | Regression tests missing |',
        '<!-- AUTO-TLDR-END -->',
        '',
        '<!-- AUTO-SCORE-START -->',
        '| Category | Score | Grade | Change |',
        '| --- | --- | --- | --- |',
        '| Code Quality | 90 | 🟢 A- | - |',
        '| **Total Average** | **83** | 🔵 B | - |',
        '<!-- AUTO-SCORE-END -->',
      ].join('\n');

      const { ShareReportCommand } = await import('../shareReport.js');
      const command = new ShareReportCommand({ appendLine: vi.fn() } as any);

      const preview = (command as any).generatePreviewReport(
        evalContent,
        '/workspace/demo',
        'devplan/Project_Evaluation_Report.md'
      );

      expect(preview).toContain('Summary (TL;DR)');
      expect(preview).toContain('Generated on');
      expect(preview).toContain('Overall score');
      expect(preview).toContain('> 📦 Version: 0.4.28');
      expect(preview).toContain('> 🏆 Overall score: **83 (🔵 B)**');
      expect(preview).not.toContain('점');
      expect(preview).not.toMatch(/[가-힣]/);

      vi.useRealTimers();
    });

    it('renders a Korean preview when language is ko', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));

      mockConfigGet.mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'sharePreviewRedactionEnabled') return false;
        if (key === 'language') return 'ko';
        return defaultValue;
      });

      const evalContent = [
        '<!-- AUTO-TLDR-START -->',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **현재 버전** | 0.4.28 |',
        '| **최대 리스크** | 회귀 테스트 부족 |',
        '<!-- AUTO-TLDR-END -->',
        '',
        '<!-- AUTO-SCORE-START -->',
        '| 항목 | 점수 | 등급 | 변화 |',
        '| --- | --- | --- | --- |',
        '| 코드 품질 | 90 | 🟢 A- | - |',
        '| **총점 평균** | **83** | 🔵 B | - |',
        '<!-- AUTO-SCORE-END -->',
      ].join('\n');

      const { ShareReportCommand } = await import('../shareReport.js');
      const command = new ShareReportCommand({ appendLine: vi.fn() } as any);

      const preview = (command as any).generatePreviewReport(
        evalContent,
        '/workspace/demo',
        'devplan/Project_Evaluation_Report.md'
      );

      expect(preview).toContain('요약 (TL;DR)');
      expect(preview).toContain('생성일');
      expect(preview).toContain('종합 점수');
      expect(preview).toContain('> 📦 버전: 0.4.28');
      expect(preview).toContain('> 🏆 종합 점수: **83점 (🔵 B)**');
      expect(preview).toContain('점');
      expect(preview).toMatch(/[가-힣]/);

      vi.useRealTimers();
    });

    it('prefers marker-extracted metadata over unrelated occurrences elsewhere in the markdown', async () => {
      mockConfigGet.mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'sharePreviewRedactionEnabled') return false;
        if (key === 'language') return 'en';
        return defaultValue;
      });

      const evalContent = [
        '# Heading that changes often',
        '',
        '**Current Version** | 9.9.9 |',
        '**Total Average** | **99** | 🟢 A+ |',
        '',
        '<!-- AUTO-TLDR-START -->',
        '| Item | Value |',
        '|------|------|',
        '| **Current Version** | 0.4.28 |',
        '<!-- AUTO-TLDR-END -->',
        '',
        '<!-- AUTO-SCORE-START -->',
        '| Category | Score | Grade | Change |',
        '| --- | --- | --- | --- |',
        '| **Total Average** | **83** | 🔵 B | - |',
        '<!-- AUTO-SCORE-END -->',
      ].join('\n');

      const { ShareReportCommand } = await import('../shareReport.js');
      const command = new ShareReportCommand({ appendLine: vi.fn() } as any);

      const preview = (command as any).generatePreviewReport(
        evalContent,
        '/workspace/demo',
        'devplan/Project_Evaluation_Report.md'
      );

      expect(preview).toContain('> 📦 Version: 0.4.28');
      expect(preview).toContain('> 🏆 Overall score: **83 (🔵 B)**');
      expect(preview).not.toContain('Version: 9.9.9');
      expect(preview).not.toContain('**99 (🟢 A+)**');
    });
  });
});
