/**
 * Extension activation smoke test
 *
 * @description activate()가 핵심 command ID들을 등록하는지 확인합니다.
 * 로컬라이즈된 메시지 문자열은 검증하지 않습니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import * as vscode from 'vscode';

const commandHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const updateReportsCommandMock = vi.hoisted(() => ({
  execute: vi.fn(),
  executeForWorkspace: vi.fn(),
}));
const reportServiceMock = vi.hoisted(() => ({
  openReport: vi.fn(),
  reportsExist: vi.fn(),
}));

// Ensure require() exists for extension.ts (it uses require('path') in a few places)
(globalThis as unknown as { require?: NodeRequire }).require ??= createRequire(
  __filename
);

// Mock vscode module
vi.mock('vscode', () => {
  const registerCommand = vi.fn((id: string, handler: unknown) => {
    commandHandlers.set(id, handler as (...args: unknown[]) => unknown);
    return {
      dispose: vi.fn(() => commandHandlers.delete(id)),
    };
  });

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
      openTextDocument: vi.fn(),
    },
    Uri: {
      file: vi.fn((fsPath: string) => ({ fsPath })),
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
      showErrorMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showTextDocument: vi.fn(),
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
    TextEditorRevealType: {
      InCenter: 2,
    },
    Selection: class Selection {
      constructor(
        public anchor: unknown,
        public active: unknown
      ) {}
    },
  };
});

// Mock dependencies created during activate()
vi.mock('./commands/index.js', () => ({
  UpdateReportsCommand: class MockUpdateReportsCommand {
    constructor(_outputChannel: unknown) {}
    execute = updateReportsCommandMock.execute;
    executeForWorkspace = updateReportsCommandMock.executeForWorkspace;
  },
  MarkImprovementAppliedCommand: class MockMarkImprovementAppliedCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  SetProjectVisionCommand: class MockSetProjectVisionCommand {
    constructor(_outputChannel: unknown) {}
    execute = vi.fn();
  },
  SetAnalysisRootWizardCommand: class MockSetAnalysisRootWizardCommand {
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
  ExportReportBundleCommand: class MockExportReportBundleCommand {
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
    openReport = reportServiceMock.openReport;
    initializeReports = vi.fn();
    reportsExist = reportServiceMock.reportsExist;
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
    analysisRoot: '',
    snapshotFile: '.vscode/vibereport-state.json',
    excludePatterns: [],
    enableGitDiff: true,
    respectGitignore: true,
    maxFilesToScan: 5000,
    autoOpenReports: true,
    enableDirectAi: false,
    language: 'ko',
    projectVisionMode: 'auto',
    defaultProjectType: 'auto-detect',
    defaultQualityFocus: 'development',
  })),
  selectWorkspaceRoot: vi.fn(async () => 'C:\\test\\workspace'),
  resolveAnalysisRoot: vi.fn((workspaceRoot: string) => workspaceRoot),
  formatTimestampForUi: vi.fn((timestamp: string) => timestamp),
}));

describe('extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commandHandlers.clear();
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
	      'vibereport.setAnalysisRootWizard',
	      'vibereport.generatePrompt',
	      'vibereport.shareReport',
	      'vibereport.exportReportBundle',
	      'vibereport.openReportPreview',
      'vibereport.clearHistory',
      'vibereport.reportDoctor',
      'vibereport.refreshViews',
      'vibereport.showSessionDetail',
    ].sort();

    const uniqueRegistered = [...new Set(registered)].sort();
    expect(uniqueRegistered).toEqual(expected);
  });

  describe('vibereport.openFunctionInFile', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    const baseConfig = {
      reportDirectory: 'devplan',
      analysisRoot: '',
      snapshotFile: '.vscode/vibereport-state.json',
      excludePatterns: [],
      enableGitDiff: true,
      respectGitignore: true,
      maxFilesToScan: 5000,
      autoOpenReports: true,
      enableDirectAi: false,
      language: 'ko',
      projectVisionMode: 'auto',
      defaultProjectType: 'auto-detect',
      defaultQualityFocus: 'development',
    } as const;

    beforeEach(async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockClear();
      vi.mocked(vscode.window.showWarningMessage).mockClear();

      const utils = await import('./utils/index.js');
      vi.mocked(utils.loadConfig).mockReturnValue(baseConfig as any);
    });

    it('blocks non-absolute paths', async () => {
      const { activate } = await import('./extension.js');
      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('src/file.ts');

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '보안 정책: 절대 경로가 아닌 파일은 열 수 없습니다.'
      );
      expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    it('blocks paths outside analysisRoot', async () => {
      const utils = await import('./utils/index.js');
      vi.mocked(utils.loadConfig).mockReturnValue({ ...baseConfig, analysisRoot: 'src' } as any);

      const { activate } = await import('./extension.js');
      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('C:\\test\\workspace\\other\\file.ts');

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '보안 정책: analysisRoot 밖 파일은 열 수 없습니다.'
      );
      expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    it('allows paths within analysisRoot', async () => {
      const utils = await import('./utils/index.js');
      vi.mocked(utils.loadConfig).mockReturnValue({ ...baseConfig, analysisRoot: 'src' } as any);

      const { activate } = await import('./extension.js');
      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('C:\\test\\workspace\\src\\file.ts');

      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe('vibereport.openEvaluationReport', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    beforeEach(async () => {
      reportServiceMock.openReport.mockClear();
      vi.mocked(vscode.commands.executeCommand).mockClear();
      vi.mocked(vscode.window.showErrorMessage).mockClear();

      const utils = await import('./utils/index.js');
      vi.mocked(utils.selectWorkspaceRoot).mockResolvedValue('C:\\test\\workspace');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation((workspaceRoot: string) => workspaceRoot);
    });

    it('opens the report in editorOnly mode without opening preview', async () => {
      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'reportOpenMode') return 'editorOnly';
          return defaultValue;
        }),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openEvaluationReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.openReport).toHaveBeenCalledWith(
        'C:\\test\\workspace',
        expect.any(Object),
        'evaluation'
      );
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );
    });

    it('opens the report and then opens preview in both mode', async () => {
      vi.useFakeTimers();
      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'reportOpenMode') return 'both';
          return defaultValue;
        }),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openEvaluationReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.openReport).toHaveBeenCalledWith(
        'C:\\test\\workspace',
        expect.any(Object),
        'evaluation'
      );
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );

      await vi.advanceTimersByTimeAsync(100);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );

      vi.useRealTimers();
    });

    it('opens the report and then opens preview in previewOnly mode', async () => {
      vi.useFakeTimers();
      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'reportOpenMode') return 'previewOnly';
          return defaultValue;
        }),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openEvaluationReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.openReport).toHaveBeenCalledWith(
        'C:\\test\\workspace',
        expect.any(Object),
        'evaluation'
      );

      await vi.advanceTimersByTimeAsync(100);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );

      vi.useRealTimers();
    });

    it('shows an error message when analysisRoot is invalid and does not open report', async () => {
      const utils = await import('./utils/index.js');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation(() => {
        throw new Error('bad analysisRoot');
      });

      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openEvaluationReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(reportServiceMock.openReport).not.toHaveBeenCalled();
    });
  });

  describe('vibereport.openImprovementReport', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    beforeEach(async () => {
      reportServiceMock.openReport.mockClear();
      vi.mocked(vscode.commands.executeCommand).mockClear();
      vi.mocked(vscode.window.showErrorMessage).mockClear();

      const utils = await import('./utils/index.js');
      vi.mocked(utils.selectWorkspaceRoot).mockResolvedValue('C:\\test\\workspace');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation((workspaceRoot: string) => workspaceRoot);
    });

    it('opens the report in editorOnly mode without opening preview', async () => {
      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'reportOpenMode') return 'editorOnly';
          return defaultValue;
        }),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openImprovementReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.openReport).toHaveBeenCalledWith(
        'C:\\test\\workspace',
        expect.any(Object),
        'improvement'
      );
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );
    });

    it('opens the report and then opens preview in both mode', async () => {
      vi.useFakeTimers();
      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'reportOpenMode') return 'both';
          return defaultValue;
        }),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openImprovementReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.openReport).toHaveBeenCalledWith(
        'C:\\test\\workspace',
        expect.any(Object),
        'improvement'
      );

      await vi.advanceTimersByTimeAsync(100);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );

      vi.useRealTimers();
    });

    it('opens the report and then opens preview in previewOnly mode', async () => {
      vi.useFakeTimers();
      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'reportOpenMode') return 'previewOnly';
          return defaultValue;
        }),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openImprovementReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.openReport).toHaveBeenCalledWith(
        'C:\\test\\workspace',
        expect.any(Object),
        'improvement'
      );

      await vi.advanceTimersByTimeAsync(100);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vibereport.openReportPreview'
      );

      vi.useRealTimers();
    });

    it('shows an error message when analysisRoot is invalid and does not open report', async () => {
      const utils = await import('./utils/index.js');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation(() => {
        throw new Error('bad analysisRoot');
      });

      const { activate } = await import('./extension.js');

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openImprovementReport') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(reportServiceMock.openReport).not.toHaveBeenCalled();
    });
  });

  describe('vibereport.openPrompt', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    beforeEach(async () => {
      vi.mocked(vscode.window.showWarningMessage).mockClear();
      vi.mocked(vscode.workspace.openTextDocument).mockClear();
      vi.mocked(vscode.window.showTextDocument).mockClear();

      const utils = await import('./utils/index.js');
      vi.mocked(utils.selectWorkspaceRoot).mockResolvedValue('C:\\test\\workspace');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation((workspaceRoot: string) => workspaceRoot);
    });

    it('opens Prompt.md when the file exists', async () => {
      const doc = { uri: { fsPath: 'C:\\test\\workspace\\devplan\\Prompt.md' } } as any;
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openPrompt') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(doc);
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows a warning when Prompt.md is missing', async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('ENOENT'));

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openPrompt') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Prompt.md 파일이 없습니다. 먼저 보고서 업데이트를 실행해주세요.'
      );
    });
  });

  describe('vibereport.openSessionHistory', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    beforeEach(async () => {
      vi.mocked(vscode.window.showWarningMessage).mockClear();
      vi.mocked(vscode.workspace.openTextDocument).mockClear();
      vi.mocked(vscode.window.showTextDocument).mockClear();

      const utils = await import('./utils/index.js');
      vi.mocked(utils.selectWorkspaceRoot).mockResolvedValue('C:\\test\\workspace');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation((workspaceRoot: string) => workspaceRoot);
    });

    it('opens Session_History.md when the file exists', async () => {
      const doc = { uri: { fsPath: 'C:\\test\\workspace\\devplan\\Session_History.md' } } as any;
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openSessionHistory') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(doc);
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('shows a warning when Session_History.md is missing', async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('ENOENT'));

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openSessionHistory') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Session_History.md 파일이 없습니다. 먼저 보고서 업데이트를 실행해주세요.'
      );
    });
  });

  describe('vibereport.initializeReports', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    beforeEach(async () => {
      updateReportsCommandMock.execute.mockClear();
      reportServiceMock.reportsExist.mockClear();
      vi.mocked(vscode.window.showWarningMessage).mockClear();

      const utils = await import('./utils/index.js');
      vi.mocked(utils.selectWorkspaceRoot).mockResolvedValue('C:\\test\\workspace');
      vi.mocked(utils.resolveAnalysisRoot).mockImplementation((workspaceRoot: string) => workspaceRoot);
    });

    it('runs updateReports when reports do not exist', async () => {
      reportServiceMock.reportsExist.mockResolvedValue(false);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.initializeReports') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(reportServiceMock.reportsExist).toHaveBeenCalled();
      expect(updateReportsCommandMock.execute).toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('does not run updateReports when user cancels overwrite', async () => {
      reportServiceMock.reportsExist.mockResolvedValue(true);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('취소' as any);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.initializeReports') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(updateReportsCommandMock.execute).not.toHaveBeenCalled();
    });

    it('runs updateReports when user confirms overwrite', async () => {
      reportServiceMock.reportsExist.mockResolvedValue(true);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('초기화' as any);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.initializeReports') as
        | (() => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.();

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(updateReportsCommandMock.execute).toHaveBeenCalled();
    });
  });

  describe('vibereport.openFunctionInFile', () => {
    const createContext = (): vscode.ExtensionContext =>
      ({
        subscriptions: [],
        extensionUri: { fsPath: 'C:\\test\\ext' },
        extensionPath: 'C:\\test\\ext',
      }) as unknown as vscode.ExtensionContext;

    beforeEach(() => {
      vi.mocked(vscode.workspace.openTextDocument).mockReset();
      vi.mocked(vscode.window.showTextDocument).mockReset();
      vi.mocked(vscode.window.showWarningMessage).mockReset();
      vi.mocked(vscode.window.showErrorMessage).mockReset();
      vi.mocked(vscode.commands.executeCommand).mockReset();
    });

    it('opens a file without resolving symbols when symbolName is omitted', async () => {
      const doc = { uri: { fsPath: 'C:\\test\\workspace\\src\\a.ts' } } as any;
      const editor = { revealRange: vi.fn(), selection: undefined } as any;

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(editor);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('C:\\test\\workspace\\src\\a.ts');

      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(doc, { preview: false });
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'vscode.executeDocumentSymbolProvider',
        expect.anything()
      );
    });

    it('reveals a symbol when symbolName matches a nested DocumentSymbol', async () => {
      const doc = { uri: { fsPath: 'C:\\test\\workspace\\src\\a.ts' } } as any;
      const editor = { revealRange: vi.fn(), selection: undefined } as any;

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(editor);
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue([
        {
          name: 'outer',
          selectionRange: { start: { line: 1, character: 0 } },
          children: [
            {
              name: 'inner',
              selectionRange: { start: { line: 2, character: 1 } },
              children: [],
            },
          ],
        },
      ] as any);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('C:\\test\\workspace\\src\\a.ts', 'inner');

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.executeDocumentSymbolProvider',
        expect.anything()
      );
      expect(editor.revealRange).toHaveBeenCalledWith(
        { start: { line: 2, character: 1 } },
        (vscode as any).TextEditorRevealType.InCenter
      );
      expect(editor.selection).toBeDefined();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('warns when a requested symbol cannot be found', async () => {
      const doc = { uri: { fsPath: 'C:\\test\\workspace\\src\\a.ts' } } as any;
      const editor = { revealRange: vi.fn(), selection: undefined } as any;

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(doc);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(editor);
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue([
        { name: 'other', selectionRange: { start: { line: 1, character: 0 } }, children: [] },
      ] as any);

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('C:\\test\\workspace\\src\\a.ts', 'missing');

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '함수/심볼을 찾을 수 없습니다: missing'
      );
      expect(editor.revealRange).not.toHaveBeenCalled();
    });

    it('shows an error message when opening the file fails', async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('boom'));

      const { activate } = await import('./extension.js');
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      } as any);

      await activate(createContext());

      const handler = commandHandlers.get('vibereport.openFunctionInFile') as
        | ((filePath: string, symbolName?: string) => Promise<void>)
        | undefined;
      expect(handler).toBeTypeOf('function');

      await handler?.('C:\\test\\workspace\\src\\a.ts', 'inner');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '파일을 열 수 없습니다: C:\\test\\workspace\\src\\a.ts'
      );
    });
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
