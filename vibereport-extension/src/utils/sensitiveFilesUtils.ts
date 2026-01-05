import * as path from 'path';

export function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.basename(normalized).toLowerCase();

  // Common convention: keep .env.example visible as it should not contain secrets.
  if (baseName === '.env.example') return false;

  if (baseName.startsWith('.env')) return true;

  const ext = path.extname(baseName).toLowerCase();
  if (ext === '.pem' || ext === '.key') return true;

  const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;

  // Common SSH private key names (exclude public-key suffix .pub).
  if ((nameWithoutExt === 'id_rsa' || nameWithoutExt === 'id_ed25519') && ext !== '.pub') return true;

  // Keep keyword-based detection limited to common data/config extensions to reduce false positives in source code.
  const keywordExtensions = new Set(['', '.txt', '.json', '.yaml', '.yml', '.ini', '.conf']);
  if (!keywordExtensions.has(ext)) return false;

  const tokens = nameWithoutExt.split(/[^a-z0-9]+/).filter(Boolean);
  const hasToken = (value: string) => tokens.includes(value);

  // Token-like detection: allow explicit token names or common suffix forms (e.g., vsctoken.txt).
  if (hasToken('token') || nameWithoutExt.endsWith('token')) return true;

  // Secret/credential-like filenames (avoid naive substring checks like "key" that match unrelated names like monkey.ts).
  if (
    hasToken('secret') ||
    hasToken('secrets') ||
    hasToken('credential') ||
    hasToken('credentials') ||
    hasToken('password') ||
    hasToken('passwd')
  ) {
    return true;
  }

  // API key patterns: apikey / api-key / api_key (and similar tokenized forms).
  if (hasToken('apikey')) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === 'api' && tokens[i + 1] === 'key') return true;
  }

  return false;
}
