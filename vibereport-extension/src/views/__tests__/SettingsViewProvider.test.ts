import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConfigGet = vi.fn();
const mockConfigUpdate = vi.fn();
const mockGetConfiguration = vi.fn();
const mockShowErrorMessage = vi.fn();
const mockShowInformationMessage = vi.fn();
const mockExecuteCommand = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfiguration(...args),
  },
  window: {
    showErrorMessage: (...args: any[]) => mockShowErrorMessage(...args),
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
  },
  commands: {
    executeCommand: (...args: any[]) => mockExecuteCommand(...args),
  },
  ConfigurationTarget: {
    Workspace: 'Workspace',
  },
}));

describe('SettingsViewProvider', () => {
  const mockOutput = { appendLine: vi.fn() } as any;
  const mockExtensionUri = { fsPath: '/ext' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigGet.mockImplementation((_key: string, def: any) => def);
    mockGetConfiguration.mockReturnValue({
      get: mockConfigGet,
      update: mockConfigUpdate,
    });
  });

  it('sets webview options and renders HTML on resolve', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage: vi.fn().mockResolvedValue(undefined),
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    expect(webviewView.webview.options.enableScripts).toBe(true);
    expect(webviewView.webview.html).toContain('<!DOCTYPE html>');
    expect(typeof onMessage).toBe('function');
  });

  it('getSetting posts settingsLoaded including analysisRoot and enableDirectAi', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const postMessage = vi.fn().mockResolvedValue(undefined);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage,
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    await onMessage?.({ command: 'getSetting' });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'settingsLoaded',
        settings: expect.objectContaining({
          analysisRoot: expect.any(String),
          enableDirectAi: expect.any(Boolean),
        }),
      })
    );
  });

  it('rejects unknown keys: updateSettings does not call config.update', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage: vi.fn().mockResolvedValue(undefined),
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    await onMessage?.({ command: 'updateSettings', settings: { unknownKey: 'x' } });

    expect(mockConfigUpdate).not.toHaveBeenCalled();
  });

  it('batch updates settings in deterministic order with a single notification and refresh', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const postMessage = vi.fn().mockResolvedValue(undefined);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage,
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    await onMessage?.({
      command: 'updateSettings',
      settings: {
        enableGitDiff: false,
        reportDirectory: '  myDir  ',
      },
    });

    expect(mockConfigUpdate).toHaveBeenCalledTimes(2);
    expect(mockConfigUpdate).toHaveBeenNthCalledWith(1, 'reportDirectory', 'myDir', 'Workspace');
    expect(mockConfigUpdate).toHaveBeenNthCalledWith(2, 'enableGitDiff', false, 'Workspace');
    expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('skips unchanged payload: updateSettings does not call config.update', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const postMessage = vi.fn().mockResolvedValue(undefined);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage,
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    await onMessage?.({
      command: 'updateSettings',
      settings: {
        reportDirectory: 'devplan',
        enableGitDiff: true,
      },
    });

    expect(mockConfigUpdate).not.toHaveBeenCalled();
    expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('updates only changed keys: one changed key triggers one config.update call', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const postMessage = vi.fn().mockResolvedValue(undefined);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage,
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    await onMessage?.({
      command: 'updateSettings',
      settings: {
        reportDirectory: 'myDir',
      },
    });

    expect(mockConfigUpdate).toHaveBeenCalledTimes(1);
    expect(mockConfigUpdate).toHaveBeenCalledWith('reportDirectory', 'myDir', 'Workspace');
    expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('resetToDefaults updates excludePatterns including **/*.vsix', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    let onMessage: ((message: any) => Promise<void>) | undefined;
    const webviewView = {
      webview: {
        options: {},
        html: '',
        cspSource: 'csp',
        postMessage: vi.fn().mockResolvedValue(undefined),
        onDidReceiveMessage: vi.fn((handler: any) => {
          onMessage = handler;
        }),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);

    await onMessage?.({ command: 'resetToDefaults' });

    expect(mockConfigUpdate).toHaveBeenCalledWith(
      'excludePatterns',
      expect.arrayContaining(['**/*.vsix']),
      'Workspace'
    );
  });
});
