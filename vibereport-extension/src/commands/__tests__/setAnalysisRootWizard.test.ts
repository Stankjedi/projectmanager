import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockFindFiles = vi.fn();
const mockGetConfiguration = vi.fn();
const mockShowQuickPick = vi.fn();
const mockShowInformationMessage = vi.fn();
const mockShowErrorMessage = vi.fn();
const mockUpdate = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    findFiles: (...args: any[]) => mockFindFiles(...args),
    getConfiguration: (...args: any[]) => mockGetConfiguration(...args),
  },
  window: {
    showQuickPick: (...args: any[]) => mockShowQuickPick(...args),
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
    showErrorMessage: (...args: any[]) => mockShowErrorMessage(...args),
  },
  ConfigurationTarget: {
    Workspace: 2,
  },
}));

const mockSelectWorkspaceRoot = vi.fn();
const mockResolveAnalysisRoot = vi.fn();

vi.mock('../../utils/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/index.js')>();
  return {
    ...actual,
    selectWorkspaceRoot: (...args: any[]) => mockSelectWorkspaceRoot(...args),
    resolveAnalysisRoot: (...args: any[]) => mockResolveAnalysisRoot(...args),
  };
});

describe('SetAnalysisRootWizardCommand', () => {
  const mockOutputChannel = {
    appendLine: vi.fn(),
  } as unknown as vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSelectWorkspaceRoot.mockResolvedValue('/mock/project');
    mockResolveAnalysisRoot.mockImplementation((rootPath: string, analysisRoot: string) =>
      analysisRoot ? `${rootPath}/${analysisRoot}` : rootPath
    );

    mockFindFiles.mockImplementation(async (include: string) => {
      if (include === '**/package.json') {
        return [{ fsPath: '/mock/project/vibereport-extension/package.json' }];
      }
      if (include === '**/tsconfig.json') {
        return [{ fsPath: '/mock/project/vibereport-extension/tsconfig.json' }];
      }
      if (include === '**/src/extension.ts') {
        return [{ fsPath: '/mock/project/vibereport-extension/src/extension.ts' }];
      }
      return [];
    });

    mockGetConfiguration.mockReturnValue({
      get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
      update: mockUpdate,
    });

    mockShowQuickPick.mockImplementation(async (items: any[]) =>
      items.find((item) => item.value === 'vibereport-extension')
    );
  });

  it('persists selected analysisRoot to workspace settings', async () => {
    const { SetAnalysisRootWizardCommand } = await import('../setAnalysisRootWizard.js');

    const command = new SetAnalysisRootWizardCommand(mockOutputChannel);
    await command.execute();

    expect(mockSelectWorkspaceRoot).toHaveBeenCalledTimes(1);
    expect(mockShowQuickPick).toHaveBeenCalledTimes(1);
    expect(mockResolveAnalysisRoot).toHaveBeenCalledWith('/mock/project', 'vibereport-extension');
    expect(mockUpdate).toHaveBeenCalledWith(
      'analysisRoot',
      'vibereport-extension',
      (vscode as any).ConfigurationTarget.Workspace
    );
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('vibereport-extension')
    );
    expect(mockShowErrorMessage).not.toHaveBeenCalled();
  });
});

