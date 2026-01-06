import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { clearAllCache } from '../snapshotCache.js';
import { scanTodoFixmeFindings } from '../workspaceScanner/todoFixmeScanner.js';

vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

describe('scanTodoFixmeFindings (incremental cache)', () => {
  const rootPath = '/root';

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCache();
  });

  it('reuses cached findings when files are unchanged', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 10, mtimeMs: 1 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('const a = 1; // TODO: first' as any);

    const files = ['src/todo.ts'];

    const first = await scanTodoFixmeFindings(rootPath, files);
    expect(first).toHaveLength(1);
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledTimes(1);

    const second = await scanTodoFixmeFindings(rootPath, files);
    expect(second).toEqual(first);
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledTimes(1);
  });

  it('only rescans changed files and keeps unchanged results', async () => {
    const files = ['src/a.ts', 'src/b.ts'];

    vi.mocked(fs.stat).mockImplementation(async (filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('src/a.ts')) return { size: 10, mtimeMs: 1 } as any;
      if (p.endsWith('src/b.ts')) return { size: 10, mtimeMs: 1 } as any;
      return { size: 10, mtimeMs: 1 } as any;
    });

    vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('src/a.ts')) return 'const a = 1; // TODO: a' as any;
      if (p.endsWith('src/b.ts')) return 'const b = 1; // TODO: b' as any;
      throw new Error(`unexpected readFile path: ${p}`);
    });

    const first = await scanTodoFixmeFindings(rootPath, files);
    expect(first.map(f => f.file)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledTimes(2);

    vi.mocked(fs.readFile).mockClear();

    vi.mocked(fs.stat).mockImplementation(async (filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('src/a.ts')) return { size: 10, mtimeMs: 1 } as any;
      if (p.endsWith('src/b.ts')) return { size: 10, mtimeMs: 2 } as any; // changed
      return { size: 10, mtimeMs: 1 } as any;
    });

    vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('src/b.ts')) return 'const b = 1; // FIXME: changed' as any;
      throw new Error(`unexpected read for unchanged file: ${p}`);
    });

    const second = await scanTodoFixmeFindings(rootPath, files);

    expect(vi.mocked(fs.readFile)).toHaveBeenCalledTimes(1);

    const aFinding = second.find(f => f.file === 'src/a.ts');
    const bFinding = second.find(f => f.file === 'src/b.ts');
    expect(aFinding?.tag).toBe('TODO');
    expect(bFinding?.tag).toBe('FIXME');
  });

  it('preserves deterministic output ordering even when reads resolve out of order', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 10, mtimeMs: 1 } as any);

    let resolveA: ((value: string) => void) | undefined;
    let resolveB: ((value: string) => void) | undefined;

    const aPromise = new Promise<string>((resolve) => {
      resolveA = resolve;
    });
    const bPromise = new Promise<string>((resolve) => {
      resolveB = resolve;
    });

    vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('src/a.ts')) return aPromise as any;
      if (p.endsWith('src/b.ts')) return bPromise as any;
      throw new Error(`unexpected readFile path: ${p}`);
    });

    const scanPromise = scanTodoFixmeFindings(rootPath, ['src/a.ts', 'src/b.ts']);

    resolveB?.('const b = 1; // TODO: b');
    resolveA?.('const a = 1; // TODO: a');

    const findings = await scanPromise;
    expect(findings.map(f => f.file)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('redacts secret-like patterns in findings text', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 200, mtimeMs: 1 } as any);

    const ghToken = 'ghp_0123456789abcdefghijklmnopqrstuvwxyzABCD';
    const openAiToken = 'sk-0123456789ABCDEFGHIJKLMNopqrstuv';

    vi.mocked(fs.readFile).mockResolvedValue(
      `// TODO: rotate token ${ghToken} and ${openAiToken}` as any
    );

    const files = ['src/todo.ts'];
    const findings = await scanTodoFixmeFindings(rootPath, files);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.text).toContain('ghp_[REDACTED_SECRET]');
    expect(findings[0]?.text).toContain('sk-[REDACTED_SECRET]');
    expect(findings[0]?.text).not.toContain(ghToken);
    expect(findings[0]?.text).not.toContain(openAiToken);
  });

  it('does not change normal TODO text', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 200, mtimeMs: 1 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('// TODO: refactor this logic' as any);

    const findings = await scanTodoFixmeFindings(rootPath, ['src/todo.ts']);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.text).toContain('refactor this logic');
    expect(findings[0]?.text).not.toContain('[REDACTED_SECRET]');
  });
});
