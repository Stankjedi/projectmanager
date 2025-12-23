import * as fs from 'fs/promises';
import * as path from 'path';
import ignore, { type Ignore } from 'ignore';

type GitignoreMatcherCacheEntry = { mtimeMs: number | null; matcher: Ignore };

const gitignoreMatcherCache = new Map<string, GitignoreMatcherCacheEntry>();

/**
 * Load a cached ignore() matcher from `${rootPath}/.gitignore`.
 *
 * - Missing/unreadable `.gitignore` is treated as empty.
 * - Paths must be relative and use POSIX-style separators (`/`).
 */
export async function getGitignoreMatcher(rootPath: string): Promise<Ignore> {
  const gitignorePath = path.join(rootPath, '.gitignore');

  let mtimeMs: number | null = null;
  try {
    const stat = await fs.stat(gitignorePath);
    mtimeMs = Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : null;
  } catch {
    // Missing/unreadable .gitignore: treat as empty.
    mtimeMs = null;
  }

  const cached = gitignoreMatcherCache.get(rootPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.matcher;
  }

  const matcher = ignore();
  if (mtimeMs !== null) {
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      matcher.add(content);
    } catch {
      // Stat succeeded but read failed: treat rules as empty and invalidate mtime.
      mtimeMs = null;
    }
  }

  gitignoreMatcherCache.set(rootPath, { mtimeMs, matcher });
  return matcher;
}

export function clearGitignoreMatcherCache(): void {
  gitignoreMatcherCache.clear();
}
