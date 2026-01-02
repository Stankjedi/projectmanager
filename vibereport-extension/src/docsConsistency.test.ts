import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type PackageJson = { version?: string; publisher?: string; name?: string };

async function readPackageInfo(extensionRoot: string): Promise<{
  version: string;
  publisher: string;
  name: string;
}> {
  const packageJson = JSON.parse(
    await readFile(join(extensionRoot, 'package.json'), 'utf-8')
  ) as PackageJson;

  const packageVersion = packageJson.version;
  expect(
    packageVersion,
    'Expected vibereport-extension/package.json to include a "version" field.'
  ).toBeTypeOf('string');

  const publisher = packageJson.publisher;
  expect(
    publisher,
    'Expected vibereport-extension/package.json to include a "publisher" field.'
  ).toBeTypeOf('string');

  const name = packageJson.name;
  expect(
    name,
    'Expected vibereport-extension/package.json to include a "name" field.'
  ).toBeTypeOf('string');

  if (
    typeof packageVersion !== 'string' ||
    typeof publisher !== 'string' ||
    typeof name !== 'string'
  ) {
    return { version: '', publisher: '', name: '' };
  }

  return { version: packageVersion, publisher, name };
}

function findVsixVersions(text: string): string[] {
  const matches = text.matchAll(/vibereport-(\d+\.\d+\.\d+)\.vsix/g);
  return Array.from(matches, (match) => match[1]);
}

function findMarketplaceItemNames(text: string): string[] {
  const itemNames = new Set<string>();

  const marketplaceUrlRegex = /marketplace\.visualstudio\.com\/items\?itemName=([\w.-]+)/g;
  for (const match of text.matchAll(marketplaceUrlRegex)) {
    itemNames.add(match[1]);
  }

  const marketplaceBadgeRegex = /img\.shields\.io\/visual-studio-marketplace\/(?:v|d)\/([\w.-]+)/g;
  for (const match of text.matchAll(marketplaceBadgeRegex)) {
    itemNames.add(match[1]);
  }

  return Array.from(itemNames);
}

describe('docs consistency', () => {
  it('keeps CHANGELOG top version in sync with package.json', async () => {
    const extensionRoot = join(__dirname, '..');

    const { version: packageVersion } = await readPackageInfo(extensionRoot);
    if (!packageVersion) return;

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

    const { version: packageVersion } = await readPackageInfo(extensionRoot);
    if (!packageVersion) return;

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

  it('keeps root README marketplace links/badges in sync with package.json', async () => {
    const extensionRoot = join(__dirname, '..');
    const { publisher, name } = await readPackageInfo(extensionRoot);
    if (!publisher || !name) return;

    const expectedMarketplaceItemName = `${publisher}.${name}`;
    const readme = await readFile(join(extensionRoot, '..', 'README.md'), 'utf-8');

    const itemNames = findMarketplaceItemNames(readme);
    expect(
      itemNames.length,
      'Expected README.md to include at least one VS Code Marketplace itemName (link or badge).'
    ).toBeGreaterThan(0);

    const mismatches = itemNames.filter((found) => found !== expectedMarketplaceItemName);
    expect(
      mismatches,
      mismatches.length > 0
        ? `README.md marketplace itemName drift: expected ${expectedMarketplaceItemName}, found ${mismatches.join(', ')}`
        : 'Expected no marketplace itemName drift.'
    ).toEqual([]);
  });

  it('keeps README VSIX examples in sync with package.json', async () => {
    const extensionRoot = join(__dirname, '..');
    const { version: packageVersion } = await readPackageInfo(extensionRoot);
    if (!packageVersion) return;

    const rootReadme = await readFile(join(extensionRoot, '..', 'README.md'), 'utf-8');
    const extReadme = await readFile(join(extensionRoot, 'README.md'), 'utf-8');

    const rootVsixVersions = findVsixVersions(rootReadme);
    const extVsixVersions = findVsixVersions(extReadme);

    const mismatches: string[] = [];

    for (const v of rootVsixVersions) {
      if (v !== packageVersion) mismatches.push(`README.md: vibereport-${v}.vsix (expected ${packageVersion})`);
    }

    for (const v of extVsixVersions) {
      if (v !== packageVersion) mismatches.push(`vibereport-extension/README.md: vibereport-${v}.vsix (expected ${packageVersion})`);
    }

    // Also validate versioned GitHub release URLs when present.
    const releaseUrlRegex = /releases\/download\/v(\d+\.\d+\.\d+)\/vibereport-(\d+\.\d+\.\d+)\.vsix/g;
    for (const match of rootReadme.matchAll(releaseUrlRegex)) {
      const urlVersion = match[1];
      const fileVersion = match[2];
      if (urlVersion !== packageVersion || fileVersion !== packageVersion) {
        mismatches.push(
          `README.md: releases/download/v${urlVersion}/vibereport-${fileVersion}.vsix (expected v${packageVersion}/vibereport-${packageVersion}.vsix)`
        );
      }
    }

    for (const match of extReadme.matchAll(releaseUrlRegex)) {
      const urlVersion = match[1];
      const fileVersion = match[2];
      if (urlVersion !== packageVersion || fileVersion !== packageVersion) {
        mismatches.push(
          `vibereport-extension/README.md: releases/download/v${urlVersion}/vibereport-${fileVersion}.vsix (expected v${packageVersion}/vibereport-${packageVersion}.vsix)`
        );
      }
    }

    // Validate a static version badge in the extension README when present.
    const badgeMatch = extReadme.match(/img\.shields\.io\/badge\/version-(\d+\.\d+\.\d+)-brightgreen/i);
    if (badgeMatch) {
      const badgeVersion = badgeMatch[1];
      if (badgeVersion !== packageVersion) {
        mismatches.push(
          `vibereport-extension/README.md: version badge ${badgeVersion} (expected ${packageVersion})`
        );
      }
    }

    expect(
      mismatches,
      mismatches.length > 0
        ? `Found README version drift (expected ${packageVersion}).`
        : 'Expected no README version drift.'
    ).toEqual([]);
  });
});
