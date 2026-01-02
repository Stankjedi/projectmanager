import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

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

  it('buildSettingsHtml is deterministic for stable inputs', async () => {
    const { buildSettingsHtml } = await import('../settingsViewHtml.js');
    const html = buildSettingsHtml({ nonce: 'nonce', cspSource: 'csp' });

    expect(html).toContain("script-src 'nonce-nonce'");
    expect(html).toContain('<script nonce="nonce">');

    const digest = createHash('sha256').update(html).digest('hex');
    expect(digest).toBe('db1aa96f1ea48719bc4740034ed203aced9b835b1473851fc67dca74343e1896');
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

  it('rejects non-object payload: updateSettings shows an error and does not update', async () => {
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

    await onMessage?.({ command: 'updateSettings', settings: ['not-an-object'] });

    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      '설정 업데이트 실패: settings는 객체여야 합니다.'
    );
    expect(mockConfigUpdate).not.toHaveBeenCalled();
  });

  it('validates and updates a wide settings payload (covers all validation branches)', async () => {
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

    await onMessage?.({
      command: 'updateSettings',
      settings: {
        reportDirectory: 'myReports',
        analysisRoot: 'packages/app',
        snapshotFile: '.vscode/state.json',
        enableGitDiff: false,
        excludePatterns: ['**/node_modules/**', '', '**/node_modules/**', '  **/dist/**  '],
        maxFilesToScan: 99, // clamped to 100
        autoOpenReports: false,
        enableDirectAi: true,
        language: 'en',
        projectVisionMode: 'custom',
        defaultProjectType: 'web-backend',
        defaultQualityFocus: 'production',
        previewEnabled: false,
        preferredMarkdownViewer: 'standard',
        previewBackgroundColor: 'white',
        reportOpenMode: 'both',
        enableAutoUpdateReports: true,
        autoUpdateDebounceMs: 70000, // clamped to 60000
      },
    });

    expect(mockConfigUpdate).toHaveBeenCalled();
    expect(mockShowErrorMessage).not.toHaveBeenCalled();
  });

  it('rejects invalid enum values: updateSettings shows an error and does not update', async () => {
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

    await onMessage?.({
      command: 'updateSettings',
      settings: {
        language: 'fr',
      },
    });

    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('설정 값이 올바르지 않습니다 (language)')
    );
    expect(mockConfigUpdate).not.toHaveBeenCalled();
  });

  it('handles config.update failures: updateSettings shows a save failure message', async () => {
    mockConfigUpdate.mockRejectedValueOnce(new Error('write failed'));

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

    await onMessage?.({
      command: 'updateSettings',
      settings: {
        reportDirectory: 'x',
      },
    });

    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('설정 저장 실패:')
    );
  });

  it('openSetVision delegates to the setProjectVision command', async () => {
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

    await onMessage?.({ command: 'openSetVision' });

    expect(mockExecuteCommand).toHaveBeenCalledWith('vibereport.setProjectVision');
  });

  it('resetToDefaults shows a different message based on whether updates were applied', async () => {
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

    // No changes: config.get returns defaults => no updates.
    await onMessage?.({ command: 'resetToDefaults' });
    expect(mockShowInformationMessage).toHaveBeenCalledWith('변경된 설정이 없습니다.');

    // Now simulate at least one changed key.
    mockConfigGet.mockImplementation((key: string, def: any) => {
      if (key === 'enableGitDiff') return false;
      return def;
    });
    await onMessage?.({ command: 'resetToDefaults' });
    expect(mockShowInformationMessage).toHaveBeenCalledWith('설정이 기본값으로 초기화되었습니다.');
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'settingsLoaded' })
    );
  });

  it('resetToDefaults updates excludePatterns including **/*.vsix', async () => {
    const { SettingsViewProvider } = await import('../SettingsViewProvider.js');
    const provider = new SettingsViewProvider(mockExtensionUri, mockOutput);

    mockConfigGet.mockImplementation((key: string, def: any) => {
      if (key === 'excludePatterns') {
        return ['**/node_modules/**'];
      }
      return def;
    });

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
