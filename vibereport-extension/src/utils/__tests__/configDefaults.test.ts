import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

const vscodeMock = vi.hoisted(() => {
  const get = vi.fn((_key: string, defaultValue: unknown) => defaultValue);
  const getConfiguration = vi.fn(() => ({ get }));
  return { get, getConfiguration };
});

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vscodeMock.getConfiguration,
    workspaceFolders: [],
  },
  window: {
    showErrorMessage: vi.fn(),
    showQuickPick: vi.fn(),
  },
}));

import { DEFAULT_CONFIG, loadConfig } from '../configUtils.js';
import { normalizeExcludePatterns } from '../excludePatternUtils.js';

type ExtensionPackageJson = {
  contributes?: {
    configuration?: {
      properties?: Record<string, { default?: unknown }>;
    };
  };
};

describe('config defaults', () => {
  it('keeps core defaults in sync with package.json', async () => {
    const raw = await fs.readFile(path.resolve(process.cwd(), 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as ExtensionPackageJson;

    const cases = [
      ['vibereport.reportDirectory', DEFAULT_CONFIG.reportDirectory],
      ['vibereport.analysisRoot', DEFAULT_CONFIG.analysisRoot],
      ['vibereport.snapshotFile', DEFAULT_CONFIG.snapshotFile],
      ['vibereport.snapshotStorageMode', DEFAULT_CONFIG.snapshotStorageMode],
      ['vibereport.enableGitDiff', DEFAULT_CONFIG.enableGitDiff],
      ['vibereport.respectGitignore', DEFAULT_CONFIG.respectGitignore],
      ['vibereport.includeSensitiveFiles', DEFAULT_CONFIG.includeSensitiveFiles],
      ['vibereport.excludePatternsIncludeDefaults', DEFAULT_CONFIG.excludePatternsIncludeDefaults],
      ['vibereport.maxFilesToScan', DEFAULT_CONFIG.maxFilesToScan],
      ['vibereport.autoOpenReports', DEFAULT_CONFIG.autoOpenReports],
      ['vibereport.enableDirectAi', DEFAULT_CONFIG.enableDirectAi],
      ['vibereport.language', DEFAULT_CONFIG.language],
      ['vibereport.projectVisionMode', DEFAULT_CONFIG.projectVisionMode],
      ['vibereport.defaultProjectType', DEFAULT_CONFIG.defaultProjectType],
      ['vibereport.defaultQualityFocus', DEFAULT_CONFIG.defaultQualityFocus],
    ] as const;

    const properties: Record<string, { default?: unknown }> =
      pkg.contributes?.configuration?.properties ?? {};
    for (const [key, expectedDefault] of cases) {
      expect(properties[key]?.default).toEqual(expectedDefault);
    }

    const excludeContributed = properties['vibereport.excludePatterns']?.default;
    expect(Array.isArray(excludeContributed)).toBe(true);
    expect(excludeContributed).toEqual(DEFAULT_CONFIG.excludePatterns);
    expect(excludeContributed).toContain('**/*.vsix');
    expect(excludeContributed).toContain('**/temp_compare/**');
  });

  it('normalizes excludePatterns deterministically', () => {
    const inputA = [' **/node_modules/** ', '', '**/dist/**', '**/node_modules/**', '**/.git/**'];
    const inputB = ['**/dist/**', '**/.git/**', '**/node_modules/**'];

    expect(normalizeExcludePatterns(inputA)).toEqual([
      '**/.git/**',
      '**/dist/**',
      '**/node_modules/**',
    ]);
    expect(normalizeExcludePatterns(inputA)).toEqual(normalizeExcludePatterns(inputB));
  });

  it('merges excludePatterns with defaults when includeDefaults enabled', () => {
    vscodeMock.get.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'excludePatternsIncludeDefaults') return true;
      if (key === 'excludePatterns') return [' **/*.vsix ', '**/custom/**', ''];
      return defaultValue;
    });

    const config = loadConfig();
    expect(config.excludePatternsIncludeDefaults).toBe(true);
    expect(config.excludePatterns).toEqual(expect.arrayContaining(DEFAULT_CONFIG.excludePatterns));
    expect(config.excludePatterns).toContain('**/custom/**');

    const vsixCount = config.excludePatterns.filter((pattern) => pattern === '**/*.vsix').length;
    expect(vsixCount).toBe(1);
  });

  it('uses user excludePatterns only when includeDefaults disabled', () => {
    vscodeMock.get.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'excludePatternsIncludeDefaults') return false;
      if (key === 'excludePatterns') return ['**/only/**', ' **/*.vsix ', ''];
      return defaultValue;
    });

    const config = loadConfig();
    expect(config.excludePatternsIncludeDefaults).toBe(false);
    expect(config.excludePatterns).toEqual(expect.arrayContaining(['**/only/**', '**/*.vsix']));
    expect(config.excludePatterns).not.toContain('**/node_modules/**');
  });
});
