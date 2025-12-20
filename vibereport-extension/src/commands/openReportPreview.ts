/**
 * Open Report Preview Command
 *
 * @description 현재 열린 마크다운 보고서를 Mermaid 다이어그램 지원 Webview로 렌더링합니다.
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../utils/htmlEscape.js';
import { getPreviewStyle } from '../utils/previewStyle.js';

export class OpenReportPreviewCommand {
  private outputChannel: vscode.OutputChannel;
  private extensionUri: vscode.Uri | undefined;

  constructor(outputChannel: vscode.OutputChannel, extensionUri?: vscode.Uri) {
    this.outputChannel = outputChannel;
    this.extensionUri = extensionUri;
  }

  setExtensionUri(uri: vscode.Uri): void {
    this.extensionUri = uri;
  }

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showErrorMessage('열린 파일이 없습니다.');
      return;
    }

    const document = editor.document;

    if (document.languageId !== 'markdown') {
      vscode.window.showErrorMessage('마크다운 파일만 미리보기할 수 있습니다.');
      return;
    }

    try {
      const content = document.getText();
      const fileName = document.fileName.split(/[\\/]/).pop() || 'Report Preview';

      // 설정에 따른 ViewColumn 결정
      const config = vscode.workspace.getConfiguration('vibereport');
      const reportOpenMode = config.get<string>('reportOpenMode', 'previewOnly');

      const viewColumn = reportOpenMode === 'both'
        ? vscode.ViewColumn.Beside
        : vscode.ViewColumn.Active;

      this.showPreviewPanel(content, fileName, viewColumn);
      this.log(`보고서 미리보기 열림: ${fileName} (Mode: ${reportOpenMode})`);
    } catch (error) {
      vscode.window.showErrorMessage(`보고서를 열 수 없습니다: ${error}`);
      this.log(`오류: ${error}`);
    }
  }

  /**
   * Webview 패널 생성 및 표시
   */
  private showPreviewPanel(markdown: string, title: string, viewColumn: vscode.ViewColumn): void {
    const panel = vscode.window.createWebviewPanel(
      'vibeReportFullPreview',
      `📊 ${title}`,
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: this.extensionUri ? [
          vscode.Uri.joinPath(this.extensionUri, 'media')
        ] : []
      }
    );

    // Get URI for local mermaid.min.js
    let mermaidScriptUri = '';
    if (this.extensionUri && panel.webview.asWebviewUri) {
      const mermaidPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'mermaid.min.js');
      mermaidScriptUri = panel.webview.asWebviewUri(mermaidPath).toString();
    }

    panel.webview.html = this.buildFullPreviewHtml(markdown, mermaidScriptUri, panel.webview);
  }



  /**
   * Sanitize link href (allowlist only)
   */
  private sanitizeHref(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Reject characters that could break out of an attribute context (defense-in-depth).
    if (/[\"'<>]/.test(trimmed)) return null;
    // Reject control chars (including newlines) to avoid odd parsing/obfuscation.
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;

    const lower = trimmed.toLowerCase();

    if (lower.startsWith('#')) return trimmed;
    if (lower.startsWith('http:') || lower.startsWith('https:')) return trimmed;
    if (lower.startsWith('command:vibereport.')) return trimmed;

    return null;
  }

  /**
   * Mermaid code escaping (keep <br/> for labels, escape everything else)
   */
  private escapeHtmlForMermaid(text: string): string {
    const placeholder = '__VIBE_BR__';
    const preserved = text.replace(/<br\s*\/?>/gi, placeholder);
    return escapeHtml(preserved).split(placeholder).join('<br/>');
  }

  /**
   * 마크다운을 HTML로 변환 (테이블 및 코드블록 완전 지원)
   */
  private markdownToHtml(markdown: string): string {
    let content = markdown; // Initialize content

    // 0. HTML 주석 마커 제거 (<!-- ... --> 형식의 마커들이 프리뷰에 표시되지 않도록)
    content = content.replace(/<!--[\s\S]*?-->/g, '');

    // 1. Mermaid 블록 보호 (플레이스홀더로 변환)
    const mermaidBlocks: string[] = [];
    content = content.replace(/```mermaid\s*([\s\S]*?)```/g, (_, code: string) => {
      const index = mermaidBlocks.length;
      mermaidBlocks.push(code); // 코드를 그대로 저장 (이스케이프 등은 나중에)
      return `__MERMAID_BLOCK_${index}__`;
    });

    // 2. 코드 블록 보호 (``` 블록을 플레이스홀더로 변환)
    const codeBlocks: string[] = [];
    content = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang: string, code: string) => {
      const index = codeBlocks.length;
      const escapedCode = escapeHtml(code);
      codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${escapedCode}</code></pre>`);
      return `__CODE_BLOCK_${index}__`;
    });

    // 줄 단위로 처리
    const lines = content.split('\n');
    const result: string[] = [];
    let tableBuffer: string[] = [];

    const flushTable = () => {
      if (tableBuffer.length === 0) return;

      let tableHtml = '<table>';
      let inBody = false;

      for (let i = 0; i < tableBuffer.length; i++) {
        const row = tableBuffer[i];

        // 구분선 행 스킵 (|---|---|)
        if (/^\|[\s:-]+\|$/.test(row.replace(/[^|:-\s]/g, ''))) {
          continue;
        }

        const cells = row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map(c => c.trim());

        if (i === 0) {
          // 첫 번째 행은 헤더
          tableHtml += '<thead><tr>';
          cells.forEach(cell => {
            tableHtml += `<th>${this.processInlineMarkdown(cell)}</th>`;
          });
          tableHtml += '</tr></thead>';
        } else {
          if (!inBody) {
            tableHtml += '<tbody>';
            inBody = true;
          }
          tableHtml += '<tr>';
          cells.forEach(cell => {
            tableHtml += `<td>${this.processInlineMarkdown(cell)}</td>`;
          });
          tableHtml += '</tr>';
        }
      }

      if (inBody) {
        tableHtml += '</tbody>';
      }
      tableHtml += '</table>';

      result.push(tableHtml);
      tableBuffer = [];
    };

    for (const line of lines) {
      // 테이블 행 감지
      if (/^\|.+\|$/.test(line.trim())) {
        tableBuffer.push(line.trim());
        continue;
      }

      // 테이블이 끝났으면 플러시
      if (tableBuffer.length > 0) {
        flushTable();
      }

      // 일반 라인 처리
      let processedLine = line;

      // 헤더
      if (/^#{1,6}\s/.test(processedLine)) {
        const match = processedLine.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
          const level = match[1].length;
          processedLine = `<h${level}>${this.processInlineMarkdown(match[2])}</h${level}>`;
        }
      }
      // 인용문
      else if (/^>\s/.test(processedLine)) {
        processedLine = `<blockquote>${this.processInlineMarkdown(processedLine.slice(2))}</blockquote>`;
      }
      // 수평선
      else if (/^---+$/.test(processedLine.trim())) {
        processedLine = '<hr>';
      }
      // 코드 블록 플레이스홀더 복원
      else if (/__CODE_BLOCK_\d+__/.test(processedLine)) {
        const blockMatch = processedLine.match(/__CODE_BLOCK_(\d+)__/);
        if (blockMatch) {
          processedLine = codeBlocks[parseInt(blockMatch[1], 10)];
        }
      }
      // Mermaid 블록 플레이스홀더 복원
      else if (/__MERMAID_BLOCK_\d+__/.test(processedLine)) {
        const blockMatch = processedLine.match(/__MERMAID_BLOCK_(\d+)__/);
        if (blockMatch) {
          const code = mermaidBlocks[parseInt(blockMatch[1], 10)];
          processedLine = `<div class="mermaid">${this.escapeHtmlForMermaid(code)}</div>`;
        }
      }
      // 일반 텍스트 및 리스트 아이템 처리
      else if (processedLine.trim()) {
        const trimmed = processedLine.trim();

        // 리스트 아이템 감지 (- 로 시작)
        if (trimmed.startsWith('- ')) {
          // 표준 리스트 스타일 적용 (bold 처리 등은 processInlineMarkdown에서 수행)
          // 전체 라인을 파란색으로 칠하는 .list-item-key 클래스 제거
          processedLine = `<p class="list-item">${this.processInlineMarkdown(processedLine)}</p>`;
        }
        // 일반 문단
        else {
          processedLine = `<p>${this.processInlineMarkdown(processedLine)}</p>`;
        }
      }
      // 빈 줄
      else {
        processedLine = '';
      }

      result.push(processedLine);
    }

    // 마지막 테이블 플러시
    if (tableBuffer.length > 0) {
      flushTable();
    }

    return result.join('\n');
  }

  /**
   * 인라인 마크다운 처리 (볼드, 이탤릭, 코드, 링크)
   */
  private processInlineMarkdown(text: string): string {
    const tokens: Array<{ placeholder: string; html: string }> = [];

    const pushToken = (kind: string, html: string): string => {
      const placeholder = `__VIBE_${kind}_${tokens.length}__`;
      tokens.push({ placeholder, html });
      return placeholder;
    };

    let working = text;

    // Inline code first: treat as literal text (no further inline parsing inside <code>).
    working = working.replace(/`([^`]+)`/g, (_m, code: string) => {
      const safeCode = escapeHtml(code);
      return pushToken('INLINE_CODE', `<code>${safeCode}</code>`);
    });

    // Links next: sanitize href; escape label and href to prevent HTML injection.
    working = working.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_m, label: string, href: string) => {
        const safeHref = this.sanitizeHref(href);
        if (!safeHref) return label;

        const safeLabelHtml = this.renderLinkLabel(escapeHtml(label));
        const relAttr = /^https?:/i.test(safeHref) ? ' rel="noopener noreferrer"' : '';
        const escapedHref = escapeHtml(safeHref);

        return pushToken(
          'LINK',
          `<a href="${escapedHref}"${relAttr}>${safeLabelHtml}</a>`
        );
      }
    );

    // Escape remaining text before turning inline markdown markers into HTML.
    working = escapeHtml(working)
      // 볼드
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 이탤릭
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Restore tokens (reverse order so nested placeholders resolve correctly).
    for (let i = tokens.length - 1; i >= 0; i--) {
      const { placeholder, html } = tokens[i];
      working = working.split(placeholder).join(html);
    }

    return working;
  }

  /**
   * Link label rendering: escape text and allow basic emphasis/code formatting.
   * (No links inside labels.)
   */
  private renderLinkLabel(escapedLabel: string): string {
    return escapedLabel
      // 볼드
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 이탤릭
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  /**
   * 전체 프리뷰 HTML 생성 (로컬 Mermaid.js 포함)
   */
  private buildFullPreviewHtml(markdown: string, mermaidScriptUri: string, webview: vscode.Webview): string {
    const config =
      vscode.workspace.getConfiguration?.('vibereport') ??
      ({ get: (_key: string, defaultValue: unknown) => defaultValue } as vscode.WorkspaceConfiguration);
    const style = getPreviewStyle(config);
    const previewBackgroundColor = config.get<string>('previewBackgroundColor', 'ide');

    // Deterministic mapping: check VS Code's active color theme for 'ide' mode
    let mermaidTheme: string;
    if (previewBackgroundColor === 'black') {
      mermaidTheme = 'dark';
    } else if (previewBackgroundColor === 'white') {
      mermaidTheme = 'default';
    } else {
      // 'ide' mode - detect from VS Code's active color theme
      const colorTheme = vscode.window.activeColorTheme;
      // VS Code ColorThemeKind enum values: Light=1, Dark=2, HighContrast=3, HighContrastLight=4.
      // Avoid accessing vscode.ColorThemeKind directly so tests can mock vscode without defining the enum.
      const colorThemeKind = typeof colorTheme?.kind === 'number' ? colorTheme.kind : undefined;
      const isDarkTheme = colorThemeKind === 2 || colorThemeKind === 4;
      mermaidTheme = isDarkTheme ? 'dark' : 'default';
    }

    // CSP nonce for inline scripts/styles
    const nonce = getNonce();

    // CSS file URI
    const cssUri = this.extensionUri && webview.asWebviewUri
      ? webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'report-preview.css')).toString()
      : '';

    // Inject custom CSS variables for coloring
    const customStyle = `
      :root {
        --vibe-preview-background: ${style.bg};
        --vibe-preview-foreground: ${style.fg};
        --vibe-preview-card-background: ${style.bg};
        --vibe-preview-border: ${style.border};
        --vscode-textLink-foreground: ${style.link};
        --vibe-accent-blue: #58a6ff; /* Fixed accessible blue for dark/light usually ok, or derive */
      }
      body {
        background-color: var(--vibe-preview-background) !important;
        color: var(--vibe-preview-foreground) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      
      /* User Requested Custom Process */
      h1, h2, h3, h4, h5, h6 {
        font-weight: 700 !important;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      h1 { font-size: 2.2em; border-bottom: 1px solid var(--vibe-preview-border); padding-bottom: 0.3em; }
      h2 { font-size: 1.8em; }
      
      /* List Item Styles */
      .list-item {
        font-size: 0.95em;
        margin: 0.3em 0 0.3em 1.5em; /* 들여쓰기 유지 */
        text-indent: -1em; /* 불릿 기호 위치 조정 (선택적) */
        line-height: 1.6;
      }
      
      /* Reset valid semantics if needed or just styling p tags */
      p { margin: 0.4em 0; line-height: 1.5; }

      /* Used by the code-click navigation (avoid inline styles under CSP) */
      .vibe-highlight {
        background-color: rgba(255, 255, 0, 0.3);
        transition: background-color 0.5s;
      }

      /* Mermaid Diagram Fixes - subgraph background */
      .mermaid {
        background: transparent !important;
      }
      .mermaid .cluster rect {
        fill: ${mermaidTheme === 'dark' ? '#2d2d2d' : '#f5f5f5'} !important;
        stroke: ${mermaidTheme === 'dark' ? '#454545' : '#e0e0e0'} !important;
      }
      .mermaid .cluster text {
        fill: ${mermaidTheme === 'dark' ? '#d4d4d4' : '#1a1a1a'} !important;
      }
      .mermaid .node rect, .mermaid .node polygon {
        fill: ${mermaidTheme === 'dark' ? '#2d2d2d' : '#f5f5f5'} !important;
        stroke: ${mermaidTheme === 'dark' ? '#454545' : '#e0e0e0'} !important;
      }
      .mermaid .nodeLabel {
        color: ${mermaidTheme === 'dark' ? '#d4d4d4' : '#1a1a1a'} !important;
      }
      .mermaid .edgeLabel {
        background-color: ${mermaidTheme === 'dark' ? '#2d2d2d' : '#ffffff'} !important;
        color: ${mermaidTheme === 'dark' ? '#d4d4d4' : '#1a1a1a'} !important;
      }
    `;

    // Process Markdown
    const htmlContent = this.markdownToHtml(markdown);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} data: https:;">
  <link rel="stylesheet" href="${cssUri}">
  <style nonce="${nonce}">
    ${customStyle}
  </style>
</head>
<body class="vscode-body markdown-body">
  ${htmlContent}
  <script src="${mermaidScriptUri}"></script>
  <script nonce="${nonce}">
    // Mermaid Init - subgraph 배경색 문제 해결
    const isDarkTheme = '${mermaidTheme}' === 'dark';
    mermaid.initialize({
      startOnLoad: true,
      theme: '${mermaidTheme}',
      securityLevel: 'strict',
      themeVariables: isDarkTheme ? {
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#1e1e1e',
        primaryColor: '#3794ff',
        primaryTextColor: '#d4d4d4',
        primaryBorderColor: '#454545',
        lineColor: '#858585',
        secondaryColor: '#3a3d41',
        tertiaryColor: '#2d2d2d',
        mainBkg: '#2d2d2d',
        nodeBorder: '#454545',
        clusterBkg: '#2d2d2d',
        clusterBorder: '#454545',
        titleColor: '#d4d4d4',
        edgeLabelBackground: '#2d2d2d'
      } : {
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#ffffff',
        primaryColor: '#0066cc',
        primaryTextColor: '#1a1a1a',
        primaryBorderColor: '#e0e0e0',
        lineColor: '#666666',
        secondaryColor: '#f5f5f5',
        tertiaryColor: '#ffffff',
        mainBkg: '#f5f5f5',
        nodeBorder: '#e0e0e0',
        clusterBkg: '#f5f5f5',
        clusterBorder: '#e0e0e0',
        titleColor: '#1a1a1a',
        edgeLabelBackground: '#ffffff'
      }
    });

    // Navigation logic for code elements
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'CODE') {
        const text = e.target.innerText.trim();
        if (!text) return;

        // Try to find the target element to scroll to
        const xpath = "//*[contains(text(), '" + text.replace(/'/g, "\\'") + "')]";
        try {
          const result = document.evaluate(xpath, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const el = result.singleNodeValue;
          if (el && el !== e.target) {
             el.scrollIntoView({ behavior: 'smooth', block: 'center' });
             el.classList.add('vibe-highlight');
             setTimeout(() => { el.classList.remove('vibe-highlight'); }, 1500);
          }
        } catch (err) {
          console.error("XPath error:", err);
        }
      }
    });

    // Re-render mermaid if needed (sometimes needed for dynamic content)
    document.addEventListener('DOMContentLoaded', () => {
      mermaid.init(undefined, document.querySelectorAll('.mermaid'));
    });
  </script>
</body>
</html>`;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[OpenReportPreview] ${message}`);
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
