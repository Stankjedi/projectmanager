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

  it('shows warning when there is no active editor', async () => {
    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = undefined;

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockShowWarningMessage).toHaveBeenCalledWith('활성화된 에디터가 없습니다.');
    expect(mockSelectWorkspaceRoot).not.toHaveBeenCalled();
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  it('returns early when workspace selection is cancelled', async () => {
    mockSelectWorkspaceRoot.mockResolvedValueOnce(null);

    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = {
      selection: {},
      document: {
        getText: () => '',
      },
    };

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockSaveState).not.toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('shows error when analysisRoot is invalid', async () => {
    mockResolveAnalysisRoot.mockImplementationOnce(() => {
      throw new Error('invalid analysisRoot');
    });

    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = {
      selection: {},
      document: {
        getText: () => '',
      },
    };

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
    );
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockSaveState).not.toHaveBeenCalled();
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

  it('shows error when no pending improvements are found in the report', async () => {
    const reportWithoutIds = ['# 🚀 프로젝트 개선 탐색 보고서', '', '내용만 있고 ID 테이블이 없습니다.'].join('\n');
    mockReadFile.mockResolvedValue(reportWithoutIds);

    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = {
      selection: {},
      document: {
        getText: () => '',
      },
    };

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockShowErrorMessage).toHaveBeenCalledWith('개선 보고서에서 개선 항목을 찾지 못했습니다.');
    expect(mockShowQuickPick).not.toHaveBeenCalled();
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  it('does not save when QuickPick is cancelled', async () => {
    const report = [
      '### 🟡 중요 (P2)',
      '',
      '#### [P2-1] Command layer tests',
      '',
      '| 항목 | 내용 |',
      '|------|------|',
      '| **ID** | `test-commands-001` |',
      '',
    ].join('\n');

    mockReadFile.mockResolvedValue(report);

    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = {
      selection: {},
      document: {
        getText: () => '',
      },
    };

    mockShowQuickPick.mockResolvedValueOnce(undefined);

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockSaveState).not.toHaveBeenCalled();
    expect(mockShowInformationMessage).not.toHaveBeenCalled();
  });

  it('shows error when the improvement report cannot be read', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('EACCES'));

    (vscode.window as unknown as { activeTextEditor: any }).activeTextEditor = {
      selection: {},
      document: {
        getText: () => '',
      },
    };

    const { MarkImprovementAppliedCommand } = await import('../updateReports.js');
    const command = new MarkImprovementAppliedCommand(mockOutputChannel);

    await command.execute();

    expect(mockShowErrorMessage).toHaveBeenCalledWith(expect.stringMatching(/개선 보고서를 읽을 수 없습니다/i));
    expect(mockSaveState).not.toHaveBeenCalled();
  });
});
