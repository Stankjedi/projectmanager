import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import type { VibeReportState } from '../../models/types.js';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
    })),
  },
  window: {
    withProgress: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

vi.mock('fs/promises');

vi.mock('../../utils/index.js', () => ({
  loadConfig: vi.fn(() => ({
    analysisRoot: '',
    reportDirectory: 'devplan',
    snapshotFile: '.vscode/vibereport-state.json',
    enableGitDiff: true,
    excludePatterns: [],
    maxFilesToScan: 5000,
    autoOpenReports: true,
    enableDirectAi: false,
    language: 'ko',
    projectVisionMode: 'auto',
    defaultProjectType: 'auto-detect',
    defaultQualityFocus: 'development',
  })),
  buildAnalysisPrompt: vi.fn(),
  generateImprovementId: vi.fn(),
  resolveAnalysisRoot: vi.fn((workspaceRoot: string) => workspaceRoot),
  selectWorkspaceRoot: vi.fn(),
}));

vi.mock('../../services/index.js', () => {
  class MockWorkspaceScanner {
    constructor(_outputChannel: unknown) {}
    scan = vi.fn().mockResolvedValue({
      projectName: 'test-project',
      generatedAt: new Date().toISOString(),
      rootPath: '/test/workspace',
      filesCount: 0,
      dirsCount: 0,
      languageStats: {},
      importantFiles: [],
      structureSummary: [],
      mainConfigFiles: { otherConfigs: [] },
    });
  }

  class MockSnapshotService {
    constructor(_outputChannel: unknown) {}
    loadState = vi.fn().mockResolvedValue({
      version: '1.0.0',
      lastSnapshot: null,
      previousSnapshot: null,
      sessionHistory: [],
      appliedImprovements: [],
      projectVision: null,
    });
    createInitialState = vi.fn().mockReturnValue({
      version: '1.0.0',
      lastSnapshot: null,
      previousSnapshot: null,
      sessionHistory: [],
      appliedImprovements: [],
      projectVision: null,
    });
    compareSnapshots = vi.fn().mockResolvedValue({
      isInitial: false,
      newFiles: [],
      removedFiles: [],
      changedConfigs: [],
      gitChanges: undefined,
      totalChanges: 0,
      previousSnapshotTime: new Date().toISOString(),
      currentSnapshotTime: new Date().toISOString(),
      languageStatsDiff: {},
    });
  }

  class MockReportService {
    constructor(_outputChannel: unknown) {}
    reportsExist = vi.fn();
    ensureReportDirectory = vi.fn().mockResolvedValue(undefined);
    getReportPaths = vi.fn().mockReturnValue({
      evaluation: '/test/workspace/devplan/Project_Evaluation_Report.md',
      improvement: '/test/workspace/devplan/Project_Improvement_Exploration_Report.md',
      sessionHistory: '/test/workspace/devplan/Session_History.md',
      prompt: '/test/workspace/devplan/Prompt.md',
    });
    createEvaluationTemplate = vi.fn().mockReturnValue('EVAL TEMPLATE');
    createImprovementTemplate = vi.fn().mockReturnValue('IMPROV TEMPLATE');
  }

  class MockAiService {
    constructor(_outputChannel: unknown) {}
  }

  return {
    WorkspaceScanner: MockWorkspaceScanner,
    SnapshotService: MockSnapshotService,
    ReportService: MockReportService,
    AiService: MockAiService,
  };
});

describe('UpdateReportsCommand.executeForWorkspace', () => {
  const outputChannel = {
    appendLine: vi.fn(),
    dispose: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('writes report templates on first run (reports missing)', async () => {
    const { UpdateReportsCommand } = await import('../updateReports.js');
    const command = new UpdateReportsCommand(outputChannel);

    const reportService = (command as any).reportService;
    vi.mocked(reportService.reportsExist).mockResolvedValue(false);

    (command as any)._inferAppliedImprovementsBestEffort = vi
      .fn()
      .mockImplementation(async (_root: string, _config: unknown, state: VibeReportState) => state);
    (command as any)._executeCleanupStep = vi.fn().mockResolvedValue(undefined);
    (command as any)._executePromptGenerationStep = vi.fn().mockResolvedValue('PROMPT');
    (command as any)._executeSessionSaveStep = vi.fn().mockResolvedValue({} as any);
    (command as any)._executeResultHandlingStep = vi.fn().mockResolvedValue(undefined);

    await command.executeForWorkspace('/test/workspace', 'test', {
      progress: { report: vi.fn() } as any,
    });

    expect(reportService.ensureReportDirectory).toHaveBeenCalled();
    expect(reportService.createEvaluationTemplate).toHaveBeenCalled();
    expect(reportService.createImprovementTemplate).toHaveBeenCalled();

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/test/workspace/devplan/Project_Evaluation_Report.md',
      'EVAL TEMPLATE',
      'utf-8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/test/workspace/devplan/Project_Improvement_Exploration_Report.md',
      'IMPROV TEMPLATE',
      'utf-8'
    );
  });

  it('does not overwrite report templates when reports already exist', async () => {
    const { UpdateReportsCommand } = await import('../updateReports.js');
    const command = new UpdateReportsCommand(outputChannel);

    const reportService = (command as any).reportService;
    vi.mocked(reportService.reportsExist).mockResolvedValue(true);

    (command as any)._inferAppliedImprovementsBestEffort = vi
      .fn()
      .mockImplementation(async (_root: string, _config: unknown, state: VibeReportState) => state);
    (command as any)._executeCleanupStep = vi.fn().mockResolvedValue(undefined);
    (command as any)._executePromptGenerationStep = vi.fn().mockResolvedValue('PROMPT');
    (command as any)._executeSessionSaveStep = vi.fn().mockResolvedValue({} as any);
    (command as any)._executeResultHandlingStep = vi.fn().mockResolvedValue(undefined);

    await command.executeForWorkspace('/test/workspace', 'test', {
      progress: { report: vi.fn() } as any,
    });

    expect(reportService.ensureReportDirectory).toHaveBeenCalled();
    expect(reportService.createEvaluationTemplate).not.toHaveBeenCalled();
    expect(reportService.createImprovementTemplate).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
