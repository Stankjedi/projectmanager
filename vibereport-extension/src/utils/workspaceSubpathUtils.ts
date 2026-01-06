import * as path from 'path';

type PathApi = typeof path.posix;

export type WorkspaceSubpathValidationFailureReason =
  | 'empty'
  | 'absolute'
  | 'containsParentSegment'
  | 'outsideRoot';

export type WorkspaceSubpathValidationResult =
  | {
      ok: true;
      normalizedSubpath: string;
      resolved: string;
    }
  | {
      ok: false;
      reason: WorkspaceSubpathValidationFailureReason;
      error: string;
    };

function isWindowsRootedPath(value: string): boolean {
  return /^[a-zA-Z]:/.test(value) || value.startsWith('\\\\');
}

function containsParentSegment(value: string): boolean {
  const segments = value.split(/[\\/]+/).filter(Boolean);
  return segments.some((segment) => segment === '..');
}

export function validateWorkspaceRelativeSubpathInput(
  value: string,
  options?: { allowEmpty?: boolean }
): { ok: true; normalized: string } | { ok: false; error: string; reason: WorkspaceSubpathValidationFailureReason } {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized) {
    if (options?.allowEmpty) {
      return { ok: true, normalized: '' };
    }
    return { ok: false, reason: 'empty', error: 'Path must not be empty.' };
  }

  if (normalized.startsWith('/') || isWindowsRootedPath(normalized)) {
    return { ok: false, reason: 'absolute', error: 'Absolute paths are not allowed.' };
  }

  if (containsParentSegment(normalized)) {
    return {
      ok: false,
      reason: 'containsParentSegment',
      error: 'Parent path segments ("..") are not allowed.',
    };
  }

  return { ok: true, normalized };
}

export function resolveWorkspaceSubpathPortable(
  workspaceRoot: string,
  subpath: string,
  pathApi: PathApi
): WorkspaceSubpathValidationResult {
  const normalizedWorkspaceRoot = pathApi.resolve(workspaceRoot);
  const input = validateWorkspaceRelativeSubpathInput(subpath);

  if (!input.ok) {
    return { ok: false, reason: input.reason, error: input.error };
  }

  const resolved = pathApi.resolve(normalizedWorkspaceRoot, input.normalized);
  const relative = pathApi.relative(normalizedWorkspaceRoot, resolved);

  if (relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative))) {
    return { ok: true, normalizedSubpath: input.normalized, resolved };
  }

  return {
    ok: false,
    reason: 'outsideRoot',
    error: 'Path must be a workspace-relative subpath and stay within the workspace root.',
  };
}
