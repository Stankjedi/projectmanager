import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { SnapshotService } from '../snapshotService.js';
import type { ProjectSnapshot, VibeReportConfig, VibeReportState } from '../../models/types.js';

const gitMock = vi.hoisted(() => ({
  checkIsRepo: vi.fn(),
  status: vi.fn(),
  diffSummary: vi.fn(),
}));

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

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => gitMock),
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
	    snapshotStorageMode: 'workspaceFile',
	    enableGitDiff: false,
	    respectGitignore: true,
	    includeSensitiveFiles: false,
	    excludePatternsIncludeDefaults: true,
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
    gitMock.checkIsRepo.mockResolvedValue(false);
    gitMock.status.mockResolvedValue({ files: [] });
    gitMock.diffSummary.mockResolvedValue({ files: [] });
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

    it('stores state under vscode storage when snapshotStorageMode=vscodeStorage', async () => {
      service = new SnapshotService(mockOutputChannel, '/mock/vscode-storage');

      const state: VibeReportState = {
        lastSnapshot: null,
        sessions: [],
        appliedImprovements: [],
        lastUpdated: new Date().toISOString(),
        version: 1,
      };

      const config: VibeReportConfig = {
        ...mockConfig,
        snapshotStorageMode: 'vscodeStorage',
      };

      await service.saveState(mockRootPath, config, state);

      const writePath = vi.mocked(fs.writeFile).mock.calls[0]?.[0] as string;
      expect(writePath).toContain('/mock/vscode-storage');
      expect(writePath).toContain('/vibereport/');
      expect(writePath).toMatch(/vibereport-state\.json$/);
    });

    it('writes state even when mkdir fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('EACCES'));

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

    it('migrates state when version mismatches and fills missing appliedImprovements', async () => {
      const oldState = {
        lastSnapshot: null,
        sessions: [],
        lastUpdated: '2025-01-01T00:00:00Z',
        version: 0,
      };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(oldState));

      const result = await service.loadState(mockRootPath, mockConfig);

      expect(result?.version).toBe(1);
      expect(result?.appliedImprovements).toEqual([]);
    });

    it('returns null when the state file is invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('{ this is not json }');

      const result = await service.loadState(mockRootPath, mockConfig);

      expect(result).toBeNull();
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

    it('returns a no-change message when summary would be empty', () => {
      const diff = {
        previousSnapshotTime: '2025-01-01T00:00:00Z',
        currentSnapshotTime: '2025-01-02T00:00:00Z',
        isInitial: false,
        newFiles: [],
        removedFiles: [],
        changedConfigs: [],
        languageStatsDiff: {},
        totalChanges: 0,
      };

      const summary = SnapshotService.diffToSummary(diff);

      expect(summary).toBe('변경사항 없음');
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

    it('includes overflow marker when more than 10 files exist', () => {
      const diff = {
        previousSnapshotTime: '2025-01-01T00:00:00Z',
        currentSnapshotTime: '2025-01-02T00:00:00Z',
        isInitial: false,
        newFiles: Array.from({ length: 11 }, (_, i) => `src/file-${i + 1}.ts`),
        removedFiles: [],
        changedConfigs: [],
        languageStatsDiff: {},
        totalChanges: 11,
      };

      const summary = SnapshotService.diffToSummary(diff);

      expect(summary).toContain('... 외 1개');
    });

    it('includes git + language + line metrics sections when present', () => {
      const diff = {
        previousSnapshotTime: '2025-01-01T00:00:00Z',
        currentSnapshotTime: '2025-01-02T00:00:00Z',
        isInitial: false,
        newFiles: [],
        removedFiles: ['src/old.ts'],
        changedConfigs: ['package.json'],
        languageStatsDiff: { ts: 1, js: -2 },
        gitChanges: { modified: ['a'], added: ['b'], deleted: ['c'] },
        totalChanges: 4,
        linesAdded: 3,
        linesRemoved: 1,
        linesTotal: 4,
      };

      const summary = SnapshotService.diffToSummary(diff as any);

      expect(summary).toContain('삭제된 파일');
      expect(summary).toContain('변경된 설정 파일');
      expect(summary).toContain('언어별 파일 수 변화');
      expect(summary).toContain('Git 변경사항');
      expect(summary).toContain('라인 변경');
      expect(summary).toContain('js: -2');
      expect(summary).toContain('ts: +1');
    });
  });

  describe('isMajorVersionChange', () => {
    it('returns false when versions are missing or invalid', () => {
      expect(SnapshotService.isMajorVersionChange(undefined, '0.1.0')).toBe(false);
      expect(SnapshotService.isMajorVersionChange('0.1.0', undefined)).toBe(false);
      expect(SnapshotService.isMajorVersionChange('nope', '0.1.0')).toBe(false);
      expect(SnapshotService.isMajorVersionChange('0.1.0', 'nope')).toBe(false);
    });

    it('returns false for patch changes and true for minor/major changes', () => {
      expect(SnapshotService.isMajorVersionChange('0.3.26', '0.3.27')).toBe(false);
      expect(SnapshotService.isMajorVersionChange('0.3.27', '0.4.0')).toBe(true);
      expect(SnapshotService.isMajorVersionChange('0.3.27', '1.0.0')).toBe(true);
    });
  });

  describe('compareSnapshots git changes', () => {
    const baseSnapshot: ProjectSnapshot = {
      generatedAt: '2025-01-01T00:00:00Z',
      rootPath: mockRootPath,
      projectName: 'test-project',
      filesCount: 10,
      dirsCount: 3,
      languageStats: { ts: 5 },
      mainConfigFiles: { otherConfigs: [] },
      importantFiles: ['src/index.ts'],
      fileList: ['src/index.ts'],
      structureSummary: [],
    };

    it('does not include gitChanges when repository is not a git repo', async () => {
      const config: VibeReportConfig = { ...mockConfig, enableGitDiff: true };
      gitMock.checkIsRepo.mockResolvedValueOnce(false);

      const diff = await service.compareSnapshots(baseSnapshot, baseSnapshot, mockRootPath, config);

      expect(diff.gitChanges).toBeUndefined();
      expect(diff.linesTotal).toBeUndefined();
    });

    it('includes gitChanges + aggregate line metrics when available', async () => {
      const config: VibeReportConfig = { ...mockConfig, enableGitDiff: true };

      vi.mocked(vscode.workspace.findFiles).mockResolvedValueOnce([
        { fsPath: `${mockRootPath}/src/index.ts` },
        { fsPath: `${mockRootPath}/src/new.ts` },
      ] as any);

      gitMock.checkIsRepo.mockResolvedValueOnce(true);
      gitMock.status.mockResolvedValueOnce({
        files: [
          { path: 'a.ts', working_dir: 'M', index: 'M' },
          { path: 'b.ts', working_dir: ' ', index: 'A' },
          { path: 'c.ts', working_dir: ' ', index: 'D' },
          { path: 'd.ts', working_dir: ' ', index: 'R' },
          { path: 'e.ts', working_dir: '?', index: '?' },
          { path: 'f.ts', working_dir: 'D', index: ' ' },
          { path: 'g.ts', working_dir: 'X', index: 'M' },
        ],
      });
      gitMock.diffSummary.mockResolvedValueOnce({
        files: [
          { file: 'a.ts', insertions: 2, deletions: 1 },
          { file: 'b.ts', insertions: 1, deletions: 0 },
          { file: 'c.ts' },
        ],
      });

      const diff = await service.compareSnapshots(baseSnapshot, baseSnapshot, mockRootPath, config);

      expect(diff.gitChanges).toBeDefined();
      expect(diff.gitChanges?.modified).toEqual(expect.arrayContaining(['a.ts', 'd.ts']));
      expect(diff.gitChanges?.added).toEqual(expect.arrayContaining(['b.ts', 'e.ts']));
      expect(diff.gitChanges?.deleted).toEqual(expect.arrayContaining(['c.ts', 'f.ts']));

      expect(diff.linesAdded).toBe(3);
      expect(diff.linesRemoved).toBe(1);
      expect(diff.linesTotal).toBe(4);
    });
  });
});
