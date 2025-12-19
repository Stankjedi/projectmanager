import * as vscode from 'vscode';
import * as path from 'path';
import {
  decideRealtimeWatcherAction,
  type RealtimeWatcherSettings,
} from '../utils/realtimeWatcherDecision.js';

export interface RealtimeWatcherOptions {
  reportDirectory: string;
  snapshotFile: string;
  debounceMs: number;
  excludePatterns: string[];
}

export interface PendingChangesState {
  hasPendingChanges: boolean;
  changedPaths: string[];
}

export interface AutoUpdateStatus {
  enabled: boolean;
  isRunning: boolean;
  hasPendingChanges: boolean;
  pendingPathsCount: number;
  lastRunAt: string | null;
  lastRunResult: 'success' | 'failed' | null;
}

function normalizeFsPath(p: string): string {
  const withSlashes = p.replace(/\\/g, '/');
  const normalized = path.posix.normalize(withSlashes);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

const globRegexCache = new Map<string, RegExp>();

function escapeRegexChar(ch: string): string {
  return /[\\^$+?.()|{}[\]]/.test(ch) ? `\\${ch}` : ch;
}

function compileGlob(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/').trim();
  const cached = globRegexCache.get(normalized);
  if (cached) return cached;

  let regex = '^';
  for (let i = 0; i < normalized.length; ) {
    if (normalized.startsWith('**/', i)) {
      regex += '(?:.*/)?';
      i += 3;
      continue;
    }

    if (normalized.startsWith('**', i)) {
      regex += '.*';
      i += 2;
      continue;
    }

    const ch = normalized[i];
    if (ch === '*') {
      regex += '[^/]*';
      i += 1;
      continue;
    }

    regex += escapeRegexChar(ch);
    i += 1;
  }

  regex += '$';
  const compiled = new RegExp(regex);
  globRegexCache.set(normalized, compiled);
  return compiled;
}

export class RealtimeWatcherService implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private changedPaths = new Set<string>();
  private debounceTimer: NodeJS.Timeout | undefined;
  private ignoredReportDirs = new Set<string>();
  private ignoredStateFiles = new Set<string>();
  private workspaceRoots: string[] = [];
  private workspaceRootsNormalized: string[] = [];
  private excludeMatchers: RegExp[] = [];

  constructor(
    private options: RealtimeWatcherOptions,
    private onPendingChanges: (state: PendingChangesState) => void
  ) {
    this.excludeMatchers = (options.excludePatterns ?? [])
      .filter(pattern => pattern.trim().length > 0)
      .map(pattern => compileGlob(pattern));
  }

  start(workspaceFolders: readonly vscode.WorkspaceFolder[]): void {
    this.stop();

    // Build ignore lists per workspace folder
    this.ignoredReportDirs.clear();
    this.ignoredStateFiles.clear();
    this.workspaceRoots = [];
    this.workspaceRootsNormalized = [];

    for (const folder of workspaceFolders) {
      const root = folder.uri.fsPath;
      this.workspaceRoots.push(root);
      this.workspaceRootsNormalized.push(normalizeFsPath(root));
      this.ignoredReportDirs.add(
        normalizeFsPath(path.join(root, this.options.reportDirectory))
      );
      this.ignoredStateFiles.add(
        normalizeFsPath(path.join(root, this.options.snapshotFile))
      );

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '**/*')
      );

      watcher.onDidChange(uri => this.recordChange(uri.fsPath));
      watcher.onDidCreate(uri => this.recordChange(uri.fsPath));
      watcher.onDidDelete(uri => this.recordChange(uri.fsPath));

      this.watchers.push(watcher);
    }
  }

  stop(): void {
    this.clearDebounceTimer();
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    this.workspaceRoots = [];
    this.workspaceRootsNormalized = [];
  }

  dispose(): void {
    this.stop();
    this.changedPaths.clear();
  }

  clearPendingChanges(): void {
    this.changedPaths.clear();
    this.onPendingChanges({ hasPendingChanges: false, changedPaths: [] });
  }

  shouldTrackChange(fsPath: string): boolean {
    const normalized = normalizeFsPath(fsPath);

    if (this.ignoredStateFiles.has(normalized)) {
      return false;
    }

    for (const reportDir of this.ignoredReportDirs) {
      if (normalized === reportDir) {
        return false;
      }
      if (normalized.startsWith(reportDir + '/')) {
        return false;
      }
    }

    if (this.excludeMatchers.length > 0) {
      const relative = this.getRelativePosixPath(fsPath, normalized);
      if (relative) {
        const candidates = relative.endsWith('/') ? [relative] : [relative, `${relative}/`];
        for (const candidate of candidates) {
          for (const matcher of this.excludeMatchers) {
            if (matcher.test(candidate)) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  private getRelativePosixPath(
    fsPath: string,
    normalizedFsPath: string
  ): string | null {
    let bestIndex = -1;
    let bestLength = -1;
    let bestRootNormalized = '';

    for (let i = 0; i < this.workspaceRootsNormalized.length; i++) {
      const rootNormalized = this.workspaceRootsNormalized[i];
      if (
        normalizedFsPath === rootNormalized ||
        normalizedFsPath.startsWith(rootNormalized + path.sep)
      ) {
        if (rootNormalized.length > bestLength) {
          bestIndex = i;
          bestLength = rootNormalized.length;
          bestRootNormalized = rootNormalized;
        }
      }
    }

    if (bestIndex === -1) {
      return null;
    }

    const relative = path.posix.relative(bestRootNormalized, normalizedFsPath);
    if (!relative || relative.startsWith('..')) {
      return null;
    }

    return relative;
  }

  recordChange(fsPath: string): void {
    if (!this.shouldTrackChange(fsPath)) {
      return;
    }

    this.changedPaths.add(fsPath);
    this.scheduleEmit();
  }

  private scheduleEmit(): void {
    this.clearDebounceTimer();

    this.debounceTimer = setTimeout(() => {
      const changedPaths = Array.from(this.changedPaths);
      this.onPendingChanges({
        hasPendingChanges: changedPaths.length > 0,
        changedPaths,
      });
    }, this.options.debounceMs);
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }
}

export interface AutoUpdateReportsManagerOptions {
  reportDirectory: string;
  snapshotFile: string;
  excludePatterns: string[];
}

/**
 * Auto-update reports when source files change (opt-in).
 *
 * @description Wraps RealtimeWatcherService + a single-flight runner so update
 * runs do not overlap. If changes happen during a run, schedules one follow-up
 * run after completion.
 */
export class AutoUpdateReportsManager implements vscode.Disposable {
  private watcher: RealtimeWatcherService | undefined;
  private settings: RealtimeWatcherSettings = { enabled: false, debounceMs: 1500 };
  private isRunning = false;
  private rerunQueued = false;
  private status: AutoUpdateStatus = {
    enabled: false,
    isRunning: false,
    hasPendingChanges: false,
    pendingPathsCount: 0,
    lastRunAt: null,
    lastRunResult: null,
  };
  private statusEmitter = new vscode.EventEmitter<AutoUpdateStatus>();
  public readonly onDidChangeStatus = this.statusEmitter.event;

  constructor(
    private options: AutoUpdateReportsManagerOptions,
    private getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined,
    private runUpdate: () => Promise<void>
  ) {}

  getStatus(): AutoUpdateStatus {
    return { ...this.status };
  }

  applySettings(next: RealtimeWatcherSettings): void {
    const action = decideRealtimeWatcherAction(this.settings, next);
    this.settings = next;

    this.updateStatus({
      enabled: next.enabled,
      ...(next.enabled ? {} : { hasPendingChanges: false, pendingPathsCount: 0 }),
    });

    switch (action) {
      case 'start':
        this.start();
        break;
      case 'stop':
        this.stop();
        break;
      case 'restart':
        this.stop();
        this.start();
        break;
      case 'noop':
        break;
    }
  }

  private start(): void {
    this.stop();

    const workspaceFolders = this.getWorkspaceFolders() ?? [];
    if (!this.settings.enabled || workspaceFolders.length === 0) {
      return;
    }

    this.watcher = new RealtimeWatcherService(
      {
        reportDirectory: this.options.reportDirectory,
        snapshotFile: this.options.snapshotFile,
        debounceMs: this.settings.debounceMs,
        excludePatterns: this.options.excludePatterns,
      },
      state => this.onPendingChanges(state)
    );

    this.watcher.start(workspaceFolders);
  }

  private stop(): void {
    this.watcher?.dispose();
    this.watcher = undefined;
    this.rerunQueued = false;
    this.updateStatus({ hasPendingChanges: false, pendingPathsCount: 0 });
  }

  dispose(): void {
    this.stop();
    this.statusEmitter.dispose();
  }

  private onPendingChanges(state: PendingChangesState): void {
    if (!state.hasPendingChanges) {
      return;
    }

    this.updateStatus({
      hasPendingChanges: true,
      pendingPathsCount: state.changedPaths.length,
    });

    // Clear now so changes during the run are tracked independently.
    this.watcher?.clearPendingChanges();
    this.triggerUpdate();
  }

  private triggerUpdate(): void {
    if (this.isRunning) {
      this.rerunQueued = true;
      return;
    }

    void this.runUpdateLoop();
  }

  private async runUpdateLoop(): Promise<void> {
    this.isRunning = true;
    this.updateStatus({
      isRunning: true,
      hasPendingChanges: false,
      pendingPathsCount: 0,
    });

    let lastRunResult: AutoUpdateStatus['lastRunResult'] = 'success';
    try {
      await this.runUpdate();
    } catch (error) {
      lastRunResult = 'failed';
      throw error;
    } finally {
      this.isRunning = false;
      this.updateStatus({
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        lastRunResult,
      });
    }

    if (this.rerunQueued) {
      this.rerunQueued = false;
      this.triggerUpdate();
    }
  }

  private updateStatus(patch: Partial<AutoUpdateStatus>): void {
    const nextStatus: AutoUpdateStatus = { ...this.status, ...patch };
    const changed = (Object.keys(nextStatus) as (keyof AutoUpdateStatus)[]).some(
      key => nextStatus[key] !== this.status[key]
    );

    if (!changed) {
      return;
    }

    this.status = nextStatus;
    this.statusEmitter.fire(this.status);
  }
}
