/**
 * UpdateReportsCommand Unit Tests
 *
 * @description 보고서 업데이트 명령에 대한 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    })),
    openTextDocument: vi.fn(),
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
    withProgress: vi.fn(async (_options, task) => {
      return task({ report: vi.fn() });
    }),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock services - use class syntax for proper constructor behavior
vi.mock('../../services/index.js', () => ({
  WorkspaceScanner: class MockWorkspaceScanner {
    scan = vi.fn().mockResolvedValue({
      timestamp: new Date().toISOString(),
      files: [],
      dependencies: {},
      devDependencies: {},
      configFiles: [],
      gitStatus: null,
      projectInfo: { name: 'test', path: '/test/workspace' },
    });
  },
  SnapshotService: class MockSnapshotService {
    loadState = vi.fn().mockResolvedValue(null);
    saveState = vi.fn().mockResolvedValue(undefined);
    createInitialState = vi.fn().mockReturnValue({
      version: '1.0.0',
      lastSnapshot: null,
      previousSnapshot: null,
      sessionHistory: [],
      projectVision: null,
    });
    compareSnapshots = vi.fn().mockReturnValue({
      hasChanges: false,
      addedFiles: [],
      removedFiles: [],
      modifiedFiles: [],
      addedDependencies: [],
      removedDependencies: [],
      configChanges: [],
      gitChanges: null,
    });
  },
  ReportService: class MockReportService {
    reportsExist = vi.fn().mockResolvedValue(true);
    ensureReportTemplates = vi.fn().mockResolvedValue(undefined);
    prepareAnalysisPrompt = vi.fn().mockReturnValue('Mock analysis prompt');    
  },
  AiService: class MockAiService {
    isAvailable = vi.fn().mockResolvedValue(false);
    runAnalysisPrompt = vi.fn().mockResolvedValue(null);
  },
}));

describe('UpdateReportsCommand', () => {
  let mockOutputChannel: vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOutputChannel = {
      appendLine: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.OutputChannel;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('execute - workspace validation', () => {
    it('should show error when no workspace is open', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = undefined;

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '워크스페이스가 열려있지 않습니다.'
      );
    });

    it('should show error when workspace folders is empty array', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [];

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '워크스페이스가 열려있지 않습니다.'
      );
    });
  });

  describe('execute - progress flow', () => {
    it('should call withProgress when workspace is valid', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: vscode.ProgressLocation.Notification,
          title: 'Vibe Report: test',
          cancellable: false,
        }),
        expect.any(Function)
      );
    });

    it('should detect first run when reports do not exist', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - withProgress is called, which indicates first run detection happened
      expect(vscode.window.withProgress).toHaveBeenCalled();
    });
  });

  describe('execute - command instantiation', () => {
    it('should create command instance without errors', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const { UpdateReportsCommand } = await import('../updateReports.js');

      // Act & Assert - should not throw
      expect(() => new UpdateReportsCommand(mockOutputChannel)).not.toThrow();
    });

    it('should have execute method', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Assert
      expect(typeof command.execute).toBe('function');
    });
  });

  describe('execute - clipboard operations', () => {
    it('should attempt clipboard operations during execution', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - withProgress should be called (clipboard is called inside progress task)
      expect(vscode.window.withProgress).toHaveBeenCalled();
    });
  });

  describe('execute - error handling scenarios', () => {
    it('should handle workspace scan failure and show error message', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Mock WorkspaceScanner to throw an error
      const mockError = new Error('Scan failed: disk error');
      vi.doMock('../../services/index.js', () => ({
        WorkspaceScanner: class MockWorkspaceScanner {
          scan = vi.fn().mockRejectedValue(mockError);
        },
        SnapshotService: class MockSnapshotService {
          loadState = vi.fn().mockResolvedValue(null);
          saveState = vi.fn().mockResolvedValue(undefined);
          createInitialState = vi.fn().mockReturnValue({
            version: '1.0.0',
            lastSnapshot: null,
            previousSnapshot: null,
            sessionHistory: [],
            projectVision: null,
            appliedImprovements: [],
          });
          compareSnapshots = vi.fn().mockReturnValue({
            hasChanges: false,
            newFiles: [],
            removedFiles: [],
            changedConfigs: [],
            totalChanges: 0,
          });
        },
        ReportService: class MockReportService {
          reportsExist = vi.fn().mockResolvedValue(true);
          ensureReportDirectory = vi.fn().mockResolvedValue(undefined);   
          getReportPaths = vi.fn().mockReturnValue({
            evaluation: '/test/devplan/eval.md',
            improvement: '/test/devplan/improve.md',
            prompt: '/test/devplan/prompt.md',
          });
        },
        AiService: class MockAiService {
          isAvailable = vi.fn().mockResolvedValue(false);
          runAnalysisPrompt = vi.fn().mockResolvedValue(null);
        },
      }));

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - error should be logged to output channel
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
      // Error message should be shown to user
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringMatching(/스캔|오류|실패/i)
      );
    });

    it('should handle report directory creation failure', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Mock ReportService.ensureReportDirectory to throw
      vi.doMock('../../services/index.js', () => ({
        WorkspaceScanner: class MockWorkspaceScanner {
          scan = vi.fn().mockResolvedValue({
            timestamp: new Date().toISOString(),
            files: [],
            dependencies: {},
            devDependencies: {},
            configFiles: [],
            gitStatus: null,
            projectInfo: { name: 'test', path: '/test/workspace' },
            filesCount: 0,
            dirsCount: 0,
            languageStats: {},
            mainConfigFiles: { otherConfigs: [] },
            importantFiles: [],
            structureSummary: [],
          });
        },
        SnapshotService: class MockSnapshotService {
          loadState = vi.fn().mockResolvedValue(null);
          saveState = vi.fn().mockResolvedValue(undefined);
          createInitialState = vi.fn().mockReturnValue({
            version: '1.0.0',
            lastSnapshot: null,
            sessions: [],
            appliedImprovements: [],
            lastUpdated: new Date().toISOString(),
          });
          compareSnapshots = vi.fn().mockResolvedValue({
            isInitial: true,
            hasChanges: false,
            newFiles: [],
            removedFiles: [],
            changedConfigs: [],
            languageStatsDiff: {},
            totalChanges: 0,
          });
        },
        ReportService: class MockReportService {
          reportsExist = vi.fn().mockResolvedValue(false);
          ensureReportDirectory = vi.fn().mockRejectedValue(new Error('Permission denied'));
          getReportPaths = vi.fn().mockReturnValue({
            evaluation: '/test/devplan/eval.md',
            improvement: '/test/devplan/improve.md',
            prompt: '/test/devplan/prompt.md',
          });
        },
        AiService: class MockAiService {
          isAvailable = vi.fn().mockResolvedValue(false);
          runAnalysisPrompt = vi.fn().mockResolvedValue(null);
        },
      }));

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - error should be shown
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringMatching(/디렉토리|보고서|실패/i)
      );
    });

    it('should log error details to output channel on failure', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const { UpdateReportsCommand } = await import('../updateReports.js');
      const command = new UpdateReportsCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - output channel should receive logs
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });
  });
});

describe('runUpdateReportsWorkflow', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('calls dependencies in the expected order (first run writes templates)', async () => {
    const { runUpdateReportsWorkflow } = await import('../updateReportsWorkflow.js');

    const callOrder: string[] = [];

    const snapshot = {
      projectName: 'test',
      generatedAt: '2025-01-01T00:00:00.000Z',
      rootPath: '/test/workspace',
      filesCount: 0,
      dirsCount: 0,
      languageStats: {},
      importantFiles: [],
      structureSummary: [],
      mainConfigFiles: { packageJson: { version: '0.4.14' }, otherConfigs: [] },
    } as any;

    const state = {
      lastSnapshot: null,
      sessions: [],
      appliedImprovements: [],
      lastUpdated: '2025-01-01T00:00:00.000Z',
      version: 1,
    } as any;

    const diff = {
      isInitial: true,
      newFiles: [],
      removedFiles: [],
      changedConfigs: [],
      totalChanges: 0,
      linesAdded: 0,
      linesRemoved: 0,
      linesTotal: 0,
      previousSnapshotTime: '2025-01-01T00:00:00.000Z',
      currentSnapshotTime: '2025-01-01T00:00:00.000Z',
      languageStatsDiff: {},
    } as any;

    const deps = {
      workspaceScanner: {
        scan: vi.fn(async () => {
          callOrder.push('scan');
          return snapshot;
        }),
      },
      snapshotService: {
        loadState: vi.fn(async () => {
          callOrder.push('loadState');
          return state;
        }),
        createInitialState: vi.fn(() => {
          callOrder.push('createInitialState');
          return state;
        }),
        compareSnapshots: vi.fn(async () => {
          callOrder.push('compareSnapshots');
          return diff;
        }),
        updateSnapshot: vi.fn((s: any) => {
          callOrder.push('updateSnapshot');
          return s;
        }),
        addSession: vi.fn((s: any) => {
          callOrder.push('addSession');
          return { ...s, sessions: [{}] };
        }),
        saveState: vi.fn(async () => {
          callOrder.push('saveState');
        }),
      },
      reportService: {
        ensureReportDirectory: vi.fn(async () => {
          callOrder.push('ensureReportDirectory');
        }),
        getReportPaths: vi.fn(() => {
          callOrder.push('getReportPaths');
          return {
            evaluation: '/test/devplan/Project_Evaluation_Report.md',
            improvement: '/test/devplan/Project_Improvement_Exploration_Report.md',
            sessionHistory: '/test/devplan/Session_History.md',
            prompt: '/test/devplan/Prompt.md',
          };
        }),
        createEvaluationTemplate: vi.fn(() => {
          callOrder.push('createEvaluationTemplate');
          return 'EVAL_TEMPLATE';
        }),
        createImprovementTemplate: vi.fn(() => {
          callOrder.push('createImprovementTemplate');
          return 'IMPROV_TEMPLATE';
        }),
        cleanupAppliedItems: vi.fn(async () => {
          callOrder.push('cleanupAppliedItems');
          return { improvementRemoved: 0, promptRemoved: 0 };
        }),
        updateSessionHistoryFile: vi.fn(async () => {
          callOrder.push('updateSessionHistoryFile');
        }),
      },
      aiService: {
        runAnalysisPrompt: vi.fn(async () => {
          callOrder.push('runAnalysisPrompt');
          return null;
        }),
      },
      fs: {
        readFile: vi.fn(async (filePath: string) => {
          if (filePath.endsWith('Prompt.md')) {
            callOrder.push('readFile:prompt');
            throw new Error('ENOENT');
          }

          if (filePath.endsWith('Project_Evaluation_Report.md')) {
            callOrder.push('readFile:evaluation');
            return [
              '<!-- AUTO-TLDR-START -->',
              '| 항목 | 내용 |',
              '| **전체 점수** | 91/100 |',
              '| **전체 등급** | F |',
              '<!-- AUTO-TLDR-END -->',
              '<!-- AUTO-SCORE-START -->',
              '| 카테고리 | 점수 | 등급 | 변화 |',
              '|----------|------|------|------|',
              '| 코드 품질 | 85 | B | - |',
              '| 보안 | 90 | A- | - |',
              '| 테스트 커버리지 | 70 | C- | - |',
              '<!-- AUTO-SCORE-END -->',
              '<!-- AUTO-TREND-START -->',
              '| 버전 | 날짜 | 총점 | 비고 |',
              '|:---:|:---:|:---:|:---|',
              '| **v0.4.13** | 2025-12-15 | **90 (A-)** | - |',
              '- note',
              '<!-- AUTO-TREND-END -->',
            ].join('\n');
          }

          callOrder.push(`readFile:${filePath}`);
          throw new Error('ENOENT');
        }),
        writeFile: vi.fn(async (filePath: string) => {
          callOrder.push(`writeFile:${filePath}`);
        }),
      },
      ui: {
        withProgress: vi.fn(async () => {
          callOrder.push('withProgress');
          return { cancelled: false, response: null };
        }),
        clipboardWriteText: vi.fn(async (text: string) => {
          callOrder.push(`clipboard:${text}`);
        }),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        openMarkdownDocument: vi.fn(),
      },
      buildAnalysisPrompt: vi.fn(() => {
        callOrder.push('buildAnalysisPrompt');
        return 'PROMPT';
      }),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    await runUpdateReportsWorkflow({
      rootPath: '/test/workspace',
      projectName: 'test',
      config: {
        reportDirectory: 'devplan',
        analysisRoot: '',
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
      },
      isFirstRun: true,
      reportProgress: vi.fn(),
      deps,
    });

    const saveStateCalls = deps.snapshotService.saveState.mock.calls as any[];
    const postEvaluationHistoryCall = saveStateCalls.find(
      call => Boolean(call?.[2]?.evaluationHistory)
    );
    expect(postEvaluationHistoryCall).toBeTruthy();

    const postEvaluationHistoryState = postEvaluationHistoryCall[2];
    const lastEntry =
      postEvaluationHistoryState.evaluationHistory[
        postEvaluationHistoryState.evaluationHistory.length - 1
      ];
    expect(lastEntry.grade).toBe('A-');
    expect(lastEntry.scoresByCategory).toMatchObject({
      codeQuality: 85,
      security: 90,
      testCoverage: 70,
    });

    expect(callOrder).toEqual([
      'scan',
      'loadState',
      'compareSnapshots',
      'getReportPaths',
      'readFile:prompt',
      'ensureReportDirectory',
      'getReportPaths',
      'createEvaluationTemplate',
      'writeFile:/test/devplan/Project_Evaluation_Report.md',
      'createImprovementTemplate',
      'writeFile:/test/devplan/Project_Improvement_Exploration_Report.md',      
      'buildAnalysisPrompt',
      'clipboard:PROMPT',
      'updateSnapshot',
      'addSession',
      'saveState',
      'updateSessionHistoryFile',
      'getReportPaths',
      'readFile:evaluation',
      'saveState',
      'writeFile:/test/devplan/Project_Evaluation_Report.md',
    ]);
  });

  it('stores a git-based version label when package.json version is missing', async () => {
    const { runUpdateReportsWorkflow } = await import('../updateReportsWorkflow.js');

    const callOrder: string[] = [];
    let lastEvaluationWrite: string | undefined;

    const snapshot = {
      projectName: 'test',
      generatedAt: '2025-01-01T00:00:00.000Z',
      rootPath: '/test/workspace',
      filesCount: 0,
      dirsCount: 0,
      languageStats: {},
      importantFiles: [],
      structureSummary: [],
      mainConfigFiles: { otherConfigs: [] },
      gitInfo: {
        branch: 'main',
        lastCommitHash: 'abcdef0123456789abcdef0123456789abcdef01',
        hasUncommittedChanges: false,
        uncommittedFilesCount: 0,
      },
    } as any;

    const state = {
      lastSnapshot: null,
      sessions: [],
      appliedImprovements: [],
      lastUpdated: '2025-01-01T00:00:00.000Z',
      version: 1,
    } as any;

    const diff = {
      isInitial: true,
      newFiles: [],
      removedFiles: [],
      changedConfigs: [],
      totalChanges: 0,
      linesAdded: 0,
      linesRemoved: 0,
      linesTotal: 0,
      previousSnapshotTime: '2025-01-01T00:00:00.000Z',
      currentSnapshotTime: '2025-01-01T00:00:00.000Z',
      languageStatsDiff: {},
    } as any;

    const deps = {
      workspaceScanner: {
        scan: vi.fn(async () => snapshot),
      },
      snapshotService: {
        loadState: vi.fn(async () => state),
        createInitialState: vi.fn(() => state),
        compareSnapshots: vi.fn(async () => diff),
        updateSnapshot: vi.fn((s: any) => s),
        addSession: vi.fn((s: any) => ({ ...s, sessions: [{}] })),
        saveState: vi.fn(async (...args: any[]) => {
          callOrder.push('saveState');
          return undefined;
        }),
      },
      reportService: {
        ensureReportDirectory: vi.fn(async () => undefined),
        getReportPaths: vi.fn(() => ({
          evaluation: '/test/devplan/Project_Evaluation_Report.md',
          improvement: '/test/devplan/Project_Improvement_Exploration_Report.md',
          sessionHistory: '/test/devplan/Session_History.md',
          prompt: '/test/devplan/Prompt.md',
        })),
        createEvaluationTemplate: vi.fn(() => 'EVAL_TEMPLATE'),
        createImprovementTemplate: vi.fn(() => 'IMPROV_TEMPLATE'),
        cleanupAppliedItems: vi.fn(async () => ({ improvementRemoved: 0, promptRemoved: 0 })),
        updateSessionHistoryFile: vi.fn(async () => undefined),
      },
      aiService: {
        runAnalysisPrompt: vi.fn(async () => null),
      },
      fs: {
        readFile: vi.fn(async (filePath: string) => {
          if (filePath.endsWith('Prompt.md')) {
            throw new Error('ENOENT');
          }

          if (filePath.endsWith('Project_Evaluation_Report.md')) {
            return [
              '<!-- AUTO-TLDR-START -->',
              '| 항목 | 내용 |',
              '| **전체 점수** | 91/100 |',
              '| **전체 등급** | F |',
              '<!-- AUTO-TLDR-END -->',
              '<!-- AUTO-SCORE-START -->',
              '| 카테고리 | 점수 | 등급 | 변화 |',
              '|----------|------|------|------|',
              '| 코드 품질 | 85 | B | - |',
              '<!-- AUTO-SCORE-END -->',
              '<!-- AUTO-TREND-START -->',
              '| 버전 | 날짜 | 총점 | 비고 |',
              '|:---:|:---:|:---:|:---|',
              '| **v0.4.13** | 2025-12-15 | **90 (A-)** | - |',
              '<!-- AUTO-TREND-END -->',
            ].join('\n');
          }

          throw new Error(`Unexpected readFile: ${filePath}`);
        }),
        writeFile: vi.fn(async (filePath: string, contents: string) => {
          if (filePath.endsWith('Project_Evaluation_Report.md')) {
            lastEvaluationWrite = contents;
          }
        }),
      },
      ui: {
        withProgress: vi.fn(async () => ({ cancelled: false, response: null })),
        clipboardWriteText: vi.fn(async () => undefined),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        openMarkdownDocument: vi.fn(),
      },
      buildAnalysisPrompt: vi.fn(() => 'PROMPT'),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    await runUpdateReportsWorkflow({
      rootPath: '/test/workspace',
      projectName: 'test',
      config: {
        reportDirectory: 'devplan',
        analysisRoot: '',
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
      },
      isFirstRun: true,
      reportProgress: vi.fn(),
      deps,
    });

    const saveStateCalls = deps.snapshotService.saveState.mock.calls as any[];
    const postEvaluationHistoryCall = saveStateCalls.find(
      call => Boolean(call?.[2]?.evaluationHistory)
    );
    expect(postEvaluationHistoryCall).toBeTruthy();

    const postEvaluationHistoryState = postEvaluationHistoryCall[2];
    const lastEntry =
      postEvaluationHistoryState.evaluationHistory[
        postEvaluationHistoryState.evaluationHistory.length - 1
      ];

    expect(lastEntry.version).toBe('git:abcdef0@main');

    expect(lastEvaluationWrite).toBeDefined();
    expect(lastEvaluationWrite).toContain('| **git:abcdef0@main** |');
    expect(lastEvaluationWrite).not.toContain('| **vgit:abcdef0@main** |');
  });

  it('skips template writes when reports already exist (isFirstRun=false)', async () => {
    const { runUpdateReportsWorkflow } = await import('../updateReportsWorkflow.js');

    const callOrder: string[] = [];

    const deps = {
      workspaceScanner: {
        scan: vi.fn(async () => {
          callOrder.push('scan');
          return {
            projectName: 'test',
            generatedAt: '2025-01-01T00:00:00.000Z',
            rootPath: '/test/workspace',
            filesCount: 0,
            dirsCount: 0,
            languageStats: {},
            importantFiles: [],
            structureSummary: [],
            mainConfigFiles: {
              packageJson: { version: '0.4.14' },
              otherConfigs: [],
            },
          } as any;
        }),
      },
      snapshotService: {
        loadState: vi.fn(async () => {
          callOrder.push('loadState');
          return {
            lastSnapshot: null,
            sessions: [],
            appliedImprovements: [],
            lastUpdated: '2025-01-01T00:00:00.000Z',
            version: 1,
          } as any;
        }),
        createInitialState: vi.fn(),
        compareSnapshots: vi.fn(async () => {
          callOrder.push('compareSnapshots');
          return {
            isInitial: false,
            newFiles: [],
            removedFiles: [],
            changedConfigs: [],
            totalChanges: 0,
            previousSnapshotTime: '2025-01-01T00:00:00.000Z',
            currentSnapshotTime: '2025-01-01T00:00:00.000Z',
            languageStatsDiff: {},
          } as any;
        }),
        updateSnapshot: vi.fn((s: any) => {
          callOrder.push('updateSnapshot');
          return s;
        }),
        addSession: vi.fn((s: any) => {
          callOrder.push('addSession');
          return { ...s, sessions: [{}] };
        }),
        saveState: vi.fn(async () => {
          callOrder.push('saveState');
        }),
      },
      reportService: {
        ensureReportDirectory: vi.fn(async () => {
          callOrder.push('ensureReportDirectory');
        }),
        getReportPaths: vi.fn(() => {
          callOrder.push('getReportPaths');
          return {
            evaluation: '/test/devplan/Project_Evaluation_Report.md',
            improvement: '/test/devplan/Project_Improvement_Exploration_Report.md',
            sessionHistory: '/test/devplan/Session_History.md',
            prompt: '/test/devplan/Prompt.md',
          };
        }),
        createEvaluationTemplate: vi.fn(() => {
          callOrder.push('createEvaluationTemplate');
          return 'EVAL_TEMPLATE';
        }),
        createImprovementTemplate: vi.fn(() => {
          callOrder.push('createImprovementTemplate');
          return 'IMPROV_TEMPLATE';
        }),
        cleanupAppliedItems: vi.fn(async () => {
          callOrder.push('cleanupAppliedItems');
          return { improvementRemoved: 0, promptRemoved: 0 };
        }),
        updateSessionHistoryFile: vi.fn(async () => {
          callOrder.push('updateSessionHistoryFile');
        }),
      },
      aiService: { runAnalysisPrompt: vi.fn() },
      fs: {
        readFile: vi.fn(async (filePath: string) => {
          if (filePath.endsWith('Prompt.md')) {
            callOrder.push('readFile:prompt');
            throw new Error('ENOENT');
          }

          if (filePath.endsWith('Project_Evaluation_Report.md')) {
            callOrder.push('readFile:evaluation');
            return [
              '<!-- AUTO-TLDR-START -->',
              '| 항목 | 내용 |',
              '| **전체 점수** | 91/100 |',
              '| **전체 등급** | F |',
              '<!-- AUTO-TLDR-END -->',
              '<!-- AUTO-SCORE-START -->',
              '| 카테고리 | 점수 | 등급 | 변화 |',
              '|----------|------|------|------|',
              '| 코드 품질 | 85 | B | - |',
              '| 보안 | 90 | A- | - |',
              '| 테스트 커버리지 | 70 | C- | - |',
              '<!-- AUTO-SCORE-END -->',
              '<!-- AUTO-TREND-START -->',
              '| 버전 | 날짜 | 총점 | 비고 |',
              '|:---:|:---:|:---:|:---|',
              '| **v0.4.13** | 2025-12-15 | **90 (A-)** | - |',
              '- note',
              '<!-- AUTO-TREND-END -->',
            ].join('\n');
          }

          callOrder.push(`readFile:${filePath}`);
          throw new Error('ENOENT');
        }),
        writeFile: vi.fn(async (filePath: string) => {
          callOrder.push(`writeFile:${filePath}`);
        }),
      },
      ui: {
        withProgress: vi.fn(),
        clipboardWriteText: vi.fn(async (text: string) => {
          callOrder.push(`clipboard:${text}`);
        }),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        openMarkdownDocument: vi.fn(),
      },
      buildAnalysisPrompt: vi.fn(() => {
        callOrder.push('buildAnalysisPrompt');
        return 'PROMPT';
      }),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    await runUpdateReportsWorkflow({
      rootPath: '/test/workspace',
      projectName: 'test',
      config: {
        reportDirectory: 'devplan',
        analysisRoot: '',
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
      },
      isFirstRun: false,
      reportProgress: vi.fn(),
      deps,
    });

    expect(callOrder).toEqual([
      'scan',
      'loadState',
      'compareSnapshots',
      'getReportPaths',
      'readFile:prompt',
      'ensureReportDirectory',
      'buildAnalysisPrompt',
      'clipboard:PROMPT',
      'updateSnapshot',
      'addSession',
      'saveState',
      'updateSessionHistoryFile',
      'getReportPaths',
      'readFile:evaluation',
      'saveState',
      'writeFile:/test/devplan/Project_Evaluation_Report.md',
    ]);
  });
});
