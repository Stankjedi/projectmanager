/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

function isWslMountedPath(cwd) {
  const normalized = cwd.replace(/\\/g, '/').toLowerCase();
  return /^\/mnt\/[a-z](\/|$)/.test(normalized);
}

function hasRollupLinuxGnuNativeModule(extensionRoot) {
  // pnpm layout: node_modules/.pnpm/@rollup+rollup-linux-x64-gnu@x.y.z/...
  const pnpmDir = path.join(extensionRoot, 'node_modules', '.pnpm');
  try {
    const entries = fs.readdirSync(pnpmDir, { withFileTypes: true });
    return entries.some(
      entry =>
        entry.isDirectory() &&
        entry.name.startsWith('@rollup+rollup-linux-x64-gnu@')
    );
  } catch {
    // node_modules missing or non-pnpm layout
  }

  // npm/yarn layout: node_modules/@rollup/rollup-linux-x64-gnu
  return fs.existsSync(
    path.join(extensionRoot, 'node_modules', '@rollup', 'rollup-linux-x64-gnu')
  );
}

function printWslRollupFix() {
  console.error('');
  console.error('[preflight] Detected WSL mounted workspace under /mnt/<drive>.');
  console.error(
    '[preflight] Missing Rollup native module: @rollup/rollup-linux-x64-gnu'
  );
  console.error('');
  console.error('This usually happens when node_modules was installed on Windows');
  console.error('and then reused in WSL/Linux.');
  console.error('');
  console.error('Fix (recommended):');
  console.error('  1) Move this repo into the WSL filesystem (not /mnt/<drive>)');
  console.error('     e.g., ~/dev/projectmanager');
  console.error('  2) Delete node_modules and reinstall in WSL:');
  console.error('     rm -rf vibereport-extension/node_modules');
  console.error('     pnpm -C vibereport-extension install --frozen-lockfile');
  console.error('  3) Re-run tests:');
  console.error('     pnpm -C vibereport-extension run test:run');
  console.error('');
}

function main() {
  if (process.platform !== 'linux') return;

  const cwd = process.cwd();
  if (!isWslMountedPath(cwd)) return;

  const extensionRoot = path.join(__dirname, '..');
  if (hasRollupLinuxGnuNativeModule(extensionRoot)) return;

  printWslRollupFix();
  process.exitCode = 1;
}

module.exports = {
  isWslMountedPath,
  hasRollupLinuxGnuNativeModule,
  printWslRollupFix,
  main,
};

if (require.main === module) {
  main();
}
