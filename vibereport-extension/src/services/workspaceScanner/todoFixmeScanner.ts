import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { TodoFixmeFinding, TodoFixmeTag } from '../../models/types.js';
import { LANGUAGE_EXTENSIONS } from '../../models/types.js';
import { createCacheKey, getCachedValue, setCachedValue } from '../snapshotCache.js';

type FileSignature = { mtimeMs: number; size: number };
type CachedFileFindings = { signature: FileSignature; findings: TodoFixmeFinding[] };
type TodoFixmeScanCache = {
  candidatesSignature: string;
  byFile: Record<string, CachedFileFindings>;
  aggregated: TodoFixmeFinding[];
};

function hashCandidateSignatures(items: Array<{ file: string; signature: FileSignature }>): string {
  const payload = items.map(({ file, signature }) => `${file}|${signature.mtimeMs}|${signature.size}`).join('\n');
  return createHash('sha1').update(payload).digest('hex');
}

function extractTodoFixmeFindingsFromContent(
  relativePath: string,
  content: string,
  tagRegex: RegExp,
  maxFindings: number
): TodoFixmeFinding[] {
  const findings: TodoFixmeFinding[] = [];

  if (content.includes('\u0000')) {
    return findings;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(tagRegex);
    if (!match) continue;

    const tag = match[1] as TodoFixmeTag;
    const matchIndex = match.index ?? 0;
    let text = line.slice(matchIndex + match[0].length);
    text = text.replace(/^[:\s-]+/, '').trim();
    if (!text) text = line.trim();
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 200) text = `${text.slice(0, 200)}...`;

    findings.push({
      file: relativePath,
      line: i + 1,
      tag,
      text,
    });

    if (findings.length >= maxFindings) break;
  }

  return findings;
}

export async function scanTodoFixmeFindings(
  rootPath: string,
  files: string[]
): Promise<TodoFixmeFinding[]> {
  const maxFilesToInspect = 300;
  const maxFileBytes = 200_000;
  const maxFindings = 200;
  const tagRegex = /\b(TODO|FIXME)\b/;

  const isTextFile = (relativePath: string): boolean => {
    const ext = path.extname(relativePath).slice(1).toLowerCase();
    const baseName = path.basename(relativePath).toLowerCase();
    if (ext && LANGUAGE_EXTENSIONS[ext]) return true;
    return baseName === 'dockerfile' || baseName === 'makefile';
  };

  const cacheKey = createCacheKey(
    'todo-fixme-scan',
    rootPath,
    maxFilesToInspect,
    maxFileBytes,
    maxFindings
  );
  const cached = getCachedValue<TodoFixmeScanCache>(cacheKey);

  const candidates: string[] = [];
  for (const relativePath of files) {
    if (candidates.length >= maxFilesToInspect) break;
    if (!isTextFile(relativePath)) continue;
    candidates.push(relativePath);
  }

  const candidateSignatures: Array<{ file: string; signature: FileSignature }> = [];
  for (const relativePath of candidates) {
    const fullPath = path.join(rootPath, relativePath);
    try {
      const stat = await fs.stat(fullPath);
      candidateSignatures.push({
        file: relativePath,
        signature: { mtimeMs: stat.mtimeMs, size: stat.size },
      });
    } catch {
      candidateSignatures.push({
        file: relativePath,
        signature: { mtimeMs: -1, size: -1 },
      });
    }
  }

  const candidatesSignature = hashCandidateSignatures(candidateSignatures);
  if (cached && cached.candidatesSignature === candidatesSignature) {
    return cached.aggregated;
  }

  const byFile: Record<string, CachedFileFindings> = { ...(cached?.byFile ?? {}) };
  const aggregated: TodoFixmeFinding[] = [];

  for (const { file: relativePath, signature } of candidateSignatures) {
    if (aggregated.length >= maxFindings) break;

    // If stat failed, treat as empty.
    if (signature.size < 0 || signature.mtimeMs < 0) {
      byFile[relativePath] = { signature, findings: [] };
      continue;
    }

    // Enforce size limits and cache empty results for large files.
    if (signature.size > maxFileBytes) {
      byFile[relativePath] = { signature, findings: [] };
      continue;
    }

    const cachedFile = byFile[relativePath];
    let fileFindings: TodoFixmeFinding[];

    if (
      cachedFile &&
      cachedFile.signature.mtimeMs === signature.mtimeMs &&
      cachedFile.signature.size === signature.size
    ) {
      fileFindings = cachedFile.findings;
    } else {
      const fullPath = path.join(rootPath, relativePath);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        fileFindings = extractTodoFixmeFindingsFromContent(relativePath, content, tagRegex, maxFindings);
      } catch {
        fileFindings = [];
      }

      byFile[relativePath] = { signature, findings: fileFindings };
    }

    for (const finding of fileFindings) {
      aggregated.push(finding);
      if (aggregated.length >= maxFindings) break;
    }
  }

  setCachedValue<TodoFixmeScanCache>(cacheKey, {
    candidatesSignature,
    byFile,
    aggregated,
  });

  return aggregated;
}
