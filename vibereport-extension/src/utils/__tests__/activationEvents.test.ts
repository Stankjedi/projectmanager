import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

type ExtensionPackageJson = {
  activationEvents?: unknown;
};

describe('package.json activationEvents', () => {
  it('activates on views and key commands so sidebar never stays empty', async () => {
    const raw = await fs.readFile(
      path.resolve(process.cwd(), 'package.json'),
      'utf-8'
    );
    const pkg = JSON.parse(raw) as ExtensionPackageJson;

    expect(pkg.activationEvents, 'Expected package.json to include activationEvents.').toBeDefined();
    expect(
      Array.isArray(pkg.activationEvents),
      'Expected package.json activationEvents to be an array.'
    ).toBe(true);

    const events = new Set(
      (Array.isArray(pkg.activationEvents) ? pkg.activationEvents : [])
        .filter((value): value is string => typeof value === 'string')
    );

    const required = [
      'onView:vibereport.summary',
      'onView:vibereport.history',
      'onView:vibereport.settings',
      'onCommand:vibereport.updateReports',
    ];

    for (const entry of required) {
      expect(events.has(entry), `Missing activation event: ${entry}`).toBe(true);
    }
  });
});

