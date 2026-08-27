import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CsvCompanySource,
  ingestFromSource,
  SIRENE_ETABLISSEMENT_MAPPING,
  type Db,
} from '../../packages/core/src';
import { cleanupEngineTables, serviceClient, supabaseReachable } from './helpers';

/**
 * Ingestion : la fusion et la conservation des données déjà acquises sont les
 * deux comportements qui décident si la base reste propre ou se remplit de
 * doublons et de champs écrasés.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('ingestion CSV', () => {
  let admin: SupabaseClient;
  let db: Db;

  const ingest = (content: string, options: Record<string, unknown> = {}) =>
    ingestFromSource(
      db,
      new CsvCompanySource({ sourceName: 'test-csv', content, ...options }),
    );

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

  it('crée les entreprises et rend compte du résultat', async () => {
    const csv = [
      'raison_sociale,siret,telephone,site,code_postal,ville',
      'BOULANGERIE MOREAU,55210055400013,01 23 45 67 89,https://www.moreau.fr,75011,PARIS',
      'COIFFURE MARTIN,38012986600014,04 78 12 34 56,,69003,LYON',
    ].join('\n');

    const report = await ingest(csv);

    expect(report).toMatchObject({ read: 2, created: 2, merged: 0, errors: 0 });

    const { data } = await admin
      .from('companies')
      .select('legal_name, siren, phone, domain, city, has_contact')
      .order('legal_name');

    expect(data).toEqual([
      expect.objectContaining({
        legal_name: 'BOULANGERIE MOREAU',
        siren: '552100554',
        phone: '+33123456789',
        domain: 'moreau.fr',
        city: 'Paris',
        has_contact: true,
      }),
      expect.objectContaining({ legal_name: 'COIFFURE MARTIN', domain: null }),
    ]);
  });

  it('conserve le payload brut et la provenance', async () => {
    await ingest('nom,siret,ville\nDupont,55210055400013,Paris');

    const { data: sources } = await admin.from('company_sources').select('*');
    expect(sources).toHaveLength(1);
    expect(sources?.[0]).toMatchObject({
      source_name: 'test-csv',
      source_external_id: '55210055400013',
    });
    expect(sources?.[0]?.raw_payload).toMatchObject({ nom: 'Dupont', ville: 'Paris' });

    const { data: provenance } = await admin
      .from('company_field_provenance')
      .select('field, value');
    const fields = new Map(provenance!.map((p) => [p.field, p.value]));
    expect(fields.get('siret')).toBe('55210055400013');
    expect(fields.get('siren')).toBe('552100554');
  });

  describe('fusion', () => {
    it('fusionne sur le SIRET plutôt que de créer un doublon', async () => {
      await ingest('nom,siret\nBOULANGERIE MOREAU,55210055400013');
      const report = await ingest('nom,siret,telephone\nLE FOURNIL MOREAU,55210055400013,0123456789');

      expect(report).toMatchObject({ read: 1, created: 0, merged: 1 });

      const { data } = await admin.from('companies').select('legal_name, phone');
      expect(data).toHaveLength(1);
      // Le nom d'origine est conservé, le téléphone est ajouté.
      expect(data?.[0]).toMatchObject({ legal_name: 'BOULANGERIE MOREAU', phone: '+33123456789' });
    });

    it('fusionne sur le SIREN entre fiches sans établissement identifié', async () => {
      await ingest('nom,siren\nMOREAU,552100554');
      const report = await ingest('nom,siren,ville\nMOREAU,552100554,Paris');

      expect(report.merged).toBe(1);
      const { count } = await admin.from('companies').select('id', { count: 'exact', head: true });
      expect(count).toBe(1);
    });

    it('garde distincts deux établissements d’une même unité légale', async () => {
      // Le SIREN identifie l'unité légale, le SIRET l'établissement. Une chaîne
      // a un seul SIREN et autant de SIRET que de points de vente : les
      // rapprocher par SIREN fusionnerait un magasin avec le siège.
      const csv = [
        'nom,siret,code_postal,ville',
        'BOULANGERIE MOREAU,55210055400013,75011,PARIS',
        'HOLDING MOREAU,55210055400021,75008,PARIS',
        'RESTAURANT MOREAU,55210055400005,33000,BORDEAUX',
      ].join('\n');

      const report = await ingest(csv);

      expect(report).toMatchObject({ read: 3, created: 3, merged: 0 });

      const { data } = await admin.from('companies').select('siren, siret, city').order('siret');
      expect(data).toHaveLength(3);
      expect(new Set(data!.map((c) => c.siren)).size).toBe(1);
      expect(new Set(data!.map((c) => c.siret)).size).toBe(3);
    });

    it('n’absorbe pas un établissement identifié dans une fiche sans SIRET', async () => {
      await ingest('nom,siren\nMOREAU,552100554');
      const report = await ingest('nom,siret,ville\nBOULANGERIE MOREAU,55210055400013,PARIS');

      // Le second porte un SIRET, le premier non : ce sont deux niveaux
      // d'identité différents, pas la même entité.
      expect(report).toMatchObject({ created: 1, merged: 0 });
      const { count } = await admin.from('companies').select('id', { count: 'exact', head: true });
      expect(count).toBe(2);
    });

    it('fusionne sur le domaine quand aucun identifiant légal n’est présent', async () => {
      await ingest('nom,site\nMoreau,https://www.moreau.fr');
      const report = await ingest('nom,site,telephone\nBoulangerie Moreau,moreau.fr/contact,0123456789');

      expect(report.merged).toBe(1);
      const { data } = await admin.from('companies').select('domain, phone');
      expect(data).toHaveLength(1);
      expect(data?.[0]).toMatchObject({ domain: 'moreau.fr', phone: '+33123456789' });
    });

    it('n’écrase jamais une donnée déjà acquise', async () => {
      await ingest('nom,siret,telephone,site\nMOREAU,55210055400013,0123456789,moreau.fr');
      await ingest('nom,siret,telephone,site\nMOREAU,55210055400013,0987654321,autre.fr');

      const { data } = await admin.from('companies').select('phone, domain');
      // Une seconde source ne remplace pas une information déjà présente.
      expect(data?.[0]).toMatchObject({ phone: '+33123456789', domain: 'moreau.fr' });
    });

    it('empile les sources sur la même entreprise', async () => {
      await ingest('nom,siret\nMOREAU,55210055400013');
      await ingestFromSource(
        db,
        new CsvCompanySource({
          sourceName: 'autre-source',
          content: 'nom,siret\nMOREAU,55210055400013',
        }),
      );

      const { data: companies } = await admin.from('companies').select('id');
      const { data: sources } = await admin.from('company_sources').select('source_name');

      expect(companies).toHaveLength(1);
      expect(sources?.map((s) => s.source_name).sort()).toEqual(['autre-source', 'test-csv']);
    });

    it('duplique une entreprise sans identifiant fort — limite assumée de cette phase', async () => {
      // Sans SIRET, SIREN ni domaine, il n'existe aucune clé exacte : la ligne
      // recrée une entreprise à chaque import. C'est la limite que la
      // déduplication approchée (téléphone, adresse, similarité de nom) devra
      // lever. Ce test la documente pour qu'elle ne passe pas inaperçue.
      const csv = 'nom,ville\nBOULANGERIE MOREAU,Paris';

      await ingest(csv);
      const second = await ingest(csv);

      expect(second).toMatchObject({ created: 1, merged: 0 });
      const { count } = await admin.from('companies').select('id', { count: 'exact', head: true });
      expect(count).toBe(2);
    });

    it('réimporter le même fichier ne crée aucun doublon', async () => {
      const csv = [
        'nom,siret',
        'MOREAU,55210055400013',
        'MARTIN,38012986600014',
      ].join('\n');

      await ingest(csv);
      const second = await ingest(csv);

      expect(second).toMatchObject({ created: 0, merged: 2 });
      const { count } = await admin.from('companies').select('id', { count: 'exact', head: true });
      expect(count).toBe(2);
    });
  });

  describe('robustesse', () => {
    it('poursuit après une ligne inexploitable', async () => {
      const csv = [
        'nom,siret',
        'MOREAU,55210055400013',
        ',00000000000000',
        'MARTIN,38012986600014',
      ].join('\n');

      const report = await ingest(csv);

      expect(report).toMatchObject({ read: 3, created: 2, rejected: 1, errors: 0 });
    });

    it('détaille les champs écartés pour diagnostiquer un fichier', async () => {
      const csv = [
        'nom,siret,telephone,site',
        'A,mauvais,pas-un-numero,https://facebook.com/a',
        'B,aussi-mauvais,12,instagram.com/b',
      ].join('\n');

      const report = await ingest(csv);

      expect(report.created).toBe(2);
      expect(report.fieldRejections).toMatchObject({
        'siret : clé de contrôle invalide': 2,
        'phone : numéro non reconnu': 2,
        'domain : plateforme': 2,
      });
    });

    it('mesure sans écrire en simulation', async () => {
      const report = await ingest('nom,siret\nMOREAU,55210055400013', {});
      expect(report.created).toBe(1);

      await cleanupEngineTables(admin);

      const dryRun = await ingestFromSource(
        db,
        new CsvCompanySource({ sourceName: 'test-csv', content: 'nom,siret\nMOREAU,55210055400013' }),
        { dryRun: true },
      );

      expect(dryRun.created).toBe(1);
      const { count } = await admin.from('companies').select('id', { count: 'exact', head: true });
      expect(count).toBe(0);
    });

    it('respecte la limite de lignes', async () => {
      const csv = ['nom', ...Array.from({ length: 50 }, (_, i) => `Entreprise ${i}`)].join('\n');
      const report = await ingestFromSource(
        db,
        new CsvCompanySource({ sourceName: 'test-csv', content: csv }),
        { limit: 10 },
      );
      expect(report.read).toBe(10);
    });
  });

  describe('fichier SIRENE', () => {
    const sireneCsv = [
      [
        'siren', 'siret', 'denominationUsuelleEtablissement', 'enseigne1Etablissement',
        'codePostalEtablissement', 'libelleCommuneEtablissement',
        'activitePrincipaleEtablissement', 'dateCreationEtablissement',
        'trancheEffectifsEtablissement', 'etatAdministratifEtablissement',
        'statutDiffusionEtablissement', 'etablissementSiege',
      ].join(','),
      '552100554,55210055400013,BOULANGERIE MOREAU,Le Fournil,75011,PARIS,1071C,2024-03-15,02,A,O,true',
      '380129866,38012986600014,COIFFURE MARTIN,,69003,LYON,9602A,2020-01-10,01,A,P,true',
    ].join('\n');

    it('ingère le format du répertoire et applique le statut de diffusion', async () => {
      const report = await ingestFromSource(
        db,
        new CsvCompanySource({
          sourceName: 'sirene',
          content: sireneCsv,
          mapping: SIRENE_ETABLISSEMENT_MAPPING,
          sireneConventions: true,
          confidence: 0.99,
        }),
      );

      expect(report).toMatchObject({ read: 2, created: 2, errors: 0 });

      const { data } = await admin
        .from('companies')
        .select('legal_name, commercial_name, industry_code, segment, employee_min, prospecting_allowed, creation_date')
        .order('legal_name');

      expect(data?.[0]).toMatchObject({
        legal_name: 'BOULANGERIE MOREAU',
        commercial_name: 'Le Fournil',
        industry_code: '10.71C',
        segment: 'local_commerce',
        employee_min: 3,
        prospecting_allowed: true,
        creation_date: '2024-03-15',
      });

      // Diffusion partielle : ingérée mais non prospectable.
      expect(data?.[1]).toMatchObject({
        legal_name: 'COIFFURE MARTIN',
        prospecting_allowed: false,
      });
    });

    it('mesure la part réellement prospectable', async () => {
      await ingestFromSource(
        db,
        new CsvCompanySource({
          sourceName: 'sirene',
          content: sireneCsv,
          mapping: SIRENE_ETABLISSEMENT_MAPPING,
          sireneConventions: true,
        }),
      );

      const { count: total } = await admin
        .from('companies')
        .select('id', { count: 'exact', head: true });
      const { count: prospectable } = await admin
        .from('companies')
        .select('id', { count: 'exact', head: true })
        .eq('prospecting_allowed', true);

      expect(total).toBe(2);
      expect(prospectable).toBe(1);
    });
  });
});
