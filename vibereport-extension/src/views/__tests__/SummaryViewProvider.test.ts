import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SnapshotService to avoid filesystem access
vi.mock('../../services/index.js', () => {
  const loadState = vi.fn().mockResolvedValue({
    lastUpdated: new Date().toISOString(),
    sessions: [],
    appliedImprovements: [],
    lastSnapshot: { projectName: 'Test Project' },
  });

  class SnapshotService {
    loadState = loadState;
  }

  return { SnapshotService };
});

// Minimal VS Code API mock
vi.mock('vscode', () => ({
  Uri: {
    file: (path: string) => ({ fsPath: path, path }),
    joinPath: (base: any, ...paths: string[]) => ({ fsPath: [base.fsPath, ...paths].join('/') }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' }, name: 'ws' }],
    getConfiguration: () => ({ get: (_: string, def: any) => def }),
    createFileSystemWatcher: vi.fn(),
  },
  window: {
    createOutputChannel: () => ({ appendLine: vi.fn(), dispose: vi.fn(), show: vi.fn() }),
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
}));

describe('SummaryViewProvider', () => {
  const mockOutput = { appendLine: vi.fn() } as any;
  const mockExtensionUri = { fsPath: '/ext' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets webview options and renders HTML on resolve', async () => {
    const { SummaryViewProvider } = await import('../SummaryViewProvider.js');
    const provider = new SummaryViewProvider(mockExtensionUri, mockOutput);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: vi.fn(),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);
    
    // Wait for async updateContent to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(webviewView.webview.options.enableScripts).toBe(true);
    expect(webviewView.webview.html).toContain('<!DOCTYPE html>');
    expect(webviewView.webview.html).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it('refresh updates the rendered webview HTML', async () => {
    const { SummaryViewProvider } = await import('../SummaryViewProvider.js');
    const provider = new SummaryViewProvider(mockExtensionUri, mockOutput);
    const webviewView = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: vi.fn(),
      },
    } as any;

    provider.resolveWebviewView(webviewView, {} as any, { isCancellationRequested: false } as any);
    webviewView.webview.html = '';

    await provider.refresh();

    expect(webviewView.webview.html).toContain('DOCTYPE html');
  });
});
