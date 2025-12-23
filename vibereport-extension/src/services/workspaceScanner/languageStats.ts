import * as path from 'path';
import { LANGUAGE_EXTENSIONS } from '../../models/types.js';

export function calculateLanguageStats(files: string[]): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase();
    if (ext && LANGUAGE_EXTENSIONS[ext]) {
      stats[ext] = (stats[ext] || 0) + 1;
    }
  }

  // 내림차순 정렬
  const sorted = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>);

  return sorted;
}
