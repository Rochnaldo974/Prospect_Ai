import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { serviceClient, supabaseReachable } from './helpers';

/**
 * File de jobs : c'est le socle de tout le pipeline. Si deux workers peuvent
 * réclamer le même job, chaque étape en aval est doublée — scans, appels
 * payants, opportunités.
 */
const reachable = await supabaseReachable();

interface Job {
  id: number;
  job_type: string;
  status: string;
  attempts: number;
  locked_by: string | null;
  run_after: string;
  last_error: string | null;
}

describe.skipIf(!reachable)('file de jobs', () => {
  let admin: SupabaseClient;

  const enqueue = async (rows: Record<string, unknown>[]) => {
    const { error } = await admin.from('job_queue').insert(rows);
    if (error) throw new Error(error.message);
  };

  const claim = async (client: SupabaseClient, worker: string, batch = 10): Promise<Job[]> => {
    const { data, error } = await client.rpc('claim_jobs', {
      worker,
      batch_size: batch,
      types: null,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Job[];
  };

  beforeAll(async () => {
    admin = serviceClient();
  });

  beforeEach(async () => {
    await admin.from('job_queue').delete().neq('id', 0);
  });

  afterAll(async () => {
    await admin.from('job_queue').delete().neq('id', 0);
  });

  it('réclame un job et le passe en running', async () => {
    await enqueue([{ job_type: 'cheap_web_scan', payload: { company_id: 'x' } }]);

    const claimed = await claim(admin, 'worker-1');
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ status: 'running', locked_by: 'worker-1', attempts: 1 });
  });

  it('ne réclame jamais le même job depuis deux workers concurrents', async () => {
    await enqueue(
      Array.from({ length: 40 }, (_, i) => ({
        job_type: 'cheap_web_scan',
        payload: { n: i },
      })),
    );

    const workers = Array.from({ length: 4 }, () => serviceClient());
    const batches = await Promise.all(
      workers.map((client, i) => claim(client, `worker-${i}`, 10)),
    );

    const ids = batches.flat().map((j) => j.id);
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40); // aucun doublon
  });

  it('respecte l’ordre de priorité', async () => {
    await enqueue([
      { job_type: 'refresh_stale', priority: 10 },
      { job_type: 'discover', priority: 95 },
      { job_type: 'detect_signals', priority: 60 },
    ]);

    const claimed = await claim(admin, 'worker-1', 3);
    expect(claimed.map((j) => j.job_type)).toEqual(['discover', 'detect_signals', 'refresh_stale']);
  });

  it('ne réclame pas un job planifié dans le futur', async () => {
    // Insertion en un seul lot : PostgREST met à null les colonnes absentes
    // d'une ligne mais présentes dans une autre, il faut donc les expliciter.
    await enqueue([
      { job_type: 'plus_tard', run_after: new Date(Date.now() + 3_600_000).toISOString() },
      { job_type: 'maintenant', run_after: new Date().toISOString() },
    ]);

    const claimed = await claim(admin, 'worker-1');
    expect(claimed.map((j) => j.job_type)).toEqual(['maintenant']);
  });

  it('filtre par type de job quand on le demande', async () => {
    await enqueue([{ job_type: 'cheap_web_scan' }, { job_type: 'deep_web_scan' }]);

    const { data } = await admin.rpc('claim_jobs', {
      worker: 'worker-scan',
      batch_size: 10,
      types: ['deep_web_scan'],
    });
    expect((data as Job[]).map((j) => j.job_type)).toEqual(['deep_web_scan']);
  });

  it('empêche de planifier deux fois le même travail', async () => {
    const job = { job_type: 'cheap_web_scan', dedupe_key: 'scan:cheap:abc:2026-08-27' };
    await enqueue([job]);
    const { error } = await admin.from('job_queue').insert(job);
    expect(error?.code).toBe('23505');
  });

  it('marque un job terminé', async () => {
    await enqueue([{ job_type: 'cheap_web_scan' }]);
    const [job] = await claim(admin, 'worker-1');

    await admin.rpc('complete_job', { job_id: job!.id });

    const { data } = await admin
      .from('job_queue')
      .select('status, locked_by, completed_at')
      .eq('id', job!.id)
      .single();
    expect(data).toMatchObject({ status: 'done', locked_by: null });
    expect(data?.completed_at).not.toBeNull();
  });

  it('replanifie un échec avec un délai croissant', async () => {
    await enqueue([{ job_type: 'cheap_web_scan', max_attempts: 3 }]);
    const [job] = await claim(admin, 'worker-1');

    await admin.rpc('fail_job', { job_id: job!.id, error_message: 'timeout DNS' });

    const { data } = await admin
      .from('job_queue')
      .select('status, attempts, last_error, run_after, locked_by')
      .eq('id', job!.id)
      .single();

    expect(data).toMatchObject({ status: 'pending', attempts: 1, last_error: 'timeout DNS', locked_by: null });
    expect(new Date(data!.run_after).getTime()).toBeGreaterThan(Date.now());
  });

  it('abandonne un job après épuisement des tentatives', async () => {
    await enqueue([{ job_type: 'cheap_web_scan', max_attempts: 2 }]);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      // Ramène le job en file immédiatement pour enchaîner les tentatives.
      await admin.from('job_queue').update({ run_after: new Date().toISOString() }).neq('id', 0);
      const [job] = await claim(admin, 'worker-1');
      await admin.rpc('fail_job', { job_id: job!.id, error_message: `échec ${attempt}` });
    }

    const { data } = await admin.from('job_queue').select('status, attempts, last_error').single();
    expect(data).toMatchObject({ status: 'dead', attempts: 2, last_error: 'échec 2' });
  });

  it('reprend les jobs abandonnés par un worker mort', async () => {
    await enqueue([{ job_type: 'cheap_web_scan' }, { job_type: 'deep_web_scan' }]);
    await claim(admin, 'worker-tué', 2);

    // Simule un verrou pris il y a longtemps.
    await admin
      .from('job_queue')
      .update({ locked_at: new Date(Date.now() - 3_600_000).toISOString() })
      .eq('status', 'running');

    const { data: reclaimed } = await admin.rpc('reclaim_stalled_jobs', {
      stalled_after: '00:15:00',
    });
    expect(reclaimed).toBe(2);

    const { data } = await admin.from('job_queue').select('status, locked_by');
    expect(data?.every((j) => j.status === 'pending' && j.locked_by === null)).toBe(true);
  });

  it('ne reprend pas un job verrouillé récemment', async () => {
    await enqueue([{ job_type: 'cheap_web_scan' }]);
    await claim(admin, 'worker-vivant');

    const { data: reclaimed } = await admin.rpc('reclaim_stalled_jobs', {
      stalled_after: '00:15:00',
    });
    expect(reclaimed).toBe(0);
  });
});
