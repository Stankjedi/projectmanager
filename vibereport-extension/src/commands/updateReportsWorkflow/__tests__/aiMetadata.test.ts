import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import { runUpdateReportsWorkflow } from '../../updateReportsWorkflow.js';
import { formatSessionEntry } from '../../../services/reportService/sessionHistoryUtils.js';

describe('runUpdateReportsWorkflow (aiMetadata)', () => {
  it('populates sessionRecord.aiMetadata and renders overall score in session history', async () => {
    const evaluationReport = [
      '# Evaluation',
      '',
      '<!-- AUTO-SCORE-START -->',
      '| 카테고리 | 점수 | 등급 |',
      '|:---|:---:|:---:|',
      '| 코드 품질 | 90 | A- |',
      '| 테스트 커버리지 | 80 | B- |',
      '<!-- AUTO-SCORE-END -->',
      '',
      '<!-- AUTO-TLDR-START -->',
      '| 항목 | 값 |',
      '|---|---|',
      '| **전체 점수** | 90/100 |',
      '<!-- AUTO-TLDR-END -->',
      '',
      '<!-- AUTO-RISK-SUMMARY-START -->',
      '| 리스크 레벨 | 항목 | 관련 개선 ID |',
      '|---|---|---|',
      '| 🔴 High | 위험 1 | security-sensitive-path-001 |',
      '| 🟡 Medium | 위험 2 | scan-important-files-001 |',
      '<!-- AUTO-RISK-SUMMARY-END -->',
      '',
      '<!-- AUTO-TREND-START -->',
      '| 버전 | 날짜 | 총점 | 비고 |',
      '|:---:|:---:|:---:|:---|',
      '| - | - | - | - |',
      '<!-- AUTO-TREND-END -->',
      '',
    ].join('\n');

    const improvementReport = [
      '# Improvement',
      '',
      '<!-- AUTO-IMPROVEMENT-LIST-START -->',
      '### 🔴 중요 (P1)',
      '',
      '#### [P1-1] Expand sensitive file detection',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `security-sensitive-path-001` |',
      '',
      '### 🟡 중요 (P2)',
      '',
      '#### [P2-1] Improve important file detection',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `scan-important-files-001` |',
      '<!-- AUTO-IMPROVEMENT-LIST-END -->',
      '',
      '<!-- AUTO-FEATURE-LIST-START -->',
      '#### [P3-1] Add JSON output mode',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `feat-doctor-json-001` |',
      '<!-- AUTO-FEATURE-LIST-END -->',
      '',
      '<!-- AUTO-OPTIMIZATION-START -->',
      '### 🚀 코드 최적화 (OPT-1)',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `opt-todo-scan-parallel-001` |',
      '<!-- AUTO-OPTIMIZATION-END -->',
      '',
    ].join('\n');

    const paths = {
      evaluation: '/root/devplan/Project_Evaluation_Report.md',
      improvement: '/root/devplan/Project_Improvement_Exploration_Report.md',
      sessionHistory: '/root/devplan/Session_History.md',
      prompt: '/root/devplan/Prompt.md',
    };

    let sessionHistoryMarkdown = '';

    const deps = {
      workspaceScanner: {
        scan: vi.fn(async () => ({
          generatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          rootPath: '/root',
          projectName: 'demo',
          filesCount: 3,
          dirsCount: 1,
          languageStats: { ts: 1 },
          mainConfigFiles: {
            packageJson: {
              name: 'demo',
              version: '1.0.0',
              scripts: [],
              dependencies: [],
              devDependencies: [],
              hasTypeScript: true,
              hasTest: true,
              hasLint: true,
            },
            otherConfigs: [],
          },
          importantFiles: [],
          fileList: [],
          structureSummary: [],
          structureDiagram: '',
          todoFixmeFindings: undefined,
        })),
      },
      snapshotService: {
        loadState: vi.fn(async () => null),
        createInitialState: vi.fn(() => ({
          lastSnapshot: null,
          sessions: [],
          appliedImprovements: [],
        })),
        compareSnapshots: vi.fn(async () => ({
          isInitial: false,
          newFiles: [],
          removedFiles: [],
          changedConfigs: [],
          totalChanges: 0,
          linesAdded: 0,
          linesRemoved: 0,
          linesTotal: 0,
          previousSnapshotTime: '2026-01-01T00:00:00.000Z',
          currentSnapshotTime: '2026-01-01T00:00:00.000Z',
          languageStatsDiff: {},
        })),
        updateSnapshot: vi.fn((state: any, snapshot: any) => ({ ...state, lastSnapshot: snapshot })),
        addSession: vi.fn((state: any, session: any) => ({ ...state, sessions: [...state.sessions, session] })),
        saveState: vi.fn(async () => undefined),
      },
      reportService: {
        ensureReportDirectory: vi.fn(async () => undefined),
        getReportPaths: vi.fn(() => paths),
        createEvaluationTemplate: vi.fn(() => ''),
        createImprovementTemplate: vi.fn(() => ''),
        cleanupAppliedItems: vi.fn(async () => ({ improvementRemoved: 0, promptRemoved: 0 })),
        updateSessionHistoryFile: vi.fn(async (_root: string, _config: any, session: any) => {
          sessionHistoryMarkdown = formatSessionEntry(session);
        }),
      },
      aiService: {
        runAnalysisPrompt: vi.fn(async () => null),
      },
      fs: {
        readFile: vi.fn(async (filePath: string) => {
          if (filePath === paths.evaluation) return evaluationReport;
          if (filePath === paths.improvement) return improvementReport;
          if (filePath === paths.prompt) return '# Prompt\n';
          throw new Error(`Unexpected readFile: ${filePath}`);
        }),
        writeFile: vi.fn(async () => undefined),
      },
      ui: {
        withProgress: vi.fn(async (_options: any, task: any) =>
          task({ report: () => undefined }, { isCancellationRequested: false })
        ),
        clipboardWriteText: vi.fn(async () => undefined),
        showInformationMessage: vi.fn(() => undefined),
        showWarningMessage: vi.fn(() => undefined),
        openMarkdownDocument: vi.fn(async () => undefined),
      },
      buildAnalysisPrompt: vi.fn(() => 'PROMPT'),
      log: vi.fn(),
      now: vi.fn(() => new Date('2026-01-01T00:00:00.000Z')),
    } as any;

    const result = await runUpdateReportsWorkflow({
      rootPath: '/root',
      projectName: 'demo',
      config: { reportDirectory: 'devplan', snapshotFile: '.vscode/state.json', enableDirectAi: false } as any,
      isFirstRun: false,
      reportProgress: () => undefined,
      deps,
    });

    expect(result.updatedState.sessions).toHaveLength(1);
    const session = result.updatedState.sessions[0];
    const metadata = session.aiMetadata;
    expect(metadata).toBeDefined();
    if (!metadata) {
      throw new Error('Expected session.aiMetadata to be populated');
    }

    expect(metadata.overallScore).toBe(90);
    expect(metadata.risksIdentified).toBeGreaterThan(0);
    expect(metadata.improvementsProposed).toBeGreaterThan(0);
    expect(metadata.evaluationScores?.codeQuality.score).toBe(90);

    expect(sessionHistoryMarkdown).toContain('90/100');
  });
});
