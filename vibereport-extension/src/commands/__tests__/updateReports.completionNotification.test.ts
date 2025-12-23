import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockShowInformationMessage = vi.fn();
const mockExecuteCommand = vi.fn();

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
  },
  commands: {
    executeCommand: (...args: any[]) => mockExecuteCommand(...args),
  },
}));

vi.mock('../../services/index.js', () => ({
  WorkspaceScanner: class MockWorkspaceScanner {},
  SnapshotService: class MockSnapshotService {},
  AiService: class MockAiService {},
  ReportService: class MockReportService {},
}));

describe('UpdateReportsCommand._showCompletionNotification', () => {
  const mockOutputChannel = {
    appendLine: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.OutputChannel;

  const mockConfig = {
    reportDirectory: 'devplan',
    analysisRoot: '',
    snapshotFile: '.vscode/vibereport-state.json',
    enableGitDiff: false,
    respectGitignore: true,
    excludePatterns: [],
    maxFilesToScan: 5000,
    autoOpenReports: true,
    enableDirectAi: false,
    language: 'ko',
    projectVisionMode: 'auto',
    defaultProjectType: 'auto-detect',
    defaultQualityFocus: 'development',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when notifications are suppressed', async () => {
    const { UpdateReportsCommand } = await import('../updateReports.js');
    const command = new UpdateReportsCommand(mockOutputChannel);

    await (command as any)._showCompletionNotification('/root', mockConfig, 'demo', true, {
      suppressNotifications: true,
    });

    expect(mockShowInformationMessage).not.toHaveBeenCalled();
  });

  it('opens Copilot Chat when selected', async () => {
    mockShowInformationMessage.mockResolvedValueOnce('Copilot Chat 열기');

    const { UpdateReportsCommand } = await import('../updateReports.js');
    const command = new UpdateReportsCommand(mockOutputChannel);
    (command as any).reportService = { openReport: vi.fn() };

    await (command as any)._showCompletionNotification('/root', mockConfig, 'demo', true, {
      suppressOpenReports: true,
    });

    expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.panel.chat.view.copilot.focus');
    expect((command as any).reportService.openReport).not.toHaveBeenCalled();
  });

  it('opens evaluation report when selected', async () => {
    mockShowInformationMessage.mockResolvedValueOnce('평가 보고서 열기');

    const { UpdateReportsCommand } = await import('../updateReports.js');
    const command = new UpdateReportsCommand(mockOutputChannel);
    (command as any).reportService = { openReport: vi.fn() };

    await (command as any)._showCompletionNotification('/root', mockConfig, 'demo', false);

    expect((command as any).reportService.openReport).toHaveBeenCalledWith(
      '/root',
      mockConfig,
      'evaluation'
    );
  });

  it('opens improvement report when selected', async () => {
    mockShowInformationMessage.mockResolvedValueOnce('개선 보고서 열기');

    const { UpdateReportsCommand } = await import('../updateReports.js');
    const command = new UpdateReportsCommand(mockOutputChannel);
    (command as any).reportService = { openReport: vi.fn() };

    await (command as any)._showCompletionNotification('/root', mockConfig, 'demo', false);

    expect((command as any).reportService.openReport).toHaveBeenCalledWith(
      '/root',
      mockConfig,
      'improvement'
    );
  });
});

