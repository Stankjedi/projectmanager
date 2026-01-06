import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  resolveWorkspaceSubpathPortable,
  validateWorkspaceRelativeSubpathInput,
} from '../workspaceSubpathUtils.js';

describe('validateWorkspaceRelativeSubpathInput', () => {
  it('accepts normal workspace-relative subpaths', () => {
    expect(validateWorkspaceRelativeSubpathInput('devplan').ok).toBe(true);
    expect(validateWorkspaceRelativeSubpathInput('.vscode/vibereport-state.json').ok).toBe(true);
  });

  it('rejects parent traversal segments', () => {
    expect(validateWorkspaceRelativeSubpathInput('../outside').ok).toBe(false);
    expect(validateWorkspaceRelativeSubpathInput('..\\outside').ok).toBe(false);
    expect(validateWorkspaceRelativeSubpathInput('devplan/../x').ok).toBe(false);
  });

  it('rejects absolute paths (POSIX and Windows)', () => {
    expect(validateWorkspaceRelativeSubpathInput('/abs/path').ok).toBe(false);
    expect(validateWorkspaceRelativeSubpathInput('C:\\\\abs\\\\path').ok).toBe(false);
    expect(validateWorkspaceRelativeSubpathInput('\\\\\\\\server\\\\share\\\\file').ok).toBe(false);
  });
});

describe('resolveWorkspaceSubpathPortable', () => {
  it('resolves POSIX subpaths under workspaceRoot', () => {
    const result = resolveWorkspaceSubpathPortable('/ws', 'devplan', path.posix);
    expect(result.ok).toBe(true);
    expect(result.ok ? result.resolved : '').toBe('/ws/devplan');
  });

  it('rejects Windows absolute paths even when using POSIX resolver', () => {
    const result = resolveWorkspaceSubpathPortable('/ws', 'C:\\\\abs\\\\path', path.posix);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('absolute');
  });

  it('resolves Windows subpaths under workspaceRoot', () => {
    const result = resolveWorkspaceSubpathPortable('C:\\ws', 'devplan', path.win32);
    expect(result.ok).toBe(true);
    expect(result.ok ? result.resolved : '').toBe('C:\\ws\\devplan');
  });
});
