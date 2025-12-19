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

import { DEFAULT_CONFIG } from '../configUtils.js';

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
      ['vibereport.enableGitDiff', DEFAULT_CONFIG.enableGitDiff],
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
  });
});
