import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

const mockShowQuickPick = vi.fn();
const mockShowInformationMessage = vi.fn();
const mockShowWarningMessage = vi.fn();
const mockShowErrorMessage = vi.fn();

vi.mock('vscode', () => ({
  window: {
    activeTextEditor: undefined,
    showQuickPick: (...args: any[]) => mockShowQuickPick(...args),
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
    showWarningMessage: (...args: any[]) => mockShowWarningMessage(...args),
    showErrorMessage: (...args: any[]) => mockShowErrorMessage(...args),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 }],
  },
}));

const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  readFile: (...args: any[]) => mockReadFile(...args),
}));

const mockLoadState = vi.fn();
const mockSaveState = vi.fn();

vi.mock('../../services/index.js', () => ({
  WorkspaceScanner: class MockWorkspaceScanner {},
  ReportService: class MockReportService {},
  AiService: class MockAiService {},
  SnapshotService: class MockSnapshotService {
    loadState = mockLoadState;
    saveState = mockSaveState;
    createInitialState = vi.fn(() => ({
      lastSnapshot: null,
      sessions: [],
      appliedImprovements: [],
      lastUpdated: new Date().toISOString(),
      version: 1,
    }));
    addAppliedImprovement = vi.fn((state: any, improvement: any) => ({
      ...state,
      appliedImprovements: [...(state.appliedImprovements ?? []), improvement],
    }));
    static generateSessionId(): string {
      return 'session_test';
    }
  },
}));

const mockSelectWorkspaceRoot = vi.fn();
const mockLoadConfig = vi.fn();
const mockResolveAnalysisRoot = vi.fn();

vi.mock('../../utils/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/index.js')>();
  return {
    ...actual,
    selectWorkspaceRoot: (...args: any[]) => mockSelectWorkspaceRoot(...args),
    loadConfig: (...args: any[]) => mockLoadConfig(...args),
    resolveAnalysisRoot: (...args: any[]) => mockResolveAnalysisRoot(...args),
  };
});

describe('MarkImprovementAppliedCommand', () => {
  const mockOutputChannel = {
    appendLine: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWorkspaceRoot.mockResolvedValue('/test/workspace');
    mockResolveAnalysisRoot.mockImplementation((rootPath: string) => rootPath);
    mockLoadConfig.mockReturnValue({
      reportDirectory: 'devplan',
      analysisRoot: '',
      snapshotFile: '.vscode/vibereport-state.json',
      enableGitDiff: false,
      excludePatterns: [],
      maxFilesToScan: 5000,
      autoOpenReports: true,
      enableDirectAi: false,
      language: 'ko',
      projectVisionMode: 'auto',
      defaultProjectType: 'auto-detect',
      defaultQualityFocus: 'development',
    });
    mockLoadState.mockResolvedValue(null);
    mockSaveState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('shows QuickPick and marks the selected improvement when there is no editor selection', async () => {
    const report = [
      '### 🟡 중요 (P2)',
      '',
      '#### [P2-1] Command layer tests',
      '',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `test-commands-001` |',
      '',
      '#### [P2-2] Sync README',
      '',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `docs-readme-sync-001` |',
      '',
    ].join('\n');

    mockReadFile.mockResolvedValue(report);

    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = {
      selection: {},
      document: {
        getText: () => '',
      },
    };

    mockShowQuickPick.mockImplementation(async (items: any[]) => items[1]);

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockShowQuickPick).toHaveBeenCalledTimes(1);
    expect(mockSaveState).toHaveBeenCalledTimes(1);

    const savedState = mockSaveState.mock.calls[0][2];
    expect(savedState.appliedImprovements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'docs-readme-sync-001' })])
    );
    expect(mockShowInformationMessage).toHaveBeenCalled();
  });
});

