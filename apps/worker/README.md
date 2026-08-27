# Worker

Processus long qui exécute le pipeline. Séparé de l'application Next.js parce
que les jobs de crawl dépassent largement les limites du serverless.

## Fonctionnement

```
pg_cron  →  insère un job dans job_queue
              ↓
worker   →  claim_jobs (FOR UPDATE SKIP LOCKED, par lots)
              ↓
            executeJob : résolution du handler → validation Zod → exécution
              ↓
            complete_job | fail_job (backoff) | kill_job (sans réessai)
```

## Garanties

- **Aucun job traité deux fois simultanément** — `SKIP LOCKED` sur la réclamation.
- **Concurrence bornée** — on ne réclame que ce qu'on peut traiter ; un job
  réclamé mais en attente d'une place serait verrouillé pour rien.
- **Arrêt propre** — sur `SIGTERM`, le worker cesse de réclamer et laisse finir
  les jobs en cours. Un second signal force la sortie.
- **Reprise après crash** — `reclaim_stalled_jobs` remet en file les jobs
  verrouillés par un worker qui ne répond plus, toutes les 5 minutes.
- **Pas de réessai inutile** — un type inconnu ou un payload invalide est
  abandonné immédiatement : une nouvelle tentative ne les corrigera pas.

## Ajouter un handler

```ts
// packages/core/src/jobs/handlers/mon-job.ts
export const monHandler: JobHandler<z.infer<typeof schema>> = {
  type: 'mon_job',
  schema,                    // valide le payload ; l'échec est définitif
  defaultPriority: 50,
  async run(payload, { db, logger, signal }) {
    // `signal` passe à aborted à l'arrêt du worker : à consulter dans les
    // boucles longues pour ne pas retarder l'extinction.
    return { processed: 0, succeeded: 0, failed: 0 };
  },
};
```

Puis l'ajouter à `packages/core/src/jobs/registry.ts`. La console admin signale
tout type présent en file sans handler enregistré.

Lever `PermanentJobError` pour un échec qu'un réessai ne corrigera pas
(entité disparue, donnée définitivement invalide).

## Local

```bash
pnpm dev:worker        # mode watch
```
