import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

type ExtensionPackageJson = {
  contributes?: {
    commands?: Array<{
      command?: unknown;
    }>;
  };
};

describe('package.json command contributions', () => {
  it('includes required user-facing commands registered in extension.ts', async () => {
    const raw = await fs.readFile(
      path.resolve(process.cwd(), 'package.json'),
      'utf-8'
    );
    const pkg = JSON.parse(raw) as ExtensionPackageJson;

    const contributedCommands = new Set(
      (pkg.contributes?.commands ?? [])
        .map((entry) => entry.command)
        .filter((value): value is string => typeof value === 'string')
    );

    const requiredCommands = [
      'vibereport.updateReportsAll',
      'vibereport.exportSettings',
      'vibereport.importSettings',
      'vibereport.clearHistory',
      'vibereport.markApplied',
    ];

    for (const command of requiredCommands) {
      expect(contributedCommands.has(command)).toBe(true);
    }
  });
});

