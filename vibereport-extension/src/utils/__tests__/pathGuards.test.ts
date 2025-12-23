import { describe, it, expect } from 'vitest';
import { validateOpenCodeReferencePath } from '../pathGuards.js';

describe('validateOpenCodeReferencePath', () => {
  it('rejects empty input', () => {
    const result = validateOpenCodeReferencePath({
      filePath: '   ',
      workspaceFolders: ['/workspace'],
      analysisRoot: '',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('empty');
  });

  it('rejects non-absolute input', () => {
    const result = validateOpenCodeReferencePath({
      filePath: 'src/file.ts',
      workspaceFolders: ['/workspace'],
      analysisRoot: '',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('nonAbsolute');
  });

  it('rejects POSIX absolute paths outside workspace', () => {
    const result = validateOpenCodeReferencePath({
      filePath: '/etc/passwd',
      workspaceFolders: ['/workspace'],
      analysisRoot: '',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('outsideWorkspace');
  });

  it('enforces analysisRoot for POSIX paths', () => {
    const allowed = validateOpenCodeReferencePath({
      filePath: '/workspace/src/file.ts',
      workspaceFolders: ['/workspace'],
      analysisRoot: 'src',
    });
    expect(allowed.ok).toBe(true);

    const blocked = validateOpenCodeReferencePath({
      filePath: '/workspace/other/file.ts',
      workspaceFolders: ['/workspace'],
      analysisRoot: 'src',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? '' : blocked.reason).toBe('outsideAnalysisRoot');
  });

  it('rejects Windows absolute paths outside workspace', () => {
    const result = validateOpenCodeReferencePath({
      filePath: 'D:\\other\\file.ts',
      workspaceFolders: ['C:\\ws'],
      analysisRoot: '',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('outsideWorkspace');
  });

  it('enforces analysisRoot for Windows paths', () => {
    const allowed = validateOpenCodeReferencePath({
      filePath: 'C:\\ws\\src\\file.ts',
      workspaceFolders: ['C:\\ws'],
      analysisRoot: 'src',
    });
    expect(allowed.ok).toBe(true);

    const blocked = validateOpenCodeReferencePath({
      filePath: 'C:\\ws\\other\\file.ts',
      workspaceFolders: ['C:\\ws'],
      analysisRoot: 'src',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? '' : blocked.reason).toBe('outsideAnalysisRoot');
  });

  it('handles UNC paths safely (outside workspace)', () => {
    const result = validateOpenCodeReferencePath({
      filePath: '\\\\server\\share\\file.ts',
      workspaceFolders: ['C:\\ws'],
      analysisRoot: '',
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toBe('outsideWorkspace');
  });

  it('allows UNC paths when they are within the workspace root', () => {
    const allowed = validateOpenCodeReferencePath({
      filePath: '\\\\server\\share\\repo\\src\\file.ts',
      workspaceFolders: ['\\\\server\\share\\repo'],
      analysisRoot: '',
    });

    expect(allowed.ok).toBe(true);
  });

  it('falls back to workspace root when analysisRoot is invalid', () => {
    const allowed = validateOpenCodeReferencePath({
      filePath: 'C:\\ws\\file.ts',
      workspaceFolders: ['C:\\ws'],
      analysisRoot: '..\\outside',
    });

    expect(allowed.ok).toBe(true);
  });
});

