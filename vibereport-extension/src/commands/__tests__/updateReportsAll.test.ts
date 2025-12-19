import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [],
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    withProgress: vi.fn(async (_options, task) => {
      return task({ report: vi.fn() });
    }),
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

describe('UpdateReportsAllCommand', () => {
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

  it('fails fast when no workspace folders exist', async () => {
    vi.mocked(vscode.workspace).workspaceFolders = undefined as any;

    const updateReportsCommand = {
      executeForWorkspace: vi.fn(),
    } as any;

    const { UpdateReportsAllCommand } = await import('../updateReportsAll.js');
    const cmd = new UpdateReportsAllCommand(mockOutputChannel, updateReportsCommand);

    await cmd.execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    expect(updateReportsCommand.executeForWorkspace).not.toHaveBeenCalled();
  });

  it('iterates all workspace folders and calls executeForWorkspace sequentially', async () => {
    vi.mocked(vscode.workspace).workspaceFolders = [
      { uri: { fsPath: 'C:\\a' }, name: 'a', index: 0 },
      { uri: { fsPath: 'C:\\b' }, name: 'b', index: 1 },
    ] as any;

    const updateReportsCommand = {
      executeForWorkspace: vi.fn().mockResolvedValue(undefined),
    } as any;

    const { UpdateReportsAllCommand } = await import('../updateReportsAll.js');
    const cmd = new UpdateReportsAllCommand(mockOutputChannel, updateReportsCommand);

    await cmd.execute();

    expect(updateReportsCommand.executeForWorkspace).toHaveBeenCalledTimes(2);
    expect(updateReportsCommand.executeForWorkspace).toHaveBeenNthCalledWith(
      1,
      'C:\\a',
      'a',
      expect.objectContaining({
        progress: expect.any(Object),
        suppressOpenReports: true,
        suppressNotifications: true,
      })
    );
    expect(updateReportsCommand.executeForWorkspace).toHaveBeenNthCalledWith(
      2,
      'C:\\b',
      'b',
      expect.objectContaining({
        progress: expect.any(Object),
        suppressOpenReports: true,
        suppressNotifications: true,
      })
    );
  });
});

