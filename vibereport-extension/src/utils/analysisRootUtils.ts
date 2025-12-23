import * as path from 'path';

export function resolveAnalysisRootPortable(
  workspaceRoot: string,
  analysisRoot: string,
  pathApi: typeof path.posix
): string {
  const normalizedWorkspaceRoot = pathApi.resolve(workspaceRoot);
  const trimmed = analysisRoot.trim();

  if (!trimmed) {
    return normalizedWorkspaceRoot;
  }

  if (pathApi.isAbsolute(trimmed)) {
    throw new Error('analysisRoot must be a subpath of the workspace root');
  }

  const resolved = pathApi.resolve(normalizedWorkspaceRoot, trimmed);
  const relative = pathApi.relative(normalizedWorkspaceRoot, resolved);

  if (relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative))) {
    return resolved;
  }

  throw new Error('analysisRoot must be a subpath of the workspace root');
}

