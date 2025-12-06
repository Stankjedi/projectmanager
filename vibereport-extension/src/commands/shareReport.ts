/**
 * Share Report Command
 * 
 * @description 프로젝트 평가 보고서를 외부 공유용 프리뷰 형태로 클립보드에 복사합니다.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadConfig, getRootPath } from '../utils/index.js';
import { SnapshotService } from '../services/index.js';

export class ShareReportCommand {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  async execute(): Promise<void> {
    const rootPath = getRootPath();
    if (!rootPath) {
      vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
      return;
    }

    const config = loadConfig();
    const reportDir = path.join(rootPath, config.reportDirectory);

    try {
      // 평가 보고서 읽기
      const evalPath = path.join(reportDir, 'Project_Evaluation_Report.md');
      const evalContent = await fs.readFile(evalPath, 'utf-8');

      // 프리뷰 보고서 생성
      const preview = this.generatePreviewReport(evalContent, rootPath);

      // 클립보드에 복사
      await vscode.env.clipboard.writeText(preview);

      const action = await vscode.window.showInformationMessage(
        '📋 프리뷰 보고서가 클립보드에 복사되었습니다!',
        '미리보기'
      );

      if (action === '미리보기') {
        this.showPreviewPanel(preview);
      }

      this.log('프리뷰 보고서 생성 및 복사 완료');
    } catch (error) {
      vscode.window.showErrorMessage(
        '보고서를 읽을 수 없습니다. 먼저 Update Reports를 실행해주세요.'
      );
      this.log(`오류: ${error}`);
    }
  }

  /**
   * 평가 보고서에서 프리뷰용 요약 생성
   */
  private generatePreviewReport(evalContent: string, rootPath: string): string {
    const projectName = path.basename(rootPath);
    const now = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // TL;DR 섹션 추출
    const tldrMatch = evalContent.match(
      /<!-- TLDR-START -->([\s\S]*?)<!-- TLDR-END -->/
    );
    const tldr = tldrMatch ? this.cleanMarkdownTable(tldrMatch[1]) : '';

    // 종합 점수 테이블 추출
    const scoreMatch = evalContent.match(
      /<!-- AUTO-SCORE-START -->([\s\S]*?)### 점수-등급 기준표/
    );
    const scoreTable = scoreMatch ? this.extractScoreTable(scoreMatch[1]) : '';

    // 버전 추출
    const versionMatch = evalContent.match(/\*\*현재 버전\*\*\s*\|\s*([^\|]+)/);
    const version = versionMatch ? versionMatch[1].trim() : '-';

    // 종합 점수 추출
    const totalScoreMatch = evalContent.match(
      /\*\*총점 평균\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*([^\|]+)/
    );
    const totalScore = totalScoreMatch ? totalScoreMatch[1] : '-';
    const totalGrade = totalScoreMatch ? totalScoreMatch[2].trim() : '-';

    // 프리뷰 보고서 생성
    return `# 📊 ${projectName} 프로젝트 평가 보고서

> 🗓️ 생성일: ${now}
> 📦 버전: ${version}
> 🏆 종합 점수: **${totalScore}점 (${totalGrade})**

---

## 📝 요약 (TL;DR)

${tldr}

---

## 📊 상세 점수

${scoreTable}

---

## 🔗 상세 정보

이 보고서는 [Vibe Coding Report](https://marketplace.visualstudio.com/items?itemName=stankjedi.vibereport) VS Code 확장으로 자동 생성되었습니다.

전체 보고서는 프로젝트의 \`devplan/Project_Evaluation_Report.md\` 파일에서 확인할 수 있습니다.
`;
  }

  /**
   * 마크다운 테이블 정리
   */
  private cleanMarkdownTable(content: string): string {
    return content
      .trim()
      .split('\n')
      .filter(line => line.trim().startsWith('|'))
      .join('\n');
  }

  /**
   * 점수 테이블 추출 및 정리
   */
  private extractScoreTable(content: string): string {
    const lines = content.split('\n');
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

  /**
   * 미리보기 패널 표시
   */
  private showPreviewPanel(content: string): void {
    const panel = vscode.window.createWebviewPanel(
      'vibeReportPreview',
      '📋 프리뷰 보고서',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.getPreviewHtml(content);
  }

  /**
   * 배경색 설정 가져오기
   */
  private getBackgroundStyle(): { bg: string; fg: string; border: string; link: string } {
    const config = vscode.workspace.getConfiguration('vibereport');
    const bgSetting = config.get<string>('previewBackgroundColor', 'ide');

    switch (bgSetting) {
      case 'white':
        return {
          bg: '#ffffff',
          fg: '#1e1e1e',
          border: '#d4d4d4',
          link: '#0066cc',
        };
      case 'black':
        return {
          bg: '#1e1e1e',
          fg: '#d4d4d4',
          border: '#404040',
          link: '#4fc3f7',
        };
      case 'ide':
      default:
        return {
          bg: 'var(--vscode-editor-background)',
          fg: 'var(--vscode-foreground)',
          border: 'var(--vscode-panel-border)',
          link: 'var(--vscode-textLink-foreground)',
        };
    }
  }

  /**
   * 미리보기 HTML 생성
   */
  private getPreviewHtml(markdown: string): string {
    const style = this.getBackgroundStyle();
    
    // 간단한 마크다운 → HTML 변환
    const html = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n---\n/g, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.some(c => c.includes('---'))) {
          return '';
        }
        const cellHtml = cells.map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cellHtml}</tr>`;
      });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
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
  <table>${html}</table>
</body>
</html>`;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[ShareReport] ${message}`);
  }
}
