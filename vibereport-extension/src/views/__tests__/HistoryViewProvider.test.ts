import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SnapshotService to return in-memory session data
vi.mock('../../services/index.js', () => {
  const loadState = vi.fn().mockResolvedValue({
    sessions: [
      {
        id: 'session_1',
        timestamp: new Date().toISOString(),
        userPrompt: 'Test session',
        changesSummary: 'Updated files',
        diffSummary: {
          newFilesCount: 1,
          removedFilesCount: 0,
          changedConfigsCount: 0,
          totalChanges: 1,
        },
      },
    ],
    appliedImprovements: [],
    lastUpdated: new Date().toISOString(),
    lastSnapshot: null,
  });

  class SnapshotService {
    loadState = loadState;
  }

  return { SnapshotService };
});

// Minimal VS Code API mock
vi.mock('vscode', () => ({
  Uri: { file: (path: string) => ({ fsPath: path, path }) },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' }, name: 'ws' }],
    getConfiguration: () => ({ get: (_: string, def: any) => def }),
    createFileSystemWatcher: vi.fn(),
  },
  window: {
    createOutputChannel: () => ({ appendLine: vi.fn(), dispose: vi.fn(), show: vi.fn() }),
  },
  TreeItem: class {
    label: string;
    description?: string;
    collapsibleState?: number;
    iconPath?: unknown;
    command?: { command: string; title: string; arguments?: any[] };
    contextValue?: string;
    tooltip?: string;
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  EventEmitter: class {
    listeners: Array<() => void> = [];
    event = (cb: () => void) => this.listeners.push(cb);
    fire = () => this.listeners.forEach((cb) => cb());
    dispose = vi.fn();
  },
  ThemeIcon: class {
    constructor(public id: string) {}
  },
}));

describe('HistoryViewProvider', () => {
  const mockOutput = { appendLine: vi.fn() } as any;
  const mockExtensionUri = { fsPath: '/ext' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns session items as tree nodes', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);

    const children = await provider.getChildren();

    expect(Array.isArray(children)).toBe(true);
    expect(children?.[0]?.label).toContain('Test session'.substring(0, 4));
  });

  it('returns detail items when expanding a session node', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);

    const rootItems = await provider.getChildren();
    const detailItems = await provider.getChildren(rootItems[0]);

    expect(detailItems.length).toBeGreaterThan(0);
    // Check that detail items include session info (timestamp or changes summary)
    expect(detailItems.some((item) => 
      String(item.label).includes('📅') || 
      String(item.label).includes('📝') || 
      String(item.description).includes('변경')
    )).toBe(true);
  });

  it('refresh triggers change event without throwing', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);

    expect(() => provider.refresh()).not.toThrow();
  });

  it('getTreeItem returns the same element', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);
    const sample = { label: 'node' } as any;

    expect(provider.getTreeItem(sample)).toBe(sample);
  });
});
