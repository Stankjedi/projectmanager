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
  OpenTroubleshootingCommand,
} from './commands/index.js';
import { UpdateReportsAllCommand } from './commands/updateReportsAll.js';
import { exportSettings, importSettings } from './commands/settingsSync.js';
import { CleanHistoryCommand } from './commands/cleanHistory.js';
import { OpenReportPreviewCommand } from './commands/openReportPreview.js';
import { AutoUpdateReportsManager, type AutoUpdateStatus } from './services/realtimeWatcherService.js';
import { ReportService } from './services/index.js';
import { AntigravityAutoAcceptService } from './services/antigravityAutoAcceptService.js';
import { PreviewStyleService } from './services/previewStyleService.js';
import { HistoryViewProvider } from './views/HistoryViewProvider.js';
import { SummaryViewProvider } from './views/SummaryViewProvider.js';
import { SettingsViewProvider } from './views/SettingsViewProvider.js';
import {
  formatTimestampForUi,
  loadConfig,
  selectWorkspaceRoot,
  resolveAnalysisRoot,
} from './utils/index.js';
import { validateOpenCodeReferencePath } from './utils/pathGuards.js';

let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

type CommandInstances = {
  reportService: ReportService;
  updateReportsCommand: UpdateReportsCommand;
  updateReportsAllCommand: UpdateReportsAllCommand;
  markAppliedCommand: MarkImprovementAppliedCommand;
  setVisionCommand: SetProjectVisionCommand;
  setAnalysisRootWizardCommand: SetAnalysisRootWizardCommand;
  generatePromptCommand: GeneratePromptCommand;
  shareReportCommand: ShareReportCommand;
  exportReportBundleCommand: ExportReportBundleCommand;
  reportDoctorCommand: ReportDoctorCommand;
  openTroubleshootingCommand: OpenTroubleshootingCommand;
  cleanHistoryCommand: CleanHistoryCommand;
  openReportPreviewCommand: OpenReportPreviewCommand;
};

type ViewProviders = {
  historyViewProvider: HistoryViewProvider;
  summaryViewProvider: SummaryViewProvider;
  settingsViewProvider: SettingsViewProvider;
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel('Vibe Report');
  context.subscriptions.push(outputChannel);

  logActivationHeader(outputChannel);

  const antigravityAutoAcceptService = new AntigravityAutoAcceptService(outputChannel);
  await antigravityAutoAcceptService.initialize();
  context.subscriptions.push(antigravityAutoAcceptService);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vibereport.antigravity.toggleAutoAccept',
      async () => {
        await antigravityAutoAcceptService.toggleEnabled();
      }
    )
  );

  const storageRoot = context.globalStorageUri.fsPath;
  const commands = createCommandInstances(context, outputChannel, storageRoot);
  setupPreviewStyles(context, outputChannel);

  statusBarItem = createStatusBarItem(context);

  const viewProviders = registerViewProviders(context, outputChannel, storageRoot);
  const autoUpdateManager = setupAutoUpdate(
    context,
    outputChannel,
    commands.updateReportsCommand
  );

  registerAutoUpdateStatusHandlers(
    context,
    autoUpdateManager,
    viewProviders.summaryViewProvider
  );
  registerCommands(context, commands, viewProviders);
  registerFileWatchers(context, outputChannel, viewProviders);

  outputChannel.appendLine('모든 명령이 등록되었습니다.');
}

export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine('Vibe Coding Report 확장이 비활성화되었습니다.');
    outputChannel.dispose();
  }
}

function logActivationHeader(channel: vscode.OutputChannel): void {
  const extensionVersion =
    (require('../package.json') as { version?: string }).version ?? 'unknown';

  channel.appendLine('='.repeat(50));
  channel.appendLine(`Vibe Coding Report Extension v${extensionVersion}`);
  channel.appendLine(`활성화 시간: ${new Date().toISOString()}`);
  channel.appendLine('='.repeat(50));
}

function createCommandInstances(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  storageRoot: string
): CommandInstances {
  const reportService = new ReportService(channel);
  const updateReportsCommand = new UpdateReportsCommand(
    channel,
    context.globalState,
    storageRoot
  );
  const updateReportsAllCommand = new UpdateReportsAllCommand(
    channel,
    updateReportsCommand
  );

  return {
    reportService,
    updateReportsCommand,
    updateReportsAllCommand,
    markAppliedCommand: new MarkImprovementAppliedCommand(channel, storageRoot),
    setVisionCommand: new SetProjectVisionCommand(channel, storageRoot),
    setAnalysisRootWizardCommand: new SetAnalysisRootWizardCommand(channel),
    generatePromptCommand: new GeneratePromptCommand(channel),
    shareReportCommand: new ShareReportCommand(channel),
    exportReportBundleCommand: new ExportReportBundleCommand(channel, storageRoot),
    reportDoctorCommand: new ReportDoctorCommand(channel, storageRoot),
    openTroubleshootingCommand: new OpenTroubleshootingCommand(
      channel,
      context.extensionUri
    ),
    cleanHistoryCommand: new CleanHistoryCommand(channel, storageRoot),
    openReportPreviewCommand: new OpenReportPreviewCommand(
      channel,
      context.extensionUri
    ),
  };
}

function setupPreviewStyles(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel
): void {
  const previewStyleService = new PreviewStyleService(channel, context.extensionPath);
  previewStyleService.updatePreviewStyles();
  context.subscriptions.push(previewStyleService.registerConfigChangeListener());
}

function createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  item.command = 'vibereport.updateReports';
  item.text = '$(notebook-render-output) Vibe Report';
  item.tooltip = '프로젝트 보고서 업데이트 (Vibe Coding)';
  item.show();
  context.subscriptions.push(item);
  return item;
}

function registerViewProviders(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  storageRoot: string
): ViewProviders {
  const historyViewProvider = new HistoryViewProvider(
    context.extensionUri,
    channel,
    storageRoot
  );
  const summaryViewProvider = new SummaryViewProvider(
    context.extensionUri,
    channel,
    storageRoot
  );
  const settingsViewProvider = new SettingsViewProvider(context.extensionUri, channel);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vibereport.history', historyViewProvider)
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibereport.summary', summaryViewProvider)
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibereport.settings', settingsViewProvider)
  );

  return { historyViewProvider, summaryViewProvider, settingsViewProvider };
}

function setupAutoUpdate(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  updateReportsCommand: UpdateReportsCommand
): AutoUpdateReportsManager {
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
        const silentProgress: vscode.Progress<{ message?: string; increment?: number }> =
          {
            report: ({ message }) => {
              if (message) {
                channel.appendLine(`[AutoUpdate] ${folder.name}: ${message}`);
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

  return autoUpdateManager;
}

function registerAutoUpdateStatusHandlers(
  context: vscode.ExtensionContext,
  autoUpdateManager: AutoUpdateReportsManager,
  summaryViewProvider: SummaryViewProvider
): void {
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
}

function registerCommands(
  context: vscode.ExtensionContext,
  commands: CommandInstances,
  viewProviders: ViewProviders
): void {
  const {
    reportService,
    updateReportsCommand,
    updateReportsAllCommand,
    markAppliedCommand,
    setVisionCommand,
    setAnalysisRootWizardCommand,
    generatePromptCommand,
    shareReportCommand,
    exportReportBundleCommand,
    reportDoctorCommand,
    openTroubleshootingCommand,
    cleanHistoryCommand,
    openReportPreviewCommand,
  } = commands;
  const { historyViewProvider, summaryViewProvider, settingsViewProvider } =
    viewProviders;

  const refreshViews = (): void => {
    summaryViewProvider.refresh();
    historyViewProvider.refresh();
    settingsViewProvider.refresh();
    outputChannel.appendLine('[RefreshViews] Views refreshed manually');
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.updateReports', async () => {
      await updateReportsCommand.execute();
      setTimeout(() => {
        vscode.commands.executeCommand('vibereport.refreshViews');
      }, 500);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.updateReportsAll', async () => {
      await updateReportsAllCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.exportSettings', async () => {
      await exportSettings();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.importSettings', async () => {
      await importSettings();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.clearHistory', async () => {
      await cleanHistoryCommand.execute();
      setTimeout(() => {
        vscode.commands.executeCommand('vibereport.refreshViews');
      }, 500);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.reportDoctor', async () => {
      await reportDoctorCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openTroubleshooting', async () => {
      await openTroubleshootingCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openEvaluationReport', async () => {
      const resolved = await resolveAnalysisRootContext();
      if (!resolved) return;

      const reportOpenMode = vscode.workspace
        .getConfiguration('vibereport')
        .get<string>('reportOpenMode', 'previewOnly');

      if (reportOpenMode === 'editorOnly') {
        await reportService.openReport(resolved.rootPath, resolved.config, 'evaluation');
      } else if (reportOpenMode === 'both') {
        await reportService.openReport(resolved.rootPath, resolved.config, 'evaluation');
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      } else {
        await reportService.openReport(resolved.rootPath, resolved.config, 'evaluation');
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openImprovementReport', async () => {
      const resolved = await resolveAnalysisRootContext();
      if (!resolved) return;

      const reportOpenMode = vscode.workspace
        .getConfiguration('vibereport')
        .get<string>('reportOpenMode', 'previewOnly');

      if (reportOpenMode === 'editorOnly') {
        await reportService.openReport(resolved.rootPath, resolved.config, 'improvement');
      } else if (reportOpenMode === 'both') {
        await reportService.openReport(resolved.rootPath, resolved.config, 'improvement');
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      } else {
        await reportService.openReport(resolved.rootPath, resolved.config, 'improvement');
        setTimeout(() => {
          vscode.commands.executeCommand('vibereport.openReportPreview');
        }, 100);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openPrompt', async () => {
      const resolved = await resolveAnalysisRootContext();
      if (!resolved) return;

      const promptPath = vscode.Uri.file(
        path.join(resolved.rootPath, resolved.config.reportDirectory, 'Prompt.md')
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

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openSessionHistory', async () => {
      const resolved = await resolveAnalysisRootContext();
      if (!resolved) return;

      const historyPath = vscode.Uri.file(
        path.join(
          resolved.rootPath,
          resolved.config.reportDirectory,
          'Session_History.md'
        )
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vibereport.openFunctionInFile',
      async (filePath: string, symbolName?: string) => {
        await openFunctionInFile(filePath, symbolName);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.initializeReports', async () => {
      const resolved = await resolveAnalysisRootContext();
      if (!resolved) return;

      const exists = await reportService.reportsExist(
        resolved.rootPath,
        resolved.config
      );

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

      await updateReportsCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.markApplied', async () => {
      await markAppliedCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.setProjectVision', async () => {
      await setVisionCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.setAnalysisRootWizard', async () => {
      await setAnalysisRootWizardCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.generatePrompt', async () => {
      await generatePromptCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.shareReport', async () => {
      await shareReportCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.exportReportBundle', async () => {
      await exportReportBundleCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.openReportPreview', async () => {
      await openReportPreviewCommand.execute();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibereport.refreshViews', () => {
      refreshViews();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vibereport.showSessionDetail',
      (session: import('./models/types.js').SessionRecord) => {
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
      }
    )
  );
}

function registerFileWatchers(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  viewProviders: ViewProviders
): void {
  const config = loadConfig();
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    channel.appendLine('[FileWatcher] No workspace folder open; skipping auto-refresh watchers');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  let analysisRootPath = workspaceRoot;
  try {
    analysisRootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
  } catch (error) {
    channel.appendLine(`[FileWatcher] Invalid analysisRoot: ${String(error)}`);
  }

  const reportDir = path.join(analysisRootPath, config.reportDirectory);
  const stateFile = path.join(analysisRootPath, config.snapshotFile);

  try {
    const reportWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(reportDir, '*.md')
    );

    const stateWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(stateFile),
        path.basename(stateFile)
      )
    );

    const refreshViews = () => {
      viewProviders.summaryViewProvider.refresh();
      viewProviders.historyViewProvider.refresh();
      channel.appendLine('[FileWatcher] Files changed, refreshing views...');
    };

    reportWatcher.onDidChange(refreshViews);
    reportWatcher.onDidCreate(refreshViews);
    reportWatcher.onDidDelete(refreshViews);

    stateWatcher.onDidChange(refreshViews);
    stateWatcher.onDidCreate(refreshViews);

    context.subscriptions.push(reportWatcher);
    context.subscriptions.push(stateWatcher);
    channel.appendLine(`[FileWatcher] Watching for changes in: ${reportDir}/*.md`);
    channel.appendLine(`[FileWatcher] Watching state file: ${stateFile}`);
  } catch (error) {
    channel.appendLine(`[FileWatcher] Failed to initialize watchers: ${error}`);
  }
}

async function resolveAnalysisRootContext(): Promise<
  | { rootPath: string; config: ReturnType<typeof loadConfig> }
  | null
> {
  const workspaceRoot = await selectWorkspaceRoot();
  if (!workspaceRoot) return null;

  const config = loadConfig();
  let rootPath = workspaceRoot;
  try {
    rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
  } catch (error) {
    vscode.window.showErrorMessage(
      'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
    );
    outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
    return null;
  }

  return { rootPath, config };
}

async function openFunctionInFile(
  filePath: string,
  symbolName?: string
): Promise<void> {
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
