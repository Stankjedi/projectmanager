import type {
  AppliedImprovement,
  EvaluationHistoryEntry,
  EvaluationCategory,
  ProjectSnapshot,
  SessionRecord,
  SnapshotDiff,
  VibeReportConfig,
  VibeReportState,
  ProjectVision,
} from '../models/types.js';
import { EVALUATION_CATEGORY_LABELS, scoreToGrade } from '../models/types.js';
import { FileOperationError, OperationCancelledError } from '../models/errors.js';
import { SnapshotService } from '../services/snapshotService.js';
import { formatScoreChange, gradeEmoji, parseScoresFromAIResponse } from '../utils/markdownUtils.js';
import { extractBetweenMarkersLines, replaceBetweenMarkersLines } from '../utils/markerUtils.js';
import { performWorkspaceScan } from './updateReportsWorkflow/performWorkspaceScan.js';
import {
  inferAppliedImprovementsFromPrompt,
  mergeAppliedImprovements,
} from './updateReportsWorkflow/appliedImprovements.js';
import { prepareReportTemplates } from './updateReportsWorkflow/prepareReportTemplates.js';

export type WorkflowProgress = (message: string, increment?: number) => void;

export interface CancellationTokenLike {
  isCancellationRequested: boolean;
}

export interface ProgressLike {
  report(value: { message?: string; increment?: number }): void;
}

export interface UpdateReportsWorkflowUi {
  withProgress<T>(
    options: { title: string; cancellable: boolean },
    task: (progress: ProgressLike, token: CancellationTokenLike) => Promise<T>
  ): PromiseLike<T>;
  clipboardWriteText(text: string): PromiseLike<void>;
  showInformationMessage(message: string): void;
  showWarningMessage(message: string): void;
  openMarkdownDocument(content: string): Promise<void>;
}

export interface UpdateReportsWorkflowFs {
  readFile(filePath: string, encoding: 'utf-8'): Promise<string>;
  writeFile(filePath: string, data: string, encoding: 'utf-8'): Promise<void>;
}

export interface WorkspaceScannerLike {
  scan(
    rootPath: string,
    config: VibeReportConfig,
    reportProgress: WorkflowProgress,
    cancellationToken?: CancellationTokenLike
  ): Promise<ProjectSnapshot>;
}

export interface SnapshotServiceLike {
  loadState(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<VibeReportState | null>;
  createInitialState(): VibeReportState;
  compareSnapshots(
    previous: ProjectSnapshot | null,
    current: ProjectSnapshot,
    rootPath: string,
    config: VibeReportConfig
  ): Promise<SnapshotDiff>;
  updateSnapshot(state: VibeReportState, snapshot: ProjectSnapshot): VibeReportState;
  addSession(state: VibeReportState, session: SessionRecord): VibeReportState;
  saveState(
    rootPath: string,
    config: VibeReportConfig,
    state: VibeReportState
  ): Promise<void>;
}

export interface ReportServiceLike {
  ensureReportDirectory(rootPath: string, config: VibeReportConfig): Promise<void>;
  getReportPaths(
    rootPath: string,
    config: VibeReportConfig
  ): { evaluation: string; improvement: string; sessionHistory: string; prompt: string };
  createEvaluationTemplate(snapshot: ProjectSnapshot, language: 'ko' | 'en'): string;
  createImprovementTemplate(snapshot: ProjectSnapshot, language: 'ko' | 'en'): string;
  cleanupAppliedItems(
    rootPath: string,
    config: VibeReportConfig,
    appliedImprovements: AppliedImprovement[],
    cancellationToken?: CancellationTokenLike
  ): Promise<{ improvementRemoved: number; promptRemoved: number }>;
  updateSessionHistoryFile(
    rootPath: string,
    config: VibeReportConfig,
    sessionRecord: SessionRecord,
    totalSessions: number,
    appliedCount: number
  ): Promise<void>;
}

export interface AiServiceLike {
  runAnalysisPrompt(
    prompt: string,
    options?: { cancellationToken?: CancellationTokenLike }
  ): Promise<string | null>;
}

export type BuildAnalysisPromptFn = (
  snapshot: ProjectSnapshot,
  diff: SnapshotDiff,
  appliedImprovements: AppliedImprovement[],
  isFirstRun: boolean,
  config: VibeReportConfig,
  reportPaths: { evaluation: string; improvement: string; prompt: string },
  projectVision?: ProjectVision
) => string;

export interface UpdateReportsWorkflowDeps {
  workspaceScanner: WorkspaceScannerLike;
  snapshotService: SnapshotServiceLike;
  reportService: ReportServiceLike;
  aiService: AiServiceLike;
  fs: UpdateReportsWorkflowFs;
  ui: UpdateReportsWorkflowUi;
  buildAnalysisPrompt: BuildAnalysisPromptFn;
  log: (message: string) => void;
  now: () => Date;
}

export interface RunUpdateReportsWorkflowArgs {
  rootPath: string;
  projectName: string;
  config: VibeReportConfig;
  isFirstRun: boolean;
  reportProgress: WorkflowProgress;
  cancellationToken?: CancellationTokenLike;
  deps: UpdateReportsWorkflowDeps;
}

export interface RunUpdateReportsWorkflowResult {
  snapshot: ProjectSnapshot;
  diff: SnapshotDiff;
  state: VibeReportState;
  updatedState: VibeReportState;
  prompt: string;
}

export class UpdateReportsWorkflowError extends Error {
  readonly step: string;
  readonly cause: unknown;

  constructor(step: string, cause: unknown) {
    super(step);
    this.name = 'UpdateReportsWorkflowError';
    this.step = step;
    this.cause = cause;
  }
}

function throwIfCancelled(
  cancellationToken?: CancellationTokenLike,
  step?: string
): void {
  if (!cancellationToken?.isCancellationRequested) {
    return;
  }

  const message = step ? `${step} cancelled` : 'Operation cancelled';
  throw new OperationCancelledError(message);
}

export async function runUpdateReportsWorkflow(
  args: RunUpdateReportsWorkflowArgs
): Promise<RunUpdateReportsWorkflowResult> {
  const {
    rootPath,
    config,
    isFirstRun,
    reportProgress,
    deps,
    cancellationToken,
  } = args;

  let snapshot: ProjectSnapshot;
  let state: VibeReportState;
  let diff: SnapshotDiff;
  try {
    throwIfCancelled(cancellationToken, '프로젝트 스캔');
    ({ snapshot, state, diff } = await performWorkspaceScan({
      rootPath,
      config,
      reportProgress,
      deps,
      cancellationToken,
    }));
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    throw new UpdateReportsWorkflowError('프로젝트 스캔', error);
  }

  throwIfCancelled(cancellationToken, '적용 완료 항목 추론');
  const stateWithApplied = await inferAppliedImprovementsBestEffort({
    rootPath,
    config,
    state,
    deps,
  });

  try {
    throwIfCancelled(cancellationToken, '보고서 템플릿 준비');
    await prepareReportTemplates({
      rootPath,
      config,
      snapshot,
      isFirstRun,
      reportProgress,
      deps,
      cancellationToken,
    });
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    throw new UpdateReportsWorkflowError('보고서 템플릿 준비', error);
  }

  await cleanupAppliedItemsBestEffort({
    rootPath,
    config,
    state: stateWithApplied,
    reportProgress,
    deps,
    cancellationToken,
  });

  let prompt: string;
  try {
    throwIfCancelled(cancellationToken, '프롬프트 생성');
    prompt = await generateAndCopyPrompt({
      snapshot,
      diff,
      state: stateWithApplied,
      isFirstRun,
      config,
      reportProgress,
      deps,
      cancellationToken,
    });
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    throw new UpdateReportsWorkflowError('프롬프트 생성', error);
  }

  let updatedState: VibeReportState;
  try {
    throwIfCancelled(cancellationToken, '세션 기록 저장');
    updatedState = await saveSessionRecord({
      rootPath,
      config,
      state: stateWithApplied,
      snapshot,
      diff,
      isFirstRun,
      deps,
      cancellationToken,
    });
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    throw new UpdateReportsWorkflowError('세션 기록 저장', error);
  }

  return {
    snapshot,
    diff,
    state: stateWithApplied,
    updatedState,
    prompt,
  };
}

async function inferAppliedImprovementsBestEffort(args: {
  rootPath: string;
  config: VibeReportConfig;
  state: VibeReportState;
  deps: UpdateReportsWorkflowDeps;
}): Promise<VibeReportState> {
  const { rootPath, config, state, deps } = args;

  try {
    const inferredApplied = await inferAppliedImprovementsFromPrompt({
      rootPath,
      config,
      deps,
    });
    if (inferredApplied.length === 0) {
      return state;
    }

    const previousCount = state.appliedImprovements.length;
    const mergedApplied = mergeAppliedImprovements(
      state.appliedImprovements,
      inferredApplied
    );

    if (mergedApplied.length === previousCount) {
      return state;
    }

    const newlyAdded = mergedApplied.length - previousCount;
    if (newlyAdded > 0) {
      deps.log(
        `Prompt.md에서 완료된 프롬프트 ${newlyAdded}개를 적용 완료 항목으로 인식했습니다.`
      );
    }

    return {
      ...state,
      appliedImprovements: mergedApplied,
    };
  } catch (error) {
    deps.log(
      `Prompt.md 기반 적용 완료 항목 추출 실패 (계속 진행): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return state;
  }
}

async function cleanupAppliedItemsBestEffort(args: {
  rootPath: string;
  config: VibeReportConfig;
  state: VibeReportState;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
  cancellationToken?: CancellationTokenLike;
}): Promise<void> {
  const { rootPath, config, state, reportProgress, deps, cancellationToken } = args;
  throwIfCancelled(cancellationToken, '적용 완료 항목 정리');
  const applied = state.appliedImprovements ?? [];
  if (applied.length === 0) {
    return;
  }

  reportProgress('적용 완료 항목 정리 중...', 65);

  try {
    const result = await deps.reportService.cleanupAppliedItems(
      rootPath,
      config,
      applied,
      cancellationToken
    );
    if (result.improvementRemoved > 0 || result.promptRemoved > 0) {
      deps.log(
        `적용 완료 항목 제거: 개선보고서 ${result.improvementRemoved}개, Prompt.md ${result.promptRemoved}개`
      );
    }
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    deps.log(`적용 완료 항목 클린업 실패 (계속 진행): ${error}`);
  }
}

export async function generateAndCopyPrompt(args: {
  snapshot: ProjectSnapshot;
  diff: SnapshotDiff;
  state: VibeReportState;
  isFirstRun: boolean;
  config: VibeReportConfig;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
  cancellationToken?: CancellationTokenLike;
}): Promise<string> {
  const {
    snapshot,
    diff,
    state,
    isFirstRun,
    config,
    reportProgress,
    deps,
    cancellationToken,
  } = args;

  reportProgress('분석 프롬프트 생성 중...', 80);
  throwIfCancelled(cancellationToken, '프롬프트 생성');

  // projectVisionMode에 따라 비전 결정
  let projectVision: ProjectVision | undefined;
  if (config.projectVisionMode === 'custom' && state.projectVision) {
    projectVision = state.projectVision;
    deps.log('사용자 정의 프로젝트 비전 사용');
  } else {
    deps.log(`자동 분석 모드 (projectVisionMode: ${config.projectVisionMode})`);
    projectVision = undefined;
  }

  const reportPaths = {
    evaluation: `${config.reportDirectory}/Project_Evaluation_Report.md`,
    improvement: `${config.reportDirectory}/Project_Improvement_Exploration_Report.md`,
    prompt: `${config.reportDirectory}/Prompt.md`,
  };

  const prompt = deps.buildAnalysisPrompt(
    snapshot,
    diff,
    state.appliedImprovements,
    isFirstRun,
    config,
    reportPaths,
    projectVision
  );

  try {
    if (config.enableDirectAi) {
      const directAiResult = await deps.ui.withProgress(
        { title: 'Direct AI analysis', cancellable: true },
        async (progress, token) => {
          progress.report({ message: 'Running...' });

          if (token.isCancellationRequested) {
            return { cancelled: true as const, response: null as string | null };
          }

          const response = await deps.aiService.runAnalysisPrompt(prompt, {
            cancellationToken: token,
          });

          if (token.isCancellationRequested) {
            return { cancelled: true as const, response: null as string | null };
          }

          return { cancelled: false as const, response };
        }
      );

      throwIfCancelled(cancellationToken, '프롬프트 생성');

      if (directAiResult.cancelled) {
        await deps.ui.clipboardWriteText(prompt);
        deps.ui.showInformationMessage('Direct AI cancelled. Prompt copied to clipboard.');
      } else if (directAiResult.response) {
        await deps.ui.clipboardWriteText(directAiResult.response);
        await deps.ui.openMarkdownDocument(directAiResult.response);
        deps.log('Direct AI analysis completed (response copied to clipboard).');
      } else {
        await deps.ui.clipboardWriteText(prompt);
        deps.ui.showWarningMessage('Direct AI unavailable. Prompt copied to clipboard.');
      }
    } else {
      await deps.ui.clipboardWriteText(prompt);
    }
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    deps.log(`클립보드 복사 실패: ${error}`);
    deps.ui.showWarningMessage(
      '클립보드 복사에 실패했습니다. 프롬프트가 생성되었지만 수동으로 복사해야 합니다.'
    );
  }

  throwIfCancelled(cancellationToken, '프롬프트 생성');
  return prompt;
}

async function saveSessionRecord(args: {
  rootPath: string;
  config: VibeReportConfig;
  state: VibeReportState;
  snapshot: ProjectSnapshot;
  diff: SnapshotDiff;
  isFirstRun: boolean;
  deps: UpdateReportsWorkflowDeps;
  cancellationToken?: CancellationTokenLike;
}): Promise<VibeReportState> {
  const {
    rootPath,
    config,
    state,
    snapshot,
    diff,
    isFirstRun,
    deps,
    cancellationToken,
  } = args;

  throwIfCancelled(cancellationToken, '세션 기록 저장');
  const sessionId = SnapshotService.generateSessionId();
  const sessionRecord: SessionRecord = {
    id: sessionId,
    timestamp: deps.now().toISOString(),
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

  let updatedState = deps.snapshotService.updateSnapshot(state, snapshot);
  updatedState = deps.snapshotService.addSession(updatedState, sessionRecord);

  try {
    throwIfCancelled(cancellationToken, '세션 기록 저장');
    await deps.snapshotService.saveState(rootPath, config, updatedState);
  } catch {
    throw new FileOperationError(
      '상태 파일 저장 실패',
      `${rootPath}/${config.snapshotFile}`
    );
  }

  const previousVersion = state.lastSnapshot?.mainConfigFiles.packageJson?.version;
  const currentVersion = snapshot.mainConfigFiles.packageJson?.version;
  const isMajorChange = SnapshotService.isMajorVersionChange(previousVersion, currentVersion);

  try {
    throwIfCancelled(cancellationToken, '세션 기록 저장');
    await deps.reportService.updateSessionHistoryFile(
      rootPath,
      config,
      sessionRecord,
      updatedState.sessions.length,
      updatedState.appliedImprovements.length
    );

    if (isFirstRun) {
      deps.log('초기 실행, 세션 히스토리에 기록');
    } else if (isMajorChange) {
      deps.log(`메이저 버전 변경 감지 (${previousVersion} → ${currentVersion}), 세션 히스토리에 기록`);
    } else if (previousVersion && currentVersion && previousVersion !== currentVersion) {
      deps.log(`버전 변경 감지 (${previousVersion} → ${currentVersion}), 세션 히스토리에 기록`);
    }
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    deps.log(`세션 히스토리 파일 업데이트 실패: ${error}`);
  }

  // 평가 점수 추이(best-effort): Evaluation Report의 TLDR 점수를 상태에 누적하고,
  // AUTO-TREND 섹션의 표 데이터 행만 최신 히스토리로 갱신합니다.
  try {
    throwIfCancelled(cancellationToken, '평가 추이 업데이트');
    const paths = deps.reportService.getReportPaths(rootPath, config);
    const evaluationReportContent = await deps.fs.readFile(
      paths.evaluation,
      'utf-8'
    );

    const categories: EvaluationCategory[] = [
      'codeQuality',
      'architecture',
      'security',
      'performance',
      'testCoverage',
      'errorHandling',
      'documentation',
      'scalability',
      'maintainability',
      'productionReadiness',
    ];

    let scoresByCategory:
      | Partial<Record<EvaluationCategory, number>>
      | undefined;
    try {
      const scoreBlock = extractBetweenMarkersLines(
        evaluationReportContent,
        '<!-- AUTO-SCORE-START -->',
        '<!-- AUTO-SCORE-END -->'
      );

      if (scoreBlock) {
        const parsed = parseScoresFromAIResponse(scoreBlock);
        if (parsed) {
          const nextScoresByCategory: Partial<
            Record<EvaluationCategory, number>
          > = {};

          for (const category of categories) {
            const score = parsed[category].score;
            if (Number.isFinite(score) && score > 0) {
              nextScoresByCategory[category] = score;
            }
          }

          if (Object.keys(nextScoresByCategory).length > 0) {
            scoresByCategory = nextScoresByCategory;
          }
        }
      }
    } catch (error) {
      deps.log(`평가 카테고리 점수 파싱 실패 (계속 진행): ${error}`);
    }

    const tldrBlock = extractBetweenMarkersLines(
      evaluationReportContent,
      '<!-- AUTO-TLDR-START -->',
      '<!-- AUTO-TLDR-END -->'
    );
    if (!tldrBlock) {
      throw new Error('AUTO-TLDR marker block not found');
    }

    const scoreMatch = tldrBlock.match(/(\d+(?:\.\d+)?)\s*\/\s*100/);
    if (!scoreMatch) {
      throw new Error('score not found in AUTO-TLDR block');
    }

    const totalScore = Number.parseFloat(scoreMatch[1]);
    if (!Number.isFinite(totalScore)) {
      throw new Error(`invalid totalScore: ${scoreMatch[1]}`);
    }

    const grade = scoreToGrade(totalScore);
    const parsedGradeMatch = tldrBlock.match(/\b([A-F][+-]?)\b/);
    if (parsedGradeMatch && parsedGradeMatch[1] !== grade) {
      deps.log(
        `TLDR 등급 불일치 감지(진단용): parsed=${parsedGradeMatch[1]}, computed=${grade}, score=${totalScore}`
      );
    }

    const gitInfo = snapshot.gitInfo;
    const gitCommit = gitInfo?.currentCommit ?? gitInfo?.lastCommitHash;
    const gitBranch = gitInfo?.branch || 'HEAD';
    const gitVersion =
      !currentVersion && gitCommit
        ? `git:${gitCommit.slice(0, 7)}@${gitBranch}`
        : undefined;

    const entry: EvaluationHistoryEntry = {
      version: currentVersion ?? gitVersion ?? 'unknown',
      evaluatedAt: sessionRecord.timestamp,
      totalScore,
      grade,
      scoresByCategory,
    };

    const mergedHistory = [...(updatedState.evaluationHistory ?? []), entry];
    const deduped: EvaluationHistoryEntry[] = [];
    const seen = new Set<string>();
    for (let i = mergedHistory.length - 1; i >= 0; i--) {
      const candidate = mergedHistory[i];
      const scoresKey = candidate.scoresByCategory
        ? Object.entries(candidate.scoresByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(',')
        : '';
      const key = `${candidate.version}|${candidate.totalScore}|${candidate.grade}|${scoresKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(candidate);
    }
    deduped.reverse();
    const trimmedHistory = deduped.slice(-5);

    updatedState = { ...updatedState, evaluationHistory: trimmedHistory };

    try {
      await deps.snapshotService.saveState(rootPath, config, updatedState);
    } catch (error) {
      deps.log(`평가 추이 상태 저장 실패 (계속 진행): ${error}`);
    }

    const existingTrendBlock = extractBetweenMarkersLines(
      evaluationReportContent,
      '<!-- AUTO-TREND-START -->',
      '<!-- AUTO-TREND-END -->'
    );
    if (!existingTrendBlock) {
      throw new Error('AUTO-TREND marker block not found');
    }

    const formatVersionLabel = (version: string): string => {
      if (version === 'unknown') return 'unknown';
      const isSemver = /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version);
      return isSemver ? `v${version}` : version;
    };

    const historyRows = trimmedHistory.map(historyEntry => {
      const date = historyEntry.evaluatedAt.split('T')[0] ?? historyEntry.evaluatedAt;
      const versionLabel = formatVersionLabel(historyEntry.version);
      return `| **${versionLabel}** | ${date} | **${historyEntry.totalScore} (${historyEntry.grade})** | - |`;
    });

    const totalScoreTable = [
      '| 버전 | 날짜 | 총점 | 비고 |',
      '|:---:|:---:|:---:|:---|',
      ...historyRows,
    ].join('\n');

    const latestEntry =
      trimmedHistory.length > 0 ? trimmedHistory[trimmedHistory.length - 1] : undefined;
    const previousEntry =
      trimmedHistory.length > 1 ? trimmedHistory[trimmedHistory.length - 2] : undefined;

    const categoryRows = categories.map(category => {
      const label = EVALUATION_CATEGORY_LABELS[category].ko;
      const latestScore = latestEntry?.scoresByCategory?.[category];
      const previousScore = previousEntry?.scoresByCategory?.[category];

      const scoreCell = latestScore === undefined ? '-' : String(latestScore);
      const gradeCell =
        latestScore === undefined
          ? '-'
          : `${gradeEmoji(scoreToGrade(latestScore))} ${scoreToGrade(latestScore)}`;

      const delta = formatScoreChange(
        latestScore === undefined || previousScore === undefined
          ? undefined
          : latestScore - previousScore
      );

      return `| ${label} | ${scoreCell} | ${gradeCell} | ${delta} |`;
    });

    const categoryTrendTable = [
      '| 카테고리 | 점수 | 등급 | 변화 |',
      '|:---|:---:|:---:|:---:|',
      ...categoryRows,
    ].join('\n');

    const updatedTrendBlock = [totalScoreTable, '', categoryTrendTable].join('\n');

    const nextEvaluationReportContent = replaceBetweenMarkersLines(
      evaluationReportContent,
      '<!-- AUTO-TREND-START -->',
      '<!-- AUTO-TREND-END -->',
      updatedTrendBlock
    );

    if (nextEvaluationReportContent !== evaluationReportContent) {
      await deps.fs.writeFile(paths.evaluation, nextEvaluationReportContent, 'utf-8');
    }
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    deps.log(`평가 추이 업데이트 실패 (계속 진행): ${error}`);
  }

  return updatedState;
}
