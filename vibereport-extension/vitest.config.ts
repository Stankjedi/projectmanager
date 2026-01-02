import type { UserConfigExport } from 'vitest/config';

const config: UserConfigExport = {
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**'],
      thresholds: {
        // Baseline as of 2026-01-02 (slightly below current coverage ~86.75/71.11/85.44/88.41)
        statements: 80,
        branches: 60,
        functions: 75,
        lines: 80,
      },
    },
  },
};

export default config;
