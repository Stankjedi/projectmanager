import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module (no UI dependencies)
vi.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  RelativePattern: class RelativePattern {
    constructor(public base: unknown, public pattern: string) {}
  },
}));

describe('RealtimeWatcherService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('filters out report directory and state file changes', async () => {
    const onPending = vi.fn();
    const { RealtimeWatcherService } = await import('../realtimeWatcherService.js');

    const service = new RealtimeWatcherService(
      {
        reportDirectory: 'devplan',
        snapshotFile: '.vscode/vibereport-state.json',
        debounceMs: 1500,
        excludePatterns: [],
      },
      onPending
    );

    service.start([
      { uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any,
    ]);

    service.recordChange('C:\\root\\devplan\\Project_Evaluation_Report.md');
    service.recordChange('C:\\root\\.vscode\\vibereport-state.json');

    vi.advanceTimersByTime(2000);

    expect(onPending).not.toHaveBeenCalled();
  });

  it('filters out report directory and state file changes under analysisRoot', async () => {
    const onPending = vi.fn();
    const { RealtimeWatcherService } = await import('../realtimeWatcherService.js');

    const service = new RealtimeWatcherService(
      {
        reportDirectory: 'devplan',
        analysisRoot: 'packages/app',
        snapshotFile: '.vscode/vibereport-state.json',
        debounceMs: 1500,
        excludePatterns: [],
      },
      onPending
    );

    service.start([
      { uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any,
    ]);

    service.recordChange('C:\\root\\packages\\app\\devplan\\Project_Evaluation_Report.md');
    service.recordChange('C:\\root\\packages\\app\\.vscode\\vibereport-state.json');

    vi.advanceTimersByTime(2000);

    expect(onPending).not.toHaveBeenCalled();
  });

  it('debounces and aggregates changes into a single pending state', async () => {
    const onPending = vi.fn();
    const { RealtimeWatcherService } = await import('../realtimeWatcherService.js');

    const service = new RealtimeWatcherService(
      {
        reportDirectory: 'devplan',
        snapshotFile: '.vscode/vibereport-state.json',
        debounceMs: 1500,
        excludePatterns: [],
      },
      onPending
    );

    service.start([
      { uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any,
    ]);

    service.recordChange('C:\\root\\src\\a.ts');
    vi.advanceTimersByTime(1000);
    service.recordChange('C:\\root\\src\\b.ts');

    vi.advanceTimersByTime(1499);
    expect(onPending).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledWith(
      expect.objectContaining({
        hasPendingChanges: true,
        changedPaths: expect.arrayContaining(['C:\\root\\src\\a.ts', 'C:\\root\\src\\b.ts']),
      })
    );

    onPending.mockClear();
    service.clearPendingChanges();
    expect(onPending).toHaveBeenCalledWith({ hasPendingChanges: false, changedPaths: [] });
  });

  it('ignores excluded paths (excludePatterns) and still tracks normal files', async () => {
    const onPending = vi.fn();
    const { RealtimeWatcherService } = await import('../realtimeWatcherService.js');

    const service = new RealtimeWatcherService(
      {
        reportDirectory: 'devplan',
        snapshotFile: '.vscode/vibereport-state.json',
        debounceMs: 1500,
        excludePatterns: ['**/node_modules/**'],
      },
      onPending
    );

    service.start([
      { uri: { fsPath: 'C:\\root' }, name: 'root', index: 0 } as any,
    ]);

    service.recordChange('C:\\root\\node_modules\\pkg\\index.js');
    service.recordChange('C:\\root\\src\\a.ts');

    vi.advanceTimersByTime(2000);

    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledWith(
      expect.objectContaining({
        hasPendingChanges: true,
        changedPaths: ['C:\\root\\src\\a.ts'],
      })
    );
  });
});
