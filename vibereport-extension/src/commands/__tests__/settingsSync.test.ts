import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
  window: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  extensions: {
    getExtension: vi.fn(),
  },
  ConfigurationTarget: {
    Workspace: 2,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

describe('settingsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('exportSettings writes JSON with metadata and settings payload', async () => {
    const configValues: Record<string, unknown> = {
      reportDirectory: 'devplan',
      snapshotFile: '.vscode/vibereport-state.json',
      enableGitDiff: true,
      'ai.customInstructions': 'hello',
    };

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => configValues[key]),
    } as any);

    vi.mocked(vscode.window.showSaveDialog).mockResolvedValue({
      fsPath: 'C:\\tmp\\vibereport-settings.json',
    } as any);

    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      packageJSON: { version: '0.4.15' },
    } as any);

    const { exportSettings } = await import('../settingsSync.js');
    await exportSettings();

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [_path, jsonText] = vi.mocked(fs.writeFile).mock.calls[0]!;

    const parsed = JSON.parse(String(jsonText)) as any;
    expect(parsed).toHaveProperty('exportedAt');
    expect(parsed.extensionVersion).toBe('0.4.15');
    expect(parsed.settings).toEqual(
      expect.objectContaining({
        reportDirectory: 'devplan',
        snapshotFile: '.vscode/vibereport-state.json',
        enableGitDiff: true,
        'ai.customInstructions': 'hello',
      })
    );
  });

  it('importSettings updates only allowlisted keys', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      update: mockUpdate,
    } as any);

    vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([
      { fsPath: 'C:\\tmp\\vibereport-settings.json' } as any,
    ]);

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        exportedAt: '2025-01-01T00:00:00.000Z',
        extensionVersion: '0.4.15',
        settings: {
          reportDirectory: 'devplan2',
          'ai.customInstructions': 'hi',
          notAllowed: true,
        },
      })
    );

    const { importSettings } = await import('../settingsSync.js');
    await importSettings();

    expect(mockUpdate).toHaveBeenCalledWith(
      'reportDirectory',
      'devplan2',
      vscode.ConfigurationTarget.Workspace
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      'ai.customInstructions',
      'hi',
      vscode.ConfigurationTarget.Workspace
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      'notAllowed',
      true,
      vscode.ConfigurationTarget.Workspace
    );
  });
});

