import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  companyFiltersSchema,
  getCompanyDetail,
  getFilterOptions,
  listCompanies,
  type Db,
} from '../../packages/core/src/companies';
import {
  anonClient,
  cleanupEngineTables,
  createCompany,
  createOpportunity,
  createUser,
  deleteTestUsers,
  serviceClient,
  signInAs,
  supabaseReachable,
} from './helpers';

/**
 * Console d'administration : agrégats, filtres et surtout étanchéité.
 * Les vues admin exposent tout le moteur — elles ne doivent être lisibles
 * que par service_role.
 */
const reachable = await supabaseReachable();
const parse = (input: Record<string, string>) => companyFiltersSchema.parse(input);

describe.skipIf(!reachable)('console admin', () => {
  let admin: SupabaseClient;
  let db: Db;
  let userId: string;
  let withSiteId: string;
  let withoutSiteId: string;
  let suppressedId: string;
  let cooledId: string;
  let assignedId: string;

  beforeAll(async () => {
    admin = serviceClient();
    db = admin as unknown as Db;

    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'admin.test');
    userId = await createUser(admin, 'paul@admin.test', 'Paul Freelance');

    withSiteId = await createCompany(admin, {
      legal_name: 'AVEC SITE SARL',
      commercial_name: 'Boulangerie Zola',
      domain: 'boulangeriezola.fr',
      website_url: 'https://boulangeriezola.fr',
      city: 'Lyon',
      postal_code: '69003',
      industry_code: '1071C',
    });
    withoutSiteId = await createCompany(admin, {
      legal_name: 'SANS SITE SARL',
      city: 'Lille',
      postal_code: '59000',
      phone: '+33320000001',
    });
    suppressedId = await createCompany(admin, {
      legal_name: 'SUPPRIMEE SARL',
      suppression_global: true,
      suppression_reason: 'opposition explicite',
    });
    cooledId = await createCompany(admin, { legal_name: 'COOLDOWN SARL' });
    assignedId = await createCompany(admin, { legal_name: 'ATTRIBUEE SARL' });

    // Sources, signaux et opportunités pour vérifier les agrégats.
    await admin.from('company_sources').insert([
      {
        company_id: withSiteId,
        source_name: 'sirene',
        source_external_id: `test-sirene-${withSiteId}`,
        raw_payload: { ok: true },
        confidence: 0.99,
      },
      {
        company_id: withSiteId,
        source_name: 'openstreetmap',
        source_external_id: `test-osm-${withSiteId}`,
        raw_payload: { ok: true },
        confidence: 0.8,
      },
    ]);

    const { data: event } = await admin
      .from('company_events')
      .insert({
        company_id: withSiteId,
        event_type: 'website_changed',
        source: 'cheap_scan',
        dedupe_key: `test:changed:${withSiteId}`,
      })
      .select('id')
      .single();

    await admin.from('signals').insert([
      {
        company_id: withSiteId,
        signal_type: 'website_changed',
        kind: 'trigger',
        category: 'timing',
        strength: 0.8,
        confidence: 0.9,
        source: 'test',
        trigger_event_id: event!.id,
        evidence: [],
        fingerprint: `trigger:${withSiteId}`,
      },
      {
        company_id: withSiteId,
        signal_type: 'outdated_stack',
        kind: 'modifier',
        category: 'need',
        strength: 0.7,
        confidence: 0.85,
        source: 'test',
        trigger_event_id: null,
        evidence: [],
        fingerprint: `modifier:${withSiteId}`,
      },
    ]);

    await createOpportunity(admin, withSiteId, {
      opportunity_type: 'website_redesign',
      base_score: 82,
    });
    await createOpportunity(admin, withSiteId, {
      opportunity_type: 'seo',
      base_score: 41,
    });
    await createOpportunity(admin, withoutSiteId, {
      opportunity_type: 'website_creation',
      base_score: 74,
    });

    await admin.from('company_cooldowns').insert({
      company_id: cooledId,
      reason: 'no_response',
      ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });

    const assignedOpportunity = await createOpportunity(admin, assignedId, { base_score: 65 });
    await admin.from('assignments').insert({
      company_id: assignedId,
      opportunity_id: assignedOpportunity,
      user_id: userId,
      rank: 1,
      match_score: 65,
      exclusive_until: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'admin.test');
  });

  describe('agrégats de la vue', () => {
    it('compte les signaux actifs et les déclencheurs séparément', async () => {
      const { rows } = await listCompanies(db, parse({ q: 'AVEC SITE' }));
      expect(rows[0]).toMatchObject({ active_signal_count: 2, trigger_signal_count: 1 });
    });

    it('rassemble les sources sans doublon', async () => {
      const { rows } = await listCompanies(db, parse({ q: 'AVEC SITE' }));
      expect(rows[0]?.source_names).toEqual(['openstreetmap', 'sirene']);
    });

    it('retient la meilleure opportunité disponible', async () => {
      const { rows } = await listCompanies(db, parse({ q: 'AVEC SITE' }));
      expect(rows[0]).toMatchObject({
        opportunity_count: 2,
        best_opportunity_score: 82,
        best_opportunity_type: 'website_redesign',
      });
    });

    it('signale l’attribution vivante', async () => {
      const { rows } = await listCompanies(db, parse({ q: 'ATTRIBUEE' }));
      expect(rows[0]?.assigned_user_id).toBe(userId);
      expect(rows[0]?.assignment_status).toBe('active');
    });

    it('signale le cooldown actif', async () => {
      const { rows } = await listCompanies(db, parse({ q: 'COOLDOWN' }));
      expect(rows[0]?.in_cooldown).toBe(true);
    });
  });

  describe('filtres', () => {
    it('sépare les entreprises avec et sans site', async () => {
      const withSite = await listCompanies(db, parse({ website: 'with' }));
      const withoutSite = await listCompanies(db, parse({ website: 'without' }));

      expect(withSite.rows.map((r) => r.id)).toContain(withSiteId);
      expect(withSite.rows.map((r) => r.id)).not.toContain(withoutSiteId);
      expect(withoutSite.rows.map((r) => r.id)).toContain(withoutSiteId);
    });

    it('isole les entreprises exclues de la prospection', async () => {
      const excluded = await listCompanies(db, parse({ prospectable: 'no' }));
      expect(excluded.rows.map((r) => r.id)).toContain(suppressedId);

      const allowed = await listCompanies(db, parse({ prospectable: 'yes' }));
      expect(allowed.rows.map((r) => r.id)).not.toContain(suppressedId);
    });

    it('filtre sur le cooldown', async () => {
      const inCooldown = await listCompanies(db, parse({ cooldown: 'yes' }));
      expect(inCooldown.rows.map((r) => r.id)).toEqual([cooledId]);
    });

    it('filtre sur l’attribution', async () => {
      const assigned = await listCompanies(db, parse({ assigned: 'yes' }));
      expect(assigned.rows.map((r) => r.id)).toEqual([assignedId]);
    });

    it('applique le seuil de score', async () => {
      const above = await listCompanies(db, parse({ minScore: '80' }));
      expect(above.rows.map((r) => r.id)).toEqual([withSiteId]);
    });

    it('filtre sur le type d’opportunité dominant', async () => {
      const creation = await listCompanies(db, parse({ opportunity: 'website_creation' }));
      expect(creation.rows.map((r) => r.id)).toEqual([withoutSiteId]);
    });

    it('cherche par nom, domaine et ville', async () => {
      const byDomain = await listCompanies(db, parse({ q: 'boulangeriezola' }));
      const byCity = await listCompanies(db, parse({ q: 'Lille' }));
      expect(byDomain.rows.map((r) => r.id)).toEqual([withSiteId]);
      expect(byCity.rows.map((r) => r.id)).toEqual([withoutSiteId]);
    });

    it('ne casse pas sur une recherche contenant une virgule', async () => {
      // La syntaxe `or` de PostgREST utilise la virgule comme séparateur.
      const result = await listCompanies(db, parse({ q: 'Zola, Lyon' }));
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('retombe sur les valeurs par défaut si un paramètre est invalide', () => {
      const filters = parse({ sort: 'n’importe quoi', page: '-4', minScore: '999' });
      expect(filters.sort).toBe('score');
      expect(filters.page).toBe(1);
      expect(filters.minScore).toBeUndefined();
    });
  });

  describe('fiche détaillée', () => {
    it('rassemble toutes les sections', async () => {
      const detail = await getCompanyDetail(db, withSiteId);
      expect(detail?.company.legal_name).toBe('AVEC SITE SARL');
      expect(detail?.sources).toHaveLength(2);
      expect(detail?.signals).toHaveLength(2);
      expect(detail?.opportunities).toHaveLength(2);
      expect(detail?.events).toHaveLength(1);
    });

    it('renvoie null pour un identifiant inconnu', async () => {
      const detail = await getCompanyDetail(db, '00000000-0000-0000-0000-000000000000');
      expect(detail).toBeNull();
    });

    it('liste les valeurs de filtre disponibles', async () => {
      const options = await getFilterOptions(db);
      expect(options.cities).toContain('Lyon');
      expect(options.sources).toContain('sirene');
      expect(options.industries.some((i) => i.code === '1071C')).toBe(true);
    });
  });

  describe('étanchéité', () => {
    it('rend les vues admin inaccessibles à un utilisateur connecté', async () => {
      const asPaul = await signInAs('paul@admin.test');

      for (const view of ['admin_company_overview', 'admin_stats', 'admin_inventory']) {
        const { data, error } = await asPaul.from(view).select('*');
        expect(data, `${view} ne doit rien renvoyer`).toBeNull();
        expect(error, `${view} doit refuser l'accès`).not.toBeNull();
      }
    });

    it('rend les vues admin inaccessibles à un visiteur anonyme', async () => {
      const anon = anonClient();
      const { data, error } = await anon.from('admin_company_overview').select('*');
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it('rend companies inaccessible à un utilisateur connecté', async () => {
      const asPaul = await signInAs('paul@admin.test');
      const { data, error } = await asPaul.from('companies').select('id');
      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
    });
  });
});
