import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SnapshotService to return in-memory session data
vi.mock('../../services/index.js', () => {
  const loadState = vi.fn().mockResolvedValue({
    sessions: [
      {
        id: 'session_1',
        timestamp: new Date().toISOString(),
        userPrompt: 'Test session prompt',
        changesSummary: 'Updated files and configurations',
        diffSummary: {
          newFilesCount: 2,
          removedFilesCount: 1,
          changedConfigsCount: 1,
          totalChanges: 4,
        },
        aiMetadata: {
          risksIdentified: 2,
          improvementsProposed: 5,
          priorityItems: ['Fix security issue', 'Add tests'],
          overallScore: 75,
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
    id: string;
    color?: any;
    constructor(id: string, color?: any) {
      this.id = id;
      this.color = color;
    }
  },
  ThemeColor: class {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
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
    expect(children.length).toBe(1);
    // Session label should contain part of the userPrompt
    expect(children[0]?.label).toContain('Test session');
  });

  it('returns section items when expanding a session node', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);

    const rootItems = await provider.getChildren();
    const sectionItems = await provider.getChildren(rootItems[0]);

    expect(sectionItems.length).toBeGreaterThan(0);
    // Should have timestamp, changes section, improvements section, risks section
    expect(sectionItems.length).toBeGreaterThanOrEqual(3);
    
    // Check descriptions include expected sections
    const descriptions = sectionItems.map(item => item.description);
    expect(descriptions).toContain('시간');
    expect(descriptions).toContain('변경사항');

    const timeItem = sectionItems.find(item => item.description === '시간');
    expect(timeItem).toBeDefined();
    expect(String(timeItem?.label)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('returns detail items when expanding a section node', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);

    const rootItems = await provider.getChildren();
    const sectionItems = await provider.getChildren(rootItems[0]);
    
    // Find the changes section (type='section', sectionType='changes')
    const changesSection = sectionItems.find(
      item => (item as any).itemType === 'section' && (item as any).sectionType === 'changes'
    );
    
    if (changesSection) {
      const detailItems = await provider.getChildren(changesSection);
      expect(detailItems.length).toBeGreaterThan(0);
      // Should show file change details
      const labels = detailItems.map(item => String(item.label));
      expect(labels.some(l => l.includes('파일') || l.includes('변경'))).toBe(true);
    }
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

  it('session items have history icon and command', async () => {
    const { HistoryViewProvider } = await import('../HistoryViewProvider.js');
    const provider = new HistoryViewProvider(mockExtensionUri, mockOutput);

    const children = await provider.getChildren();
    const sessionItem = children[0];

    expect(sessionItem.iconPath).toBeDefined();
    expect(sessionItem.command?.command).toBe('vibereport.showSessionDetail');
    expect((sessionItem as any).itemType).toBe('session');
  });
});
