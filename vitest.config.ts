import { defineConfig } from 'vitest/config';

/**
 * Deux projets, parce que deux rapports à la base.
 *
 * Les tests unitaires ne touchent jamais Postgres : ils n'ont aucune raison
 * de la vider. Or le nettoyage global s'appliquait à tout lancement de
 * vitest, y compris `vitest run tests/unit/un-seul-fichier` — et c'est ainsi
 * que seize mille entreprises réelles, collectées pendant une demi-journée,
 * ont disparu pour un test de sept assertions. Le nettoyage n'appartient
 * qu'au projet d'intégration, le seul qui partage la base de développement.
 */
const common = {
  environment: 'node' as const,
  globals: false,
  setupFiles: ['tests/setup/load-env.ts'],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...common,
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          ...common,
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/setup/global-clean.ts'],
        },
      },
    ],

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
