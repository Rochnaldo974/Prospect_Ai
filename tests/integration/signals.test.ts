import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { materializeCreationEvents, runSignalEngine, type Db } from '../../packages/core/src';
import { cleanupEngineTables, serviceClient, supabaseReachable } from './helpers';

/**
 * Moteur de signaux, contre la base.
 *
 * Deux propriétés comptent : la chaîne fait → événement → signal n'est jamais
 * court-circuitée, et le travail se fait par différence — un signal toujours
 * vrai n'est ni recréé ni redaté.
 */
const reachable = await supabaseReachable();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe.skipIf(!reachable)('moteur de signaux', () => {
  let admin: SupabaseClient;
  let db: Db;

  const create = async (over: Record<string, unknown> = {}): Promise<string> => {
    const { data, error } = await admin
      .from('companies')
      .insert({
        legal_name: 'COMMERCE TEST',
        segment: 'local_commerce',
        phone: '+33241222479',
        postal_code: '49000',
        city: 'Angers',
        identity_confidence: 0.95,
        last_seen_at: daysAgo(1).toISOString(),
        ...over,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };

  const activeSignals = async (companyId: string) => {
    const { data } = await admin
      .from('signals')
      .select('signal_type, kind, category, strength, confidence, trigger_event_id, active')
      .eq('company_id', companyId)
      .eq('active', true);
    return data ?? [];
  };

  beforeAll(async () => {
    admin = serviceClient();
    db = admin as unknown as Db;
  });

  beforeEach(async () => {
    await cleanupEngineTables(admin);
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
  });

  describe('chaîne fait → événement → signal', () => {
    it('matérialise la date de création en événement daté', async () => {
      const id = await create({ creation_date: daysAgo(30).toISOString().slice(0, 10) });

      const report = await materializeCreationEvents(db, { limit: 10 });
      expect(report.created).toBe(1);

      const { data: events } = await admin
        .from('company_events')
        .select('event_type, occurred_at')
        .eq('company_id', id);
      expect(events).toHaveLength(1);
      expect(events?.[0]?.event_type).toBe('company_created');
    });

    it('ne matérialise rien deux fois', async () => {
      await create({ creation_date: daysAgo(30).toISOString().slice(0, 10) });

      await materializeCreationEvents(db, { limit: 10 });
      const second = await materializeCreationEvents(db, { limit: 10 });

      expect(second.created).toBe(0);
      expect(second.skipped).toBe(1);
    });

    it('produit un déclencheur adossé à son événement', async () => {
      const id = await create({ creation_date: daysAgo(30).toISOString().slice(0, 10) });
      await runSignalEngine(db, { limit: 10 });

      const signals = await activeSignals(id);
      const trigger = signals.find((s) => s.signal_type === 'company_recently_created');

      expect(trigger).toBeDefined();
      expect(trigger?.kind).toBe('trigger');
      // La contrainte de la base l'impose, et le moteur ne la contourne pas.
      expect(trigger?.trigger_event_id).not.toBeNull();
    });

    it('n’émet aucun déclencheur sans fait daté', async () => {
      const id = await create({ creation_date: null });
      await runSignalEngine(db, { limit: 10 });

      const signals = await activeSignals(id);
      expect(signals.filter((s) => s.kind === 'trigger')).toHaveLength(0);
      // Les modificateurs, eux, décrivent un état et n'ont pas besoin de date.
      expect(signals.filter((s) => s.kind === 'modifier').length).toBeGreaterThan(0);
    });
  });

  describe('travail par différence', () => {
    it('ne recrée pas un signal toujours vrai', async () => {
      await create({ creation_date: daysAgo(30).toISOString().slice(0, 10) });

      const first = await runSignalEngine(db, { limit: 10 });
      expect(first.created).toBeGreaterThan(0);
      expect(first.unchanged).toBe(0);

      const second = await runSignalEngine(db, { limit: 10 });
      expect(second.created).toBe(0);
      expect(second.unchanged).toBe(first.created);
      expect(second.deactivated).toBe(0);
    });

    it('préserve la date de détection d’un signal inchangé', async () => {
      const id = await create({ creation_date: daysAgo(30).toISOString().slice(0, 10) });
      await runSignalEngine(db, { limit: 10 });

      const { data: before } = await admin
        .from('signals')
        .select('id, detected_at')
        .eq('company_id', id)
        .eq('signal_type', 'active_business')
        .single();

      await runSignalEngine(db, { limit: 10 });

      const { data: after } = await admin
        .from('signals')
        .select('id, detected_at')
        .eq('company_id', id)
        .eq('signal_type', 'active_business')
        .single();

      // Redater un signal inchangé ferait refléter la dernière exécution du
      // moteur au lieu du moment où le fait a été constaté.
      expect(after?.id).toBe(before?.id);
      expect(after?.detected_at).toBe(before?.detected_at);
    });

    it('désactive un signal devenu faux sans le supprimer', async () => {
      const id = await create({ identity_confidence: 0.4 });
      await runSignalEngine(db, { limit: 10 });
      expect((await activeSignals(id)).some((s) => s.signal_type === 'weak_identity')).toBe(true);

      await admin.from('companies').update({ identity_confidence: 0.98 }).eq('id', id);
      const report = await runSignalEngine(db, { limit: 10 });

      expect(report.deactivated).toBeGreaterThanOrEqual(1);
      expect((await activeSignals(id)).some((s) => s.signal_type === 'weak_identity')).toBe(false);

      // L'historique explique pourquoi une opportunité passée avait été créée.
      const { data: all } = await admin
        .from('signals')
        .select('signal_type, active')
        .eq('company_id', id)
        .eq('signal_type', 'weak_identity');
      expect(all).toHaveLength(1);
      expect(all?.[0]?.active).toBe(false);
    });
  });

  describe('règles produit', () => {
    it('n’examine pas une entreprise exclue de la prospection', async () => {
      const id = await create({
        suppression_global: true,
        suppression_reason: 'opposition explicite',
      });
      await runSignalEngine(db, { limit: 10 });
      expect(await activeSignals(id)).toHaveLength(0);
    });

    it('n’examine pas une entreprise fermée', async () => {
      const id = await create({ company_status: 'closed' });
      await runSignalEngine(db, { limit: 10 });
      expect(await activeSignals(id)).toHaveLength(0);
    });

    it('signale un site partagé comme un risque, pas comme un besoin', async () => {
      await admin.from('domains').insert({ domain: 'reseau.fr', status: 'reachable' });
      await create({ legal_name: 'MAGASIN A', domain: 'reseau.fr' });
      const b = await create({ legal_name: 'MAGASIN B', domain: 'reseau.fr' });

      await runSignalEngine(db, { limit: 10 });

      const shared = (await activeSignals(b)).find((s) => s.signal_type === 'shared_domain');
      expect(shared).toBeDefined();
      // Le gérant d'un magasin d'enseigne n'a aucune prise sur le site du réseau.
      expect(shared?.category).toBe('risk');
    });

    it('ne mesure rien sans écrire en simulation', async () => {
      await create({ creation_date: daysAgo(30).toISOString().slice(0, 10) });

      const report = await runSignalEngine(db, { limit: 10, dryRun: true });
      expect(report.examined).toBeGreaterThan(0);

      const { count } = await admin.from('signals').select('id', { count: 'exact', head: true });
      expect(count).toBe(0);
    });
  });
});
