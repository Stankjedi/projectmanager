/**
 * CleanHistoryCommand Unit Tests
 *
 * @description 세션 히스토리 초기화 명령에 대한 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

const mockSelectWorkspaceRoot = vi.fn<() => Promise<string | null>>();
const mockLoadConfig = vi.fn();
const mockClearHistory = vi.fn();
const mockResolveAnalysisRoot = vi.fn((workspaceRoot: string) => workspaceRoot);

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

// Mock config utils
vi.mock('../../utils/index.js', () => ({
  selectWorkspaceRoot: mockSelectWorkspaceRoot,
  loadConfig: mockLoadConfig,
  resolveAnalysisRoot: mockResolveAnalysisRoot,
}));

// Mock SnapshotService
vi.mock('../../services/snapshotService.js', () => ({
  SnapshotService: class MockSnapshotService {
    clearHistory = mockClearHistory;
    constructor(_outputChannel: unknown) {}
  },
}));

describe('CleanHistoryCommand', () => {
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

  it('returns early when no workspace is selected', async () => {
    mockSelectWorkspaceRoot.mockResolvedValue(null);

    const { CleanHistoryCommand } = await import('../cleanHistory.js');
    const cmd = new CleanHistoryCommand(mockOutputChannel);

    await cmd.execute();

    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(mockClearHistory).not.toHaveBeenCalled();
  });

  it('logs and returns when user cancels confirmation', async () => {
    mockSelectWorkspaceRoot.mockResolvedValue('C:\\test\\workspace');
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'No' as unknown as never
    );

    const { CleanHistoryCommand } = await import('../cleanHistory.js');
    const cmd = new CleanHistoryCommand(mockOutputChannel);

    await cmd.execute();

    expect(mockClearHistory).not.toHaveBeenCalled();
    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('초기화 취소')
    );
  });

  it('clears history when user confirms', async () => {
    const rootPath = 'C:\\test\\workspace';
    const config = {
      analysisRoot: '',
      reportDirectory: 'devplan',
      snapshotFile: '.vscode/vibereport-state.json',
    } as unknown;

    mockSelectWorkspaceRoot.mockResolvedValue(rootPath);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Yes' as unknown as never
    );
    mockLoadConfig.mockReturnValue(config);
    mockClearHistory.mockResolvedValue(undefined);

    const { CleanHistoryCommand } = await import('../cleanHistory.js');
    const cmd = new CleanHistoryCommand(mockOutputChannel);

    await cmd.execute();

    expect(mockClearHistory).toHaveBeenCalledWith(rootPath, config);
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'vibereport.refreshViews'
    );
  });

  it('shows an error when clearHistory throws', async () => {
    const rootPath = 'C:\\test\\workspace';
    const config = {
      analysisRoot: '',
      reportDirectory: 'devplan',
      snapshotFile: '.vscode/vibereport-state.json',
    } as unknown;

    mockSelectWorkspaceRoot.mockResolvedValue(rootPath);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Yes' as unknown as never
    );
    mockLoadConfig.mockReturnValue(config);
    mockClearHistory.mockRejectedValue(new Error('boom'));

    const { CleanHistoryCommand } = await import('../cleanHistory.js');
    const cmd = new CleanHistoryCommand(mockOutputChannel);

    await cmd.execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('boom')
    );
  });
});
