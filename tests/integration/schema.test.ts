import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupEngineTables,
  createCompany,
  createOpportunity,
  createUser,
  deleteTestUsers,
  serviceClient,
  supabaseReachable,
} from './helpers';

/** Garanties structurelles du schéma métier. */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('schéma du moteur', () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    admin = serviceClient();
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'schema.test');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'schema.test');
  });

  describe('identité des entreprises', () => {
    it('interdit deux entreprises sur le même SIREN', async () => {
      await createCompany(admin, { siren: '123456789' });
      const { error } = await admin
        .from('companies')
        .insert({ legal_name: 'Doublon', siren: '123456789' });
      expect(error?.code).toBe('23505');
    });

    it('interdit deux entreprises sur le même domaine', async () => {
      await createCompany(admin, { domain: 'restaurantdupont.fr' });
      const { error } = await admin
        .from('companies')
        .insert({ legal_name: 'Doublon domaine', domain: 'restaurantdupont.fr' });
      expect(error?.code).toBe('23505');
    });

    it('refuse un SIRET incohérent avec son SIREN', async () => {
      const { error } = await admin.from('companies').insert({
        legal_name: 'Incohérente',
        siren: '111111111',
        siret: '22222222200015',
      });
      expect(error?.message).toMatch(/companies_siret_matches_siren/);
    });

    it('refuse un SIREN mal formé', async () => {
      const { error } = await admin
        .from('companies')
        .insert({ legal_name: 'Mauvais SIREN', siren: '12A45' });
      expect(error?.message).toMatch(/companies_siren_format/);
    });

    it('refuse une latitude sans longitude', async () => {
      const { error } = await admin
        .from('companies')
        .insert({ legal_name: 'Géo incomplète', lat: 48.85 });
      expect(error?.message).toMatch(/companies_geo_complete/);
    });

    it('exige un motif pour toute mise en suppression', async () => {
      const { error } = await admin
        .from('companies')
        .insert({ legal_name: 'Supprimée sans motif', suppression_global: true });
      expect(error?.message).toMatch(/companies_suppression_has_reason/);
    });

    it('calcule has_contact depuis le téléphone ou le formulaire', async () => {
      const withPhone = await createCompany(admin, { phone: '+33199887766' });
      const withForm = await createCompany(admin, {
        phone: null,
        contact_form_url: 'https://exemple.fr/contact',
      });
      const withNothing = await createCompany(admin, { phone: null });

      const { data } = await admin
        .from('companies')
        .select('id, has_contact')
        .in('id', [withPhone, withForm, withNothing]);

      const byId = new Map(data!.map((r) => [r.id, r.has_contact]));
      expect(byId.get(withPhone)).toBe(true);
      expect(byId.get(withForm)).toBe(true);
      expect(byId.get(withNothing)).toBe(false);
    });
  });

  describe('opportunités', () => {
    it('interdit deux opportunités vivantes du même type sur une entreprise', async () => {
      const companyId = await createCompany(admin);
      await createOpportunity(admin, companyId, { opportunity_type: 'website_redesign' });

      const { error } = await admin.from('opportunities').insert({
        company_id: companyId,
        opportunity_type: 'website_redesign',
        need_score: 60,
        timing_score: 60,
        freshness_factor: 0.8,
        confidence_score: 0.7,
        base_score: 60,
        algorithm_version: 'v0',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(error?.code).toBe('23505');
    });

    it('autorise plusieurs types d’opportunité sur la même entreprise', async () => {
      const companyId = await createCompany(admin);
      await createOpportunity(admin, companyId, { opportunity_type: 'website_redesign' });
      const { error } = await admin.from('opportunities').insert({
        company_id: companyId,
        opportunity_type: 'ecommerce',
        need_score: 70,
        timing_score: 65,
        freshness_factor: 0.9,
        confidence_score: 0.8,
        base_score: 66,
        algorithm_version: 'v0',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(error).toBeNull();
    });

    it('rejette un facteur de fraîcheur hors de ]0, 1]', async () => {
      const companyId = await createCompany(admin);
      const { error } = await admin.from('opportunities').insert({
        company_id: companyId,
        opportunity_type: 'seo',
        need_score: 70,
        timing_score: 65,
        freshness_factor: 1.4,
        confidence_score: 0.8,
        base_score: 66,
        algorithm_version: 'v0',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(error?.message).toMatch(/freshness_factor/);
    });
  });

  describe('signaux', () => {
    it('exige un événement déclencheur pour un signal de type trigger', async () => {
      const companyId = await createCompany(admin);
      const { error } = await admin.from('signals').insert({
        company_id: companyId,
        signal_type: 'company_recently_created',
        kind: 'trigger',
        category: 'timing',
        strength: 0.9,
        confidence: 0.95,
        source: 'sirene',
        fingerprint: 'recent:1',
      });
      expect(error?.message).toMatch(/signals_trigger_needs_event/);
    });

    it('n’exige rien de tel pour un signal modificateur', async () => {
      const companyId = await createCompany(admin);
      const { error } = await admin.from('signals').insert({
        company_id: companyId,
        signal_type: 'weak_website',
        kind: 'modifier',
        category: 'need',
        strength: 0.7,
        confidence: 0.8,
        source: 'cheap_scan',
        fingerprint: 'weak:1',
      });
      expect(error).toBeNull();
    });

    it('empêche de recréer le même signal actif sur une entreprise', async () => {
      const companyId = await createCompany(admin);
      const signal = {
        company_id: companyId,
        signal_type: 'slow_website',
        kind: 'modifier' as const,
        category: 'need' as const,
        strength: 0.6,
        confidence: 0.9,
        source: 'cheap_scan',
        fingerprint: 'slow:ttfb>3000',
      };
      await admin.from('signals').insert(signal);
      const { error } = await admin.from('signals').insert(signal);
      expect(error?.code).toBe('23505');
    });
  });

  describe('événements partitionnés', () => {
    it('route une insertion vers la partition du mois', async () => {
      const companyId = await createCompany(admin);
      const { error } = await admin.from('company_events').insert({
        company_id: companyId,
        event_type: 'company_created',
        source: 'sirene',
        importance: 90,
        occurred_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      });
      expect(error).toBeNull();

      const { data } = await admin
        .from('company_events')
        .select('event_type')
        .eq('company_id', companyId);
      expect(data).toHaveLength(1);
    });

    it('déduplique les événements par dedupe_key', async () => {
      const companyId = await createCompany(admin);
      const event = {
        company_id: companyId,
        event_type: 'new_domain_registered',
        source: 'afnic',
        dedupe_key: `afnic:${companyId}:exemple.fr`,
      };
      const first = await admin.from('company_events').insert(event);
      expect(first.error).toBeNull();

      const second = await admin.from('company_events').insert(event);
      expect(second.error?.code).toBe('23505');
    });
  });

  describe('configuration du scoring', () => {
    it('n’autorise qu’une seule version active', async () => {
      const { error } = await admin.from('scoring_config').insert({
        version: 'v1-test',
        weights: {},
        half_lives: {},
        thresholds: {},
        active: true,
      });
      expect(error?.code).toBe('23505');
    });

    it('expose la version v0 comme active', async () => {
      const { data } = await admin
        .from('scoring_config')
        .select('version, thresholds')
        .eq('active', true)
        .single();
      expect(data?.version).toBe('v0');
      expect(data?.thresholds).toMatchObject({ exclusivity_hours: 72, min_confidence: 0.6 });
    });
  });

  describe('préférences utilisateur', () => {
    it('crée les préférences en même temps que le profil', async () => {
      const userId = await createUser(admin, 'julie@schema.test', 'Julie Design');
      const { data } = await admin
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      expect(data).toMatchObject({ location_mode: 'france', services: [] });
    });

    it('refuse un mode local sans ville ni région', async () => {
      const userId = await createUser(admin, 'marc@schema.test', 'Marc Web');
      const { error } = await admin
        .from('user_preferences')
        .update({ location_mode: 'city', city: null, region: null })
        .eq('user_id', userId);
      expect(error?.message).toMatch(/local_needs_place/);
    });
  });
});
