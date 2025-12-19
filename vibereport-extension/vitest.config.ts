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
        // Baseline as of 2025-12-16 (slightly below current numbers)
        statements: 66,
        branches: 45,
        functions: 60,
        lines: 67,
      },
    },
  },
};

export default config;
