import * as path from 'path';
import { resolveAnalysisRootPortable } from './analysisRootUtils.js';

type PathApi = typeof path.posix;

export type OpenCodeReferenceValidationFailureReason =
  | 'empty'
  | 'nonAbsolute'
  | 'outsideWorkspace'
  | 'outsideAnalysisRoot';

export type OpenCodeReferenceValidationResult =
  | {
      ok: true;
      pathStyle: 'posix' | 'win32';
      workspaceRoot: string;
      analysisRootPath: string;
      analysisRootSource: 'analysisRoot' | 'workspaceRoot';
      targetResolved: string;
    }
  | {
      ok: false;
      pathStyle: 'posix' | 'win32';
      reason: OpenCodeReferenceValidationFailureReason;
      workspaceRoot?: string;
      analysisRootPath?: string;
      targetResolved?: string;
    };

function isWindowsAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\');
}

function getPathApi(value: string): PathApi {
  return isWindowsAbsolutePath(value) ? path.win32 : path.posix;
}

function ensureTrailingSeparator(pathApi: PathApi, value: string): string {
  return value.endsWith(pathApi.sep) ? value : value + pathApi.sep;
}

function normalizeForComparison(pathApi: PathApi, value: string): string {
  const resolved = pathApi.resolve(value);
  return pathApi === path.win32 ? resolved.toLowerCase() : resolved;
}

function findBestWorkspaceRoot(pathApi: PathApi, targetResolved: string, workspaceFolders: string[]): string | null {
  const targetComparable = normalizeForComparison(pathApi, targetResolved);

  let best: string | null = null;
  let bestLen = -1;

  for (const folderPath of workspaceFolders) {
    if (!folderPath) continue;

    const folderApi = getPathApi(folderPath);
    if (folderApi !== pathApi) continue;
    if (!folderApi.isAbsolute(folderPath)) continue;

    const folderResolved = folderApi.resolve(folderPath);
    const folderComparable = folderApi === path.win32
      ? ensureTrailingSeparator(folderApi, folderResolved).toLowerCase()
      : ensureTrailingSeparator(folderApi, folderResolved);

    if (targetComparable.startsWith(folderComparable) && folderComparable.length > bestLen) {
      best = folderResolved;
      bestLen = folderComparable.length;
    }
  }

  return best;
}

export function validateOpenCodeReferencePath(args: {
  filePath: string;
  workspaceFolders: string[];
  analysisRoot: string;
}): OpenCodeReferenceValidationResult {
  const normalizedInput = typeof args.filePath === 'string' ? args.filePath.trim() : '';
  const pathApi = getPathApi(normalizedInput);
  const pathStyle = pathApi === path.win32 ? 'win32' : 'posix';

  if (!normalizedInput) {
    return { ok: false, pathStyle, reason: 'empty' };
  }

  if (!pathApi.isAbsolute(normalizedInput)) {
    return { ok: false, pathStyle, reason: 'nonAbsolute', targetResolved: normalizedInput };
  }

  const targetResolved = pathApi.resolve(normalizedInput);
  const workspaceRoot = findBestWorkspaceRoot(pathApi, targetResolved, args.workspaceFolders);
  if (!workspaceRoot) {
    return { ok: false, pathStyle, reason: 'outsideWorkspace', targetResolved };
  }

  const trimmedAnalysisRoot = args.analysisRoot.trim();
  let analysisRootPath = workspaceRoot;
  let analysisRootSource: 'analysisRoot' | 'workspaceRoot' = 'workspaceRoot';

  if (trimmedAnalysisRoot) {
    try {
      analysisRootPath = resolveAnalysisRootPortable(workspaceRoot, trimmedAnalysisRoot, pathApi);
      analysisRootSource = 'analysisRoot';
    } catch {
      analysisRootPath = workspaceRoot;
      analysisRootSource = 'workspaceRoot';
    }
  }

  const safeRootComparable = pathApi === path.win32
    ? ensureTrailingSeparator(pathApi, analysisRootPath).toLowerCase()
    : ensureTrailingSeparator(pathApi, analysisRootPath);

  const targetComparable = normalizeForComparison(pathApi, targetResolved);
  if (!targetComparable.startsWith(safeRootComparable)) {
    return {
      ok: false,
      pathStyle,
      reason: 'outsideAnalysisRoot',
      workspaceRoot,
      analysisRootPath,
      targetResolved,
    };
  }

  return {
    ok: true,
    pathStyle,
    workspaceRoot,
    analysisRootPath,
    analysisRootSource,
    targetResolved,
  };
}
