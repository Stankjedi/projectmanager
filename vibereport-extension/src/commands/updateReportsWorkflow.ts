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
import { FileOperationError, WorkspaceScanError } from '../models/errors.js';
import { SnapshotService } from '../services/snapshotService.js';
import { formatScoreChange, gradeEmoji, parseScoresFromAIResponse } from '../utils/markdownUtils.js';
import { extractBetweenMarkersLines, replaceBetweenMarkersLines } from '../utils/markerUtils.js';
import { EXECUTION_CHECKLIST_BLOCK_REGEX } from '../utils/promptChecklistUtils.js';

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
    reportProgress: WorkflowProgress
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
    appliedImprovements: AppliedImprovement[]
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

export async function runUpdateReportsWorkflow(
  args: RunUpdateReportsWorkflowArgs
): Promise<RunUpdateReportsWorkflowResult> {
  const { rootPath, config, isFirstRun, reportProgress, deps } = args;

  let snapshot: ProjectSnapshot;
  let state: VibeReportState;
  let diff: SnapshotDiff;
  try {
    ({ snapshot, state, diff } = await performWorkspaceScan({
      rootPath,
      config,
      reportProgress,
      deps,
    }));
  } catch (error) {
    throw new UpdateReportsWorkflowError('프로젝트 스캔', error);
  }

  const stateWithApplied = await inferAppliedImprovementsBestEffort({
    rootPath,
    config,
    state,
    deps,
  });

  try {
    await prepareReportTemplates({
      rootPath,
      config,
      snapshot,
      isFirstRun,
      reportProgress,
      deps,
    });
  } catch (error) {
    throw new UpdateReportsWorkflowError('보고서 템플릿 준비', error);
  }

  await cleanupAppliedItemsBestEffort({
    rootPath,
    config,
    state: stateWithApplied,
    reportProgress,
    deps,
  });

  let prompt: string;
  try {
    prompt = await generateAndCopyPrompt({
      snapshot,
      diff,
      state: stateWithApplied,
      isFirstRun,
      config,
      reportProgress,
      deps,
    });
  } catch (error) {
    throw new UpdateReportsWorkflowError('프롬프트 생성', error);
  }

  let updatedState: VibeReportState;
  try {
    updatedState = await saveSessionRecord({
      rootPath,
      config,
      state: stateWithApplied,
      snapshot,
      diff,
      isFirstRun,
      deps,
    });
  } catch (error) {
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

async function performWorkspaceScan(args: {
  rootPath: string;
  config: VibeReportConfig;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
}): Promise<{ snapshot: ProjectSnapshot; state: VibeReportState; diff: SnapshotDiff }> {
  const { rootPath, config, reportProgress, deps } = args;

  reportProgress('프로젝트 구조 스캔 중...', 20);
  let snapshot: ProjectSnapshot;
  try {
    snapshot = await deps.workspaceScanner.scan(rootPath, config, reportProgress);
  } catch (error) {
    throw new WorkspaceScanError(
      '프로젝트 구조 스캔 실패',
      error instanceof Error ? error.message : String(error)
    );
  }

  reportProgress('상태 분석 중...', 40);
  let state: VibeReportState;
  try {
    const loadedState = await deps.snapshotService.loadState(rootPath, config);
    state = loadedState ?? deps.snapshotService.createInitialState();
  } catch (error) {
    deps.log(`이전 상태 로드 실패, 초기 상태로 시작: ${error}`);
    state = deps.snapshotService.createInitialState();
  }

  let diff: SnapshotDiff;
  try {
    diff = await deps.snapshotService.compareSnapshots(
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

async function inferAppliedImprovementsFromPrompt(args: {
  rootPath: string;
  config: VibeReportConfig;
  deps: UpdateReportsWorkflowDeps;
}): Promise<AppliedImprovement[]> {
  const { rootPath, config, deps } = args;
  const paths = deps.reportService.getReportPaths(rootPath, config);

  let content: string;
  try {
    content = await deps.fs.readFile(paths.prompt, 'utf-8');
  } catch {
    return [];
  }

  const checklistMatch = content.match(
    EXECUTION_CHECKLIST_BLOCK_REGEX
  );
  if (!checklistMatch) {
    return [];
  }

  const checklist = checklistMatch[0];
  const applied: AppliedImprovement[] = [];
  const seenIds = new Set<string>();

  // | # | Prompt ID | Title | Priority | Status |
  const rowPattern =
    /\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;

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
      appliedAt: deps.now().toISOString(),
      sessionId: SnapshotService.generateSessionId(),
    });
  }

  return applied;
}

function mergeAppliedImprovements(
  existing: AppliedImprovement[],
  inferred: AppliedImprovement[]
): AppliedImprovement[] {
  if (!inferred.length) {
    return existing;
  }

  const merged = [...existing];
  const existingIds = new Set(existing.map(i => i.id));
  const existingTitles = new Set(existing.map(i => i.title.toLowerCase()));

  for (const item of inferred) {
    const titleKey = item.title.toLowerCase();
    if (existingIds.has(item.id) || existingTitles.has(titleKey)) {
      continue;
    }
    merged.push(item);
  }

  return merged;
}

async function prepareReportTemplates(args: {
  rootPath: string;
  config: VibeReportConfig;
  snapshot: ProjectSnapshot;
  isFirstRun: boolean;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
}): Promise<void> {
  const { rootPath, config, snapshot, isFirstRun, reportProgress, deps } = args;
  reportProgress('보고서 준비 중...', 60);

  try {
    await deps.reportService.ensureReportDirectory(rootPath, config);
  } catch {
    throw new FileOperationError(
      '보고서 디렉토리 생성 실패',
      `${rootPath}/${config.reportDirectory}`
    );
  }

  if (!isFirstRun) return;

  const paths = deps.reportService.getReportPaths(rootPath, config);

  try {
    const evalTemplate = deps.reportService.createEvaluationTemplate(snapshot, config.language);
    await deps.fs.writeFile(paths.evaluation, evalTemplate, 'utf-8');
  } catch {
    throw new FileOperationError('평가 보고서 템플릿 생성 실패', paths.evaluation);
  }

  try {
    const improvTemplate = deps.reportService.createImprovementTemplate(snapshot, config.language);
    await deps.fs.writeFile(paths.improvement, improvTemplate, 'utf-8');
  } catch {
    throw new FileOperationError('개선 보고서 템플릿 생성 실패', paths.improvement);
  }
}

async function cleanupAppliedItemsBestEffort(args: {
  rootPath: string;
  config: VibeReportConfig;
  state: VibeReportState;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
}): Promise<void> {
  const { rootPath, config, state, reportProgress, deps } = args;
  const applied = state.appliedImprovements ?? [];
  if (applied.length === 0) {
    return;
  }

  reportProgress('적용 완료 항목 정리 중...', 65);

  try {
    const result = await deps.reportService.cleanupAppliedItems(rootPath, config, applied);
    if (result.improvementRemoved > 0 || result.promptRemoved > 0) {
      deps.log(
        `적용 완료 항목 제거: 개선보고서 ${result.improvementRemoved}개, Prompt.md ${result.promptRemoved}개`
      );
    }
  } catch (error) {
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
}): Promise<string> {
  const { snapshot, diff, state, isFirstRun, config, reportProgress, deps } = args;

  reportProgress('분석 프롬프트 생성 중...', 80);

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
    deps.log(`클립보드 복사 실패: ${error}`);
    deps.ui.showWarningMessage(
      '클립보드 복사에 실패했습니다. 프롬프트가 생성되었지만 수동으로 복사해야 합니다.'
    );
  }

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
}): Promise<VibeReportState> {
  const { rootPath, config, state, snapshot, diff, isFirstRun, deps } = args;

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
    deps.log(`세션 히스토리 파일 업데이트 실패: ${error}`);
  }

  // 평가 점수 추이(best-effort): Evaluation Report의 TLDR 점수를 상태에 누적하고,
  // AUTO-TREND 섹션의 표 데이터 행만 최신 히스토리로 갱신합니다.
  try {
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
    deps.log(`평가 추이 업데이트 실패 (계속 진행): ${error}`);
  }

  return updatedState;
}
