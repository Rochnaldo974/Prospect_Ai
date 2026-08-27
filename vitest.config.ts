import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['tests/setup/load-env.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
    },
  },
});
