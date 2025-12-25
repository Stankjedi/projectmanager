import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

vi.mock('vscode', () => ({
  Uri: {
    joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
      fsPath: [base.fsPath, ...parts].join('/'),
    })),
  },
  workspace: {
    openTextDocument: vi.fn(),
  },
  window: {
    showTextDocument: vi.fn(),
    showWarningMessage: vi.fn(),
  },
}));

describe('OpenTroubleshootingCommand', () => {
  const extensionUri = { fsPath: '/test/ext' } as unknown as vscode.Uri;
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

  it('opens TROUBLESHOOTING.md from the extension URI', async () => {
    const document = { uri: { fsPath: '/test/ext/TROUBLESHOOTING.md' } };
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(document as any);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);

    const { OpenTroubleshootingCommand } = await import('../openTroubleshooting.js');
    const cmd = new OpenTroubleshootingCommand(mockOutputChannel, extensionUri);

    await cmd.execute();

    expect(vscode.Uri.joinPath).toHaveBeenCalledWith(extensionUri, 'TROUBLESHOOTING.md');
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/test/ext/TROUBLESHOOTING.md' })
    );
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(document, { preview: false });
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('shows a warning and does not throw when TROUBLESHOOTING.md cannot be opened', async () => {
    vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('ENOENT'));

    const { OpenTroubleshootingCommand } = await import('../openTroubleshooting.js');
    const cmd = new OpenTroubleshootingCommand(mockOutputChannel, extensionUri);

    await expect(cmd.execute()).resolves.not.toThrow();

    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('[OpenTroubleshooting] Failed to open')
    );
    expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
  });
});

