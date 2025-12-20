/**
 * Extension activation smoke test
 *
 * @description activate()가 핵심 command ID들을 등록하는지 확인합니다.
 * 로컬라이즈된 메시지 문자열은 검증하지 않습니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import * as vscode from 'vscode';

// Ensure require() exists for extension.ts (it uses require('path') in a few places)
(globalThis as unknown as { require?: NodeRequire }).require ??= createRequire(
  __filename
);

// Mock vscode module
vi.mock('vscode', () => {
  const registerCommand = vi.fn((_id: string, _handler: unknown) => ({
    dispose: vi.fn(),
  }));

  const createFileSystemWatcher = vi.fn(() => ({
    onDidChange: vi.fn(),
    onDidCreate: vi.fn(),
    onDidDelete: vi.fn(),
    dispose: vi.fn(),
  }));

  return {
    workspace: {
      workspaceFolders: [
        { uri: { fsPath: 'C:\\test\\workspace' }, name: 'test', index: 0 },     
      ],
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),       
      })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
      createFileSystemWatcher,
    },
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        dispose: vi.fn(),
      })),
      createStatusBarItem: vi.fn(() => ({
        command: '',
        text: '',
        tooltip: '',
        show: vi.fn(),
        dispose: vi.fn(),
      })),
      registerTreeDataProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
      createWebviewPanel: vi.fn(() => ({ webview: { html: '' } })),
    },
    EventEmitter: class EventEmitter<T> {
      private listeners: Array<(e: T) => void> = [];
      event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: vi.fn() };
      };
      fire = (data: T) => {
        for (const listener of this.listeners) {
          listener(data);
        }
      };
      dispose = vi.fn();
    },
    commands: {
      registerCommand,
      executeCommand: vi.fn(),
    },
    RelativePattern: class RelativePattern {
      constructor(public base: string, public pattern: string) {}
    },
    StatusBarAlignment: {
      Right: 2,
    },
  };
});

// Mock dependencies created during activate()
vi.mock('./commands/index.js', () => ({
  UpdateReportsCommand: class MockUpdateReportsCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  MarkImprovementAppliedCommand: class MockMarkImprovementAppliedCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  SetProjectVisionCommand: class MockSetProjectVisionCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  GeneratePromptCommand: class MockGeneratePromptCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  ShareReportCommand: class MockShareReportCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  ReportDoctorCommand: class MockReportDoctorCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
}));

vi.mock('./commands/openReportPreview.js', () => ({
  OpenReportPreviewCommand: class MockOpenReportPreviewCommand {
    constructor(_outputChannel: unknown, _extensionUri?: unknown) {}
    execute = vi.fn();
  },
}));

vi.mock('./commands/updateReportsAll.js', () => ({
  UpdateReportsAllCommand: class MockUpdateReportsAllCommand {
    constructor(_outputChannel: unknown, _updateReportsCommand?: unknown) {}
    execute = vi.fn();
  },
}));

vi.mock('./commands/settingsSync.js', () => ({
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
}));

vi.mock('./commands/cleanHistory.js', () => ({
  CleanHistoryCommand: class MockCleanHistoryCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
}));

vi.mock('./services/index.js', () => ({
  ReportService: class MockReportService {
    constructor(_outputChannel: unknown) {}
    openReport = vi.fn();
    initializeReports = vi.fn();
  },
}));

vi.mock('./services/previewStyleService.js', () => ({
  PreviewStyleService: class MockPreviewStyleService {
    constructor(_outputChannel: unknown, _extensionPath: string) {}
    updatePreviewStyles = vi.fn();
    registerConfigChangeListener = vi.fn(() => ({ dispose: vi.fn() }));
  },
}));

vi.mock('./views/HistoryViewProvider.js', () => ({
  HistoryViewProvider: class MockHistoryViewProvider {
    constructor(_extensionUri: unknown, _outputChannel: unknown) {}
    refresh = vi.fn();
  },
}));

vi.mock('./views/SummaryViewProvider.js', () => ({
  SummaryViewProvider: class MockSummaryViewProvider {
    constructor(_extensionUri: unknown, _outputChannel: unknown) {}
    refresh = vi.fn();
    setAutoUpdateStatus = vi.fn();
  },
}));

vi.mock('./views/SettingsViewProvider.js', () => ({
  SettingsViewProvider: class MockSettingsViewProvider {
    constructor(_extensionUri: unknown, _outputChannel: unknown) {}
    refresh = vi.fn();
  },
}));

vi.mock('./utils/index.js', () => ({
  loadConfig: vi.fn(() => ({
    reportDirectory: 'devplan',
    snapshotFile: '.vscode/vibereport-state.json',
    excludePatterns: [],
  })),
  selectWorkspaceRoot: vi.fn(),
}));

describe('extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('activate() registers all command IDs', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => {
        if (key === 'enableAutoUpdateReports') {
          return true;
        }
        return defaultValue;
      }),
    } as any);

    await activate(context);

    const output = vi.mocked(vscode.window.createOutputChannel).mock.results[0]
      ?.value as { appendLine: ReturnType<typeof vi.fn> };
    const pkg = (globalThis as unknown as { require: NodeRequire }).require(
      '../package.json'
    ) as { version?: string };
    const version = pkg.version ?? 'unknown';
    expect(output.appendLine).toHaveBeenCalledWith(
      `Vibe Coding Report Extension v${version}`
    );

    const statusBar = vi.mocked(vscode.window.createStatusBarItem).mock.results[0]
      ?.value as { text: string; tooltip: string };
    expect(statusBar.text).toContain('$(sync)');
    expect(statusBar.tooltip).toContain('자동 업데이트');

    const calls = vi.mocked(vscode.commands.registerCommand).mock.calls;        
    const registered = calls.map(args => args[0]);

    const expected = [
      'vibereport.updateReports',
      'vibereport.updateReportsAll',
      'vibereport.exportSettings',
      'vibereport.importSettings',
      'vibereport.openEvaluationReport',
      'vibereport.openImprovementReport',
      'vibereport.openPrompt',
      'vibereport.openSessionHistory',
      'vibereport.openFunctionInFile',
      'vibereport.initializeReports',
      'vibereport.markApplied',
      'vibereport.setProjectVision',
      'vibereport.generatePrompt',
      'vibereport.shareReport',
      'vibereport.openReportPreview',
      'vibereport.clearHistory',
      'vibereport.reportDoctor',
      'vibereport.refreshViews',
      'vibereport.showSessionDetail',
    ].sort();

    const uniqueRegistered = [...new Set(registered)].sort();
    expect(uniqueRegistered).toEqual(expected);
  });

  it('activate() keeps status bar plain when auto-update is disabled', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => {
        if (key === 'enableAutoUpdateReports') {
          return false;
        }
        return defaultValue;
      }),
    } as any);

    await activate(context);

    const statusBar = vi.mocked(vscode.window.createStatusBarItem).mock.results[0]
      ?.value as { text: string; tooltip: string };

    expect(statusBar.text).toBe('$(notebook-render-output) Vibe Report');
    expect(statusBar.text).not.toContain('$(sync)');
    expect(statusBar.tooltip).toBe('프로젝트 보고서 업데이트 (Vibe Coding)');
    expect(statusBar.tooltip).not.toContain('자동 업데이트');
  });

  it('activate() skips auto-refresh watchers when no workspace folder is open', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.workspace).workspaceFolders = undefined as unknown as vscode.WorkspaceFolder[];
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as any);

    await activate(context);

    const output = vi.mocked(vscode.window.createOutputChannel).mock.results[0]
      ?.value as { appendLine: ReturnType<typeof vi.fn> };

    expect(output.appendLine).toHaveBeenCalledWith(
      '[FileWatcher] No workspace folder open; skipping auto-refresh watchers'
    );
    expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
  });

  it('activate() registers view providers', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as any);

    await activate(context);

    expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
      'vibereport.history',
      expect.any(Object)
    );
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'vibereport.summary',
      expect.any(Object)
    );
    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'vibereport.settings',
      expect.any(Object)
    );
  });

  it('activate() registers updateReports command and stores disposables', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as any);

    await activate(context);

    const registeredCommands = vi.mocked(vscode.commands.registerCommand).mock.calls.map(
      args => args[0]
    );
    expect(registeredCommands).toContain('vibereport.updateReports');
    expect(context.subscriptions.length).toBeGreaterThan(0);
  });

  it('activate() handles file watcher initialization errors gracefully', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.workspace).workspaceFolders = [
      { uri: { fsPath: 'C:\\test\\workspace' }, name: 'test', index: 0 },
    ] as unknown as vscode.WorkspaceFolder[];

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as any);

    vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementationOnce(() => {
      throw new Error('watcher boom');
    });

    await expect(activate(context)).resolves.not.toThrow();

    const output = vi.mocked(vscode.window.createOutputChannel).mock.results[0]
      ?.value as { appendLine: ReturnType<typeof vi.fn> };

    expect(output.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('[FileWatcher] Failed to initialize watchers')
    );
  });

  it('activate() surfaces output channel failures', async () => {
    const { activate } = await import('./extension.js');

    const context = {
      subscriptions: [],
      extensionUri: { fsPath: 'C:\\test\\ext' },
      extensionPath: 'C:\\test\\ext',
    } as unknown as vscode.ExtensionContext;

    vi.mocked(vscode.window.createOutputChannel).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(activate(context)).rejects.toThrow('boom');
  });
});
