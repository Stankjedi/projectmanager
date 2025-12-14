/**
 * SetProjectVisionCommand Unit Tests
 *
 * @description 프로젝트 비전 설정 명령에 대한 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      update: vi.fn(),
    })),
  },
  window: {
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  ConfigurationTarget: {
    Workspace: 2,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock SnapshotService
vi.mock('../../services/index.js', () => ({
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
  },
}));

describe('SetProjectVisionCommand', () => {
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

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

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

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '워크스페이스가 열려있지 않습니다.'
      );
    });
  });

  describe('execute - user cancellation at each step', () => {
    it('should return early when user cancels project type selection', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - no further prompts or success message
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('should return early when user cancels core goals input', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // User selects project type but cancels core goals
      vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({
        label: 'VS Code Extension',
        value: 'vscode-extension'
      } as any);
      vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should return early when user cancels target users input', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // User completes project type and core goals but cancels target users
      vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({
        label: 'VS Code Extension',
        value: 'vscode-extension'
      } as any);
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce('Goal 1, Goal 2') // core goals
        .mockResolvedValueOnce(undefined); // target users cancelled

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should return early when user cancels quality focus selection', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      vi.mocked(vscode.window.showQuickPick)
        .mockResolvedValueOnce({ label: 'VS Code Extension', value: 'vscode-extension' } as any)
        .mockResolvedValueOnce(undefined); // quality focus cancelled
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce('Goal 1')
        .mockResolvedValueOnce('Developers');

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });

  describe('execute - successful flow', () => {
    it('should save vision and show success message when all inputs are provided', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Mock all user inputs for complete flow
      vi.mocked(vscode.window.showQuickPick)
        .mockResolvedValueOnce({ label: 'VS Code Extension', value: 'vscode-extension' } as any) // project type
        .mockResolvedValueOnce({ label: 'Development', value: 'development' } as any) // quality focus
        .mockResolvedValueOnce([{ label: 'Testing', value: 'testing' }] as any) // focus categories
        .mockResolvedValueOnce([] as any); // exclude categories (empty)

      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce('Goal 1, Goal 2') // core goals
        .mockResolvedValueOnce('VS Code users') // target users
        .mockResolvedValueOnce('TypeScript, VS Code API'); // tech stack

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('프로젝트 비전이 설정되었습니다'),
        '확인'
      );
    });

    it('should update projectVisionMode to custom when different from current', async () => {
      // Arrange
      const mockUpdate = vi.fn();
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue('auto'),
        update: mockUpdate,
      } as any);

      // Mock all user inputs for complete flow
      vi.mocked(vscode.window.showQuickPick)
        .mockResolvedValueOnce({ label: 'CLI Tool', value: 'cli-tool' } as any)
        .mockResolvedValueOnce({ label: 'Prototype', value: 'prototype' } as any)
        .mockResolvedValueOnce([{ label: 'Performance', value: 'performance' }] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce('Fast CLI')
        .mockResolvedValueOnce('Developers')
        .mockResolvedValueOnce('Node.js');

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith(
        'projectVisionMode',
        'custom',
        vscode.ConfigurationTarget.Workspace
      );
    });
  });

  describe('execute - error handling', () => {
    it('should show error message when an exception occurs', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Mock showQuickPick to throw an error
      vi.mocked(vscode.window.showQuickPick).mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('프로젝트 비전 설정 실패')
      );
    });

    it('should log error to output channel when save fails', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Mock all user inputs for complete flow
      vi.mocked(vscode.window.showQuickPick)
        .mockResolvedValueOnce({ label: 'VS Code Extension', value: 'vscode-extension' } as any)
        .mockResolvedValueOnce({ label: 'Development', value: 'development' } as any)
        .mockResolvedValueOnce([{ label: 'Testing', value: 'testing' }] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce('Goal 1, Goal 2')
        .mockResolvedValueOnce('VS Code users')
        .mockResolvedValueOnce('TypeScript, VS Code API');

      // Mock SnapshotService to throw on saveState
      vi.doMock('../../services/index.js', () => ({
        SnapshotService: class MockSnapshotService {
          loadState = vi.fn().mockResolvedValue(null);
          saveState = vi.fn().mockRejectedValue(new Error('Disk full'));
          createInitialState = vi.fn().mockReturnValue({
            version: '1.0.0',
            lastSnapshot: null,
            sessions: [],
            appliedImprovements: [],
            lastUpdated: new Date().toISOString(),
          });
        },
      }));

      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - error message should be shown
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringMatching(/실패|오류|error/i)
      );
      // Output channel should receive log
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should handle workspace configuration update failure gracefully', async () => {
      // Arrange - clear mocks first to avoid interference
      vi.clearAllMocks();

      const mockUpdate = vi.fn().mockRejectedValue(new Error('Config write failed'));
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue('auto'),
        update: mockUpdate,
      } as any);

      // Mock all user inputs for complete flow - ensure fresh mocks
      vi.mocked(vscode.window.showQuickPick)
        .mockResolvedValueOnce({ label: 'CLI Tool', value: 'cli-tool' } as any)
        .mockResolvedValueOnce({ label: 'Prototype', value: 'prototype' } as any)
        .mockResolvedValueOnce([{ label: 'Performance', value: 'performance' }] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce('Fast CLI')
        .mockResolvedValueOnce('Developers')
        .mockResolvedValueOnce('Node.js');

      // Reset modules to get fresh command instance
      vi.resetModules();
      const { SetProjectVisionCommand } = await import('../setProjectVision.js');
      const command = new SetProjectVisionCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - the command should have attempted to update config
      // Note: since config update throws, error should be caught and shown
      // Just verify the command completed and showed an error
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });
});
