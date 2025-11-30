import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { WorkspaceScanner } from '../workspaceScanner.js';
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
  readFile: vi.fn().mockResolvedValue('{"name": "test-project", "version": "1.0.0"}'),
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
    snapshotFile: '.vscode/state.json',
    enableGitDiff: false,
    excludePatterns: ['**/node_modules/**'],
    maxFilesToScan: 5000,
    autoOpenReports: true,
    language: 'ko',
  };

  beforeEach(() => {
    scanner = new WorkspaceScanner(mockOutputChannel);
    vi.clearAllMocks();
  });

  describe('scan', () => {
    it('should return project snapshot with correct structure', async () => {
      const mockFiles = [
        { fsPath: '/mock/project/src/index.ts' },
        { fsPath: '/mock/project/package.json' },
      ];

      (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

      const result = await scanner.scan(mockConfig);

      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('filesCount');
      expect(result).toHaveProperty('dirsCount');
      expect(result).toHaveProperty('languageStats');
      expect(result).toHaveProperty('projectName');
    });

    it('should detect TypeScript files correctly', async () => {
      const mockFiles = [
        { fsPath: '/mock/project/src/app.ts' },
        { fsPath: '/mock/project/src/utils.ts' },
        { fsPath: '/mock/project/src/types.tsx' },
      ];

      (vscode.workspace.findFiles as any).mockResolvedValue(mockFiles);

      const result = await scanner.scan(mockConfig);

      expect(result.languageStats).toHaveProperty('ts');
      expect(result.languageStats).toHaveProperty('tsx');
    });

    it('should handle empty workspace', async () => {
      (vscode.workspace.findFiles as any).mockResolvedValue([]);

      const result = await scanner.scan(mockConfig);

      expect(result.filesCount).toBe(0);
      expect(result.languageStats).toEqual({});
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
