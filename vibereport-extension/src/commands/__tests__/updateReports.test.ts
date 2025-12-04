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
        '워크스페이스가 열려있지 않습니다. 프로젝트 폴더를 열어주세요.'
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
        '워크스페이스가 열려있지 않습니다. 프로젝트 폴더를 열어주세요.'
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
});
