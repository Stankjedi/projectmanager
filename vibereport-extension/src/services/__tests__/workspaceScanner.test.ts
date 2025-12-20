import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
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

    if (filePath.endsWith('todo.ts')) {
      return [
        'const value = 1; // TODO: add validation',
        '// FIXME: handle edge cases',
      ].join('\n');
    }

    throw new Error('Not found');
  }),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
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

    it('collects TODO/FIXME findings from scanned files', async () => {
      const mockFiles = [
        { fsPath: '/mock/project/src/todo.ts' },
        { fsPath: '/mock/project/package.json' },
      ];

      (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

      const result = await scanner.scan('/mock/project', mockConfig);

      expect(result.todoFixmeFindings).toBeDefined();
      expect(result.todoFixmeFindings?.length).toBeGreaterThan(0);
      expect(result.todoFixmeFindings?.[0]).toMatchObject({
        file: 'src/todo.ts',
      });
      expect(result.todoFixmeFindings?.some((f) => f.tag === 'TODO')).toBe(true);
      expect(result.todoFixmeFindings?.some((f) => f.tag === 'FIXME')).toBe(true);
    });
  });

  describe('config parsing helpers', () => {
    it('parses package.json with scripts and dependencies', () => {
      const summary = (scanner as any).parsePackageJson({
        name: 'demo',
        version: ' 1.2.3 ',
        scripts: { test: 'vitest', lint: 'eslint' },
        dependencies: { typescript: '^5.0.0' },
        devDependencies: { vitest: '^4.0.0' },
      });

      expect(summary.name).toBe('demo');
      expect(summary.version).toBe('1.2.3');
      expect(summary.hasTypeScript).toBe(true);
      expect(summary.hasTest).toBe(true);
      expect(summary.hasLint).toBe(true);
    });

    it('returns undefined version when missing or blank', () => {
      const summary = (scanner as any).parsePackageJson({
        name: 'demo',
        version: '   ',
      });

      expect(summary.version).toBeUndefined();
    });

    it('parses JSONC content and rejects invalid objects', async () => {
      const parsed = await (scanner as any).parseJsoncObject('{"a": 1,}');
      expect(parsed).toEqual({ a: 1 });

      const invalid = await (scanner as any).parseJsoncObject('{ invalid json }');
      expect(invalid).toBeNull();

      const array = await (scanner as any).parseJsoncObject('[1, 2, 3]');
      expect(array).toBeNull();
    });

    it('parses Cargo.toml dependencies', () => {
      const result = (scanner as any).parseCargoToml(`
[package]
name = "demo"
version = "0.2.0"

[dependencies]
serde = "1"
tokio = "1"

[dev-dependencies]
rstest = "0.18"
      `);

      expect(result.name).toBe('demo');
      expect(result.version).toBe('0.2.0');
      expect(result.dependencies).toEqual(['serde', 'tokio']);
    });

    it('identifies important files by pattern', () => {
      const files = [
        'src/index.ts',
        'src/app.tsx',
        'server.ts',
        'README.md',
      ];

      const important = (scanner as any).identifyImportantFiles(files, '/mock/project');
      expect(important).toEqual(
        expect.arrayContaining(['src/index.ts', 'src/app.tsx', 'server.ts'])
      );
      expect(important).not.toContain('README.md');
    });
  });

  describe('structure and git helpers', () => {
    it('builds a structure summary and skips excluded entries', async () => {
      const readdirMock = vi.mocked(fs.readdir);
      readdirMock.mockImplementation(async (dirPath: any) => {
        if (String(dirPath).endsWith('/mock/project')) {
          return [
            {
              name: 'src',
              isDirectory: () => true,
              isFile: () => false,
            },
            {
              name: '.git',
              isDirectory: () => true,
              isFile: () => false,
            },
            {
              name: 'README.md',
              isDirectory: () => false,
              isFile: () => true,
            },
          ] as any;
        }

        if (String(dirPath).endsWith('/mock/project/src')) {
          return [
            {
              name: 'index.ts',
              isDirectory: () => false,
              isFile: () => true,
            },
            {
              name: 'node_modules',
              isDirectory: () => true,
              isFile: () => false,
            },
          ] as any;
        }

        return [];
      });

      const summary = await (scanner as any).buildStructureSummary(
        '/mock/project',
        mockConfig,
        1
      );

      const names = summary.map((node: any) => node.name);
      expect(names).toEqual(expect.arrayContaining(['src', 'README.md']));
      expect(names).not.toContain('.git');

      const srcNode = summary.find((node: any) => node.name === 'src');
      expect(srcNode?.children?.[0]?.name).toBe('index.ts');
    });

    it('returns empty structure summary when directory read fails', async () => {
      const readdirMock = vi.mocked(fs.readdir);
      readdirMock.mockRejectedValueOnce(new Error('fail'));

      const summary = await (scanner as any).buildStructureSummary(
        '/mock/project',
        mockConfig,
        1
      );

      expect(summary).toEqual([]);
    });

    it('returns git info when repository is detected', async () => {
      const simpleGitModule = await import('simple-git');
      const simpleGitMock = simpleGitModule.simpleGit as unknown as ReturnType<typeof vi.fn>;

      simpleGitMock.mockImplementationOnce(() => ({
        checkIsRepo: vi.fn().mockResolvedValue(true),
        branch: vi.fn().mockResolvedValue({ current: 'main' }),
        status: vi.fn().mockResolvedValue({
          isClean: () => false,
          files: [{ path: 'a' }, { path: 'b' }],
        }),
        log: vi.fn().mockResolvedValue({
          latest: {
            hash: 'abc123',
            message: 'Commit message\nDetails',
            date: '2025-01-01',
          },
        }),
      }));

      const info = await (scanner as any).getGitInfo('/mock/project');

      expect(info?.branch).toBe('main');
      expect(info?.lastCommitHash).toBe('abc123');
      expect(info?.lastCommitMessage).toBe('Commit message');
      expect(info?.hasUncommittedChanges).toBe(true);
      expect(info?.uncommittedFilesCount).toBe(2);
    });

    it('returns undefined when git repository is not detected', async () => {
      const info = await (scanner as any).getGitInfo('/mock/project');
      expect(info).toBeUndefined();
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
