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
  return markdown
    .replace(/^# (.+)$/gm, (_, text: string) => `<h1>${escapeHtml(text)}</h1>`)
    .replace(/^## (.+)$/gm, (_, text: string) => `<h2>${escapeHtml(text)}</h2>`)
    .replace(
      /^> (.+)$/gm,
      (_, text: string) => `<blockquote>${escapeHtml(text)}</blockquote>`
    )
    .replace(/\*\*(.+?)\*\*/g, (_, text: string) => `<strong>${escapeHtml(text)}</strong>`)
    .replace(/\n---\n/g, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.includes('---'))) {
        return '';
      }

      const cellHtml = cells
        .map(c => `<td>${escapeHtml(c.trim())}</td>`)
        .join('');
      return `<tr>${cellHtml}</tr>`;
    });
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
  <table>${rows}</table>
</body>
</html>`;
}
