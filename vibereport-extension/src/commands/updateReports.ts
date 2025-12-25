/**
 * Update Reports Command
 *
 * @description Main workflow for scanning the workspace, generating prompts,
 * updating reports, and copying the analysis prompt to the clipboard.
 *
 * @example
 * const command = new UpdateReportsCommand(outputChannel);
 * await command.execute();
 */
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { VibeReportConfig } from '../models/types.js';
import { OperationCancelledError, VibeReportError } from '../models/errors.js';
import {
  WorkspaceScanner,
  SnapshotService,
  ReportService,
  AiService,
} from '../services/index.js';
import {
  loadConfig,
  buildAnalysisPrompt,
  selectWorkspaceRoot,
  resolveAnalysisRoot,
} from '../utils/index.js';
import { extractImprovementIdFromText } from '../utils/markdownUtils.js';
import {
  runUpdateReportsWorkflow,
  UpdateReportsWorkflowError,
} from './updateReportsWorkflow.js';

interface ExecuteForWorkspaceOptions {
  progress?: vscode.Progress<{ message?: string; increment?: number }>;
  suppressOpenReports?: boolean;
  suppressNotifications?: boolean;
}

export class UpdateReportsCommand {
  private workspaceScanner: WorkspaceScanner;
  private snapshotService: SnapshotService;
  private reportService: ReportService;
  private aiService: AiService;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel, memento?: vscode.Memento) {
    this.outputChannel = outputChannel;
    this.workspaceScanner = new WorkspaceScanner(outputChannel);
    this.snapshotService = new SnapshotService(outputChannel);
    this.reportService = new ReportService(outputChannel);
    this.aiService = new AiService(outputChannel, memento);
  }

  /**
   * 보고서 업데이트 실행
   *
   * @description Run a full scan, generate prompt, persist snapshot, and notify user.
   */
  async execute(): Promise<void> {
    // 워크스페이스 선택 (multi-root 지원)
    const rootPath = await selectWorkspaceRoot();
    if (!rootPath) {
      this.log('워크스페이스 선택이 취소되었습니다.');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const selectedFolder =
      workspaceFolders.find(f => f.uri.fsPath === rootPath) ?? workspaceFolders[0];
    const projectName = selectedFolder?.name || 'Unknown Workspace';

    const config = loadConfig();

    let analysisRootPath: string;
    try {
      analysisRootPath = resolveAnalysisRoot(rootPath, config.analysisRoot);
    } catch (error) {
      vscode.window.showErrorMessage(
        'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
      );
      this.log(`[analysisRoot] invalid: ${String(error)}`);
      return;
    }

    const reportsExist = await this.reportService.reportsExist(analysisRootPath, config);
    const isFirstRun = !reportsExist;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Vibe Report: ${projectName}`,
        cancellable: true,
      },
      async (progress, token) => {
        await this._executeWithProgress(
          analysisRootPath,
          config,
          projectName,
          progress,
          isFirstRun,
          undefined,
          token
        );
      }
    );
  }

  /**
   * 특정 워크스페이스 루트에 대해 보고서 업데이트 실행 (multi-root / batch 용)
   */
  async executeForWorkspace(
    rootPath: string,
    projectName: string,
    options?: ExecuteForWorkspaceOptions
  ): Promise<void> {
    const config = loadConfig();

    let analysisRootPath: string;
    try {
      analysisRootPath = resolveAnalysisRoot(rootPath, config.analysisRoot);
    } catch (error) {
      if (!options?.suppressNotifications) {
        void vscode.window.showErrorMessage(
          'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
        );
      }
      this.log(`[analysisRoot] invalid: ${String(error)}`);
      return;
    }

    const reportsExist = await this.reportService.reportsExist(analysisRootPath, config);
    const isFirstRun = !reportsExist;

    if (options?.progress) {
      await this._executeWithProgress(
        analysisRootPath,
        config,
        projectName,
        options.progress,
        isFirstRun,
        options
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Vibe Report: ${projectName}`,
        cancellable: true,
      },
      async (progress, token) => {
        await this._executeWithProgress(
          analysisRootPath,
          config,
          projectName,
          progress,
          isFirstRun,
          options,
          token
        );
      }
    );
  }

  private async _executeWithProgress(
    rootPath: string,
    config: VibeReportConfig,
    projectName: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    isFirstRun: boolean,
    completionOptions?: ExecuteForWorkspaceOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<void> {
    const reportProgress = (message: string, increment?: number) => {
      progress.report({ message, increment });
      this.log(message);
    };

    const fs = await import('fs/promises');
    const ui = {
      withProgress: <T>(
        options: { title: string; cancellable: boolean },
        task: (
          p: { report(value: { message?: string; increment?: number }): void },
          token: vscode.CancellationToken
        ) => Promise<T>
      ) =>
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: options.title,
            cancellable: options.cancellable,
          },
          task
        ),
      clipboardWriteText: (text: string) => vscode.env.clipboard.writeText(text),
      showInformationMessage: (message: string) => {
        void vscode.window.showInformationMessage(message);
      },
      showWarningMessage: (message: string) => {
        void vscode.window.showWarningMessage(message);
      },
      openMarkdownDocument: async (content: string) => {
        const doc = await vscode.workspace.openTextDocument({
          language: 'markdown',
          content,
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      },
    };

    try {
      await runUpdateReportsWorkflow({
        rootPath,
        projectName,
        config,
        isFirstRun,
        reportProgress,
        cancellationToken,
        deps: {
          workspaceScanner: this.workspaceScanner,
          snapshotService: this.snapshotService,
          reportService: this.reportService,
          aiService: {
            runAnalysisPrompt: (
              prompt: string,
              options?: { cancellationToken?: unknown }
            ) =>
              this.aiService.runAnalysisPrompt(prompt, {
                cancellationToken: options?.cancellationToken as vscode.CancellationToken,
              }),
          },
          fs,
          ui,
          buildAnalysisPrompt,
          log: (message: string) => this.log(message),
          now: () => new Date(),
        },
      });
    } catch (error) {
      if (error instanceof OperationCancelledError) {
        this.log('보고서 업데이트가 취소되었습니다.');
        return;
      }
      if (
        error instanceof UpdateReportsWorkflowError &&
        error.cause instanceof OperationCancelledError
      ) {
        this.log('보고서 업데이트가 취소되었습니다.');
        return;
      }
      if (error instanceof UpdateReportsWorkflowError) {
        this._handleError(error.cause, error.step);
      } else {
        this._handleError(error, '보고서 업데이트');
      }
      return;
    }

    reportProgress('완료!', 100);
    await this._showCompletionNotification(
      rootPath,
      config,
      projectName,
      isFirstRun,
      completionOptions
    );
  }

  /**
   * Step 5: 완료 알림 표시
   */
  private async _showCompletionNotification(
    rootPath: string,
    config: VibeReportConfig,
    projectName: string,
    isFirstRun: boolean,
    options?: ExecuteForWorkspaceOptions
  ): Promise<void> {
    if (options?.suppressNotifications) {
      return;
    }

    const openChat = 'Copilot Chat 열기';
    const openEval = '평가 보고서 열기';
    const openImprove = '개선 보고서 열기';

    const message = isFirstRun
      ? `✅ [${projectName}] 초기 분석 프롬프트가 클립보드에 복사되었습니다!`
      : `✅ [${projectName}] 업데이트 프롬프트가 클립보드에 복사되었습니다!`;

    const actions = options?.suppressOpenReports
      ? [openChat]
      : [openChat, openEval, openImprove];

    const result = await vscode.window.showInformationMessage(
      message + '\n\nCopilot Chat에 붙여넣기(Ctrl+V)하여 분석을 시작하세요.',
      ...actions
    );

    if (result === openChat) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    } else if (!options?.suppressOpenReports && result === openEval) {
      await this.reportService.openReport(rootPath, config, 'evaluation');
    } else if (!options?.suppressOpenReports && result === openImprove) {
      await this.reportService.openReport(rootPath, config, 'improvement');
    }
  }

  private _handleError(error: unknown, context: string): void {
    if (error instanceof VibeReportError) {
      this.log(`[${context}] ${error.code}: ${error.message}`);
      vscode.window.showErrorMessage(`${context} 실패: ${error.userMessage}`);
    } else if (error instanceof Error) {
      this.log(`[${context}] ${error.name}: ${error.message}`);
      vscode.window.showErrorMessage(`${context} 중 오류 발생: ${error.message}`);
    } else {
      this.log(`[${context}] Unknown error: ${error}`);
      vscode.window.showErrorMessage(`${context} 중 알 수 없는 오류가 발생했습니다.`);
    }
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[UpdateReports] ${message}`);
  }
}

/**
 * 개선 항목 적용 완료 마킹 명령
 */
interface PendingImprovementSummary {
  id: string;
  title: string;
}

function parsePendingImprovementsFromReport(markdown: string): PendingImprovementSummary[] {
  const lines = markdown.split(/\r?\n/);
  const found: PendingImprovementSummary[] = [];
  let currentTitle: string | undefined;

  for (const line of lines) {
    const headingMatch = line.match(/^####\s+(.*)$/);
    if (headingMatch) {
      currentTitle = headingMatch[1].trim();
      continue;
    }

    const idRowMatch = line.match(/^\|\s*\*\*ID\*\*\s*\|\s*`([^`]+)`\s*\|/);
    if (idRowMatch) {
      const id = idRowMatch[1].trim();
      found.push({ id, title: currentTitle ?? id });
    }
  }

  const seen = new Set<string>();
  const deduped: PendingImprovementSummary[] = [];
  for (const item of found) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

export class MarkImprovementAppliedCommand {
  private snapshotService: SnapshotService;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.snapshotService = new SnapshotService(outputChannel);
  }

  /**
   * 현재 선택된 텍스트에서 개선 항목을 적용 완료로 마킹
   */
  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('활성화된 에디터가 없습니다.');
      return;
    }

    // 워크스페이스 선택 (multi-root 지원)
    const rootPath = await selectWorkspaceRoot();
    if (!rootPath) {
      this.log('워크스페이스 선택이 취소되었습니다.');
      return;
    }
    const config = loadConfig();

    let analysisRootPath: string;
    try {
      analysisRootPath = resolveAnalysisRoot(rootPath, config.analysisRoot);
    } catch (error) {
      vscode.window.showErrorMessage(
        'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
      );
      this.log(`[analysisRoot] invalid: ${String(error)}`);
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    const explicitId = selectedText ? extractImprovementIdFromText(selectedText) : undefined;

    const titleMatch = selectedText
      ? selectedText.match(/^\s*#{1,6}\s*\[[^\]]+\]\s*([^\n]+)/m) ??
        selectedText.match(/^\s*\[[^\]]+\]\s*([^\n]+)/m)
      : null;

    const titleFromSelection = titleMatch ? titleMatch[1].trim() : undefined;

    const picked = explicitId
      ? { id: explicitId, title: titleFromSelection ?? explicitId }
      : await this.pickPendingImprovement(analysisRootPath, config);

    if (!picked) {
      return;
    }

    // 상태 로드
    let state = await this.snapshotService.loadState(analysisRootPath, config);
    if (!state) {
      state = this.snapshotService.createInitialState();
    }

    // 적용 완료 항목 추가
    state = this.snapshotService.addAppliedImprovement(state, {
      id: picked.id,
      title: picked.title,
      appliedAt: new Date().toISOString(),
      sessionId: SnapshotService.generateSessionId(),
    });

    // 상태 저장
    await this.snapshotService.saveState(analysisRootPath, config, state);

    vscode.window.showInformationMessage(`개선 항목이 적용 완료로 마킹되었습니다: ${picked.title}`);

    this.log(`적용 완료 마킹: ${picked.id} - ${picked.title}`);
  }

  private async pickPendingImprovement(
    analysisRootPath: string,
    config: VibeReportConfig
  ): Promise<PendingImprovementSummary | null> {
    const reportPath = path.join(
      analysisRootPath,
      config.reportDirectory,
      'Project_Improvement_Exploration_Report.md'
    );

    try {
      const report = await fs.readFile(reportPath, 'utf-8');
      const improvements = parsePendingImprovementsFromReport(report);

      if (improvements.length === 0) {
        vscode.window.showErrorMessage('개선 보고서에서 개선 항목을 찾지 못했습니다.');
        this.log(`[markApplied] 개선 항목 파싱 실패: ${reportPath}`);
        return null;
      }

      const items = improvements.map((improvement) => ({
        ...improvement,
        label: `${improvement.title} (${improvement.id})`,
      })) as Array<vscode.QuickPickItem & PendingImprovementSummary>;

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '적용 완료로 마킹할 개선 항목을 선택하세요.',
      });

      if (!selected) {
        this.log('[markApplied] QuickPick이 취소되었습니다.');
        return null;
      }

      return { id: selected.id, title: selected.title };
    } catch (error) {
      vscode.window.showErrorMessage(`개선 보고서를 읽을 수 없습니다: ${String(error)}`);
      this.log(`[markApplied] 개선 보고서 읽기 실패: ${String(error)}`);
      return null;
    }
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[MarkApplied] ${message}`);
  }
}
