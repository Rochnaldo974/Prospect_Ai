import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  claimJobs,
  enqueueJob,
  executeJob,
  getHandler,
  PermanentJobError,
  registeredJobTypes,
  type Db,
  type JobHandler,
  type QueuedJob,
} from '../../packages/core/src/jobs';
import { createLogger } from '../../packages/core/src/logger';
import {
  assignmentPayload,
  cleanupEngineTables,
  createCompany,
  createOpportunity,
  createUser,
  deleteTestUsers,
  serviceClient,
  supabaseReachable,
} from './helpers';

/**
 * Exécution des jobs : ce sont les chemins d'échec qui comptent.
 * Un pipeline nocturne qui s'arrête sur un handler défaillant ou qui réessaie
 * indéfiniment un payload invalide ne produit rien le lendemain matin.
 */
const reachable = await supabaseReachable();
const quiet = createLogger({ level: 'error' });

describe.skipIf(!reachable)('exécution des jobs', () => {
  let admin: SupabaseClient;
  let db: Db;

  const options = (resolveHandler?: (type: string) => JobHandler<never> | undefined) => ({
    db,
    logger: quiet,
    workerId: 'worker-test',
    signal: new AbortController().signal,
    ...(resolveHandler ? { resolveHandler } : {}),
  });

  /**
   * Réclame le job qu'on vient de planifier, en le désignant par son type.
   *
   * Le filtre par type n'est pas une commodité : pg_cron insère ses propres
   * jobs — reclaim_stalled_jobs toutes les cinq minutes, avec une priorité de
   * 95 supérieure à celle des tests. Sans filtre, un test réclamerait le job
   * du planificateur au lieu du sien, et échouerait sur une assertion qui
   * n'a rien à voir avec ce qu'elle vérifie.
   */
  const claimOne = async (type: string): Promise<QueuedJob> => {
    const [job] = await claimJobs(db, 'worker-test', 1, [type]);
    if (!job) {
      throw new Error(
        `Aucun job « ${type} » réclamé. Un worker tourne-t-il en parallèle sur la même base ?`,
      );
    }
    return job;
  };

  beforeAll(async () => {
    admin = serviceClient();
    db = admin as unknown as Db;
  });

  beforeEach(async () => {
    await admin.from('job_queue').delete().neq('id', 0);
    await admin.from('job_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  afterAll(async () => {
    await admin.from('job_queue').delete().neq('id', 0);
    await admin.from('job_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('registre', () => {
    it('expose les handlers de maintenance', () => {
      expect(registeredJobTypes()).toEqual([
        'companies_from_domains',
        'detect_duplicates',
        'detect_signals',
        'discover_osm',
        'enrich_from_sirene',
        'ensure_partitions',
        'expire_assignments',
        'expire_opportunities',
        'prune_event_keys',
        'reclaim_stalled_jobs',
        'refresh_admin_stats',
        'refresh_filter_options',
        'resolve_websites',
        'scan_domains',
        'sync_bodacc',
      ]);
    });

    it('ne connaît pas les types non enregistrés', () => {
      expect(getHandler('cheap_web_scan')).toBeUndefined();
    });

    it('refuse un payload de découverte sans périmètre', async () => {
      // Une découverte OSM sans ville interrogerait le monde entier.
      await enqueueJob(db, 'discover_osm', { cities: [] });
      const job = await claimOne('discover_osm');

      const outcome = await executeJob(job, options());
      expect(outcome.status).toBe('abandoned');

      const { data } = await admin
        .from('job_queue')
        .select('status, last_error')
        .eq('id', job.id)
        .single();
      expect(data?.status).toBe('dead');
      expect(data?.last_error).toMatch(/Payload invalide/);
    });
  });

  describe('chemin nominal', () => {
    it('exécute un job et le marque terminé', async () => {
      await enqueueJob(db, 'ensure_partitions', {});
      const job = await claimOne('ensure_partitions');

      const outcome = await executeJob(job, options());
      expect(outcome.status).toBe('succeeded');

      const { data } = await admin.from('job_queue').select('status').eq('id', job.id).single();
      expect(data?.status).toBe('done');
    });

    it('journalise l’exécution dans job_runs', async () => {
      await enqueueJob(db, 'expire_opportunities', {});
      const job = await claimOne('expire_opportunities');
      await executeJob(job, options());

      const { data } = await admin
        .from('job_runs')
        .select('*')
        .eq('job_id', job.id)
        .single();

      expect(data).toMatchObject({
        job_type: 'expire_opportunities',
        worker_id: 'worker-test',
        status: 'succeeded',
      });
      expect(data?.completed_at).not.toBeNull();
    });

    it('applique les valeurs par défaut du schéma au payload vide', async () => {
      const seen: unknown[] = [];
      const handler: JobHandler<{ monthsAhead: number }> = {
        type: 'spy',
        schema: z.object({ monthsAhead: z.number().default(7) }),
        run: async (payload) => {
          seen.push(payload);
          return { processed: 1, succeeded: 1, failed: 0 };
        },
      };

      await enqueueJob(db, 'spy', {});
      const job = await claimOne('spy');
      await executeJob(job, options(() => handler as unknown as JobHandler<never>));

      expect(seen).toEqual([{ monthsAhead: 7 }]);
    });
  });

  describe('chemins d’échec', () => {
    it('abandonne un type de job inconnu sans le réessayer', async () => {
      await enqueueJob(db, 'type_inexistant', {});
      const job = await claimOne('type_inexistant');

      const outcome = await executeJob(job, options());
      expect(outcome.status).toBe('abandoned');

      const { data } = await admin
        .from('job_queue')
        .select('status, last_error')
        .eq('id', job.id)
        .single();
      expect(data?.status).toBe('dead');
      expect(data?.last_error).toMatch(/Aucun handler/);
    });

    it('abandonne un payload invalide sans le réessayer', async () => {
      const handler: JobHandler<{ companyId: string }> = {
        type: 'strict',
        schema: z.object({ companyId: z.uuid() }),
        run: async () => ({ processed: 0, succeeded: 0, failed: 0 }),
      };

      await enqueueJob(db, 'strict', { companyId: 'pas-un-uuid' });
      const job = await claimOne('strict');

      const outcome = await executeJob(job, options(() => handler as unknown as JobHandler<never>));
      expect(outcome.status).toBe('abandoned');

      const { data } = await admin
        .from('job_queue')
        .select('status, last_error, attempts')
        .eq('id', job.id)
        .single();
      // Un payload invalide le restera : aucune tentative supplémentaire.
      expect(data?.status).toBe('dead');
      expect(data?.attempts).toBe(1);
      expect(data?.last_error).toMatch(/Payload invalide/);
    });

    it('replanifie une erreur transitoire', async () => {
      const handler: JobHandler<Record<string, never>> = {
        type: 'flaky',
        schema: z.object({}).loose(),
        run: async () => {
          throw new Error('timeout réseau');
        },
      };

      await enqueueJob(db, 'flaky', {}, { maxAttempts: 3 });
      const job = await claimOne('flaky');

      const outcome = await executeJob(job, options(() => handler as unknown as JobHandler<never>));
      expect(outcome.status).toBe('retrying');

      const { data } = await admin
        .from('job_queue')
        .select('status, last_error')
        .eq('id', job.id)
        .single();
      expect(data?.status).toBe('pending');
      expect(data?.last_error).toBe('timeout réseau');
    });

    it('abandonne immédiatement sur PermanentJobError', async () => {
      const handler: JobHandler<Record<string, never>> = {
        type: 'doomed',
        schema: z.object({}).loose(),
        run: async () => {
          throw new PermanentJobError('entreprise supprimée entre-temps');
        },
      };

      await enqueueJob(db, 'doomed', {}, { maxAttempts: 5 });
      const job = await claimOne('doomed');

      const outcome = await executeJob(job, options(() => handler as unknown as JobHandler<never>));
      expect(outcome.status).toBe('abandoned');

      const { data } = await admin
        .from('job_queue')
        .select('status, attempts')
        .eq('id', job.id)
        .single();
      expect(data?.status).toBe('dead');
      expect(data?.attempts).toBe(1);
    });

    it('marque l’exécution en échec dans job_runs', async () => {
      const handler: JobHandler<Record<string, never>> = {
        type: 'flaky',
        schema: z.object({}).loose(),
        run: async () => {
          throw new Error('disque plein');
        },
      };

      await enqueueJob(db, 'flaky', {});
      const job = await claimOne('flaky');
      await executeJob(job, options(() => handler as unknown as JobHandler<never>));

      const { data } = await admin.from('job_runs').select('status, error').eq('job_id', job.id).single();
      expect(data).toMatchObject({ status: 'failed', error: 'disque plein' });
    });

    it('ne laisse jamais une exception remonter à la boucle du worker', async () => {
      const handler: JobHandler<Record<string, never>> = {
        type: 'explosive',
        schema: z.object({}).loose(),
        run: async () => {
          // Rejet non-Error : le cas que les gestionnaires naïfs oublient.
          throw 'chaîne nue';
        },
      };

      await enqueueJob(db, 'explosive', {});
      const job = await claimOne('explosive');

      await expect(
        executeJob(job, options(() => handler as unknown as JobHandler<never>)),
      ).resolves.toMatchObject({ status: 'retrying' });
    });
  });

  describe('planification', () => {
    it('ne planifie qu’une fois pour une même clé', async () => {
      const first = await enqueueJob(db, 'expire_opportunities', {}, { dedupeKey: 'test:unique' });
      const second = await enqueueJob(db, 'expire_opportunities', {}, { dedupeKey: 'test:unique' });

      expect(first).toBeTypeOf('number');
      expect(second).toBeNull();

      const { count } = await admin
        .from('job_queue')
        .select('id', { count: 'exact', head: true })
        .eq('dedupe_key', 'test:unique');
      expect(count).toBe(1);
    });

    it('planifie sans clé autant de fois que demandé', async () => {
      await enqueueJob(db, 'expire_opportunities', {});
      await enqueueJob(db, 'expire_opportunities', {});

      const { count } = await admin
        .from('job_queue')
        .select('id', { count: 'exact', head: true })
        .eq('job_type', 'expire_opportunities');
      expect(count).toBe(2);
    });

    it('respecte le report dans le futur', async () => {
      await enqueueJob(db, 'expire_opportunities', {}, {
        runAfter: new Date(Date.now() + 3_600_000),
      });
      const claimed = await claimJobs(db, 'worker-test', 10);
      expect(claimed).toHaveLength(0);
    });
  });
});

describe.skipIf(!reachable)('handlers de maintenance', () => {
  let admin: SupabaseClient;
  let db: Db;
  let userId: string;

  beforeAll(async () => {
    admin = serviceClient();
    db = admin as unknown as Db;
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'worker.test');
    userId = await createUser(admin, 'paul@worker.test', 'Paul Freelance');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'worker.test');
  });

  it('expire les opportunités arrivées à terme, et elles seules', async () => {
    const staleCompany = await createCompany(admin);
    const freshCompany = await createCompany(admin);

    // La contrainte opportunities_expiry_after_creation vaut aussi à l'UPDATE :
    // on simule donc une opportunité créée il y a 40 jours et périmée hier,
    // en reculant les deux dates, plutôt qu'une échéance antérieure à sa
    // propre création — qui serait une donnée incohérente.
    const stale = await createOpportunity(admin, staleCompany);
    await admin
      .from('opportunities')
      .update({
        created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .eq('id', stale);

    const fresh = await createOpportunity(admin, freshCompany, {
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const { data: expired } = await admin.rpc('expire_stale_opportunities');
    expect(expired).toBeGreaterThanOrEqual(1);

    const { data: rows } = await admin
      .from('opportunities')
      .select('id, status')
      .in('id', [stale, fresh]);

    const byId = new Map(rows!.map((r) => [r.id, r.status]));
    expect(byId.get(stale)).toBe('expired');
    expect(byId.get(fresh)).toBe('available');
  });

  it('relâche une attribution non contactée et remet l’opportunité en stock', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    const { data: assignment } = await admin
      .from('assignments')
      .insert(
        assignmentPayload(companyId, opportunityId, userId, {
          exclusive_until: new Date(Date.now() - 3_600_000).toISOString(),
        }),
      )
      .select('id')
      .single();

    await admin.from('opportunities').update({ status: 'assigned' }).eq('id', opportunityId);

    const { data: released } = await admin.rpc('expire_stale_assignments');
    expect(released).toBe(1);

    const { data: after } = await admin
      .from('assignments')
      .select('status')
      .eq('id', assignment!.id)
      .single();
    expect(after?.status).toBe('expired');

    const { data: opportunity } = await admin
      .from('opportunities')
      .select('status')
      .eq('id', opportunityId)
      .single();
    expect(opportunity?.status).toBe('available');

    // L'entreprise redevient attribuable : l'index d'exclusivité ne bloque plus.
    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, userId));
    expect(error).toBeNull();
  });

  it('ne relâche pas une attribution déjà contactée', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    const { data: assignment } = await admin
      .from('assignments')
      .insert(
        assignmentPayload(companyId, opportunityId, userId, {
          exclusive_until: new Date(Date.now() - 3_600_000).toISOString(),
          contacted_at: new Date(Date.now() - 7_200_000).toISOString(),
          status: 'contacted',
        }),
      )
      .select('id')
      .single();

    await admin.rpc('expire_stale_assignments');

    const { data: after } = await admin
      .from('assignments')
      .select('status')
      .eq('id', assignment!.id)
      .single();
    expect(after?.status).toBe('contacted');
  });

  it('crée les partitions manquantes de façon idempotente', async () => {
    const { data: first } = await admin.rpc('ensure_month_partitions', {
      months_back: 1,
      months_ahead: 3,
    });
    const { data: second } = await admin.rpc('ensure_month_partitions', {
      months_back: 1,
      months_ahead: 3,
    });

    expect(first).toBe(0); // déjà créées par la migration
    expect(second).toBe(0);
  });
});
