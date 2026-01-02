import * as path from 'path';

export function isSensitivePath(relativePath: string): boolean {
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
