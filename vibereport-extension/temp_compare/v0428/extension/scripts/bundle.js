/* eslint-disable no-console */
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const extensionRoot = path.join(__dirname, '..');
  const entryFile = path.join(extensionRoot, 'out', 'extension.js');

  if (!fs.existsSync(entryFile)) {
    throw new Error(
      `Missing build entry: ${entryFile}. Run \"pnpm run compile\" first.`
    );
  }

  const tmpOutfile = path.join(extensionRoot, 'out', 'extension.bundle.js');
  const finalOutfile = entryFile;

  await esbuild.build({
    entryPoints: [entryFile],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: tmpOutfile,
    external: ['vscode'],
    logLevel: 'info',
  });

  fs.renameSync(tmpOutfile, finalOutfile);
}

main().catch((error) => {
  console.error('[bundle]', error);
  process.exitCode = 1;
});

