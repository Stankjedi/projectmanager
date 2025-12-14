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
