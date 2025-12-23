import { escapeHtml } from '../utils/htmlEscape.js';

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
