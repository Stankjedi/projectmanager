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
} from '../services/index.js';
import { generateImprovementId, loadConfig } from '../utils/index.js';
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
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.workspaceScanner = new WorkspaceScanner(outputChannel);
    this.snapshotService = new SnapshotService(outputChannel);
    this.reportService = new ReportService(outputChannel);
  }

  /**
   * 보고서 업데이트 실행
   *
   * @description Run a full scan, generate prompt, persist snapshot, and notify user.
   */
  async execute(): Promise<void> {
    // 워크스페이스 확인
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다. 프로젝트 폴더를 열어주세요.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const projectName = workspaceFolders[0].name;

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

    const { snapshot, state, diff } = scanResult;

    // Step 2: 보고서 템플릿 준비
    try {
      await this._prepareReportTemplates(rootPath, config, snapshot, isFirstRun, reportProgress);
    } catch (error) {
      this._handleError(error, '보고서 템플릿 준비');
      return;
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
      snapshot = await this.workspaceScanner.scan(config, reportProgress);
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

    const prompt = this.buildAnalysisPrompt(
      snapshot,
      diff,
      state.appliedImprovements,
      isFirstRun,
      config,
      projectVision
    );

    try {
      await vscode.env.clipboard.writeText(prompt);
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

    // 세션 히스토리 파일 업데이트 (실패해도 계속 진행)
    try {
      await this.reportService.updateSessionHistoryFile(
        rootPath,
        config,
        sessionRecord,
        updatedState.sessions.length,
        updatedState.appliedImprovements.length
      );
    } catch (error) {
      this.log(`세션 히스토리 파일 업데이트 실패: ${error}`);
    }

    return updatedState;
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
   * 분석 프롬프트 생성
   */
  private buildAnalysisPrompt(
    snapshot: ProjectSnapshot,
    diff: SnapshotDiff,
    appliedImprovements: import('../models/types.js').AppliedImprovement[],
    isFirstRun: boolean,
    config: VibeReportConfig,
    projectVision?: import('../models/types.js').ProjectVision
  ): string {
    const lines: string[] = [];

    // 보고서 파일 경로 계산
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const reportDir = workspaceFolder 
      ? `${workspaceFolder.uri.fsPath.replace(/\\/g, '/')}/${config.reportDirectory}`
      : config.reportDirectory;
    const evaluationPath = `${reportDir}/Project_Evaluation_Report.md`;
    const improvementPath = `${reportDir}/Project_Improvement_Exploration_Report.md`;
    const promptPath = `${reportDir}/Prompt.md`;

    lines.push('# 🔧 프로젝트 분석 및 보고서 작성 요청');
    lines.push('');
    lines.push(`현재 열린 **${snapshot.projectName}** 프로젝트를 분석하고, **아래 세 파일에 직접 보고서를 작성**해주세요.`);
    lines.push('');
    lines.push('## 🚨 필수 규칙: 파일 직접 수정 (텍스트 응답 금지)');
    lines.push('');
    lines.push('> **⛔ 절대 금지 사항:**');
    lines.push('> - 채팅으로 코드나 보고서 내용을 텍스트로 보여주는 것');
    lines.push('> - "다음과 같이 수정하세요" 라고 말만 하는 것');
    lines.push('> - 코드 블록으로 변경사항을 표시만 하는 것');
    lines.push('> - **평가 보고서만 작성하고 개선 보고서/프롬프트 파일을 건너뛰는 것**');
    lines.push('> ');
    lines.push('> **✅ 반드시 해야 하는 것:**');
    lines.push('> - `replace_string_in_file` 또는 `create_file` 도구를 사용하여 **직접 파일 수정**');
    lines.push('> - **세 파일 모두 반드시 수정** (평가 보고서 → 개선 보고서 → 프롬프트 파일 순서)');
    lines.push('> - 모든 변경사항을 **실제 파일에 반영**');
    lines.push('> - 파일 수정 후 "파일을 수정했습니다" 라고 확인');
    lines.push('');
    lines.push('### 🚨 중요: 세 파일 모두 필수 수정');
    lines.push('');
    lines.push('| # | 파일 | 설명 | 상태 |');
    lines.push('|:---:|:---|:---|:---:|');
    lines.push(`| 1 | \`${evaluationPath}\` | 종합 평가 보고서 (한국어) | ⬜ 필수 |`);
    lines.push(`| 2 | \`${improvementPath}\` | 개선 제안 보고서 (한국어) | ⬜ 필수 |`);
    lines.push(`| 3 | \`${promptPath}\` | AI 실행 프롬프트 (영어) | ⬜ 필수 |`);
    lines.push('');
    lines.push('**❗ 이 프롬프트를 받으면 세 파일 모두 순서대로 수정하세요. 하나라도 건너뛰면 안 됩니다.**');
    lines.push('');
    lines.push('## 🚨🚨🚨 매우 중요: 파트별 순차 작성 (길이 제한 방지)');
    lines.push('');
    lines.push('> **⚠️ AI 에이전트의 출력 길이 제한으로 인해 한 번에 전체 파일을 작성하면 중간에 잘릴 수 있습니다!**');
    lines.push('> **반드시 아래 지침을 따라 파트별로 나눠서 순차적으로 작성하세요.**');
    lines.push('');
    lines.push('### 📋 파트별 순차 작성 규칙');
    lines.push('');
    lines.push('1. **한 번의 파일 수정에 최대 150줄까지만 작성**');
    lines.push('2. **각 파일을 여러 파트로 나눠서 순차적으로 수정**');
    lines.push('3. **마커(`<!-- AUTO-*-START/END -->`) 기준으로 섹션 분리**');
    lines.push('4. **이전 파트 작성 완료 후 다음 파트 진행**');
    lines.push('');
    lines.push('### 📝 파일별 작성 순서');
    lines.push('');
    lines.push('#### 1️⃣ 평가 보고서 (4~5 파트로 분리)');
    lines.push('```');
    lines.push('파트 1: 프로젝트 개요 섹션 (<!-- AUTO-OVERVIEW-START --> ~ <!-- AUTO-OVERVIEW-END -->)');
    lines.push('파트 2: 종합 점수 섹션 (<!-- AUTO-SCORE-START --> ~ <!-- AUTO-SCORE-END -->)');
    lines.push('파트 3: 기능별 상세 평가 (테이블 + 설명)');
    lines.push('파트 4: 현재 상태 요약 (<!-- AUTO-SUMMARY-START --> ~ <!-- AUTO-SUMMARY-END -->)');
    lines.push('```');
    lines.push('');
    lines.push('#### 2️⃣ 개선 보고서 (3~4 파트로 분리)');
    lines.push('```');
    lines.push('파트 1: 개선 현황 요약 (<!-- AUTO-SUMMARY-START --> ~ <!-- AUTO-SUMMARY-END -->)');
    lines.push('파트 2: P1/P2 개선 항목 (<!-- AUTO-IMPROVEMENT-LIST-START --> 전반부)');
    lines.push('파트 3: P3 기능 추가 항목 (<!-- AUTO-FEATURE-LIST-START --> ~ <!-- AUTO-FEATURE-LIST-END -->)');
    lines.push('```');
    lines.push('');
    lines.push('#### 3️⃣ 프롬프트 파일 (개선 항목 개수에 따라 분리)');
    lines.push('```');
    lines.push('파트 1: 헤더 + Execution Checklist + P1 프롬프트들');
    lines.push('파트 2: P2 프롬프트들 (3~4개씩)');
    lines.push('파트 3: P3 프롬프트들 + 마무리');
    lines.push('```');
    lines.push('');
    lines.push('### ⚡ 작성 예시');
    lines.push('');
    lines.push('**잘못된 방법 ❌:**');
    lines.push('```');
    lines.push('한 번의 replace_string_in_file로 300줄 이상 작성 → 중간에 잘림!');
    lines.push('```');
    lines.push('');
    lines.push('**올바른 방법 ✅:**');
    lines.push('```');
    lines.push('1차 수정: 프로젝트 개요 섹션만 작성 (50줄)');
    lines.push('2차 수정: 종합 점수 테이블 작성 (30줄)');
    lines.push('3차 수정: 기능별 평가 작성 (80줄)');
    lines.push('4차 수정: 요약 섹션 작성 (40줄)');
    lines.push('→ 총 4번의 수정으로 완성!');
    lines.push('```');
    lines.push('');
    lines.push('### 🔧 수정 도구 사용 팁');
    lines.push('');
    lines.push('- **`replace_string_in_file`**: oldString은 3~5줄의 고유한 컨텍스트만 포함');
    lines.push('- **`multi_replace_string_in_file`**: 같은 파일의 여러 작은 섹션을 한 번에 수정 가능');
    lines.push('- **섹션 마커 활용**: `<!-- AUTO-*-START/END -->` 마커 사이의 내용만 교체');
    lines.push('');

    // 프로젝트 요약 정보
    lines.push('---');
    lines.push('');
    lines.push('## 📋 프로젝트 현황');
    lines.push('');
    lines.push(`- **프로젝트명**: ${snapshot.projectName}`);
    
    // 파일/디렉토리 수와 변화량 표시
    const filesChange = diff.filesCountDiff !== undefined && diff.filesCountDiff !== 0 
      ? ` (${diff.filesCountDiff > 0 ? '+' : ''}${diff.filesCountDiff})` 
      : '';
    const dirsChange = diff.dirsCountDiff !== undefined && diff.dirsCountDiff !== 0 
      ? ` (${diff.dirsCountDiff > 0 ? '+' : ''}${diff.dirsCountDiff})` 
      : '';
    
    lines.push(`- **파일 수**: ${snapshot.filesCount}개${filesChange}`);
    lines.push(`- **디렉토리 수**: ${snapshot.dirsCount}개${dirsChange}`);
    
    const topLanguages = Object.entries(snapshot.languageStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => `${lang}(${count})`)
      .join(', ');
    lines.push(`- **주요 언어**: ${topLanguages || '감지 안됨'}`);
    
    if (snapshot.mainConfigFiles.packageJson) {
      const pkg = snapshot.mainConfigFiles.packageJson;
      lines.push(`- **프로젝트 버전**: ${pkg.version || '-'}`);
      const mainDeps = pkg.dependencies.slice(0, 8).join(', ');
      if (mainDeps) {
        lines.push(`- **주요 의존성**: ${mainDeps}${pkg.dependencies.length > 8 ? '...' : ''}`);
      }
    }
    lines.push('');

    // 프로젝트 비전 정보 (설정된 경우)
    if (projectVision) {
      lines.push('## 🎯 프로젝트 비전 (개선 방향 지침)');
      lines.push('');
      lines.push('> ⚠️ **중요**: 아래 프로젝트 비전에 맞는 개선사항만 제안해야 합니다.');
      lines.push('> 비전에 명시된 목표, 우선순위, 기술 스택에 부합하지 않는 개선은 제외하세요.');
      lines.push('');
      
      if (projectVision.coreGoals && projectVision.coreGoals.length > 0) {
        lines.push('### 프로젝트 핵심 목표');
        projectVision.coreGoals.forEach(goal => {
          lines.push(`- ${goal}`);
        });
        lines.push('');
      }

      if (projectVision.targetUsers) {
        lines.push('### 대상 사용자');
        lines.push(`- ${projectVision.targetUsers}`);
        lines.push('');
      }

      if (projectVision.projectType) {
        lines.push('### 프로젝트 유형');
        lines.push(`- ${this.formatProjectType(projectVision.projectType)}`);
        lines.push('');
      }

      if (projectVision.techStackPriorities && projectVision.techStackPriorities.length > 0) {
        lines.push('### 기술 스택 우선순위');
        lines.push(`기술: ${projectVision.techStackPriorities.join(', ')}`);
        lines.push('');
      }

      if (projectVision.qualityFocus) {
        lines.push('### 현재 개발 단계');
        const focusDescription = this.getQualityFocusDescription(projectVision.qualityFocus);
        lines.push(`- **${projectVision.qualityFocus}**: ${focusDescription}`);
        lines.push('');
      }

      if (projectVision.constraints && projectVision.constraints.length > 0) {
        lines.push('### 제약 조건');
        projectVision.constraints.forEach(constraint => {
          lines.push(`- ⚠️ ${constraint}`);
        });
        lines.push('');
      }

      if (projectVision.focusCategories && projectVision.focusCategories.length > 0) {
        lines.push('### ✅ 개선 집중 영역 (이 카테고리 우선 제안)');
        projectVision.focusCategories.forEach(category => {
          lines.push(`- **${this.formatCategory(category)}**`);
        });
        lines.push('');
      }

      if (projectVision.excludeCategories && projectVision.excludeCategories.length > 0) {
        lines.push('### ❌ 개선 제외 영역 (이 카테고리는 제안하지 마세요)');
        projectVision.excludeCategories.forEach(category => {
          lines.push(`- ~~${this.formatCategory(category)}~~`);
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // 변경사항 (업데이트인 경우)
    if (!isFirstRun && !diff.isInitial) {
      lines.push('## 📝 이전 분석 이후 변경사항');
      lines.push('');
      if (diff.totalChanges === 0 && (diff.filesCountDiff === undefined || diff.filesCountDiff === 0)) {
        lines.push('- 변경사항 없음');
      } else {
        if (diff.filesCountDiff !== undefined && diff.filesCountDiff !== 0) {
          const changeType = diff.filesCountDiff > 0 ? '증가' : '감소';
          lines.push(`- 파일 수 ${changeType}: ${Math.abs(diff.filesCountDiff)}개`);
        }
        if (diff.newFiles.length > 0) {
          lines.push(`- 새 파일: ${diff.newFiles.length}개`);
          // 새 파일 목록 (최대 10개)
          diff.newFiles.slice(0, 10).forEach(f => {
            lines.push(`  - \`${f}\``);
          });
          if (diff.newFiles.length > 10) {
            lines.push(`  - ... 외 ${diff.newFiles.length - 10}개`);
          }
        }
        if (diff.removedFiles.length > 0) {
          lines.push(`- 삭제된 파일: ${diff.removedFiles.length}개`);
        }
        if (diff.changedConfigs.length > 0) {
          lines.push(`- 설정 변경: ${diff.changedConfigs.join(', ')}`);
        }
      }
      lines.push('');
    }

    // 적용된 개선사항
    if (appliedImprovements.length > 0) {
      lines.push('## ✅ 이미 적용된 개선사항 (제외 필수)');
      lines.push('');
      appliedImprovements.forEach(imp => {
        lines.push(`- ${imp.title}`);
      });
      lines.push('');
    }

    // ===== 평가 보고서 작성 요청 =====
    lines.push('---');
    lines.push('');
    lines.push('## 📊 작성 요청 1: 종합 평가 보고서');
    lines.push('');
    lines.push(`**파일 경로**: \`${evaluationPath}\``);
    lines.push('');
    lines.push('### 필수 포함 섹션:');
    lines.push('');
    lines.push('#### 1. 프로젝트 목표 및 비전');
    lines.push('- 프로젝트의 목적과 핵심 목표');
    lines.push('- 대상 사용자');
    lines.push('');
    lines.push('#### 2. 현재 구현된 기능');
    lines.push('테이블 형식으로 작성:');
    lines.push('```');
    lines.push('| 기능 | 상태 | 설명 | 평가 |');
    lines.push('|------|------|------|------|');
    lines.push('| 기능명 | ✅ 완료/🔄 부분/❌ 미구현 | 설명 | 🟢 우수/🟡 양호/🔴 미흡 |');
    lines.push('```');
    lines.push('');
    lines.push('#### 3. 종합 점수 테이블');
    lines.push('`<!-- AUTO-SCORE-START -->` 와 `<!-- AUTO-SCORE-END -->` 마커 사이에 작성:');
    lines.push('');
    lines.push('**🚨 필수: 아래 점수-등급 기준을 정확히 적용하세요!**');
    lines.push('');
    lines.push('| 점수 범위 | 등급 | 색상 | 의미 |');
    lines.push('|:---:|:---:|:---:|:---|');
    lines.push('| 97-100 | A+ | 🟢 | 최우수 |');
    lines.push('| 93-96 | A | 🟢 | 우수 |');
    lines.push('| 90-92 | A- | 🟢 | 우수 |');
    lines.push('| 87-89 | B+ | 🔵 | 양호 |');
    lines.push('| 83-86 | B | 🔵 | 양호 |');
    lines.push('| 80-82 | B- | 🔵 | 양호 |');
    lines.push('| 77-79 | C+ | 🟡 | 보통 |');
    lines.push('| 73-76 | C | 🟡 | 보통 |');
    lines.push('| 70-72 | C- | 🟡 | 보통 |');
    lines.push('| 67-69 | D+ | 🟠 | 미흡 |');
    lines.push('| 63-66 | D | 🟠 | 미흡 |');
    lines.push('| 60-62 | D- | 🟠 | 미흡 |');
    lines.push('| 0-59 | F | 🔴 | 부족 |');
    lines.push('');
    lines.push('**예시:**');
    lines.push('- 점수 85 → 등급 B (83-86 범위)');
    lines.push('- 점수 72 → 등급 C- (70-72 범위)');
    lines.push('- 점수 88 → 등급 B+ (87-89 범위)');
    lines.push('- 점수 91 → 등급 A- (90-92 범위)');
    lines.push('');
    lines.push('**테이블 형식:**');
    lines.push('```');
    lines.push('| 항목 | 점수 (100점 만점) | 등급 | 변화 |');
    lines.push('|------|------------------|------|------|');
    lines.push('| 코드 품질 | 85 | 🔵 B | ⬆️ +7 |');
    lines.push('| 테스트 커버리지 | 72 | 🟡 C- | ⬆️ +27 |');
    lines.push('| ... | ... | ... | ... |');
    lines.push('```');
    lines.push('');
    lines.push('**⚠️ 점수와 등급이 일치하지 않으면 잘못된 평가입니다!**');
    lines.push('');
    lines.push('#### 4. 기능별 상세 평가');
    lines.push('각 주요 모듈/서비스별로:');
    lines.push('- 기능 완성도, 코드 품질, 에러 처리, 성능 점수');
    lines.push('- 강점과 약점');
    lines.push('');
    lines.push('#### 5. 현재 상태 요약');
    lines.push('`<!-- AUTO-SUMMARY-START -->` 와 `<!-- AUTO-SUMMARY-END -->` 마커 사이에 작성');
    lines.push('');
    lines.push('> ⚠️ **세션 로그는 `Session_History.md` 파일에서 자동 관리됩니다.**');
    lines.push('> 평가 보고서에는 세션 로그를 작성하지 마세요.');
    lines.push('');

    // ===== 개선 보고서 작성 요청 =====
    lines.push('---');
    lines.push('');
    lines.push('## 🚀 작성 요청 2: 개선 제안 보고서');
    lines.push('');
    lines.push(`**파일 경로**: \`${improvementPath}\``);
    lines.push('');
    lines.push('### ⚠️ 핵심 원칙: 미적용 항목만 표시');
    lines.push('');
    lines.push('**❌ 절대 금지:**');
    lines.push('- 이미 적용 완료된 항목을 보고서에 표시하지 마세요');
    lines.push('- "✅ 적용 완료" 섹션을 만들지 마세요');
    lines.push('- 완료된 항목의 히스토리를 개선 목록에 남기지 마세요');
    lines.push('');
    lines.push('**✅ 올바른 방법:**');
    lines.push('- 현재 시점에서 **아직 적용되지 않은** 개선 항목만 작성');
    lines.push('- 코드를 분석하여 **새로운 개선점** 발굴');
    lines.push('- 기존 미적용 항목 + 새 발견 항목만 포함');
    lines.push('');
    lines.push('### 필수 포함 섹션:');
    lines.push('');
    lines.push('#### 1. 전체 개선 현황 요약');
    lines.push('`<!-- AUTO-SUMMARY-START -->` 마커 사이에:');
    lines.push('- 현황 개요 테이블 (P1/P2/P3 **미적용** 개수만)');
    lines.push('- **항목별 분포 테이블** (아래 형식 필수):');
    lines.push('```');
    lines.push('| # | 항목명 | 우선순위 | 카테고리 |');
    lines.push('|:---:|:---|:---:|:---|');
    lines.push('| 1 | loadConfig 리팩토링 | P2 | 🧹 코드 품질 |');
    lines.push('| 2 | 명령 레이어 테스트 | P2 | 🧪 테스트 |');
    lines.push('| 3 | AI 직접 연동 | P3 | ✨ 기능 추가 |');
    lines.push('```');
    lines.push('- 우선순위별 한줄 요약');
    lines.push('- **적용 완료 항목 개수는 세션 로그에만 기록** (요약에서는 총 개수만 언급)');
    lines.push('');
    lines.push('#### 2. 🔧 기능 개선 항목 (기존 기능 개선)');
    lines.push('`<!-- AUTO-IMPROVEMENT-LIST-START -->` 마커 사이에:');
    lines.push('');
    lines.push('**미적용 항목만** 아래 형식으로 작성 (**코드 제외, 설명만**):');
    lines.push('```');
    lines.push('### 🟡 중요 (P2)');
    lines.push('');
    lines.push('#### [P2-1] 항목명');
    lines.push('| 항목 | 내용 |');
    lines.push('|------|------|');
    lines.push('| **ID** | `고유-id` |');
    lines.push('| **카테고리** | 🧪 테스트 / 🔒 보안 / 🧹 코드 품질 등 |');
    lines.push('| **복잡도** | Low / Medium / High |');
    lines.push('| **대상 파일** | 파일 경로 |');
    lines.push('');
    lines.push('**현재 상태:** ...');
    lines.push('**개선 내용:** ...');
    lines.push('**기대 효과:** ...');
    lines.push('```');
    lines.push('');
    lines.push('#### 3. ✨ 기능 추가 항목 (새 기능)');
    lines.push('`<!-- AUTO-FEATURE-LIST-START -->` 마커 사이에:');
    lines.push('- 위와 동일한 형식으로 새 기능 제안 (**미적용 항목만**)');
    lines.push('');
    lines.push('#### 4. 🚀 코드 품질 및 성능 최적화 섹션 (필수)');
    lines.push('`<!-- AUTO-OPTIMIZATION-START -->` 와 `<!-- AUTO-OPTIMIZATION-END -->` 마커 사이에:');
    lines.push('');
    lines.push('> **⚠️ 중요**: 기존 기능을 해치지 않으면서 코드 품질과 성능을 향상시킬 수 있는 개선점을 반드시 분석하세요.');
    lines.push('> 이 섹션은 프로젝트의 최대 잠재력을 끌어내기 위한 최적화 제안입니다.');
    lines.push('');
    lines.push('**분석 및 제안 항목:**');
    lines.push('');
    lines.push('##### 🔍 코드 품질 분석');
    lines.push('- **중복 코드 제거**: 비슷한 로직이 여러 곳에 있다면 공통 유틸리티로 추출');
    lines.push('- **타입 안전성 강화**: any 타입 제거, 엄격한 타입 정의');
    lines.push('- **코드 가독성**: 복잡한 함수 분리, 명확한 변수/함수 네이밍');
    lines.push('- **에러 처리 개선**: try-catch 누락, 에러 메시지 명확화');
    lines.push('- **코드 구조 개선**: SRP(단일 책임 원칙) 적용, 모듈 분리');
    lines.push('');
    lines.push('##### ⚡ 성능 최적화 분석');
    lines.push('- **불필요한 연산 제거**: 반복 계산, 불필요한 객체 생성');
    lines.push('- **비동기 처리 최적화**: Promise.all 활용, 병렬 처리 가능 작업 식별');
    lines.push('- **메모리 사용 최적화**: 대용량 데이터 처리, 메모리 누수 방지');
    lines.push('- **캐싱 전략**: 반복 호출되는 비용이 큰 작업에 캐싱 적용');
    lines.push('- **지연 로딩**: 필요할 때만 로드하는 lazy loading 패턴');
    lines.push('');
    lines.push('##### 📝 제안 형식');
    lines.push('```');
    lines.push('### 🚀 코드 최적화 (OPT-1)');
    lines.push('| 항목 | 내용 |');
    lines.push('|------|------|');
    lines.push('| **ID** | `opt-고유id` |');
    lines.push('| **카테고리** | 🚀 코드 최적화 / ⚙️ 성능 튜닝 |');
    lines.push('| **영향 범위** | 성능 / 품질 / 둘 다 |');
    lines.push('| **대상 파일** | 파일 경로 |');
    lines.push('');
    lines.push('**현재 상태:** [현재 코드의 문제점 설명]');
    lines.push('**최적화 내용:** [구체적인 개선 방법]');
    lines.push('**예상 효과:**');
    lines.push('- 성능: [예: API 응답 시간 30% 단축, 메모리 사용량 20% 감소]');
    lines.push('- 품질: [예: 코드 라인 수 50% 감소, 유지보수성 향상]');
    lines.push('**측정 가능한 지표:** [벤치마크 방법 또는 측정 기준]');
    lines.push('```');
    lines.push('');
    lines.push('> ⚠️ **세션 로그는 `Session_History.md` 파일에서 자동 관리됩니다.**');
    lines.push('> 개선 보고서에는 세션 로그를 작성하지 마세요.');
    lines.push('');

    // ===== 프롬프트 파일 작성 요청 (영어) =====
    lines.push('---');
    lines.push('');
    lines.push('## 🤖 Request 3: AI Prompt File (Write in English)');
    lines.push('');
    lines.push(`**File Path**: \`${promptPath}\``);
    lines.push('');
    lines.push('### ⚠️ CRITICAL: Based on Improvement Report');
    lines.push('');
    lines.push('**Prompt.md MUST be generated from the Improvement Report\'s pending items:**');
    lines.push('- Read `Project_Improvement_Exploration_Report.md` first');
    lines.push('- Extract ONLY the pending (not applied) items from P1/P2/P3 sections');
    lines.push('- Create prompts for EACH pending item with complete implementation code');
    lines.push('- DO NOT include prompts for already completed items');
    lines.push('');
    lines.push('### ⚠️ CRITICAL: Sequential Execution Structure');
    lines.push('');
    lines.push('The Prompt.md file MUST be structured so that when copied entirely and given to an AI agent,');
    lines.push('the agent will execute ALL prompts sequentially without stopping after the first one.');
    lines.push('');
    lines.push('### ⚠️ CRITICAL: No Useless Headers or Descriptions');
    lines.push('');
    lines.push('**DO NOT include any of these at the top of Prompt.md:**');
    lines.push('- Generic descriptions like "This file contains ready-to-use prompts"');
    lines.push('- Instructions like "Copy any section and paste it into Copilot Chat"');
    lines.push('- Any introductory text that is not directly actionable');
    lines.push('');
    lines.push('**START DIRECTLY with the mandatory execution rules.**');
    lines.push('');
    lines.push('### Required File Structure:');
    lines.push('');
    lines.push('````markdown');
    lines.push('# 🤖 AI Agent Improvement Prompts');
    lines.push('');
    lines.push('> ## 🚨 MANDATORY: FILE MODIFICATION REQUIRED');
    lines.push('> ');
    lines.push('> **⛔ DO NOT just respond with text or code blocks.**');
    lines.push('> **⛔ DO NOT say "you can modify like this" without actually modifying.**');
    lines.push('> **⛔ DO NOT explain what needs to be done without doing it.**');
    lines.push('> ');
    lines.push('> **✅ YOU MUST use file editing tools (`replace_string_in_file`, `create_file`, `multi_replace_string_in_file`) to directly modify files.**');
    lines.push('> **✅ After each prompt, confirm "I have modified the file(s)" with the actual changes made.**');
    lines.push('> ');
    lines.push('> ---');
    lines.push('> ');
    lines.push('> **Process ALL prompts below SEQUENTIALLY. Do NOT stop after completing one prompt.**');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📋 Execution Checklist');
    lines.push('');
    lines.push('| # | Prompt ID | Title | Priority | Status |');
    lines.push('|:---:|:---|:---|:---:|:---:|');
    lines.push('| 1 | PROMPT-001 | [Title from P2-1 in Improvement Report] | P2 | ⬜ Pending |');
    lines.push('| 2 | PROMPT-002 | [Title from P2-2 in Improvement Report] | P2 | ⬜ Pending |');
    lines.push('| 3 | PROMPT-003 | [Title from P3-1 in Improvement Report] | P3 | ⬜ Pending |');
    lines.push('| ... | ... | ... | ... | ... |');
    lines.push('');
    lines.push('**Total: X prompts** | **Completed: 0** | **Remaining: X**');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🔴 Priority 1 (Critical) - Execute First');
    lines.push('');
    lines.push('### [PROMPT-001] Title Here');
    lines.push('');
    lines.push('> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**');
    lines.push('');
    lines.push('**Task**: Clear one-sentence description of what needs to be done');
    lines.push('**Files to Modify**: `src/path/to/file.ts`');
    lines.push('');
    lines.push('#### Instructions:');
    lines.push('');
    lines.push('1. Open `src/path/to/file.ts`');
    lines.push('2. Locate the specific section to modify');
    lines.push('3. Apply the changes shown below');
    lines.push('');
    lines.push('#### Implementation Code:');
    lines.push('');
    lines.push('```typescript');
    lines.push('// FULL implementation code here - NO abbreviations');
    lines.push('// Include ALL necessary imports');
    lines.push('// Include COMPLETE function/class definitions');
    lines.push('```');
    lines.push('');
    lines.push('#### Verification:');
    lines.push('- Run: `pnpm run compile`');
    lines.push('- Expected: No compilation errors');
    lines.push('');
    lines.push('**✅ After completing this prompt, proceed to [PROMPT-002]**');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('### [PROMPT-002] Next Title');
    lines.push('');
    lines.push('**⏱️ Execute this prompt now, then proceed to PROMPT-003**');
    lines.push('');
    lines.push('[Continue with same structure...]');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🟡 Priority 2 (High) - Execute Second');
    lines.push('');
    lines.push('[P2 prompts with same structure...]');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🟢 Priority 3 (Medium) - Execute Last');
    lines.push('');
    lines.push('[P3 prompts with same structure...]');
    lines.push('');
    lines.push('**🎉 ALL PROMPTS COMPLETED! Run final verification.**');
    lines.push('````');
    lines.push('');
    lines.push('### ⚠️ MANDATORY Requirements for Each Prompt:');
    lines.push('');
    lines.push('1. **Header**: `**⏱️ Execute this prompt now, then proceed to PROMPT-XXX**`');
    lines.push('2. **Complete Code**: NO `// ... existing code ...` or `/* omitted */`');
    lines.push('3. **Full Context**: Include imports, class definitions, everything needed');
    lines.push('4. **Verification Step**: Include command to run after implementation');
    lines.push('5. **Footer**: `**✅ After completing this prompt, proceed to [PROMPT-XXX]**`');
    lines.push('6. **Final Prompt**: End with `**🎉 ALL PROMPTS COMPLETED!**`');
    lines.push('');
    lines.push('### ❌ NEVER Include:');
    lines.push('- Abbreviated code blocks');
    lines.push('- Placeholder comments like `// add implementation here`');
    lines.push('- References to "see above" or "similar to previous"');
    lines.push('- Incomplete function bodies');
    lines.push('- "Previously Completed Prompts" section or any completed prompt history');
    lines.push('- Any list or mention of already completed/applied improvements');
    lines.push('- Historical data about past prompts or previous sessions');
    lines.push('');
    lines.push('### 📌 IMPORTANT: Prompt.md Content Rule');
    lines.push('- Prompt.md should ONLY contain PENDING prompts that need to be executed');
    lines.push('- DO NOT add any section showing completed or previously applied prompts');
    lines.push('- Each run should generate fresh prompts based on current improvement report');
    lines.push('- No historical tracking of completed prompts in this file');
    lines.push('');
    lines.push('### 🚨 CRITICAL: Write Prompt.md in Multiple Parts');
    lines.push('');
    lines.push('**Due to output length limits, write Prompt.md in sequential parts:**');
    lines.push('');
    lines.push('```');
    lines.push('Part 1: Header + Execution Checklist + First 2-3 prompts');
    lines.push('Part 2: Next 2-3 prompts');
    lines.push('Part 3: Remaining prompts + Final verification section');
    lines.push('```');
    lines.push('');
    lines.push('**Each prompt section should be ~50-80 lines max.**');
    lines.push('**If there are 6+ prompts, split into 3+ parts.**');
    lines.push('');

    // ===== 완료 확인 =====
    lines.push('---');
    lines.push('');
    lines.push('## ✅ 작성 완료 체크리스트');
    lines.push('');
    lines.push('### 🚨 필수: 세 파일 모두 수정 확인');
    lines.push('');
    lines.push(`| # | 파일 | 완료 확인 |`);
    lines.push(`|:---:|:---|:---:|`);
    lines.push(`| 1 | \`${evaluationPath}\` | [ ] 평가 보고서 수정 완료 |`);
    lines.push(`| 2 | \`${improvementPath}\` | [ ] 개선 보고서 수정 완료 |`);
    lines.push(`| 3 | \`${promptPath}\` | [ ] 프롬프트 파일 수정 완료 |`);
    lines.push('');
    lines.push('**⚠️ 세 파일 모두 수정해야 작업이 완료됩니다. 평가 보고서만 수정하고 끝내지 마세요!**');
    lines.push('');
    lines.push('### 각 파일 검증 항목:');
    lines.push('');
    lines.push('**평가 보고서:**');
    lines.push('- [ ] 프로젝트 목표 및 비전 작성');
    lines.push('- [ ] 기능 테이블 작성');
    lines.push('- [ ] 종합 점수 테이블 작성');
    lines.push('- [ ] 기능별 상세 평가 작성');
    lines.push('- [ ] 현재 상태 요약 작성');
    lines.push('');
    lines.push('**개선 보고서:**');
    lines.push('- [ ] 개선 현황 요약 (항목별 분포 테이블 포함)');
    lines.push('- [ ] 기능 개선 항목 (P1/P2)');
    lines.push('- [ ] 기능 추가 항목 (P3)');
    lines.push('- [ ] 미적용 항목만 표시 (적용 완료 항목 제외)');
    lines.push('');
    lines.push('**프롬프트 파일:**');
    lines.push('- [ ] Execution Checklist 테이블');
    lines.push('- [ ] 각 프롬프트에 순차 실행 헤더/푸터');
    lines.push('- [ ] 완전한 구현 코드 (축약 없음)');
    lines.push('- [ ] 마지막에 "ALL PROMPTS COMPLETED"');
    lines.push('');
    lines.push('### 🚨 파트별 순차 작성 확인');
    lines.push('');
    lines.push('각 파일 작성 시 **한 번에 150줄 이상 작성하지 마세요!**');
    lines.push('');
    lines.push('```');
    lines.push('✅ 올바른 작성 순서:');
    lines.push('1. 평가 보고서 파트1 → 파트2 → 파트3 → 파트4 (완료)');
    lines.push('2. 개선 보고서 파트1 → 파트2 → 파트3 (완료)');
    lines.push('3. 프롬프트 파일 파트1 → 파트2 → 파트3 (완료)');
    lines.push('');
    lines.push('❌ 잘못된 작성:');
    lines.push('- 한 번에 전체 파일 작성 시도 → 중간에 잘림!');
    lines.push('```');

    return lines.join('\n');
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

    // 워크스페이스 확인
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
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
