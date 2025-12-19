import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('docs consistency', () => {
  it('keeps CHANGELOG top version in sync with package.json', async () => {
    const extensionRoot = join(__dirname, '..');

    const packageJson = JSON.parse(
      await readFile(join(extensionRoot, 'package.json'), 'utf-8')
    ) as { version?: string };

    const packageVersion = packageJson.version;
    expect(
      packageVersion,
      'Expected vibereport-extension/package.json to include a "version" field.'
    ).toBeTypeOf('string');
    if (typeof packageVersion !== 'string') return;

    const changelog = await readFile(join(extensionRoot, 'CHANGELOG.md'), 'utf-8');
    const changelogTopMatch = changelog.match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
    expect(
      changelogTopMatch,
      'Expected vibereport-extension/CHANGELOG.md to include a version heading like "## [x.y.z]".'
    ).not.toBeNull();
    if (!changelogTopMatch) return;

    const changelogTopVersion = changelogTopMatch[1];
    expect(
      changelogTopVersion,
      `CHANGELOG top version (${changelogTopVersion}) must match package.json version (${packageVersion}).`
    ).toBe(packageVersion);
  });

  it('keeps root README version in sync with package.json', async () => {
    const extensionRoot = join(__dirname, '..');

    const packageJson = JSON.parse(
      await readFile(join(extensionRoot, 'package.json'), 'utf-8')
    ) as { version?: string };

    const packageVersion = packageJson.version;
    expect(
      packageVersion,
      'Expected vibereport-extension/package.json to include a "version" field.'
    ).toBeTypeOf('string');
    if (typeof packageVersion !== 'string') return;

    const readme = await readFile(join(extensionRoot, '..', 'README.md'), 'utf-8');
    const readmeTopMatch = readme.match(/(\d+\.\d+\.\d+)/);
    expect(
      readmeTopMatch,
      'Expected README.md to include a version string like "x.y.z".'
    ).not.toBeNull();
    if (!readmeTopMatch) return;

    const readmeVersion = readmeTopMatch[1];
    expect(
      readmeVersion,
      `README version (${readmeVersion}) must match package.json version (${packageVersion}).`
    ).toBe(packageVersion);
  });
});
