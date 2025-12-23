import * as path from 'path';

function normalizeForComparison(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function ensureTrailingSeparator(value: string): string {
  return value.endsWith(path.sep) ? value : value + path.sep;
}

function resolveWithinRoot(rootPath: string, relPath: string): string | null {
  if (!rootPath || !relPath) return null;
  if (relPath.includes('\0')) return null;

  // Reject absolute paths (rooted) up-front.
  if (path.posix.isAbsolute(relPath) || path.win32.isAbsolute(relPath)) return null;

  const rootResolved = path.resolve(rootPath);
  const targetResolved = path.resolve(rootResolved, relPath);

  const rootComparable = ensureTrailingSeparator(normalizeForComparison(rootResolved));
  const targetComparable = normalizeForComparison(targetResolved);

  // Block path traversal and root-escape attempts.
  if (!targetComparable.startsWith(rootComparable)) return null;

  return targetResolved;
}

export function linkifyCodeReferences(rootPath: string, description: string): string {
  // Skip if already contains command links
  if (description.includes('command:vibereport.openFunctionInFile')) {
    return description;
  }

  // Improved pattern: supports double underscores (__tests__), more extensions
  const refPattern =
    /`([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|cs|cpp|c|h|md|json))`(?:[:#]([A-Za-z0-9_$]+))?/g;

  return description.replace(refPattern, (full: string, relPath: string, symbolName?: string) => {
    const absPath = resolveWithinRoot(rootPath, relPath);
    if (!absPath) {
      return full;
    }

    const args = symbolName ? [absPath, symbolName] : [absPath];
    const encodedArgs = encodeURIComponent(JSON.stringify(args));
    const label = symbolName ? `${relPath}#${symbolName}` : relPath;
    return `[${label}](command:vibereport.openFunctionInFile?${encodedArgs})`;
  });
}

export function linkifyTableFilePaths(rootPath: string, content: string): string {
  // Pattern for "대상 파일" table row: | **대상 파일** | paths |
  const targetFileRowPattern = /(\|\s*\*\*대상 파일\*\*\s*\|\s*)([^|\n]+)(\|)/g;

  return content.replace(targetFileRowPattern, (_full, prefix: string, pathsCell: string, suffix: string) => {
    const linkedPaths = linkifyMultiplePaths(rootPath, pathsCell.trim());
    return `${prefix}${linkedPaths} ${suffix}`;
  });
}

export function linkifyMultiplePaths(rootPath: string, pathsStr: string): string {
  // Skip if already contains command links
  if (pathsStr.includes('command:vibereport.openFunctionInFile')) {
    return pathsStr;
  }

  // Handle multiple paths separated by comma or newline
  // Also handle paths with annotations like "(신규)"
  const pathSegments = pathsStr
    .split(/[,、]+/)
    .map(p => p.trim())
    .filter(Boolean);

  return pathSegments.map(segment => linkifySinglePath(rootPath, segment)).join(', ');
}

export function linkifySinglePath(rootPath: string, pathStr: string): string {
  // Extract path and annotation (e.g., "path/to/file.ts(신규)" -> "path/to/file.ts", "(신규)")
  const annotationMatch = pathStr.match(/^(.+?)(\([^)]+\))?\s*$/);
  if (!annotationMatch) return pathStr;

  let filePath = annotationMatch[1].trim();
  const annotation = annotationMatch[2] || '';

  // Remove backticks if present
  filePath = filePath.replace(/`/g, '');
  if (!filePath) return pathStr;

  // Check for valid file extension
  const extMatch = filePath.match(/\.(?:ts|tsx|js|jsx|py|go|rs|java|cs|cpp|c|h|md|json)$/);
  if (!extMatch) return pathStr;

  const absPath = resolveWithinRoot(rootPath, filePath);
  if (!absPath) {
    return pathStr;
  }

  const encodedArgs = encodeURIComponent(JSON.stringify([absPath]));
  const linkedPath = `[${filePath}](command:vibereport.openFunctionInFile?${encodedArgs})`;

  return annotation ? `${linkedPath}${annotation}` : linkedPath;
}
