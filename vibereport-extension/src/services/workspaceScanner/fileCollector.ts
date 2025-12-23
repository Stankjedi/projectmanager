import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { VibeReportConfig } from '../../models/types.js';
import { getCachedValue, setCachedValue, createCacheKey } from '../snapshotCache.js';
import { getGitignoreMatcher } from '../../utils/gitignoreUtils.js';

function normalizeExcludePatterns(patterns: string[]): string[] {
  const trimmed = patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
    .sort();

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const pattern of trimmed) {
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    unique.push(pattern);
  }

  return unique;
}

function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.basename(normalized).toLowerCase();

  // Common convention: keep .env.example visible as it should not contain secrets.
  if (baseName === '.env.example') return false;

  if (baseName.startsWith('.env')) return true;

  const ext = path.extname(baseName).toLowerCase();
  if (ext === '.pem' || ext === '.key') return true;

  const tokenLikeExtensions = new Set(['', '.txt', '.json', '.yaml', '.yml', '.ini', '.conf']);
  if (baseName.includes('token') && tokenLikeExtensions.has(ext)) return true;

  return false;
}

async function applyGitignoreAndSensitiveFilters(args: {
  rootPath: string;
  files: string[];
  respectGitignore: boolean;
  includeSensitiveFiles: boolean;
  normalizedSnapshotFile: string;
}): Promise<string[]> {
  const { rootPath, files, respectGitignore, includeSensitiveFiles, normalizedSnapshotFile } = args;

  let filtered = files;

  if (respectGitignore) {
    const matcher = await getGitignoreMatcher(rootPath);
    filtered = filtered.filter((relativePath) => !matcher.ignores(relativePath.replace(/\\/g, '/')));
  }

  if (!includeSensitiveFiles) {
    filtered = filtered.filter((relativePath) => !isSensitivePath(relativePath));
  }

  // Always exclude the snapshot file from scan results.
  filtered = filtered.filter((relativePath) => relativePath.replace(/\\/g, '/') !== normalizedSnapshotFile);

  return filtered;
}

async function getGitignoreMtimeMs(rootPath: string, respectGitignore: boolean): Promise<number | null> {
  if (!respectGitignore) return null;

  try {
    const stat = await fs.stat(path.join(rootPath, '.gitignore'));
    return Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : null;
  } catch {
    return null;
  }
}

export async function collectFiles(args: {
  rootPath: string;
  config: VibeReportConfig;
  log?: (message: string) => void;
}): Promise<string[]> {
  const { rootPath, config, log } = args;

  const normalizedExcludePatterns = normalizeExcludePatterns(config.excludePatterns);
  const gitignoreMtimeMs = await getGitignoreMtimeMs(rootPath, config.respectGitignore);
  const cacheKey = createCacheKey(
    'file-list',
    rootPath,
    config.maxFilesToScan,
    `exclude=${normalizedExcludePatterns.join(',')}`,
    `respectGitignore=${config.respectGitignore}`,
    `includeSensitiveFiles=${config.includeSensitiveFiles}`,
    `gitignoreMtimeMs=${gitignoreMtimeMs ?? 'null'}`,
    `snapshotFile=${config.snapshotFile.replace(/\\/g, '/')}`
  );
  const cached = getCachedValue<string[]>(cacheKey);

  if (cached) {
    log?.(`[WorkspaceScanner] Using cached file list for ${rootPath}`);
    return cached;
  }

  const excludePattern =
    normalizedExcludePatterns.length > 0 ? `{${normalizedExcludePatterns.join(',')}}` : undefined;

  const uris = await vscode.workspace.findFiles('**/*', excludePattern, config.maxFilesToScan);

  const files = uris
    .filter((uri) => uri.fsPath.startsWith(rootPath))
    .map((uri) => path.relative(rootPath, uri.fsPath).replace(/\\/g, '/'));

  const normalizedSnapshotFile = config.snapshotFile.replace(/\\/g, '/');
  const filteredFiles = await applyGitignoreAndSensitiveFilters({
    rootPath,
    files,
    respectGitignore: config.respectGitignore,
    includeSensitiveFiles: config.includeSensitiveFiles,
    normalizedSnapshotFile,
  });

  setCachedValue(cacheKey, filteredFiles);
  return filteredFiles;
}
