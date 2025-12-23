/**
 * Vibe Coding Report - VS Code Extension Entry Point
 * 프로젝트 평가 및 개선 보고서 자동 생성 도구
 */

import * as vscode from 'vscode';
import * as path from 'path';
	import {
	  UpdateReportsCommand,
	  MarkImprovementAppliedCommand,
	  SetProjectVisionCommand,
	  SetAnalysisRootWizardCommand,
	  GeneratePromptCommand,
	  ShareReportCommand,
	  ExportReportBundleCommand,
	  ReportDoctorCommand,
	} from './commands/index.js';
import { UpdateReportsAllCommand } from './commands/updateReportsAll.js';
import { exportSettings, importSettings } from './commands/settingsSync.js';
import { CleanHistoryCommand } from './commands/cleanHistory.js';
import { OpenReportPreviewCommand } from './commands/openReportPreview.js';
import { AutoUpdateReportsManager, type AutoUpdateStatus } from './services/realtimeWatcherService.js';
import { ReportService } from './services/index.js';
import { PreviewStyleService } from './services/previewStyleService.js';
import { HistoryViewProvider } from './views/HistoryViewProvider.js';
import { SummaryViewProvider } from './views/SummaryViewProvider.js';
import { SettingsViewProvider } from './views/SettingsViewProvider.js';
import { formatTimestampForUi, loadConfig, selectWorkspaceRoot, resolveAnalysisRoot } from './utils/index.js';
import { validateOpenCodeReferencePath } from './utils/pathGuards.js';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 출력 채널 생성
  outputChannel = vscode.window.createOutputChannel('Vibe Report');
  context.subscriptions.push(outputChannel);

  const extensionVersion =
    (require('../package.json') as { version?: string }).version ?? 'unknown';

  outputChannel.appendLine('='.repeat(50));
  outputChannel.appendLine(`Vibe Coding Report Extension v${extensionVersion}`);
  outputChannel.appendLine(`활성화 시간: ${new Date().toISOString()}`);
  outputChannel.appendLine('='.repeat(50));

  // 서비스 인스턴스 생성
  const reportService = new ReportService(outputChannel);
  const updateReportsCommand = new UpdateReportsCommand(outputChannel, context.globalState);
  const updateReportsAllCommand = new UpdateReportsAllCommand(
    outputChannel,
    updateReportsCommand
  );
	  const markAppliedCommand = new MarkImprovementAppliedCommand(outputChannel);  
	  const setVisionCommand = new SetProjectVisionCommand(outputChannel);
	  const setAnalysisRootWizardCommand = new SetAnalysisRootWizardCommand(outputChannel);
	  const generatePromptCommand = new GeneratePromptCommand(outputChannel);
	  const shareReportCommand = new ShareReportCommand(outputChannel);
	  const exportReportBundleCommand = new ExportReportBundleCommand(outputChannel);
	  const reportDoctorCommand = new ReportDoctorCommand(outputChannel);
	  const cleanHistoryCommand = new CleanHistoryCommand(outputChannel);
  const openReportPreviewCommand = new OpenReportPreviewCommand(outputChannel, context.extensionUri);

  // Auto-update Reports (opt-in)
  const baseConfig = loadConfig();
  const readAutoUpdateSettings = (): { enabled: boolean; debounceMs: number } => {
    const cfg = vscode.workspace.getConfiguration('vibereport');
    return {
      enabled: cfg.get<boolean>('enableAutoUpdateReports', false),
      debounceMs: cfg.get<number>('autoUpdateDebounceMs', 1500),
    };
  };

  const autoUpdateManager = new AutoUpdateReportsManager(
    {
      reportDirectory: baseConfig.reportDirectory,
      analysisRoot: baseConfig.analysisRoot,
      snapshotFile: baseConfig.snapshotFile,
      excludePatterns: baseConfig.excludePatterns,
    },
    () => vscode.workspace.workspaceFolders ?? [],
    async () => {
      const folders = vscode.workspace.workspaceFolders ?? [];
      for (const folder of folders) {
        const silentProgress: vscode.Progress<{ message?: string; increment?: number }> = {
          report: ({ message }) => {
            if (message) {
              outputChannel.appendLine(`[AutoUpdate] ${folder.name}: ${message}`);
            }
          },
        };

        await updateReportsCommand.executeForWorkspace(folder.uri.fsPath, folder.name, {
          progress: silentProgress,
          suppressNotifications: true,
          suppressOpenReports: true,
        });
      }
    }
  );
  context.subscriptions.push(autoUpdateManager);

  autoUpdateManager.applySettings(readAutoUpdateSettings());
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration('vibereport.enableAutoUpdateReports') ||
        event.affectsConfiguration('vibereport.autoUpdateDebounceMs')
      ) {
        autoUpdateManager.applySettings(readAutoUpdateSettings());
      }
    })
  );

  // 미리보기 스타일 서비스 초기화
  const previewStyleService = new PreviewStyleService(outputChannel, context.extensionPath);
  previewStyleService.updatePreviewStyles();
  context.subscriptions.push(previewStyleService.registerConfigChangeListener());

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
      // 업데이트 후 View 새로고침 (약간의 지연 후 실행)
      setTimeout(() => {
        vscode.commands.executeCommand('vibereport.refreshViews');
      }, 500);
    })
  );

  // 명령 등록: Update Reports All (multi-root batch)
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.updateReportsAll', async () => {
      await updateReportsAllCommand.execute();
    })
  );

  // 명령 등록: Export Settings
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.exportSettings', async () => {
      await exportSettings();
    })
  );

  // 명령 등록: Import Settings
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.importSettings', async () => {
      await importSettings();
    })
  );

  // 명령 등록: Clear History
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.clearHistory', async () => {
      await cleanHistoryCommand.execute();
      setTimeout(() => {
        vscode.commands.executeCommand('vibereport.refreshViews');        
      }, 500);
    })
  );

  // 명령 등록: Report Doctor
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.reportDoctor', async () => {
      await reportDoctorCommand.execute();
    })
  );

  // 명령 등록: Open Evaluation Report
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openEvaluationReport', async () => {
      const workspaceRoot = await selectWorkspaceRoot();
      if (!workspaceRoot) return;

      const config = loadConfig();
      let rootPath = workspaceRoot;
      try {
        rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
      } catch (error) {
        vscode.window.showErrorMessage(
          'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
        );
        outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
        return;
      }
      const reportOpenMode = vscode.workspace.getConfiguration('vibereport').get<string>('reportOpenMode', 'previewOnly');

      if (reportOpenMode === 'editorOnly') {
        // MD 에디터만 열기
        await reportService.openReport(rootPath, config, 'evaluation');
      } else if (reportOpenMode === 'both') {
        // MD 에디터와 프리뷰 둘 다 열기
        await reportService.openReport(rootPath, config, 'evaluation');
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      } else {
        // previewOnly: 파일 열고 프리뷰로 전환
        // 에디터에서 파일을 연 뒤 openReportPreview 명령을 실행하면
        // openReportPreview 내부에서 ViewColumn.Active를 사용하여 현재 에디터(방금 연 파일)를 대체하거나 위에 덮어씀
        await reportService.openReport(rootPath, config, 'evaluation');

        // 약간의 지연 후 프리뷰 실행 (파일 로딩 확보)
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      }
    })
  );

  // 명령 등록: Open Improvement Report
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openImprovementReport', async () => {
      const workspaceRoot = await selectWorkspaceRoot();
      if (!workspaceRoot) return;

      const config = loadConfig();
      let rootPath = workspaceRoot;
      try {
        rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
      } catch (error) {
        vscode.window.showErrorMessage(
          'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
        );
        outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
        return;
      }
      const reportOpenMode = vscode.workspace.getConfiguration('vibereport').get<string>('reportOpenMode', 'previewOnly');

      if (reportOpenMode === 'editorOnly') {
        // MD 에디터만 열기
        await reportService.openReport(rootPath, config, 'improvement');
      } else if (reportOpenMode === 'both') {
        // MD 에디터와 프리뷰 둘 다 열기
        await reportService.openReport(rootPath, config, 'improvement');
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      } else {
        // previewOnly: 파일 열고 프리뷰로 전환
        await reportService.openReport(rootPath, config, 'improvement');

        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      }
    })
  );

  // 명령 등록: Open Prompt File
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openPrompt', async () => {
      const workspaceRoot = await selectWorkspaceRoot();
      if (!workspaceRoot) return;

      const config = loadConfig();
      let rootPath = workspaceRoot;
      try {
        rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
      } catch (error) {
        vscode.window.showErrorMessage(
          'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
        );
        outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
        return;
      }
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

  // 명령 등록: Open Session History
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openSessionHistory', async () => {
      const workspaceRoot = await selectWorkspaceRoot();
      if (!workspaceRoot) return;

      const config = loadConfig();
      let rootPath = workspaceRoot;
      try {
        rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
      } catch (error) {
        vscode.window.showErrorMessage(
          'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
        );
        outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
        return;
      }
      const historyPath = vscode.Uri.file(
        require('path').join(rootPath, config.reportDirectory, 'Session_History.md')
      );

      try {
        const doc = await vscode.workspace.openTextDocument(historyPath);
        await vscode.window.showTextDocument(doc);
      } catch {
        vscode.window.showWarningMessage(
          'Session_History.md 파일이 없습니다. 먼저 보고서 업데이트를 실행해주세요.'
        );
      }
    })
  );

  // 명령 등록: Open Function In File (reports용 코드/함수 링크)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vibereport.openFunctionInFile',
      async (filePath: string, symbolName?: string) => {
        await openFunctionInFile(filePath, symbolName);
      }
    )
  );

  // 명령 등록: Initialize Reports
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.initializeReports', async () => {
      const workspaceRoot = await selectWorkspaceRoot();
      if (!workspaceRoot) return;

      const config = loadConfig();
      let rootPath = workspaceRoot;
      try {
        rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
      } catch (error) {
        vscode.window.showErrorMessage(
          'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
        );
        outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
        return;
      }

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
	
	  // 명령 등록: Set Analysis Root Wizard
	  context.subscriptions.push(
	    vscode.commands.registerCommand('vibereport.setAnalysisRootWizard', async () => {
	      await setAnalysisRootWizardCommand.execute();
	    })
	  );

	  // 명령 등록: Generate Prompt (개선 항목 선택하여 프롬프트 생성)
	  context.subscriptions.push(
	    vscode.commands.registerCommand('vibereport.generatePrompt', async () => {
	      await generatePromptCommand.execute();
    })
  );

  // 명령 등록: Share Report Preview (외부 공유용 프리뷰 복사)
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.shareReport', async () => {
      await shareReportCommand.execute();
    })
  );

  // 명령 등록: Export Report Bundle (보고서 + 공유 프리뷰 번들 내보내기)
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.exportReportBundle', async () => {
      await exportReportBundleCommand.execute();
    })
  );

  // 명령 등록: Open Report Preview (Mermaid 지원 Webview 미리보기)
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openReportPreview', async () => {
      await openReportPreviewCommand.execute();
    })
  );

  // [REMOVED] showLastRunSummary - Summary View와 중복
  // [REMOVED] copyAsPrompt - generatePrompt와 중복


  // View Providers 등록
  const historyViewProvider = new HistoryViewProvider(context.extensionUri, outputChannel);
  const summaryViewProvider = new SummaryViewProvider(context.extensionUri, outputChannel);
  const settingsViewProvider = new SettingsViewProvider(context.extensionUri, outputChannel);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vibereport.history', historyViewProvider)
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibereport.summary', summaryViewProvider)
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibereport.settings', settingsViewProvider)
  );

  // Auto-update 상태를 StatusBar + Summary View에 반영
  const renderAutoUpdateStatus = (status: AutoUpdateStatus): void => {
    const baseText = '$(notebook-render-output) Vibe Report';
    const baseTooltip = '프로젝트 보고서 업데이트 (Vibe Coding)';

    if (!status.enabled) {
      statusBarItem.text = baseText;
      statusBarItem.tooltip = baseTooltip;
    } else {
      const runningLabel = status.isRunning ? '실행 중' : '대기';
      const pendingLabel = status.hasPendingChanges
        ? `${status.pendingPathsCount}개`
        : '0개';
      const lastRunAt = status.lastRunAt ?? '없음';
      const lastRunResult =
        status.lastRunResult === 'success'
          ? '성공'
          : status.lastRunResult === 'failed'
            ? '실패'
            : '없음';

      statusBarItem.text = status.isRunning
        ? `${baseText} $(sync~spin)`
        : `${baseText} $(sync)`;
      statusBarItem.tooltip = `${baseTooltip}\n자동 업데이트: 켜짐 (${runningLabel})\n대기 변경: ${pendingLabel}\n마지막 실행: ${lastRunAt}\n마지막 결과: ${lastRunResult}`;
    }

    summaryViewProvider.setAutoUpdateStatus(status);
  };

  context.subscriptions.push(
    autoUpdateManager.onDidChangeStatus(status => renderAutoUpdateStatus(status))
  );
  renderAutoUpdateStatus(autoUpdateManager.getStatus());

  // 명령 등록: Refresh Views (수동 또는 자동 호출용)
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.refreshViews', () => {
      summaryViewProvider.refresh();
      historyViewProvider.refresh();
      settingsViewProvider.refresh();
      outputChannel.appendLine('[RefreshViews] Views refreshed manually');
    })
  );

  // ===== File System Watcher for Auto-Refresh =====
  const config = loadConfig();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    outputChannel.appendLine('[FileWatcher] No workspace folder open; skipping auto-refresh watchers');
  } else {
    const workspaceRoot = workspaceFolder.uri.fsPath;
    let analysisRootPath = workspaceRoot;
    try {
      analysisRootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
    } catch (error) {
      outputChannel.appendLine(`[FileWatcher] Invalid analysisRoot: ${String(error)}`);
    }

    const reportDir = require('path').join(analysisRootPath, config.reportDirectory);
    const stateFile = require('path').join(analysisRootPath, config.snapshotFile);

    try {
      // 보고서 파일 감시 (.md)
      const reportWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(reportDir, '*.md')
      );

      // 상태 파일 감시 (.json)
      const stateWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          require('path').dirname(stateFile),
          require('path').basename(stateFile)
        )
      );

      const refreshViews = () => {
        summaryViewProvider.refresh();
        historyViewProvider.refresh();
        outputChannel.appendLine('[FileWatcher] Files changed, refreshing views...');
      };

      reportWatcher.onDidChange(refreshViews);
      reportWatcher.onDidCreate(refreshViews);
      reportWatcher.onDidDelete(refreshViews);

      stateWatcher.onDidChange(refreshViews);
      stateWatcher.onDidCreate(refreshViews);

      context.subscriptions.push(reportWatcher);
      context.subscriptions.push(stateWatcher);
      outputChannel.appendLine(`[FileWatcher] Watching for changes in: ${reportDir}/*.md`);
      outputChannel.appendLine(`[FileWatcher] Watching state file: ${stateFile}`);
    } catch (error) {
      outputChannel.appendLine(`[FileWatcher] Failed to initialize watchers: ${error}`);
    }
  }

  // 명령 등록: Show Session Detail
  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.showSessionDetail', (session: import('./models/types.js').SessionRecord) => {
      const panel = vscode.window.createWebviewPanel(
        'sessionDetail',
        `세션: ${formatTimestampForUi(session.timestamp)}`,
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
    <div class="value">${formatTimestampForUi(session.timestamp)}</div>
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

  // [REMOVED] applyFromSelection - generatePrompt/copyAsPrompt와 중복

  outputChannel.appendLine('모든 명령이 등록되었습니다.');
}

export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine('Vibe Coding Report 확장이 비활성화되었습니다.');
    outputChannel.dispose();
  }
}

// ===== Helper Functions =====

async function openFunctionInFile(filePath: string, symbolName?: string): Promise<void> {
  const config = loadConfig();
  const normalizedInput = typeof filePath === 'string' ? filePath.trim() : '';
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const workspaceFolderPaths = workspaceFolders.map(folder => folder.uri.fsPath);

  const validation = validateOpenCodeReferencePath({
    filePath: normalizedInput,
    workspaceFolders: workspaceFolderPaths,
    analysisRoot: config.analysisRoot,
  });

  if (!validation.ok) {
    if (validation.reason === 'empty') {
      vscode.window.showWarningMessage('파일 경로가 비어있어 열 수 없습니다.');
      return;
    }

    if (validation.reason === 'nonAbsolute') {
      vscode.window.showWarningMessage('보안 정책: 절대 경로가 아닌 파일은 열 수 없습니다.');
      outputChannel?.appendLine(`[openFunctionInFile] blocked non-absolute path: ${normalizedInput}`);
      return;
    }

    if (validation.reason === 'outsideWorkspace') {
      vscode.window.showWarningMessage('보안 정책: 워크스페이스 밖 파일은 열 수 없습니다.');
      outputChannel?.appendLine(`[openFunctionInFile] blocked outside workspace: ${normalizedInput}`);
      return;
    }

    vscode.window.showWarningMessage('보안 정책: analysisRoot 밖 파일은 열 수 없습니다.');
    outputChannel?.appendLine(
      `[openFunctionInFile] blocked outside analysisRoot: ${normalizedInput} (analysisRoot=${validation.analysisRootPath})`
    );
    return;
  }

  if (validation.analysisRootSource === 'workspaceRoot' && config.analysisRoot.trim()) {
    outputChannel?.appendLine(
      `[openFunctionInFile] invalid analysisRoot, falling back to workspace root: ${config.analysisRoot}`
    );
  }

  const uri = vscode.Uri.file(validation.targetResolved);

  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    if (symbolName) {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        uri
      );
      const target = findSymbolByName(symbols || [], symbolName);
      if (target) {
        const range = target.selectionRange;
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(range.start, range.start);
      } else {
        vscode.window.showWarningMessage(`함수/심볼을 찾을 수 없습니다: ${symbolName}`);
      }
    }
  } catch (error) {
    outputChannel?.appendLine(`[openFunctionInFile] ${error}`);
    vscode.window.showErrorMessage(`파일을 열 수 없습니다: ${normalizedInput}`);
  }
}

function findSymbolByName(
  symbols: vscode.DocumentSymbol[],
  name: string
): vscode.DocumentSymbol | undefined {
  for (const sym of symbols) {
    if (sym.name === name) {
      return sym;
    }
    if (sym.children && sym.children.length > 0) {
      const found = findSymbolByName(sym.children, name);
      if (found) return found;
    }
  }
  return undefined;
}

// [REMOVED] formatAsPrompt - 더 이상 사용하지 않음 (copyAsPrompt/applyFromSelection 제거)
// [REMOVED] createSummaryHtml - 더 이상 사용하지 않음 (showLastRunSummary 제거)
