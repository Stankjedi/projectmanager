import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';

const vscodeMock = vi.hoisted(() => {
  const get = vi.fn((_key: string, defaultValue: unknown) => defaultValue);
  const getConfiguration = vi.fn(() => ({ get }));
  return { getConfiguration };
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

import { resolveAnalysisRoot } from '../configUtils.js';

describe('resolveAnalysisRoot', () => {
  it('returns workspaceRoot when analysisRoot is empty', () => {
    const workspaceRoot = path.resolve('test-workspace');
    expect(resolveAnalysisRoot(workspaceRoot, '')).toBe(workspaceRoot);
    expect(resolveAnalysisRoot(workspaceRoot, '   ')).toBe(workspaceRoot);
  });

  it('resolves subpaths under workspaceRoot', () => {
    const workspaceRoot = path.resolve('test-workspace');
    const expected = path.join(workspaceRoot, 'packages', 'app');
    expect(resolveAnalysisRoot(workspaceRoot, 'packages/app')).toBe(expected);
  });

  it('rejects path traversal outside workspaceRoot', () => {
    const workspaceRoot = path.resolve('test-workspace');
    expect(() => resolveAnalysisRoot(workspaceRoot, '../outside')).toThrow();
  });
});
