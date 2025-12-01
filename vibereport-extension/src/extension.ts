/**
 * Vibe Coding Report - VS Code Extension Entry Point
 * 프로젝트 평가 및 개선 보고서 자동 생성 도구
 */

import * as vscode from 'vscode';
import { UpdateReportsCommand, MarkImprovementAppliedCommand, SetProjectVisionCommand } from './commands/index.js';
import { ReportService } from './services/index.js';
import { HistoryViewProvider } from './views/HistoryViewProvider.js';
import { SummaryViewProvider } from './views/SummaryViewProvider.js';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Vibe Coding Report 확장이 활성화되었습니다!');

  // 출력 채널 생성
  outputChannel = vscode.window.createOutputChannel('Vibe Report');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('='.repeat(50));
  outputChannel.appendLine('Vibe Coding Report Extension v0.2.0');
  outputChannel.appendLine(`활성화 시간: ${new Date().toISOString()}`);
  outputChannel.appendLine('='.repeat(50));

  // 서비스 인스턴스 생성
  const reportService = new ReportService(outputChannel);
  const updateReportsCommand = new UpdateReportsCommand(outputChannel);
  const markAppliedCommand = new MarkImprovementAppliedCommand(outputChannel);
  const setVisionCommand = new SetProjectVisionCommand(outputChannel);

  // Status Bar 아이템 생성
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'vibereport.updateReports';
  statusBarItem.text = '$(notebook-render-output) Vibe Report';
  statusBarItem.tooltip = '프로젝트 보고서 업데이트 (Vibe Coding)';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 명령 등록: Update Reports
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.updateReports', async () => {
      await updateReportsCommand.execute();
    })
  );

  // 명령 등록: Open Evaluation Report
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openEvaluationReport', async () => {
      const rootPath = getRootPath();
      if (!rootPath) return;

      const config = loadConfig();
      await reportService.openReport(rootPath, config, 'evaluation');
    })
  );

  // 명령 등록: Open Improvement Report
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openImprovementReport', async () => {
      const rootPath = getRootPath();
      if (!rootPath) return;

      const config = loadConfig();
      await reportService.openReport(rootPath, config, 'improvement');
    })
  );

  // 명령 등록: Open Prompt File
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openPrompt', async () => {
      const rootPath = getRootPath();
      if (!rootPath) return;

      const config = loadConfig();
      const promptPath = vscode.Uri.file(
        require('path').join(rootPath, config.reportDirectory, 'Prompt.md')
      );

      try {
        const doc = await vscode.workspace.openTextDocument(promptPath);
        await vscode.window.showTextDocument(doc);
      } catch {
        vscode.window.showWarningMessage(
          'Prompt.md 파일이 없습니다. 먼저 보고서 업데이트를 실행해주세요.'
        );
      }
    })
  );

  // 명령 등록: Initialize Reports
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.initializeReports', async () => {
      const rootPath = getRootPath();
      if (!rootPath) return;

      const config = loadConfig();
      const exists = await reportService.reportsExist(rootPath, config);

      if (exists) {
        const overwrite = await vscode.window.showWarningMessage(
          '보고서 파일이 이미 존재합니다. 초기화하면 기존 내용이 삭제됩니다.',
          '초기화',
          '취소'
        );
        if (overwrite !== '초기화') {
          return;
        }
      }

      // 빈 보고서 업데이트 실행
      await updateReportsCommand.execute();
    })
  );

  // 명령 등록: Mark Improvement Applied
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.markApplied', async () => {
      await markAppliedCommand.execute();
    })
  );

  // 명령 등록: Set Project Vision
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.setProjectVision', async () => {
      await setVisionCommand.execute();
    })
  );

  // 명령 등록: Show Last Run Summary
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.showLastRunSummary', async () => {
      const rootPath = getRootPath();
      if (!rootPath) return;

      const config = loadConfig();
      const { SnapshotService } = await import('./services/index.js');
      const snapshotService = new SnapshotService(outputChannel);
      const state = await snapshotService.loadState(rootPath, config);

      if (!state || state.sessions.length === 0) {
        vscode.window.showInformationMessage('아직 실행된 세션이 없습니다.');
        return;
      }

      const lastSession = state.sessions[state.sessions.length - 1];
      const panel = vscode.window.createWebviewPanel(
        'vibeReportSummary',
        '마지막 실행 요약',
        vscode.ViewColumn.One,
        {}
      );

      panel.webview.html = createSummaryHtml(lastSession, state.appliedImprovements.length);
    })
  );

  // 명령 등록: Copy Improvement as Prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.copyAsPrompt', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('활성화된 에디터가 없습니다.');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showWarningMessage('개선 항목을 선택해주세요.');
        return;
      }

      // 프롬프트 형식으로 변환
      const prompt = formatAsPrompt(selectedText);
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(
        '개선 항목이 클립보드에 복사되었습니다. AI 에이전트에 붙여넣어 사용하세요.'
      );
    })
  );

  // View Providers 등록
  const historyViewProvider = new HistoryViewProvider(context.extensionUri, outputChannel);
  const summaryViewProvider = new SummaryViewProvider(context.extensionUri, outputChannel);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vibereport.history', historyViewProvider)
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibereport.summary', summaryViewProvider)
  );

  // ===== File System Watcher for Auto-Refresh =====
  const config = loadConfig();
  const reportDir = require('path').join(
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
    config.reportDirectory
  );

  const reportWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(reportDir, '*.md')
  );

  const refreshViews = () => {
    summaryViewProvider.refresh();
    historyViewProvider.refresh();
    outputChannel.appendLine('[FileWatcher] Report files changed, refreshing views...');
  };

  reportWatcher.onDidChange(refreshViews);
  reportWatcher.onDidCreate(refreshViews);
  reportWatcher.onDidDelete(refreshViews);

  context.subscriptions.push(reportWatcher);
  outputChannel.appendLine(`[FileWatcher] Watching for changes in: ${reportDir}/*.md`);

  // 명령 등록: Show Session Detail
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.showSessionDetail', (session: import('./models/types.js').SessionRecord) => {
      const panel = vscode.window.createWebviewPanel(
        'sessionDetail',
        `세션: ${new Date(session.timestamp).toLocaleString()}`,
        vscode.ViewColumn.One,
        {}
      );
      
      panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: var(--vscode-font-family); 
      padding: 20px; 
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
    .section { margin: 15px 0; padding: 15px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; }
    .label { font-weight: bold; color: var(--vscode-textLink-foreground); margin-bottom: 8px; }
    .value { white-space: pre-wrap; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
    .stat { background: var(--vscode-badge-background); padding: 10px; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>📋 세션 상세 정보</h1>
  <div class="section">
    <div class="label">⏰ 시간</div>
    <div class="value">${new Date(session.timestamp).toLocaleString()}</div>
  </div>
  <div class="section">
    <div class="label">📝 요약</div>
    <div class="value">${session.userPrompt}</div>
  </div>
  <div class="section">
    <div class="label">🔄 변경 사항</div>
    <div class="value">${session.changesSummary}</div>
  </div>
  <div class="section">
    <div class="label">📊 통계</div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${session.diffSummary.totalChanges}</div>
        <div>총 변경</div>
      </div>
      <div class="stat">
        <div class="stat-value">${session.diffSummary.newFilesCount}</div>
        <div>새 파일</div>
      </div>
      <div class="stat">
        <div class="stat-value">${session.aiMetadata?.improvementsProposed || 0}</div>
        <div>개선 제안</div>
      </div>
    </div>
  </div>
</body>
</html>`;
    })
  );

  // 에디터 컨텍스트 메뉴 등록
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.applyFromSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showWarningMessage('적용할 개선 항목을 선택해주세요.');
        return;
      }

      // 선택한 개선 항목을 프롬프트로 변환하여 Copilot Chat으로 전송
      const prompt = formatAsPrompt(selectedText);
      
      // Copilot Chat 명령 실행 시도
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open');
        // 약간의 딜레이 후 텍스트 입력
        setTimeout(async () => {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage(
            '프롬프트가 클립보드에 복사되었습니다. Copilot Chat에 Ctrl+V로 붙여넣으세요.'
          );
        }, 500);
      } catch {
        // Copilot Chat이 없으면 클립보드에 복사
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage(
          '프롬프트가 클립보드에 복사되었습니다.'
        );
      }
    })
  );

  outputChannel.appendLine('모든 명령이 등록되었습니다.');
}

export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine('Vibe Coding Report 확장이 비활성화되었습니다.');
    outputChannel.dispose();
  }
}

// ===== Helper Functions =====

function getRootPath(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}

function loadConfig() {
  const config = vscode.workspace.getConfiguration('vibereport');
  return {
    reportDirectory: config.get<string>('reportDirectory', 'devplan'),
    snapshotFile: config.get<string>('snapshotFile', '.vscode/vibereport-state.json'),
    enableGitDiff: config.get<boolean>('enableGitDiff', true),
    excludePatterns: config.get<string[]>('excludePatterns', []),
    maxFilesToScan: config.get<number>('maxFilesToScan', 5000),
    autoOpenReports: config.get<boolean>('autoOpenReports', true),
    language: config.get<'ko' | 'en'>('language', 'ko'),
  };
}

function formatAsPrompt(selectedText: string): string {
  // 제목과 설명 추출
  const titleMatch = selectedText.match(/\[P[123]\]\s*([^\n]+)/);
  const title = titleMatch ? titleMatch[1].trim() : '개선 항목';

  return `## 개선 요청: ${title}

다음 개선 항목을 현재 프로젝트에 적용해주세요:

${selectedText}

---

위 개선 사항을 분석하고, 구체적인 코드 변경을 제안해주세요.
변경이 필요한 파일과 수정 내용을 명확히 설명해주세요.`;
}

function createSummaryHtml(
  session: import('./models/types.js').SessionRecord,
  appliedCount: number
): string {
  const date = new Date(session.timestamp);
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>마지막 실행 요약</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 { color: var(--vscode-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
    .section { margin: 20px 0; padding: 15px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; }
    .label { font-weight: bold; color: var(--vscode-textLink-foreground); }
    .value { margin-top: 5px; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px; }
    .stat-item { background: var(--vscode-badge-background); padding: 10px; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: var(--vscode-badge-foreground); }
    .stat-label { font-size: 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <h1>📊 마지막 실행 요약</h1>
  
  <div class="section">
    <div class="label">실행 시간</div>
    <div class="value">${formattedDate}</div>
  </div>

  <div class="section">
    <div class="label">사용자 입력</div>
    <div class="value">${session.userPrompt}</div>
  </div>

  <div class="section">
    <div class="label">변경 사항</div>
    <div class="value">${session.changesSummary}</div>
  </div>

  <div class="section">
    <div class="label">통계</div>
    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${session.diffSummary.totalChanges}</div>
        <div class="stat-label">총 변경</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${session.diffSummary.newFilesCount}</div>
        <div class="stat-label">새 파일</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${session.aiMetadata?.improvementsProposed || 0}</div>
        <div class="stat-label">개선 제안</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${appliedCount}</div>
        <div class="stat-label">적용 완료</div>
      </div>
    </div>
  </div>

  ${session.aiMetadata?.priorityItems ? `
  <div class="section">
    <div class="label">🔴 긴급 항목 (P1)</div>
    <div class="value">
      <ul>
        ${session.aiMetadata.priorityItems.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  </div>
  ` : ''}
</body>
</html>`;
}
