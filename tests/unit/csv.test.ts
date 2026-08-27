import { describe, expect, it } from 'vitest';
import {
  CsvCompanySource,
  detectDelimiter,
  inferMapping,
  isLocalCommerce,
  isProspectable,
  normalizeNafCode,
  parseCsv,
  parseCsvLine,
  parseEmployeeRange,
  parseSireneDate,
  SIRENE_ETABLISSEMENT_MAPPING,
} from '../../packages/core/src/sources';

describe('lecture CSV', () => {
  it('respecte les guillemets et les séparateurs internes', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(parseCsvLine('"Dupont, SARL",Paris')).toEqual(['Dupont, SARL', 'Paris']);
  });

  it('gère les guillemets doublés', () => {
    expect(parseCsvLine('"Le ""Fournil""",Lyon')).toEqual(['Le "Fournil"', 'Lyon']);
  });

  it('produit un champ vide pour une colonne absente', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
    expect(parseCsvLine(',,')).toEqual(['', '', '']);
  });

  it('détecte le séparateur', () => {
    expect(detectDelimiter('a;b;c;d')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a\tb\tc\td\te')).toBe('\t');
  });

  it('signale les lignes mal formées sans interrompre la lecture', () => {
    const csv = ['nom,ville', 'Dupont,Paris', 'LigneCassée', 'Martin,Lyon'].join('\n');
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.malformed).toEqual([{ lineNumber: 3, reason: '1 colonnes au lieu de 2' }]);
  });

  it('retire le BOM de la première colonne', () => {
    const result = parseCsv('﻿nom,ville\nDupont,Paris');
    expect(result.headers[0]).toBe('nom');
  });

  it('respecte la limite de lignes', () => {
    const csv = ['nom', ...Array.from({ length: 100 }, (_, i) => `E${i}`)].join('\n');
    expect(parseCsv(csv, { limit: 10 }).rows).toHaveLength(10);
  });
});

describe('détection des colonnes', () => {
  it('reconnaît les intitulés français courants', () => {
    const mapping = inferMapping([
      'Raison sociale', 'SIRET', 'Téléphone', 'Site web', 'Code postal', 'Ville',
    ]);
    expect(mapping).toMatchObject({
      legalName: 'Raison sociale',
      siret: 'SIRET',
      phone: 'Téléphone',
      domain: 'Site web',
      postalCode: 'Code postal',
      city: 'Ville',
    });
  });

  it('n’attribue jamais deux fois la même colonne', () => {
    const mapping = inferMapping(['nom', 'name']);
    const columns = Object.values(mapping);
    expect(new Set(columns).size).toBe(columns.length);
  });

  it('laisse non mappé ce qu’il ne reconnaît pas', () => {
    const mapping = inferMapping(['colonne_obscure', 'autre_chose']);
    expect(Object.keys(mapping)).toHaveLength(0);
  });
});

describe('codes SIRENE', () => {
  it('traduit les tranches d’effectifs', () => {
    expect(parseEmployeeRange('01')).toEqual({ min: 1, max: 2 });
    expect(parseEmployeeRange('12')).toEqual({ min: 20, max: 49 });
    expect(parseEmployeeRange('NN')).toEqual({ min: 0, max: 0 });
    expect(parseEmployeeRange('inconnu')).toEqual({ min: null, max: null });
    expect(parseEmployeeRange(null)).toEqual({ min: null, max: null });
  });

  it('ne retient que le statut de diffusion complet', () => {
    expect(isProspectable('O')).toBe(true);
    expect(isProspectable('P')).toBe(false);   // diffusion partielle
    expect(isProspectable('N')).toBe(false);
    expect(isProspectable(null)).toBe(false);
  });

  it('normalise les codes NAF', () => {
    expect(normalizeNafCode('5610A')).toBe('56.10A');
    expect(normalizeNafCode('56.10A')).toBe('56.10A');
    expect(normalizeNafCode('561')).toBeNull();
    expect(normalizeNafCode(null)).toBeNull();
  });

  it('reconnaît le segment commerce local', () => {
    expect(isLocalCommerce('5610A')).toBe(true);   // restauration
    expect(isLocalCommerce('1071C')).toBe(true);   // boulangerie
    expect(isLocalCommerce('9602A')).toBe(true);   // coiffure
    expect(isLocalCommerce('4520A')).toBe(true);   // garage
    expect(isLocalCommerce('6420Z')).toBe(false);  // holding
    expect(isLocalCommerce('7010Z')).toBe(false);  // sièges sociaux
  });

  it('rejette les dates aberrantes', () => {
    expect(parseSireneDate('2024-03-15')).toBe('2024-03-15');
    expect(parseSireneDate('15/03/2024')).toBeNull();
    expect(parseSireneDate('2099-01-01')).toBeNull();  // dans le futur
    expect(parseSireneDate('')).toBeNull();
  });
});

describe('source CSV', () => {
  const collect = async (source: CsvCompanySource) => {
    const out = [];
    for await (const raw of source.discover()) out.push(source.normalize(raw));
    return out;
  };

  it('normalise une ligne complète', async () => {
    const csv = [
      'Raison sociale;SIRET;Téléphone;Site web;Code postal;Ville',
      'BOULANGERIE MOREAU SARL;55210055400013;01 23 45 67 89;https://www.moreau.fr/;75 011;PARIS 11',
    ].join('\n');

    const [candidate] = await collect(new CsvCompanySource({ sourceName: 'test', content: csv }));

    expect(candidate).toMatchObject({
      legalName: 'BOULANGERIE MOREAU SARL',
      siret: '55210055400013',
      siren: '552100554',
      phone: '+33123456789',
      domain: 'moreau.fr',
      websiteUrl: 'https://moreau.fr',
      postalCode: '75011',
      city: 'Paris',
      identityConfidence: 0.98,
    });
  });

  it('consigne les champs écartés avec leur motif', async () => {
    const csv = [
      'nom,siret,telephone,site',
      'Dupont,00000000000000,pas-un-numero,https://facebook.com/dupont',
    ].join('\n');

    const [candidate] = await collect(new CsvCompanySource({ sourceName: 'test', content: csv }));

    expect(candidate?.siret).toBeNull();
    expect(candidate?.phone).toBeNull();
    expect(candidate?.domain).toBeNull();
    expect(candidate?.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'siret', reason: 'clé de contrôle invalide' }),
        expect.objectContaining({ field: 'phone', reason: 'numéro non reconnu' }),
        expect.objectContaining({ field: 'domain', reason: 'plateforme' }),
      ]),
    );
  });

  it('écarte une ligne sans nom exploitable', async () => {
    const csv = ['nom,ville', ',Paris', 'SARL,Lyon'].join('\n');
    const candidates = await collect(new CsvCompanySource({ sourceName: 'test', content: csv }));
    expect(candidates.every((c) => c === null)).toBe(true);
  });

  it('déduit la confiance d’identité du niveau d’identifiant', async () => {
    const rows = [
      'nom,siret,siren,code_postal',
      'Avec SIRET,55210055400013,,75011',
      'Avec SIREN,,552100554,75011',
      'Avec CP seul,,,75011',
      'Sans rien,,,',
    ].join('\n');

    const candidates = await collect(new CsvCompanySource({ sourceName: 'test', content: rows }));
    expect(candidates.map((c) => c?.identityConfidence)).toEqual([0.98, 0.92, 0.65, 0.45]);
  });

  describe('conventions SIRENE', () => {
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
      '552100554,55210055400021,HOLDING EXEMPLE,,75008,PARIS,6420Z,2015-06-01,NN,F,O,false',
    ].join('\n');

    const sireneSource = () =>
      new CsvCompanySource({
        sourceName: 'sirene',
        content: sireneCsv,
        mapping: SIRENE_ETABLISSEMENT_MAPPING,
        sireneConventions: true,
        confidence: 0.99,
      });

    it('interprète les codes du répertoire', async () => {
      const [first] = await collect(sireneSource());
      expect(first).toMatchObject({
        legalName: 'BOULANGERIE MOREAU',
        commercialName: 'Le Fournil',
        industryCode: '10.71C',
        segment: 'local_commerce',
        employeeMin: 3,
        employeeMax: 5,
        creationDate: '2024-03-15',
        companyStatus: 'active',
        prospectingAllowed: true,
      });
    });

    it('marque non prospectable une diffusion partielle', async () => {
      const candidates = await collect(sireneSource());
      expect(candidates[1]).toMatchObject({
        legalName: 'COIFFURE MARTIN',
        prospectingAllowed: false,
      });
    });

    it('reconnaît un établissement fermé', async () => {
      const candidates = await collect(sireneSource());
      expect(candidates[2]?.companyStatus).toBe('closed');
    });

    it('filtre sur le segment quand on le demande', async () => {
      const source = new CsvCompanySource({
        sourceName: 'sirene',
        content: sireneCsv,
        mapping: SIRENE_ETABLISSEMENT_MAPPING,
        sireneConventions: true,
        localCommerceOnly: true,
      });

      const candidates = await collect(source);
      // La holding (6420Z) est écartée, les deux commerces sont conservés.
      expect(candidates.filter(Boolean)).toHaveLength(2);
      expect(candidates[2]).toBeNull();
    });
  });
});
