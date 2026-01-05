/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function tryResolveTscViaRequire() {
  try {
    return require.resolve('typescript/bin/tsc');
  } catch {
    return null;
  }
}

function tryResolveTscViaPnpmStore() {
  const extensionRoot = path.join(__dirname, '..');
  const pnpmStoreDir = path.join(extensionRoot, 'node_modules', '.pnpm');

  if (!fs.existsSync(pnpmStoreDir)) return null;

  /** @type {{version: string, tscPath: string}[]} */
  const candidates = [];

  for (const dirent of fs.readdirSync(pnpmStoreDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    if (!dirent.name.startsWith('typescript@')) continue;

    const tscPath = path.join(
      pnpmStoreDir,
      dirent.name,
      'node_modules',
      'typescript',
      'bin',
      'tsc'
    );
    const pkgPath = path.join(
      pnpmStoreDir,
      dirent.name,
      'node_modules',
      'typescript',
      'package.json'
    );

    if (!fs.existsSync(tscPath)) continue;

    let version = dirent.name.slice('typescript@'.length);
    if (fs.existsSync(pkgPath)) {
      try {
        version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version ?? version;
      } catch {
        // ignore
      }
    }

    candidates.push({ version, tscPath });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  return candidates.at(-1).tscPath;
}

function resolveTsc() {
  return tryResolveTscViaRequire() ?? tryResolveTscViaPnpmStore();
}

function main() {
  const tscPath = resolveTsc();
  if (!tscPath) {
    console.error(
      '[runTsc] Failed to locate TypeScript compiler. Try reinstalling deps with "pnpm install".'
    );
    process.exitCode = 1;
    return;
  }

  const args = process.argv.slice(2);
  const result = spawnSync(process.execPath, [tscPath, ...args], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}

main();

