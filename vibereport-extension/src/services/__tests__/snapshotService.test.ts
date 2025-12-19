import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { SnapshotService } from '../snapshotService.js';
import type { ProjectSnapshot, VibeReportConfig, VibeReportState } from '../../models/types.js';

vi.mock('vscode', () => ({
  workspace: {
    findFiles: vi.fn().mockResolvedValue([]),
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
    joinPath: vi.fn((base: any, ...paths: string[]) => ({
      fsPath: `${base.fsPath}/${paths.join('/')}`,
    })),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import * as fs from 'fs/promises';

describe('SnapshotService', () => {
  let service: SnapshotService;
  const mockRootPath = '/mock/project';
  const mockOutputChannel = {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    name: 'test',
    replace: vi.fn(),
  } as unknown as vscode.OutputChannel;

  const mockConfig: VibeReportConfig = {
    reportDirectory: 'devplan',
    analysisRoot: '',
    snapshotFile: '.vscode/state.json',
    enableGitDiff: false,
    excludePatterns: ['**/node_modules/**'],
    maxFilesToScan: 5000,
    autoOpenReports: true,
    enableDirectAi: false,
    language: 'ko',
    projectVisionMode: 'auto',
    defaultProjectType: 'auto-detect',
    defaultQualityFocus: 'development',
  };

  beforeEach(() => {
    service = new SnapshotService(mockOutputChannel);
    vi.clearAllMocks();
  });

  describe('createInitialState', () => {
    it('should create initial state with correct structure', () => {
      const state = service.createInitialState();

      expect(state).toHaveProperty('lastSnapshot', null);
      expect(state).toHaveProperty('sessions');
      expect(state.sessions).toEqual([]);
      expect(state).toHaveProperty('appliedImprovements');
      expect(state.appliedImprovements).toEqual([]);
      expect(state).toHaveProperty('version');
    });
  });

  describe('compareSnapshots', () => {
    const baseSnapshot: ProjectSnapshot = {
      generatedAt: '2025-01-01T00:00:00Z',
      rootPath: '/mock/project',
      projectName: 'test-project',
      filesCount: 10,
      dirsCount: 3,
      languageStats: { ts: 5 },
      mainConfigFiles: { otherConfigs: [] },
      importantFiles: ['src/index.ts'],
      fileList: ['src/index.ts', 'src/app.ts'],
      structureSummary: [],
    };

    it('should handle initial snapshot (no previous)', async () => {
      const diff = await service.compareSnapshots(null, baseSnapshot, mockRootPath, mockConfig);

      expect(diff.isInitial).toBe(true);
      expect(diff.filesCountDiff).toBe(baseSnapshot.filesCount);
    });

    it('should detect config changes', async () => {
      const newSnapshot: ProjectSnapshot = {
        ...baseSnapshot,
        generatedAt: '2025-01-02T00:00:00Z',
        mainConfigFiles: {
          packageJson: {
            name: 'updated',
            version: '2.0.0',
            scripts: [],
            dependencies: [],
            devDependencies: [],
            hasTypeScript: true,
            hasTest: false,
            hasLint: false,
          },
          otherConfigs: [],
        },
      };

      const diff = await service.compareSnapshots(baseSnapshot, newSnapshot, mockRootPath, mockConfig);

      expect(diff.isInitial).toBe(false);
      expect(diff.changedConfigs).toContain('package.json');
    });
  });

  describe('saveState', () => {
    it('should write state to file', async () => {
      const state: VibeReportState = {
        lastSnapshot: null,
        sessions: [],
        appliedImprovements: [],
        lastUpdated: new Date().toISOString(),
        version: 1,
      };

      await service.saveState(mockRootPath, mockConfig, state);

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('loadState', () => {
    it('should return null if file does not exist', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const result = await service.loadState(mockRootPath, mockConfig);

      expect(result).toBeNull();
    });

    it('should parse and return state from file', async () => {
      const mockState: VibeReportState = {
        lastSnapshot: null,
        sessions: [],
        appliedImprovements: [],
        lastUpdated: '2025-01-01T00:00:00Z',
        version: 1,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(mockState));

      const result = await service.loadState(mockRootPath, mockConfig);

      expect(result).toEqual(mockState);
    });
  });

  describe('addSession', () => {
    it('should add session to state', () => {
      const state = service.createInitialState();
      const session = {
        id: 'test-session',
        timestamp: new Date().toISOString(),
        userPrompt: 'Test prompt',
        changesSummary: 'Test changes',
        diffSummary: {
          newFilesCount: 1,
          removedFilesCount: 0,
          changedConfigsCount: 0,
          totalChanges: 1,
        },
      };

      const newState = service.addSession(state, session);

      expect(newState.sessions).toHaveLength(1);
      expect(newState.sessions[0].id).toBe('test-session');
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = SnapshotService.generateSessionId();
      const id2 = SnapshotService.generateSessionId();

      expect(id1).toMatch(/^session_/);
      expect(id2).toMatch(/^session_/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('diffToSummary', () => {
    it('should return message for initial diff', () => {
      const diff = {
        previousSnapshotTime: null,
        currentSnapshotTime: new Date().toISOString(),
        isInitial: true,
        newFiles: [],
        removedFiles: [],
        changedConfigs: [],
        languageStatsDiff: {},
        totalChanges: 0,
      };

      const summary = SnapshotService.diffToSummary(diff);

      expect(summary).toContain('초기');
    });

    it('should include new files in summary', () => {
      const diff = {
        previousSnapshotTime: '2025-01-01T00:00:00Z',
        currentSnapshotTime: '2025-01-02T00:00:00Z',
        isInitial: false,
        newFiles: ['src/new.ts', 'src/another.ts'],
        removedFiles: [],
        changedConfigs: [],
        languageStatsDiff: {},
        totalChanges: 2,
      };

      const summary = SnapshotService.diffToSummary(diff);

      expect(summary).toContain('새 파일');
      expect(summary).toContain('2개');
    });
  });
});
