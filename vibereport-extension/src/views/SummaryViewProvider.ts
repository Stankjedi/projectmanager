/**
 * Summary View Provider
 * 프로젝트 상태 요약 웹뷰
 */

import * as vscode from 'vscode';
import type { VibeReportConfig, VibeReportState } from '../models/types.js';
import { SnapshotService } from '../services/index.js';

export class SummaryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibereport.summary';

  private _view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private outputChannel: vscode.OutputChannel;
  private snapshotService: SnapshotService;

  constructor(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    this.extensionUri = extensionUri;
    this.outputChannel = outputChannel;
    this.snapshotService = new SnapshotService(outputChannel);
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // 메시지 핸들러 등록
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'updateReports':
          await vscode.commands.executeCommand('vibereport.updateReports');
          break;
        case 'openEvaluation':
          await vscode.commands.executeCommand('vibereport.openEvaluationReport');
          break;
        case 'openImprovement':
          await vscode.commands.executeCommand('vibereport.openImprovementReport');
          break;
        case 'openPrompt':
          await vscode.commands.executeCommand('vibereport.openPrompt');
          break;
        case 'openSessionHistory':
          await vscode.commands.executeCommand('vibereport.openSessionHistory');
          break;
        case 'generatePrompt':
          await vscode.commands.executeCommand('vibereport.generatePrompt');
          break;
      }
    });

    this.updateContent();
  }

  public async refresh(): Promise<void> {
    await this.updateContent();
  }

  private async updateContent(): Promise<void> {
    if (!this._view) {
      return;
    }

    const state = await this.loadState();
    this._view.webview.html = this.getHtmlContent(state);
  }

  private async loadState(): Promise<VibeReportState | null> {
    const rootPath = this.getRootPath();
    if (!rootPath) return null;

    const config = this.loadConfig();
    return await this.snapshotService.loadState(rootPath, config);
  }

  private getHtmlContent(state: VibeReportState | null): string {
    const nonce = this.getNonce();
    const cspSource = this._view?.webview.cspSource || '';
    
    const sessionsCount = state?.sessions.length || 0;
    const appliedCount = state?.appliedImprovements.length || 0;
    const lastUpdate = state?.lastUpdated 
      ? new Date(state.lastUpdated).toLocaleString() 
      : '없음';
    const projectName = state?.lastSnapshot?.projectName || '프로젝트 미설정';

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Vibe Report Summary</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      padding: 10px;
      margin: 0;
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
    }
    .header {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .project-name {
      color: var(--vscode-textLink-foreground);
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 15px;
    }
    .stat-card {
      background: var(--vscode-editor-background);
      padding: 10px;
      border-radius: 4px;
      text-align: center;
    }
    .stat-value {
      font-size: 20px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    .stat-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    .last-update {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 15px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      text-align: center;
    }
    .action-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .action-btn.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .no-data {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    📊 <span class="project-name">${projectName}</span>
  </div>

  ${state ? `
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${sessionsCount}</div>
        <div class="stat-label">세션</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${appliedCount}</div>
        <div class="stat-label">적용 완료</div>
      </div>
    </div>

    <div class="last-update">
      마지막 업데이트: ${lastUpdate}
    </div>
  ` : `
    <div class="no-data">
      아직 보고서가 생성되지 않았습니다.
    </div>
  `}

  <div class="actions">
    <button class="action-btn" id="btn-update">
      📝 보고서 업데이트 (분석 프롬프트)
    </button>
    <button class="action-btn" id="btn-generate" style="background: var(--vscode-statusBarItem-prominentBackground);">
      🔧 개선 프롬프트 생성 (선택)
    </button>
    <button class="action-btn secondary" id="btn-evaluation">
      📋 평가 보고서 열기
    </button>
    <button class="action-btn secondary" id="btn-improvement">
      💡 개선 보고서 열기
    </button>
    <button class="action-btn secondary" id="btn-prompt">
      🤖 프롬프트 열기
    </button>
    <button class="action-btn secondary" id="btn-history">
      📜 세션 히스토리
    </button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    document.getElementById('btn-update').addEventListener('click', function() {
      vscode.postMessage({ command: 'updateReports' });
    });

    document.getElementById('btn-generate').addEventListener('click', function() {
      vscode.postMessage({ command: 'generatePrompt' });
    });
    
    document.getElementById('btn-evaluation').addEventListener('click', function() {
      vscode.postMessage({ command: 'openEvaluation' });
    });
    
    document.getElementById('btn-improvement').addEventListener('click', function() {
      vscode.postMessage({ command: 'openImprovement' });
    });
    
    document.getElementById('btn-prompt').addEventListener('click', function() {
      vscode.postMessage({ command: 'openPrompt' });
    });

    document.getElementById('btn-history').addEventListener('click', function() {
      vscode.postMessage({ command: 'openSessionHistory' });
    });
  </script>
</body>
</html>`;
  }

  private getRootPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    return workspaceFolders[0].uri.fsPath;
  }

  private loadConfig(): VibeReportConfig {
    const config = vscode.workspace.getConfiguration('vibereport');
    return {
      reportDirectory: config.get<string>('reportDirectory', 'devplan'),
      snapshotFile: config.get<string>('snapshotFile', '.vscode/vibereport-state.json'),
      enableGitDiff: config.get<boolean>('enableGitDiff', true),
      excludePatterns: config.get<string[]>('excludePatterns', []),
      maxFilesToScan: config.get<number>('maxFilesToScan', 5000),
      autoOpenReports: config.get<boolean>('autoOpenReports', true),
      language: config.get<'ko' | 'en'>('language', 'ko'),
      projectVisionMode: config.get<'auto' | 'custom'>('projectVisionMode', 'auto'),
      defaultProjectType: config.get<import('../models/types.js').ProjectType | 'auto-detect'>('defaultProjectType', 'auto-detect'),
      defaultQualityFocus: config.get<import('../models/types.js').QualityFocus>('defaultQualityFocus', 'development'),
    };
  }
}
