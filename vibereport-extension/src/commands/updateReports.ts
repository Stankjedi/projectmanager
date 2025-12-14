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
import type {
  VibeReportConfig,
  ProjectSnapshot,
  SnapshotDiff,
  VibeReportState,
  SessionRecord,
} from '../models/types.js';
import {
  WorkspaceScanner,
  SnapshotService,
  ReportService,
  AiService,
} from '../services/index.js';
import { generateImprovementId, loadConfig, buildAnalysisPrompt, selectWorkspaceRoot } from '../utils/index.js';
import {
  VibeReportError,
  WorkspaceScanError,
  FileOperationError,
} from '../models/errors.js';

/**
 * 워크스페이스 스캔 결과
 */
interface WorkspaceScanResult {
  snapshot: ProjectSnapshot;
  state: VibeReportState;
  diff: SnapshotDiff;
}

export class UpdateReportsCommand {
  private workspaceScanner: WorkspaceScanner;
  private snapshotService: SnapshotService;
  private reportService: ReportService;
  private aiService: AiService;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.workspaceScanner = new WorkspaceScanner(outputChannel);
    this.snapshotService = new SnapshotService(outputChannel);
    this.reportService = new ReportService(outputChannel);
    this.aiService = new AiService(outputChannel);
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

    // 설정 로드
    const config = loadConfig();

    // 기존 보고서 확인
    const reportsExist = await this.reportService.reportsExist(rootPath, config);
    const isFirstRun = !reportsExist;

    // 진행 표시
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Vibe Report: ${projectName}`,
        cancellable: false,
      },
      async (progress) => {
        await this._executeWithProgress(rootPath, config, projectName, progress, isFirstRun);
      }
    );
  }

  /**
   * 진행 표시와 함께 전체 워크플로우 실행
   */
  private async _executeWithProgress(
    rootPath: string,
    config: VibeReportConfig,
    projectName: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    isFirstRun: boolean
  ): Promise<void> {
    const reportProgress = (message: string, increment?: number) => {
      progress.report({ message, increment });
      this.log(message);
    };

    // Step 1: 워크스페이스 스캔
    let scanResult: WorkspaceScanResult;
    try {
      scanResult = await this._performWorkspaceScan(rootPath, config, reportProgress);
    } catch (error) {
      this._handleError(error, '프로젝트 스캔');
      return;
    }

    let { snapshot, state, diff } = scanResult;

    // Step 1.5: 기존 Prompt.md에서 완료된 프롬프트를 적용 완료 항목으로 인식
    try {
      const inferredApplied = await this._inferAppliedImprovementsFromPrompt(rootPath, config);
      if (inferredApplied.length > 0) {
        const previousCount = state.appliedImprovements.length;
        const mergedApplied = this._mergeAppliedImprovements(
          state.appliedImprovements,
          inferredApplied
        );

        if (mergedApplied.length !== previousCount) {
          state = {
            ...state,
            appliedImprovements: mergedApplied,
          };

          const newlyAdded = mergedApplied.length - previousCount;
          if (newlyAdded > 0) {
            this.log(`Prompt.md에서 완료된 프롬프트 ${newlyAdded}개를 적용 완료 항목으로 인식했습니다.`);
          }
        }
      }
    } catch (error) {
      this.log(
        `Prompt.md 기반 적용 완료 항목 추출 실패 (계속 진행): ${error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Step 2: 보고서 템플릿 준비
    try {
      await this._prepareReportTemplates(rootPath, config, snapshot, isFirstRun, reportProgress);
    } catch (error) {
      this._handleError(error, '보고서 템플릿 준비');
      return;
    }

    // Step 2.5: 적용 완료된 항목 자동 제거
    try {
      await this._cleanupAppliedItems(rootPath, config, state, reportProgress);
    } catch (error) {
      // 클린업 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
      this.log(`적용 완료 항목 클린업 실패 (계속 진행): ${error}`);
    }

    // Step 3: 프롬프트 생성 및 클립보드 복사
    let prompt: string;
    try {
      prompt = await this._generateAndCopyPrompt(snapshot, diff, state, isFirstRun, config, reportProgress);
    } catch (error) {
      this._handleError(error, '프롬프트 생성');
      return;
    }

    // Step 4: 세션 기록 저장
    let updatedState: VibeReportState;
    try {
      updatedState = await this._saveSessionRecord(rootPath, config, state, snapshot, diff, isFirstRun, reportProgress);
    } catch (error) {
      this._handleError(error, '세션 기록 저장');
      return;
    }

    reportProgress('완료!', 100);

    // Step 5: 결과 알림
    await this._showCompletionNotification(rootPath, config, projectName, isFirstRun);
  }

  /**
   * Step 1: 워크스페이스 스캔 및 상태 비교
   * 
   * @throws {WorkspaceScanError} 스캔 실패 시
   */
  private async _performWorkspaceScan(
    rootPath: string,
    config: VibeReportConfig,
    reportProgress: (message: string, increment?: number) => void
  ): Promise<WorkspaceScanResult> {
    // 프로젝트 스캔
    reportProgress('프로젝트 구조 스캔 중...', 20);
    let snapshot: ProjectSnapshot;
    try {
      snapshot = await this.workspaceScanner.scan(rootPath, config, reportProgress);
    } catch (error) {
      throw new WorkspaceScanError(
        '프로젝트 구조 스캔 실패',
        error instanceof Error ? error.message : String(error)
      );
    }

    // 이전 상태 로드
    reportProgress('상태 분석 중...', 40);
    let state: VibeReportState;
    try {
      const loadedState = await this.snapshotService.loadState(rootPath, config);
      state = loadedState ?? this.snapshotService.createInitialState();
    } catch (error) {
      this.log(`이전 상태 로드 실패, 초기 상태로 시작: ${error}`);
      state = this.snapshotService.createInitialState();
    }

    // 스냅샷 비교
    let diff: SnapshotDiff;
    try {
      diff = await this.snapshotService.compareSnapshots(
        state.lastSnapshot,
        snapshot,
        rootPath,
        config
      );
    } catch (error) {
      throw new WorkspaceScanError(
        '스냅샷 비교 실패',
        error instanceof Error ? error.message : String(error)
      );
    }

    return { snapshot, state, diff };
  }

  /**
   * Step 2: 보고서 디렉토리 및 템플릿 준비
   * 
   * @throws {FileOperationError} 파일 작업 실패 시
   */
  private async _prepareReportTemplates(
    rootPath: string,
    config: VibeReportConfig,
    snapshot: ProjectSnapshot,
    isFirstRun: boolean,
    reportProgress: (message: string, increment?: number) => void
  ): Promise<void> {
    reportProgress('보고서 준비 중...', 60);

    try {
      await this.reportService.ensureReportDirectory(rootPath, config);
    } catch (error) {
      throw new FileOperationError(
        '보고서 디렉토리 생성 실패',
        `${rootPath}/${config.reportDirectory}`
      );
    }

    if (isFirstRun) {
      const paths = this.reportService.getReportPaths(rootPath, config);
      const fs = await import('fs/promises');

      try {
        const evalTemplate = this.reportService.createEvaluationTemplate(snapshot, config.language);
        await fs.writeFile(paths.evaluation, evalTemplate, 'utf-8');
      } catch (error) {
        throw new FileOperationError('평가 보고서 템플릿 생성 실패', paths.evaluation);
      }

      try {
        const improvTemplate = this.reportService.createImprovementTemplate(snapshot, config.language);
        await fs.writeFile(paths.improvement, improvTemplate, 'utf-8');
      } catch (error) {
        throw new FileOperationError('개선 보고서 템플릿 생성 실패', paths.improvement);
      }
    }
  }

  /**
   * Step 2.5: 적용 완료된 개선 항목 자동 제거
   * 
   * @description 개선 보고서와 Prompt.md에서 이미 적용된 항목을 제거
   */
  private async _cleanupAppliedItems(
    rootPath: string,
    config: VibeReportConfig,
    state: VibeReportState,
    reportProgress: (message: string, increment?: number) => void
  ): Promise<void> {
    const applied = state.appliedImprovements ?? [];
    if (applied.length === 0) {
      return;
    }

    reportProgress('적용 완료 항목 정리 중...', 65);

    const result = await this.reportService.cleanupAppliedItems(
      rootPath,
      config,
      applied
    );

    if (result.improvementRemoved > 0 || result.promptRemoved > 0) {
      this.log(`적용 완료 항목 제거: 개선보고서 ${result.improvementRemoved}개, Prompt.md ${result.promptRemoved}개`);
    }
  }

  /**
   * Step 3: 프롬프트 생성 및 클립보드 복사
   */
  private async _generateAndCopyPrompt(
    snapshot: ProjectSnapshot,
    diff: SnapshotDiff,
    state: VibeReportState,
    isFirstRun: boolean,
    config: VibeReportConfig,
    reportProgress: (message: string, increment?: number) => void
  ): Promise<string> {
    reportProgress('분석 프롬프트 생성 중...', 80);

    // projectVisionMode에 따라 비전 결정
    let projectVision: import('../models/types.js').ProjectVision | undefined;

    if (config.projectVisionMode === 'custom' && state.projectVision) {
      // 사용자 정의 비전 사용
      projectVision = state.projectVision;
      this.log('사용자 정의 프로젝트 비전 사용');
    } else {
      // auto 모드: 기본값으로 전체 파일 기반 분석 (비전 없음 = 전체 평가)
      // 단, 기본 설정값은 참조하여 로그에 표시
      this.log(`자동 분석 모드 (projectVisionMode: ${config.projectVisionMode})`);
      projectVision = undefined;
    }

    // 보고서 파일 경로 계산
    const reportPaths = {
      evaluation: `${config.reportDirectory}/Project_Evaluation_Report.md`,
      improvement: `${config.reportDirectory}/Project_Improvement_Exploration_Report.md`,
      prompt: `${config.reportDirectory}/Prompt.md`,
    };

    const prompt = buildAnalysisPrompt(
      snapshot,
      diff,
      state.appliedImprovements,
      isFirstRun,
      config,
      reportPaths,
      projectVision
    );

    try {
      // Use the already-loaded VibeReportConfig (passed into _executeWithProgress/_generateAndCopyPrompt)
      if (config.enableDirectAi) {
        const aiResponse = await this.aiService.runAnalysisPrompt(prompt);

        if (aiResponse) {
          // Make the response easy to consume: open it and also copy it.
          await vscode.env.clipboard.writeText(aiResponse);

          const doc = await vscode.workspace.openTextDocument({
            language: 'markdown',
            content: aiResponse,
          });
          await vscode.window.showTextDocument(doc, { preview: false });

          this.log('Direct AI analysis completed (response copied to clipboard).');
        } else {
          // Fallback: copy the prompt for manual execution
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showInformationMessage('Direct AI unavailable. Prompt copied to clipboard.');
        }
      } else {
        // Standard clipboard-only workflow
        await vscode.env.clipboard.writeText(prompt);
      }
    } catch (error) {
      this.log(`클립보드 복사 실패: ${error}`);
      vscode.window.showWarningMessage('클립보드 복사에 실패했습니다. 프롬프트가 생성되었지만 수동으로 복사해야 합니다.');
    }

    return prompt;
  }

  /**
   * Step 4: 세션 기록 생성 및 저장
   * 
   * @throws {FileOperationError} 저장 실패 시
   */
  private async _saveSessionRecord(
    rootPath: string,
    config: VibeReportConfig,
    state: VibeReportState,
    snapshot: ProjectSnapshot,
    diff: SnapshotDiff,
    isFirstRun: boolean,
    reportProgress: (message: string, increment?: number) => void
  ): Promise<VibeReportState> {
    const sessionId = SnapshotService.generateSessionId();
    const sessionRecord: SessionRecord = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      userPrompt: isFirstRun ? '프로젝트 초기 분석' : '보고서 업데이트',
      changesSummary: SnapshotService.diffToSummary(diff),
      diffSummary: {
        newFilesCount: diff.newFiles.length,
        removedFilesCount: diff.removedFiles.length,
        changedConfigsCount: diff.changedConfigs.length,
        totalChanges: diff.totalChanges,
        linesAdded: diff.linesAdded,
        linesRemoved: diff.linesRemoved,
        linesTotal: diff.linesTotal,
      },
    };

    // 스냅샷 업데이트
    let updatedState = this.snapshotService.updateSnapshot(state, snapshot);
    // 세션 기록 추가
    updatedState = this.snapshotService.addSession(updatedState, sessionRecord);

    try {
      await this.snapshotService.saveState(rootPath, config, updatedState);
    } catch (error) {
      throw new FileOperationError(
        '상태 파일 저장 실패',
        `${rootPath}/${config.snapshotFile}`
      );
    }

    // 세션 히스토리 파일 업데이트 - 메이저 버전 변경 시에만
    // 패치 버전 변경(0.3.26 → 0.3.27)은 스킵, 마이너 버전 변경(0.3.27 → 0.4.0)은 기록
    const previousVersion = state.lastSnapshot?.mainConfigFiles.packageJson?.version;
    const currentVersion = snapshot.mainConfigFiles.packageJson?.version;
    const isMajorChange = SnapshotService.isMajorVersionChange(previousVersion, currentVersion);

    if (isFirstRun || isMajorChange) {
      try {
        await this.reportService.updateSessionHistoryFile(
          rootPath,
          config,
          sessionRecord,
          updatedState.sessions.length,
          updatedState.appliedImprovements.length
        );
        if (isMajorChange) {
          this.log(`메이저 버전 변경 감지 (${previousVersion} → ${currentVersion}), 세션 히스토리에 기록`);
        }
      } catch (error) {
        this.log(`세션 히스토리 파일 업데이트 실패: ${error}`);
      }
    } else {
      this.log(`패치 버전 변경 (${previousVersion} → ${currentVersion}), 세션 히스토리 스킵`);
    }

    return updatedState;
  }

  /**
   * 기존 Prompt.md에서 완료된 프롬프트를 적용 완료 항목으로 추출
   *
   * @description Execution Checklist에서 완료(✅, 완료, Done 등) 상태인 항목을 찾아
   *              AppliedImprovement 목록으로 반환합니다.
   */
  private async _inferAppliedImprovementsFromPrompt(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<import('../models/types.js').AppliedImprovement[]> {
    const paths = this.reportService.getReportPaths(rootPath, config);

    let content: string;
    try {
      const fs = await import('fs/promises');
      content = await fs.readFile(paths.prompt, 'utf-8');
    } catch {
      return [];
    }

    const checklistMatch = content.match(
      /## 📋 Execution Checklist[\s\S]*?(?=\n---|\n\n##|\n\*\*Total|$)/
    );
    if (!checklistMatch) {
      return [];
    }

    const checklist = checklistMatch[0];
    const applied: import('../models/types.js').AppliedImprovement[] = [];
    const seenIds = new Set<string>();

    // | # | Prompt ID | Title | Priority | Status |
    const rowPattern =
      /\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\|/g;

    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(checklist)) !== null) {
      const promptId = match[1].trim();
      const title = match[2].trim();
      const statusCell = match[4].trim();

      const normalized = statusCell.replace(/\s+/g, '').toLowerCase();
      const hasDoneIcon = /✅|☑|✔/.test(statusCell);
      const isPartial =
        normalized.includes('부분완료') ||
        normalized.includes('부분완') ||
        normalized.includes('partial');
      const isKoreanDone =
        normalized.includes('완료') && !normalized.includes('미완료') && !isPartial;
      const isEnglishDone =
        (normalized.includes('done') ||
          normalized.includes('complete') ||
          normalized.includes('completed')) &&
        !normalized.includes('notdone') &&
        !normalized.includes('incomplete') &&
        !isPartial;

      const isDone = !isPartial && (hasDoneIcon || isKoreanDone || isEnglishDone);
      if (!isDone) {
        continue;
      }

      const idFromTitle = title.match(/`([^`]+)`/);
      const improvementId = (idFromTitle ? idFromTitle[1].trim() : promptId) || promptId;

      if (seenIds.has(improvementId)) {
        continue;
      }
      seenIds.add(improvementId);

      applied.push({
        id: improvementId,
        title,
        appliedAt: new Date().toISOString(),
        sessionId: SnapshotService.generateSessionId(),
      });
    }

    return applied;
  }

  /**
   * 기존 적용 완료 목록과 Prompt.md에서 추론된 항목을 병합
   */
  private _mergeAppliedImprovements(
    existing: import('../models/types.js').AppliedImprovement[],
    inferred: import('../models/types.js').AppliedImprovement[]
  ): import('../models/types.js').AppliedImprovement[] {
    if (!inferred.length) {
      return existing;
    }

    const merged = [...existing];
    const existingIds = new Set(existing.map((i) => i.id));
    const existingTitles = new Set(existing.map((i) => i.title.toLowerCase()));

    for (const item of inferred) {
      const titleKey = item.title.toLowerCase();
      if (existingIds.has(item.id) || existingTitles.has(titleKey)) {
        continue;
      }
      merged.push(item);
    }

    return merged;
  }

  /**
   * Step 5: 완료 알림 표시
   */
  private async _showCompletionNotification(
    rootPath: string,
    config: VibeReportConfig,
    projectName: string,
    isFirstRun: boolean
  ): Promise<void> {
    const openChat = 'Copilot Chat 열기';
    const openEval = '평가 보고서 열기';
    const openImprove = '개선 보고서 열기';

    const message = isFirstRun
      ? `✅ [${projectName}] 초기 분석 프롬프트가 클립보드에 복사되었습니다!`
      : `✅ [${projectName}] 업데이트 프롬프트가 클립보드에 복사되었습니다!`;

    const result = await vscode.window.showInformationMessage(
      message + '\n\nCopilot Chat에 붙여넣기(Ctrl+V)하여 분석을 시작하세요.',
      openChat,
      openEval,
      openImprove
    );

    if (result === openChat) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    } else if (result === openEval) {
      await this.reportService.openReport(rootPath, config, 'evaluation');
    } else if (result === openImprove) {
      await this.reportService.openReport(rootPath, config, 'improvement');
    }
  }

  /**
   * 에러 처리 및 사용자 알림
   */
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


  /**
   * 프로젝트 유형 포맷
   */
  private formatProjectType(type: import('../models/types.js').ProjectType): string {
    const typeLabels: Record<string, string> = {
      'vscode-extension': 'VS Code 확장 프로그램',
      'web-frontend': '웹 프론트엔드',
      'web-backend': '웹 백엔드',
      'fullstack': '풀스택',
      'cli-tool': 'CLI 도구',
      'library': '라이브러리/패키지',
      'desktop-app': '데스크톱 앱',
      'mobile-app': '모바일 앱',
      'api-server': 'API 서버',
      'monorepo': '모노레포',
      'other': '기타',
    };
    return typeLabels[type] || type;
  }

  /**
   * 품질 우선순위 설명
   */
  private getQualityFocusDescription(focus: import('../models/types.js').QualityFocus): string {
    const descriptions: Record<string, string> = {
      'prototype': '빠른 구현 우선, 품질은 후순위',
      'development': '기능 완성도 + 기본 품질 (개발 중)',
      'stabilization': '테스트, 에러 처리, 문서화 집중 (안정화)',
      'production': '보안, 성능, 모니터링 집중 (프로덕션)',
      'maintenance': '리팩토링, 기술 부채 해소 (유지보수)',
    };
    return descriptions[focus] || focus;
  }

  /**
   * 카테고리 포맷
   */
  private formatCategory(category: import('../models/types.js').ImprovementCategory): string {
    const categoryLabels: Record<string, string> = {
      'testing': '🧪 테스트',
      'security': '🔒 보안',
      'performance': '⚡ 성능',
      'documentation': '📚 문서화',
      'code-quality': '🧹 코드 품질',
      'architecture': '🏗️ 아키텍처',
      'error-handling': '🛡️ 에러 처리',
      'accessibility': '♿ 접근성',
      'internationalization': '🌐 국제화',
      'devops': '🔧 DevOps/CI/CD',
      'ux-improvement': '🎨 UX 개선',
      'new-feature': '✨ 새 기능',
      'refactoring': '🔄 리팩토링',
      'dependency-update': '📦 의존성 업데이트',
      'monitoring': '📊 모니터링',
      'dependency': '📦 의존성',
      'code-optimization': '🚀 코드 최적화',
      'performance-tuning': '⚙️ 성능 튜닝',
      'other': '기타',
    };
    return categoryLabels[category] || category;
  }

  /**
   * 설정 로드 - 중앙화된 유틸리티 사용
   * @deprecated loadConfig from utils/configUtils.js를 사용하세요
   */

  private log(message: string): void {
    this.outputChannel.appendLine(`[UpdateReports] ${message}`);
  }
}

/**
 * 개선 항목 적용 완료 마킹 명령
 */
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

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
      vscode.window.showWarningMessage('개선 항목을 선택해주세요.');
      return;
    }

    // 항목 ID 추출 시도
    const idMatch = selectedText.match(/항목 ID:\s*`([a-f0-9]+)`/);
    const titleMatch = selectedText.match(/\[P[123]\]\s*([^\n]+)/);

    if (!idMatch && !titleMatch) {
      vscode.window.showWarningMessage(
        '올바른 개선 항목 형식이 아닙니다. [P1/P2/P3] 제목 형식의 항목을 선택해주세요.'
      );
      return;
    }

    const title = titleMatch ? titleMatch[1].trim() : '알 수 없음';
    const id = idMatch ? idMatch[1] : generateImprovementId(title, selectedText);

    // 워크스페이스 선택 (multi-root 지원)
    const rootPath = await selectWorkspaceRoot();
    if (!rootPath) {
      this.log('워크스페이스 선택이 취소되었습니다.');
      return;
    }
    const config = loadConfig();

    // 상태 로드
    let state = await this.snapshotService.loadState(rootPath, config);
    if (!state) {
      state = this.snapshotService.createInitialState();
    }

    // 적용 완료 항목 추가
    state = this.snapshotService.addAppliedImprovement(state, {
      id,
      title,
      appliedAt: new Date().toISOString(),
      sessionId: SnapshotService.generateSessionId(),
    });

    // 상태 저장
    await this.snapshotService.saveState(rootPath, config, state);

    vscode.window.showInformationMessage(
      `개선 항목이 적용 완료로 마킹되었습니다: ${title}`
    );

    this.log(`적용 완료 마킹: ${id} - ${title}`);
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[MarkApplied] ${message}`);
  }
}
