import { escapeHtml } from '../utils/htmlEscape.js';
import { extractBetweenMarkersLines } from '../utils/markerUtils.js';
import * as path from 'path';

export function extractScoreTable(markdown: string): string {
  const lines = markdown.split('\n');
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith('| 항목') || line.trim().startsWith('| Category')) {
      inTable = true;
    }
    if (inTable && line.trim().startsWith('|')) {
      tableLines.push(line);
    }
    if (inTable && !line.trim().startsWith('|') && line.trim() !== '') {
      break;
    }
  }

  return tableLines.join('\n');
}

function cleanMarkdownTable(content: string): string {
  return content
    .trim()
    .split('\n')
    .filter(line => line.trim().startsWith('|'))
    .join('\n');
}

function resolveLanguage(value: unknown): 'ko' | 'en' {
  return value === 'en' ? 'en' : 'ko';
}

function stripMarkdownDecorations(value: string): string {
  return value.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function parseMarkdownTableRows(tableMarkdown: string): string[][] {
  const rows: string[][] = [];
  const lines = tableMarkdown.split('\n');

  const isSeparatorRow = (cells: string[]): boolean => {
    if (cells.length === 0) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith('|')) continue;

    const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
    const cells = withoutEdges.split('|').map((cell) => cell.trim());

    if (isSeparatorRow(cells)) continue;
    if (cells.length === 0) continue;

    rows.push(cells);
  }

  return rows;
}

function extractVersionFromTldrTable(tldrTable: string): string | null {
  if (!tldrTable) return null;

  for (const row of parseMarkdownTableRows(tldrTable)) {
    if (row.length < 2) continue;

    const label = stripMarkdownDecorations(row[0] ?? '').toLowerCase();
    if (!label) continue;

    if (label.includes('현재 버전') || label.includes('current version') || label === '버전' || label === 'version') {
      const value = stripMarkdownDecorations(row[1] ?? '');
      return value || null;
    }
  }

  return null;
}

function extractOverallScoreFromScoreTable(scoreTable: string): { score: string; grade: string } | null {
  if (!scoreTable) return null;

  for (const row of parseMarkdownTableRows(scoreTable)) {
    if (row.length < 3) continue;

    const label = stripMarkdownDecorations(row[0] ?? '').toLowerCase();
    if (!label) continue;

    const isTotalAverage =
      label.includes('총점 평균') ||
      label.includes('전체 평균') ||
      label.includes('total average') ||
      label.includes('overall average');

    if (!isTotalAverage) continue;

    const scoreCell = stripMarkdownDecorations(row[1] ?? '');
    const scoreMatch = scoreCell.match(/(\d+)/);
    const score = scoreMatch?.[1] ?? '';

    const grade = stripMarkdownDecorations(row[2] ?? '');

    if (!score) return null;

    return {
      score,
      grade: grade || '-',
    };
  }

  return null;
}

function getPreviewStrings(language: 'ko' | 'en'): {
  titleSuffix: string;
  generatedAtLabel: string;
  versionLabel: string;
  totalScoreLabel: string;
  tldrHeading: string;
  scoreHeading: string;
  detailsHeading: string;
  footerLine1: string;
  footerLine2Prefix: string;
} {
  if (language === 'en') {
    return {
      titleSuffix: 'Project Evaluation Report',
      generatedAtLabel: 'Generated on',
      versionLabel: 'Version',
      totalScoreLabel: 'Overall score',
      tldrHeading: 'Summary (TL;DR)',
      scoreHeading: 'Detailed Scores',
      detailsHeading: 'More Details',
      footerLine1:
        'This report was generated automatically by the Vibe Coding Report VS Code extension.',
      footerLine2Prefix: 'You can find the full report at',
    };
  }

  return {
    titleSuffix: '프로젝트 평가 보고서',
    generatedAtLabel: '생성일',
    versionLabel: '버전',
    totalScoreLabel: '종합 점수',
    tldrHeading: '요약 (TL;DR)',
    scoreHeading: '상세 점수',
    detailsHeading: '상세 정보',
    footerLine1:
      '이 보고서는 [Vibe Coding Report](https://marketplace.visualstudio.com/items?itemName=stankjedi.vibereport) VS Code 확장으로 자동 생성되었습니다.',
    footerLine2Prefix: '전체 보고서는 프로젝트의',
  };
}

export function buildSharePreviewMarkdown(args: {
  evalContent: string;
  workspaceRootPath: string;
  reportRelativePath: string;
  language?: 'ko' | 'en';
}): string {
  const language = resolveLanguage(args.language);
  const strings = getPreviewStrings(language);
  const projectName = path.basename(args.workspaceRootPath);

  const locale = language === 'en' ? 'en-US' : 'ko-KR';
  const now = new Date().toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tldrSection =
    extractBetweenMarkersLines(
      args.evalContent,
      '<!-- AUTO-TLDR-START -->',
      '<!-- AUTO-TLDR-END -->'
    ) ??
    extractBetweenMarkersLines(args.evalContent, '<!-- TLDR-START -->', '<!-- TLDR-END -->') ??
    '';
  const tldr = tldrSection ? cleanMarkdownTable(tldrSection) : '';

  const scoreSection =
    extractBetweenMarkersLines(
      args.evalContent,
      '<!-- AUTO-SCORE-START -->',
      '<!-- AUTO-SCORE-END -->'
    ) ?? '';
  const scoreTable = scoreSection ? extractScoreTable(scoreSection) : '';

  const versionFromTldr = extractVersionFromTldrTable(tldr);
  const versionMatchKo = args.evalContent.match(/\*\*현재 버전\*\*\s*\|\s*([^\|]+)/);
  const versionMatchEn = args.evalContent.match(/\*\*Current Version\*\*\s*\|\s*([^\|]+)/);
  const version = versionFromTldr ?? (versionMatchKo ?? versionMatchEn)?.[1]?.trim() ?? '-';

  const overallFromScoreTable = extractOverallScoreFromScoreTable(scoreTable);

  const totalScoreMatchKo = args.evalContent.match(/\*\*총점 평균\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*([^\|]+)/);
  const totalScoreMatchEn = args.evalContent.match(/\*\*Total Average\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*([^\|]+)/);
  const totalScoreMatch = totalScoreMatchKo ?? totalScoreMatchEn;

  const totalScore = overallFromScoreTable?.score ?? totalScoreMatch?.[1] ?? '-';
  const totalGrade = overallFromScoreTable?.grade ?? totalScoreMatch?.[2]?.trim() ?? '-';

  const totalScoreLine =
    language === 'en' ? `**${totalScore} (${totalGrade})**` : `**${totalScore}점 (${totalGrade})**`;

  const footerLine2 =
    language === 'en'
      ? `${strings.footerLine2Prefix} \`${args.reportRelativePath}\`.`
      : `${strings.footerLine2Prefix} \`${args.reportRelativePath}\` 파일에서 확인 할 수 있습니다.`;

  return `# 📊 ${projectName} ${strings.titleSuffix}

> 🗓️ ${strings.generatedAtLabel}: ${now}
> 📦 ${strings.versionLabel}: ${version}
> 🏆 ${strings.totalScoreLabel}: ${totalScoreLine}

---

## 📝 ${strings.tldrHeading}

${tldr}

---

## 📊 ${strings.scoreHeading}

${scoreTable}

---

## 🔗 ${strings.detailsHeading}

${strings.footerLine1}

${footerLine2}
`;
}

export function markdownToPreviewRows(markdown: string): string {
  const renderInline = (text: string): string => {
    const escaped = escapeHtml(text);
    return escaped.replace(/\*\*(.+?)\*\*/g, (_full, inner: string) => `<strong>${inner}</strong>`);
  };

  const isTableSeparatorRow = (cells: string[]): boolean => {
    if (cells.length === 0) return false;
    return cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
  };

  const renderTable = (tableLines: string[]): string => {
    const rows: string[] = [];
    for (const line of tableLines) {
      const cells = line
        .trim()
        .split('|')
        .map(c => c.trim())
        .filter(Boolean);

      if (isTableSeparatorRow(cells)) {
        continue;
      }

      const cellHtml = cells.map(c => `<td>${renderInline(c)}</td>`).join('');
      rows.push(`<tr>${cellHtml}</tr>`);
    }

    return `<table>${rows.join('')}</table>`;
  };

  const blocks: string[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      blocks.push('<hr>');
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      blocks.push(`<blockquote>${renderInline(trimmed.slice(2))}</blockquote>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        tableLines.push(lines[i] ?? '');
        i += 1;
      }

      blocks.push(renderTable(tableLines));
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? '';
      const currentTrimmed = current.trim();
      if (!currentTrimmed) break;
      if (currentTrimmed === '---') break;
      if (currentTrimmed.startsWith('# ') || currentTrimmed.startsWith('## ') || currentTrimmed.startsWith('> ')) break;
      if (currentTrimmed.startsWith('|')) break;

      paragraphLines.push(currentTrimmed);
      i += 1;
    }

    blocks.push(`<p>${paragraphLines.map(renderInline).join('<br>')}</p>`);
  }

  return blocks.join('\n');
}

export function buildPreviewHtml(
  markdown: string,
  style: { bg: string; fg: string; border: string; link: string }
): string {
  const rows = markdownToPreviewRows(markdown);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      color: ${style.fg};
      background: ${style.bg};
    }
    h1 { border-bottom: 2px solid ${style.link}; padding-bottom: 10px; }
    h2 { color: ${style.link}; margin-top: 30px; }
    blockquote {
      border-left: 4px solid ${style.link};
      padding-left: 15px;
      margin: 10px 0;
      opacity: 0.8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    td, th {
      border: 1px solid ${style.border};
      padding: 8px 12px;
      text-align: left;
    }
    tr:nth-child(even) { opacity: 0.9; }
    hr { border: none; border-top: 1px solid ${style.border}; margin: 20px 0; }
    strong { color: ${style.link}; }
</style>
</head>
<body>
  ${rows}
</body>
</html>`;
}
