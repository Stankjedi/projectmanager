import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

const createFileSystemWatcherMock = vi.hoisted(() => {
  return vi.fn(() => ({
    onDidChange: vi.fn(),
    onDidCreate: vi.fn(),
    onDidDelete: vi.fn(),
    dispose: vi.fn(),
  }));
});

vi.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: createFileSystemWatcherMock,
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
  RelativePattern: class RelativePattern {
    constructor(public base: unknown, public pattern: string) {}
  },
}));

describe('AutoUpdateReportsManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('does not start the watcher when disabled', async () => {
    const { AutoUpdateReportsManager } = await import('../realtimeWatcherService.js');

    const manager = new AutoUpdateReportsManager(
      { reportDirectory: 'devplan', snapshotFile: '.vscode/vibereport-state.json', excludePatterns: [] },
      () => [{ uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any],
      vi.fn().mockResolvedValue(undefined)
    );

    manager.applySettings({ enabled: false, debounceMs: 1500 });

    expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
  });

  it('starts and stops (disposing watchers) when enabled/disabled', async () => {
    const { AutoUpdateReportsManager } = await import('../realtimeWatcherService.js');

    const manager = new AutoUpdateReportsManager(
      { reportDirectory: 'devplan', snapshotFile: '.vscode/vibereport-state.json', excludePatterns: [] },
      () => [{ uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any],
      vi.fn().mockResolvedValue(undefined)
    );

    manager.applySettings({ enabled: true, debounceMs: 1500 });
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1);

    const firstWatcher = createFileSystemWatcherMock.mock.results[0]?.value as any;
    manager.applySettings({ enabled: false, debounceMs: 1500 });
    expect(firstWatcher.dispose).toHaveBeenCalled();
  });

  it('restarts when debounce changes while enabled', async () => {
    const { AutoUpdateReportsManager } = await import('../realtimeWatcherService.js');

    const manager = new AutoUpdateReportsManager(
      { reportDirectory: 'devplan', snapshotFile: '.vscode/vibereport-state.json', excludePatterns: [] },
      () => [{ uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any],
      vi.fn().mockResolvedValue(undefined)
    );

    manager.applySettings({ enabled: true, debounceMs: 1500 });
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1);

    const firstWatcher = createFileSystemWatcherMock.mock.results[0]?.value as any;
    manager.applySettings({ enabled: true, debounceMs: 3000 });

    expect(firstWatcher.dispose).toHaveBeenCalled();
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2);
  });

  it('debounces and single-flights auto updates (queues one rerun)', async () => {
    const { AutoUpdateReportsManager } = await import('../realtimeWatcherService.js');

    let resolveFirstRun: (() => void) | undefined;
    const runUpdate = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveFirstRun = resolve; }))
      .mockResolvedValueOnce(undefined);

    const manager = new AutoUpdateReportsManager(
      { reportDirectory: 'devplan', snapshotFile: '.vscode/vibereport-state.json', excludePatterns: [] },
      () => [{ uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any],
      runUpdate
    );

    manager.applySettings({ enabled: true, debounceMs: 1500 });

    const watcher = (manager as any).watcher;
    expect(watcher).toBeTruthy();

    watcher.recordChange('C:\\root\\src\\a.ts');
    vi.advanceTimersByTime(1499);
    await Promise.resolve();
    expect(runUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(runUpdate).toHaveBeenCalledTimes(1);

    // Changes while the update is running should queue exactly one follow-up run.
    watcher.recordChange('C:\\root\\src\\b.ts');
    vi.advanceTimersByTime(1500);
    await Promise.resolve();

    watcher.recordChange('C:\\root\\src\\c.ts');
    vi.advanceTimersByTime(1500);
    await Promise.resolve();

    expect(runUpdate).toHaveBeenCalledTimes(1);

    resolveFirstRun?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(runUpdate).toHaveBeenCalledTimes(2);
  });
});
