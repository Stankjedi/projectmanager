import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { WorkspaceScanner } from '../workspaceScanner.js';
import { clearAllCache, getCacheStats } from '../snapshotCache.js';
import type { VibeReportConfig } from '../../models/types.js';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    findFiles: vi.fn(),
    workspaceFolders: [{ uri: { fsPath: '/mock/project' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
    },
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path, path })),
    joinPath: vi.fn((base: any, ...paths: string[]) => ({
      fsPath: `${base.fsPath}/${paths.join('/')}`,
    })),
  },
  FileType: {
    File: 1,
    Directory: 2,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (filePath: string) => {
    if (filePath.endsWith('package.json')) {
      return '{"name": "test-project", "version": "1.0.0"}';
    }

    if (filePath.endsWith('tsconfig.json')) {
      return `{
        // JSONC comment
        "compilerOptions": {
          "strict": true,
        },
      }`;
    }

    if (filePath.endsWith('tauri.conf.json')) {
      return `{
        /* JSONC comment */
        "productName": "tauri-app",
      }`;
    }

    if (filePath.endsWith('Cargo.toml')) {
      return '[package]\\nname = \"test\"\\nversion = \"0.1.0\"\\n';
    }

    throw new Error('Not found');
  }),
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error('Not found')),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    checkIsRepo: vi.fn().mockResolvedValue(false),
  })),
}));

describe('WorkspaceScanner', () => {
  let scanner: WorkspaceScanner;
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
    scanner = new WorkspaceScanner(mockOutputChannel);
    vi.clearAllMocks();
    clearAllCache(); // 캐시 초기화
  });

  describe('scan', () => {
    it('should return project snapshot with correct structure', async () => {
      const mockFiles = [
        { fsPath: '/mock/project/src/index.ts' },
        { fsPath: '/mock/project/package.json' },
      ];

      (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

      const result = await scanner.scan('/mock/project', mockConfig);

      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('filesCount');
      expect(result).toHaveProperty('dirsCount');
      expect(result).toHaveProperty('languageStats');
      expect(result).toHaveProperty('projectName');
    });

    it('should parse JSONC tsconfig and extract strict=true', async () => {
      const mockFiles = [
        { fsPath: '/mock/project/src/index.ts' },
        { fsPath: '/mock/project/package.json' },
        { fsPath: '/mock/project/tsconfig.json' },
      ];

      (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

      const result = await scanner.scan('/mock/project', mockConfig);

      expect(result.mainConfigFiles.tsconfig?.strict).toBe(true);
    });

    it('should detect TypeScript files correctly', async () => {
      const mockFiles = [
        { fsPath: '/mock/project/src/app.ts' },
        { fsPath: '/mock/project/src/utils.ts' },
        { fsPath: '/mock/project/src/types.tsx' },
      ];

      (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

      const result = await scanner.scan('/mock/project', mockConfig);

      expect(result.languageStats).toHaveProperty('ts');
      expect(result.languageStats).toHaveProperty('tsx');
    });

    it('should handle empty workspace', async () => {
      (vscode.workspace.findFiles as any).mockResolvedValue([]);

      const result = await scanner.scan('/mock/project', mockConfig);

      expect(result.filesCount).toBe(0);
      expect(result.languageStats).toEqual({});
    });

    it('includes normalized excludePatterns in the file-list cache key', async () => {
      const mockFilesFirst = [{ fsPath: '/mock/project/src/a.ts' }];
      const mockFilesSecond = [{ fsPath: '/mock/project/src/b.ts' }];

      (vscode.workspace.findFiles as any)
        .mockResolvedValueOnce(mockFilesFirst)
        .mockResolvedValueOnce(mockFilesSecond);

      const configA: VibeReportConfig = {
        ...mockConfig,
        excludePatterns: [' **/node_modules/** ', '**/dist/**', ''],
      };

      const configASameNormalized: VibeReportConfig = {
        ...mockConfig,
        excludePatterns: ['**/node_modules/**', ' **/dist/** '],
      };

      const configB: VibeReportConfig = {
        ...mockConfig,
        excludePatterns: ['**/node_modules/**'],
      };

      await scanner.scan('/mock/project', configA);

      const keysAfterFirst = getCacheStats().keys.filter((k) => k.startsWith('file-list:'));
      expect(keysAfterFirst).toHaveLength(1);
      expect(vscode.workspace.findFiles).toHaveBeenCalledTimes(1);

      // Same normalized patterns should reuse cache and avoid a second listing within TTL
      await scanner.scan('/mock/project', configASameNormalized);
      expect(vscode.workspace.findFiles).toHaveBeenCalledTimes(1);

      // Different excludePatterns should produce a new cache key and force a new listing within TTL
      await scanner.scan('/mock/project', configB);
      expect(vscode.workspace.findFiles).toHaveBeenCalledTimes(2);

      const keysAfterSecond = getCacheStats().keys.filter((k) => k.startsWith('file-list:'));
      expect(keysAfterSecond).toHaveLength(2);
    });
  });

  describe('snapshotToSummary', () => {
    it('should convert snapshot to summary string', () => {
      const mockSnapshot = {
        generatedAt: new Date().toISOString(),
        rootPath: '/mock/project',
        projectName: 'test-project',
        filesCount: 10,
        dirsCount: 3,
        languageStats: { ts: 5, js: 3 },
        mainConfigFiles: {
          packageJson: {
            name: 'test-project',
            version: '1.0.0',
            scripts: ['test'],
            dependencies: [],
            devDependencies: [],
            hasTypeScript: true,
            hasTest: true,
            hasLint: false,
          },
          otherConfigs: [],
        },
        importantFiles: ['src/index.ts'],
        structureSummary: [],
      };

      const summary = WorkspaceScanner.snapshotToSummary(mockSnapshot);

      expect(summary).toContain('test-project');
      expect(summary).toContain('10');
      expect(summary).toContain('TypeScript');
    });
  });
});
