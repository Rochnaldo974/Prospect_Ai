import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  decideDuplicate,
  detectDuplicates,
  getDuplicateCounts,
  listPendingDuplicates,
  type Db,
} from '../../packages/core/src';
import { cleanupEngineTables, serviceClient, supabaseReachable } from './helpers';

/**
 * Déduplication approchée.
 *
 * Les cas qui comptent sont ceux où le moteur doit REFUSER de fusionner : une
 * fusion abusive détruit de la donnée et fait disparaître un prospect, alors
 * qu'un doublon subsistant ne coûte qu'une ligne.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('déduplication', () => {
  let admin: SupabaseClient;
  let db: Db;

  const create = async (over: Record<string, unknown>): Promise<string> => {
    const { data, error } = await admin
      .from('companies')
      .insert({ legal_name: 'SANS NOM', segment: 'local_commerce', ...over })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };

  const candidatesFor = async (id: string, minScore = 0.5) => {
    const { data, error } = await admin.rpc('find_duplicate_candidates', {
      target_id: id,
      min_score: minScore,
      max_results: 10,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  const countCompanies = async (): Promise<number> => {
    const { count } = await admin.from('companies').select('id', { count: 'exact', head: true });
    return count ?? 0;
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

  describe('normalisation des noms', () => {
    it('produit la même clé que la version TypeScript', async () => {
      // Les deux implémentations doivent rester alignées : celle de la base
      // sert au blocage indexé, celle de TypeScript aux comparaisons en mémoire.
      const cases: [string, string][] = [
        ['SARL Boulangerie DUPONT', 'boulangerie dupont'],
        ['DUPONT SAS', 'dupont'],
        ['Établissements Martin EURL', 'martin'],
        ['Café de l’Étoile', 'cafe de l etoile'],
        ['DUPONT & FILS', 'dupont et fils'],
        ['  Le   Fournil  ', 'le fournil'],
        ['SARL', ''],
      ];

      for (const [input, expected] of cases) {
        const { data } = await admin.rpc('normalize_name_key', { input });
        expect(data ?? '', input).toBe(expected === '' ? '' : expected);
      }
    });
  });

  describe('détection', () => {
    it('rapproche deux fiches du même commerce', async () => {
      const a = await create({
        legal_name: 'BOULANGERIE MOREAU',
        phone: '+33241222479',
        postal_code: '49000',
        city: 'Angers',
        lat: 47.4784,
        lon: -0.5632,
      });
      await create({
        legal_name: 'Boulangerie Moreau SARL',
        phone: '+33241222479',
        postal_code: '49000',
        city: 'Angers',
        lat: 47.4784,
        lon: -0.5632,
      });

      const candidates = await candidatesFor(a);
      expect(candidates).toHaveLength(1);
      expect(Number(candidates[0]!.score)).toBeGreaterThanOrEqual(0.9);
      expect(candidates[0]!.evidence).toMatchObject({ phone: true, postal: true });
    });

    it('refuse de rapprocher deux SIRET différents, même identiques par ailleurs', async () => {
      // Un centre commercial aligne des enseignes voisines à la même adresse.
      const a = await create({
        legal_name: 'CARREFOUR CITY',
        siret: '55210055400013',
        siren: '552100554',
        phone: '+33241222479',
        postal_code: '49000',
        address: '1 place du ralliement',
        lat: 47.4784,
        lon: -0.5632,
      });
      await create({
        legal_name: 'CARREFOUR CITY',
        siret: '55210055400021',
        siren: '552100554',
        phone: '+33241222479',
        postal_code: '49000',
        address: '1 place du ralliement',
        lat: 47.4784,
        lon: -0.5632,
      });

      expect(await candidatesFor(a, 0.1)).toHaveLength(0);
    });

    it('refuse de rapprocher deux SIREN différents', async () => {
      const a = await create({
        legal_name: 'LE FOURNIL',
        siren: '552100554',
        phone: '+33241222479',
        postal_code: '49000',
      });
      await create({
        legal_name: 'LE FOURNIL',
        siren: '380129866',
        phone: '+33241222479',
        postal_code: '49000',
      });

      expect(await candidatesFor(a, 0.1)).toHaveLength(0);
    });

    it('ne rapproche pas deux commerces homonymes de villes différentes', async () => {
      // « Boulangerie Martin » existe dans chaque ville de France : le nom
      // seul ne doit jamais suffire.
      const a = await create({ legal_name: 'BOULANGERIE MARTIN', postal_code: '49000', city: 'Angers' });
      await create({ legal_name: 'BOULANGERIE MARTIN', postal_code: '75011', city: 'Paris' });

      expect(await candidatesFor(a, REVIEW)).toHaveLength(0);
    });

    it('ne rapproche pas deux commerces distincts de la même rue', async () => {
      const a = await create({
        legal_name: 'BOULANGERIE MOREAU',
        postal_code: '49000',
        address: '12 rue bressigny',
        lat: 47.4700,
        lon: -0.5500,
      });
      await create({
        legal_name: 'GARAGE DUBOIS',
        postal_code: '49000',
        address: '12 rue bressigny',
        lat: 47.4700,
        lon: -0.5500,
      });

      // Même adresse, mais des noms sans rapport : sous le seuil de revue.
      const candidates = await candidatesFor(a, REVIEW);
      expect(candidates).toHaveLength(0);
    });

    it('ne signale pas deux enseignes d’un même réseau à la même adresse', async () => {
      // « Carrefour City » et « Carrefour Market » ont une similarité de 0,476.
      // C'est la zone dangereuse : une pondération linéaire du nom leur
      // accorderait presque autant qu'à une correspondance franche.
      const a = await create({
        legal_name: 'Carrefour City',
        postal_code: '49000',
        address: '1 place du ralliement',
        lat: 47.4784,
        lon: -0.5632,
        industry_code: '47.11B',
      });
      await create({
        legal_name: 'Carrefour Market',
        postal_code: '49000',
        address: '1 place du ralliement',
        lat: 47.4784,
        lon: -0.5632,
        industry_code: '47.11B',
      });

      expect(await candidatesFor(a, REVIEW)).toHaveLength(0);
    });

    it('rapproche deux relevés du même point de vente à quelques mètres', async () => {
      const a = await create({
        legal_name: 'Le Fournil de la Gare',
        postal_code: '49000',
        lat: 47.4784,
        lon: -0.5632,
        industry_code: '10.71C',
      });
      await create({
        legal_name: 'Fournil de la Gare',
        postal_code: '49000',
        lat: 47.47845,
        lon: -0.56325,
        industry_code: '10.71C',
      });

      const candidates = await candidatesFor(a, REVIEW);
      expect(candidates).toHaveLength(1);
      expect(Number(candidates[0]!.evidence.distance_m)).toBeLessThan(30);
    });
  });

  describe('fusion', () => {
    it('conserve l’identité la mieux établie', async () => {
      const pauvre = await create({ legal_name: 'MOREAU', postal_code: '49000' });
      const riche = await create({
        legal_name: 'BOULANGERIE MOREAU',
        siret: '55210055400013',
        siren: '552100554',
        postal_code: '49000',
        phone: '+33241222479',
      });

      const { data: survivor } = await admin.rpc('pick_merge_survivor', {
        a_id: pauvre,
        b_id: riche,
      });
      expect(survivor).toBe(riche);
    });

    it('transfère tout ce qui pend à l’absorbée', async () => {
      const survivor = await create({ legal_name: 'SURVIVANTE', postal_code: '49000' });
      const absorbed = await create({ legal_name: 'ABSORBEE', postal_code: '49000', phone: '+33241222479' });

      await admin.from('company_sources').insert({
        company_id: absorbed,
        source_name: 'test-source',
        source_external_id: 'ext-1',
        raw_payload: { ok: true },
      });
      const { data: event } = await admin
        .from('company_events')
        .insert({ company_id: absorbed, event_type: 'test', source: 'test' })
        .select('id')
        .single();
      await admin.from('signals').insert({
        company_id: absorbed,
        signal_type: 'test_signal',
        kind: 'trigger',
        category: 'timing',
        strength: 0.8,
        confidence: 0.9,
        source: 'test',
        trigger_event_id: event!.id,
        fingerprint: 'fp-absorbed',
      });

      await admin.rpc('merge_companies', {
        p_survivor_id: survivor,
        p_absorbed_id: absorbed,
        p_score: 0.95,
        p_evidence: [],
        p_decided_by: 'test',
      });

      const { data: sources } = await admin.from('company_sources').select('company_id');
      const { data: signals } = await admin.from('signals').select('company_id');
      const { data: events } = await admin.from('company_events').select('company_id');

      expect(sources?.every((s) => s.company_id === survivor)).toBe(true);
      expect(signals?.every((s) => s.company_id === survivor)).toBe(true);
      expect(events?.every((e) => e.company_id === survivor)).toBe(true);

      // Le survivant hérite du téléphone qui lui manquait.
      const { data: after } = await admin.from('companies').select('phone').eq('id', survivor).single();
      expect(after?.phone).toBe('+33241222479');

      expect(await countCompanies()).toBe(1);
    });

    it('conserve une trace exploitable de l’absorbée', async () => {
      const survivor = await create({ legal_name: 'SURVIVANTE', postal_code: '49000' });
      const absorbed = await create({ legal_name: 'ABSORBEE', postal_code: '49000' });

      await admin.rpc('merge_companies', {
        p_survivor_id: survivor,
        p_absorbed_id: absorbed,
        p_score: 0.93,
        p_evidence: [{ phone: true }],
        p_decided_by: 'test',
      });

      const { data: merge } = await admin.from('company_merges').select('*').single();
      expect(merge).toMatchObject({
        survivor_id: survivor,
        absorbed_id: absorbed,
        decided_by: 'test',
      });
      expect((merge?.absorbed_snapshot as Record<string, unknown>)['legal_name']).toBe('ABSORBEE');
    });

    it('refuse toujours de fusionner deux établissements identifiés', async () => {
      const a = await create({ legal_name: 'A', siret: '55210055400013', siren: '552100554' });
      const b = await create({ legal_name: 'B', siret: '55210055400021', siren: '552100554' });

      const { error } = await admin.rpc('merge_companies', {
        p_survivor_id: a,
        p_absorbed_id: b,
        p_score: 1.0,
        p_evidence: [],
        p_decided_by: 'test',
      });

      // Le garde-fou est dans la fonction : même une décision explicite est refusée.
      expect(error?.message).toMatch(/SIRET différents/);
      expect(await countCompanies()).toBe(2);
    });

    it('relâche l’attribution de l’absorbée si le survivant en a déjà une', async () => {
      const survivor = await create({ legal_name: 'SURVIVANTE', postal_code: '49000' });
      const absorbed = await create({ legal_name: 'ABSORBEE', postal_code: '49000' });

      const { data: user } = await admin.auth.admin.createUser({
        email: 'dedup@dedup.test',
        password: 'motdepasse123',
        email_confirm: true,
      });

      const makeOpportunity = async (companyId: string) => {
        const { data } = await admin
          .from('opportunities')
          .insert({
            company_id: companyId,
            opportunity_type: 'website_creation',
            need_score: 70,
            timing_score: 70,
            freshness_factor: 0.9,
            confidence_score: 0.8,
            base_score: 70,
            algorithm_version: 'v0',
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          })
          .select('id')
          .single();
        return data!.id as string;
      };

      for (const companyId of [survivor, absorbed]) {
        await admin.from('assignments').insert({
          company_id: companyId,
          opportunity_id: await makeOpportunity(companyId),
          user_id: user.user!.id,
          rank: 1,
          match_score: 70,
          exclusive_until: new Date(Date.now() + 86_400_000).toISOString(),
        });
      }

      await admin.rpc('merge_companies', {
        p_survivor_id: survivor,
        p_absorbed_id: absorbed,
        p_score: 0.95,
        p_evidence: [],
        p_decided_by: 'test',
      });

      const { data: assignments } = await admin
        .from('assignments')
        .select('company_id, status')
        .order('status');

      // Les deux attributions pointent vers le survivant, une seule est vivante.
      expect(assignments?.every((a) => a.company_id === survivor)).toBe(true);
      expect(assignments?.filter((a) => a.status === 'active')).toHaveLength(1);
      expect(assignments?.filter((a) => a.status === 'released')).toHaveLength(1);

      await admin.auth.admin.deleteUser(user.user!.id);
    });
  });

  describe('orchestration', () => {
    it('fusionne au-dessus du seuil et met en revue en dessous', async () => {
      // Paire certaine : même téléphone, même nom, même lieu.
      await create({
        legal_name: 'BOULANGERIE MOREAU',
        phone: '+33241222479',
        postal_code: '49000',
        lat: 47.4784,
        lon: -0.5632,
      });
      await create({
        legal_name: 'Boulangerie Moreau',
        phone: '+33241222479',
        postal_code: '49000',
        lat: 47.4784,
        lon: -0.5632,
      });

      // Paire douteuse, calibrée sur les similarités mesurées.
      // Score ≈ 0,749 : nom quasi identique, même commune, même point, même
      // activité — assez proche pour être signalé, trop incertain pour décider.
      await create({
        legal_name: 'Le Fournil de la Gare',
        postal_code: '75011',
        lat: 48.8566,
        lon: 2.3522,
        industry_code: '10.71C',
      });
      await create({
        legal_name: 'Fournil de la Gare',
        postal_code: '75011',
        lat: 48.85665,
        lon: 2.35225,
        industry_code: '10.71C',
      });

      const report = await detectDuplicates(db, { limit: 50 });

      expect(report.merged).toBe(1);
      expect(report.queued).toBeGreaterThanOrEqual(1);
      expect(await countCompanies()).toBe(3);
    });

    it('ne fusionne rien en mode revue seule', async () => {
      await create({ legal_name: 'MOREAU', phone: '+33241222479', postal_code: '49000' });
      await create({ legal_name: 'MOREAU', phone: '+33241222479', postal_code: '49000' });

      const report = await detectDuplicates(db, { limit: 50, reviewOnly: true });

      expect(report.merged).toBe(0);
      expect(report.queued).toBe(1);
      expect(await countCompanies()).toBe(2);
    });

    it('réduit un triplon à une seule entreprise', async () => {
      for (let i = 0; i < 3; i += 1) {
        await create({ legal_name: 'TRIPLON', phone: '+33241222479', postal_code: '49000' });
      }

      const report = await detectDuplicates(db, { limit: 50 });

      expect(report.merged).toBe(2);
      expect(report.errors).toBe(0);
      expect(await countCompanies()).toBe(1);
    });
  });

  describe('arbitrage manuel', () => {
    it('fusionne une paire acceptée', async () => {
      await create({ legal_name: 'BOULANGERIE MOREAU', phone: '+33241222479', postal_code: '49000' });
      await create({ legal_name: 'Boulangerie Moreau', phone: '+33241222479', postal_code: '49000' });
      await detectDuplicates(db, { limit: 50, reviewOnly: true });

      const { data: pair } = await admin
        .from('company_duplicate_candidates')
        .select('id')
        .eq('status', 'pending')
        .single();

      const { survivorId } = await decideDuplicate(db, pair!.id, 'merge', 'admin@test');

      expect(survivorId).not.toBeNull();
      expect(await countCompanies()).toBe(1);
    });

    it('écarte une paire refusée sans rien détruire', async () => {
      await create({ legal_name: 'GARAGE DUBOIS', phone: '+33241333333', postal_code: '49000' });
      await create({ legal_name: 'Garage Dubois', phone: '+33241333333', postal_code: '49000' });
      await detectDuplicates(db, { limit: 50, reviewOnly: true });

      const { data: pair } = await admin
        .from('company_duplicate_candidates')
        .select('id')
        .eq('status', 'pending')
        .single();

      await decideDuplicate(db, pair!.id, 'reject', 'admin@test');

      const { data: after } = await admin
        .from('company_duplicate_candidates')
        .select('status, decided_by')
        .eq('id', pair!.id)
        .single();

      expect(after).toMatchObject({ status: 'rejected', decided_by: 'admin@test' });
      expect(await countCompanies()).toBe(2);
    });

    it('compte les fusions depuis le journal, pas depuis le statut des paires', async () => {
      // merge_companies supprime la paire par cascade en supprimant
      // l'entreprise absorbée : compter les paires « merged » donnerait
      // toujours zéro. Le journal des fusions est la source de vérité.
      await create({ legal_name: 'COMPTAGE', phone: '+33241555555', postal_code: '49000' });
      await create({ legal_name: 'Comptage', phone: '+33241555555', postal_code: '49000' });
      await detectDuplicates(db, { limit: 50, reviewOnly: true });

      const before = await getDuplicateCounts(db);
      expect(before.pending).toBe(1);
      expect(before.merged).toBe(0);

      const { data: pair } = await admin
        .from('company_duplicate_candidates')
        .select('id')
        .eq('status', 'pending')
        .single();
      await decideDuplicate(db, pair!.id, 'merge', 'admin@test');

      const after = await getDuplicateCounts(db);
      expect(after.pending).toBe(0);
      expect(after.merged).toBe(1);
      expect(after.autoMerges).toBe(0);
    });

    it('présente les deux fiches côte à côte pour l’arbitrage', async () => {
      await create({
        legal_name: 'COTE A COTE',
        phone: '+33241666666',
        postal_code: '49000',
        siret: '55210055400013',
        siren: '552100554',
      });
      await create({ legal_name: 'Cote a Cote', phone: '+33241666666', postal_code: '49000' });
      await detectDuplicates(db, { limit: 50, reviewOnly: true });

      const pairs = await listPendingDuplicates(db, 10);
      expect(pairs).toHaveLength(1);

      const pair = pairs[0]!;
      // Les deux fiches sont chargées complètes : arbitrer demande de comparer.
      expect(pair.a.legalName).toBeTruthy();
      expect(pair.b.legalName).toBeTruthy();
      expect(pair.a.sourceCount).toBeGreaterThanOrEqual(0);
      expect(pair.evidence).toMatchObject({ phone: true });
      expect([pair.a.siret, pair.b.siret]).toContain('55210055400013');
    });

    it('refuse d’arbitrer deux fois la même paire', async () => {
      await create({ legal_name: 'PRESSING MARTIN', phone: '+33241444444', postal_code: '49000' });
      await create({ legal_name: 'Pressing Martin', phone: '+33241444444', postal_code: '49000' });
      await detectDuplicates(db, { limit: 50, reviewOnly: true });

      const { data: pair } = await admin
        .from('company_duplicate_candidates')
        .select('id')
        .eq('status', 'pending')
        .single();

      await decideDuplicate(db, pair!.id, 'reject', 'admin@test');
      await expect(decideDuplicate(db, pair!.id, 'merge', 'admin@test')).rejects.toThrow(/déjà été arbitrée/);
    });
  });
});

const REVIEW = 0.7;
