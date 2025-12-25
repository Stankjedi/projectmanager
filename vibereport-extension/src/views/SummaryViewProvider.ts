/**
 * Summary View Provider
 * 프로젝트 상태 요약 웹뷰
 */

import * as vscode from 'vscode';
import type { VibeReportState } from '../models/types.js';
import { SnapshotService } from '../services/index.js';
import type { AutoUpdateStatus } from '../services/realtimeWatcherService.js';
import {
  loadConfig,
  getLastSelectedWorkspaceRoot,
  getRootPath as getWorkspaceRootPath,
  formatTimestampForUi,
  resolveAnalysisRoot,
} from '../utils/index.js';
import { escapeHtml, escapeHtmlAttribute } from '../utils/htmlEscape.js';

export class SummaryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibereport.summary';

  private _view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private outputChannel: vscode.OutputChannel;
  private snapshotService: SnapshotService;
  private autoUpdateStatus: AutoUpdateStatus | undefined;
  private autoUpdateRefreshTimer: NodeJS.Timeout | undefined;

  constructor(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    this.extensionUri = extensionUri;
    this.outputChannel = outputChannel;
    this.snapshotService = new SnapshotService(outputChannel);
  }

  public setAutoUpdateStatus(status: AutoUpdateStatus): void {
    this.autoUpdateStatus = status;
    this.scheduleAutoUpdateRefresh();
  }

  private scheduleAutoUpdateRefresh(): void {
    if (this.autoUpdateRefreshTimer) {
      clearTimeout(this.autoUpdateRefreshTimer);
    }

    this.autoUpdateRefreshTimer = setTimeout(() => {
      void this.refresh();
    }, 200);
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

    try {
      const state = await this.loadState();
      this._view.webview.html = this.getHtmlContent(state);
    } catch (error) {
      this.outputChannel.appendLine(`[SummaryView] Error loading state: ${error}`);
      // Fallback to null state - shows "no data" message instead of infinite loading
      this._view.webview.html = this.getHtmlContent(null);
    }
  }

  private async loadState(): Promise<VibeReportState | null> {
    const workspaceRoot = getLastSelectedWorkspaceRoot() ?? getWorkspaceRootPath();
    if (!workspaceRoot) {
      this.outputChannel.appendLine('[SummaryView] No workspace root path available');
      return null;
    }

    const config = loadConfig();

    let rootPath = workspaceRoot;
    try {
      rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
    } catch (error) {
      this.outputChannel.appendLine(`[SummaryView] Invalid analysisRoot: ${String(error)}`);
    }

    return await this.snapshotService.loadState(rootPath, config);
  }

  private getHtmlContent(state: VibeReportState | null): string {
    const nonce = this.getNonce();
    const cspSource = this._view?.webview.cspSource || '';
    const safeNonce = escapeHtmlAttribute(nonce);
    const safeCspSource = escapeHtmlAttribute(cspSource);

    const sessionsCount = state?.sessions.length || 0;
    const appliedCount = state?.appliedImprovements.length || 0;
    const lastUpdate = state?.lastUpdated
      ? formatTimestampForUi(state.lastUpdated)
      : '없음';
    const projectName = state?.lastSnapshot?.projectName || '프로젝트 미설정';
    const safeSessionsCount = escapeHtml(String(sessionsCount));
    const safeAppliedCount = escapeHtml(String(appliedCount));
    const safeLastUpdate = escapeHtml(lastUpdate);
    const safeProjectName = escapeHtml(projectName);

    const autoUpdate = this.autoUpdateStatus;
    const autoUpdateEnabledLabel = autoUpdate?.enabled ? '켜짐' : '꺼짐';
    const autoUpdateRunningLabel = autoUpdate?.isRunning ? '실행 중' : '대기';
    const pendingCount = autoUpdate?.hasPendingChanges
      ? autoUpdate.pendingPathsCount
      : 0;
    const lastRunAt = autoUpdate?.lastRunAt
      ? formatTimestampForUi(autoUpdate.lastRunAt)
      : '없음';
    const lastRunResult =
      autoUpdate?.lastRunResult === 'success'
        ? '성공'
        : autoUpdate?.lastRunResult === 'failed'
          ? '실패'
          : '없음';
    const autoUpdateLine = autoUpdate
      ? `자동 업데이트: ${autoUpdateEnabledLabel} · 상태: ${autoUpdateRunningLabel} · 대기 변경: ${pendingCount}개 · 마지막 실행: ${lastRunAt} (${lastRunResult})`
      : null;
    const safeAutoUpdateLine = autoUpdateLine ? escapeHtml(autoUpdateLine) : null;

    const lastSession = state?.sessions[state.sessions.length - 1];
    const lineMetrics =
      lastSession?.diffSummary?.linesTotal !== undefined && lastSession.diffSummary.linesTotal > 0
        ? {
          added: lastSession.diffSummary.linesAdded ?? 0,
          removed: lastSession.diffSummary.linesRemoved ?? 0,
          total: lastSession.diffSummary.linesTotal,
        }
        : null;
    const safeLineMetrics = lineMetrics
      ? {
        added: escapeHtml(String(lineMetrics.added)),
        removed: escapeHtml(String(lineMetrics.removed)),
        total: escapeHtml(String(lineMetrics.total)),
      }
      : null;

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${safeCspSource} 'unsafe-inline'; script-src 'nonce-${safeNonce}';">
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
    📊 <span class="project-name">${safeProjectName}</span>
  </div>

  ${state ? `
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${safeSessionsCount}</div>
        <div class="stat-label">세션</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${safeAppliedCount}</div>
        <div class="stat-label">적용 완료</div>
      </div>
    </div>

    <div class="last-update">
      마지막 업데이트: ${safeLastUpdate}
    </div>

    ${safeLineMetrics ? `
    <div class="last-update">
      최근 라인 변경: +${safeLineMetrics.added} / -${safeLineMetrics.removed} (총 ${safeLineMetrics.total}줄)
    </div>
    ` : ''}
  ` : `
    <div class="no-data">
      아직 보고서가 생성되지 않았습니다.
    </div>
  `}

  ${safeAutoUpdateLine ? `
    <div class="last-update">
      ${safeAutoUpdateLine}
    </div>
  ` : ''}

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

  <script nonce="${safeNonce}">
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

}
