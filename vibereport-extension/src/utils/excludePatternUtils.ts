export function normalizeExcludePatterns(patterns: string[]): string[] {
  const trimmed = patterns.map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0);
  const unique = Array.from(new Set(trimmed));
  unique.sort();
  return unique;
}
