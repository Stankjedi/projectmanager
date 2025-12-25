import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-preflight-'));
}

describe('preflightTestEnv helpers', () => {
  it('detects WSL mounted paths under /mnt/<drive>', async () => {
    const { isWslMountedPath } = await import(
      '../../../scripts/preflightTestEnv.js'
    );

    expect(isWslMountedPath('/mnt/c')).toBe(true);
    expect(isWslMountedPath('/mnt/c/Users/test')).toBe(true);
    expect(isWslMountedPath('/mnt/d')).toBe(true);
    expect(isWslMountedPath('/mnt/d/projects/x')).toBe(true);
    expect(isWslMountedPath('/home/user/repo')).toBe(false);
    expect(isWslMountedPath('C:\\Users\\test')).toBe(false);
  });

  it('detects pnpm rollup native module layout', async () => {
    const { hasRollupLinuxGnuNativeModule } = await import(
      '../../../scripts/preflightTestEnv.js'
    );

    const tempRoot = createTempDir();
    try {
      const rollupDir = path.join(
        tempRoot,
        'node_modules',
        '.pnpm',
        '@rollup+rollup-linux-x64-gnu@4.0.0'
      );
      fs.mkdirSync(rollupDir, { recursive: true });

      expect(hasRollupLinuxGnuNativeModule(tempRoot)).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns false when rollup native module is missing', async () => {
    const { hasRollupLinuxGnuNativeModule } = await import(
      '../../../scripts/preflightTestEnv.js'
    );

    const tempRoot = createTempDir();
    try {
      expect(hasRollupLinuxGnuNativeModule(tempRoot)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
