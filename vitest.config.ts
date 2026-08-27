import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['tests/setup/load-env.ts'],

    // Les tests d'intégration partagent une seule base Postgres : les exécuter
    // en parallèle les ferait s'effacer mutuellement leurs données. Le coût est
    // négligeable (quelques secondes) au regard des faux échecs évités.
    fileParallelism: false,

    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
    },
  },
});
