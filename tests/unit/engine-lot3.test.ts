import { describe, expect, it } from 'vitest';
import { scoreOpportunity, type ScoringInput, type ScoringSignal } from '../../packages/core/src/opportunities/scoring';
import { ruleFor } from '../../packages/core/src/opportunities/rules';
import { isTargetNaf, parseSireneHeader, parseSireneRow, splitCsvLine } from '../../packages/core/src/sources/sirene/reference';
import { rescanIntervalDays } from '../../packages/core/src/enrichment/domain-scanner';

/**
 * Lot 3 : la création de site par plusieurs chemins, la refonte par
 * gravité, le référentiel SIRENE lu sans rien inventer, le rescan qui
 * s'adapte à l'histoire du domaine.
 */

const signal = (over: Partial<ScoringSignal> = {}): ScoringSignal => ({
  signalType: 'outdated_stack', kind: 'modifier', category: 'need', strength: 0.9, confidence: 0.9,
  occurredAt: null, triggerEventId: null, ...over,
} as ScoringSignal);

const input = (over: Partial<ScoringInput> = {}): ScoringInput => ({
  companyId: 'c1', identityConfidence: 0.95, websiteStatus: 'reachable', signals: [], now: new Date(), ...over,
} as ScoringInput);

describe('création de site V2 : plusieurs chemins', () => {
  const rule = ruleFor('website_creation')!;

  it('chemin C : réseaux sociaux sans site, plus un second fait', () => {
    const r = scoreOpportunity(rule, input({ websiteStatus: null, signals: [
      signal({ signalType: 'social_without_website', strength: 1 }),
      signal({ signalType: 'active_business', category: 'quality', strength: 1 }),
    ] }));
    expect(r).not.toBeNull();
  });

  it('chemin A : absence de site prouvée après recherche, sans réseau social', () => {
    const r = scoreOpportunity(rule, input({ websiteStatus: null, signals: [
      signal({ signalType: 'no_website_proven', strength: 0.95 }),
      signal({ signalType: 'active_business', category: 'quality', strength: 1 }),
    ] }));
    expect(r).not.toBeNull();
  });

  it('chemin E : domaine déposé et parké, entreprise identifiée', () => {
    const r = scoreOpportunity(rule, input({ websiteStatus: 'placeholder', signals: [
      signal({ signalType: 'website_placeholder', strength: 0.9 }),
      signal({ signalType: 'domain_recently_registered', kind: 'trigger', category: 'timing', strength: 0.8, occurredAt: new Date().toISOString(), triggerEventId: 'e1' }),
    ] }));
    expect(r).not.toBeNull();
  });

  it('refuse toujours le seul silence d’un annuaire', () => {
    const r = scoreOpportunity(rule, input({ websiteStatus: null, signals: [
      signal({ signalType: 'active_business', category: 'quality', strength: 1 }),
      signal({ signalType: 'company_recently_created', strength: 0.5 }),
    ] }));
    expect(r).toBeNull();
  });
});

describe('refonte V2 : gravité', () => {
  const rule = ruleFor('website_redesign')!;

  it('un seul défaut mineur n’est pas une opportunité', () => {
    const r = scoreOpportunity(rule, input({ signals: [
      signal({ signalType: 'no_contact_form', strength: 0.5 }),
      signal({ signalType: 'aged_domain', strength: 0.5 }),
      signal({ signalType: 'slow_website', strength: 0.3 }),
    ] }));
    expect(r).toBeNull();
  });

  it('un défaut critique suffit avec le plancher de besoin', () => {
    const r = scoreOpportunity(rule, input({ signals: [
      signal({ signalType: 'not_responsive', strength: 0.9 }),
      signal({ signalType: 'no_contact_form', strength: 0.5 }),
      signal({ signalType: 'aged_domain', strength: 0.5 }),
    ] }));
    expect(r).not.toBeNull();
  });

  it('deux défauts majeurs suffisent, un seul non', () => {
    const two = scoreOpportunity(rule, input({ signals: [
      signal({ signalType: 'outdated_stack', strength: 0.9 }),
      signal({ signalType: 'dated_platform', strength: 0.75 }),
      signal({ signalType: 'no_contact_form', strength: 0.5 }),
    ] }));
    expect(two).not.toBeNull();
    const one = scoreOpportunity(rule, input({ signals: [
      signal({ signalType: 'outdated_stack', strength: 0.9 }),
      signal({ signalType: 'no_contact_form', strength: 0.5 }),
      signal({ signalType: 'aged_domain', strength: 0.6 }),
    ] }));
    expect(one).toBeNull();
  });
});

describe('référentiel SIRENE', () => {
  const header = 'siren,nic,siret,statutDiffusionEtablissement,dateCreationEtablissement,trancheEffectifsEtablissement,etablissementSiege,codePostalEtablissement,libelleCommuneEtablissement,activitePrincipaleEtablissement,etatAdministratifEtablissement,enseigne1Etablissement,enseigne2Etablissement,denominationUsuelleEtablissement';
  const columns = parseSireneHeader(header);

  it('découpe une ligne avec guillemets', () => {
    expect(splitCsvLine('a,"b, c","d ""e""",f')).toEqual(['a', 'b, c', 'd "e"', 'f']);
  });

  it('garde un commerce actif et diffusible d’un métier ciblé, avec son enseigne', () => {
    const row = parseSireneRow(columns, '123456789,00012,12345678900012,O,2019-03-04,01,true,49000,ANGERS,47.11B,A,BOULANGERIE MARTIN,,');
    expect(row).toEqual(expect.objectContaining({ siret: '12345678900012', siren: '123456789', storefront_name: 'BOULANGERIE MARTIN', postal_code: '49000', naf_code: '47.11B', is_head_office: true, creation_date: '2019-03-04' }));
  });

  it('écarte les fermés, les non diffusibles et les métiers hors cible', () => {
    expect(parseSireneRow(columns, '123456789,00012,12345678900012,O,2019-03-04,01,true,49000,ANGERS,47.11B,F,X,,')).toBeNull();
    expect(parseSireneRow(columns, '123456789,00012,12345678900012,P,2019-03-04,01,true,49000,ANGERS,47.11B,A,X,,')).toBeNull();
    expect(parseSireneRow(columns, '123456789,00012,12345678900012,O,2019-03-04,01,true,49000,ANGERS,64.19Z,A,X,,')).toBeNull();
    expect(isTargetNaf('56.10A')).toBe(true);
    expect(isTargetNaf('64.19Z')).toBe(false);
  });

  it('ne lit jamais un nom de personne : sans enseigne, le nom reste vide', () => {
    const row = parseSireneRow(columns, '123456789,00012,12345678900012,O,2019-03-04,01,true,49000,ANGERS,96.02A,A,,,');
    expect(row?.storefront_name).toBeNull();
  });
});

describe('rescan adaptatif', () => {
  it('rapproche un domaine déposé récemment', () => {
    expect(rescanIntervalDays('reachable', true, { registeredAt: new Date(Date.now() - 10 * 86_400_000).toISOString() })).toBe(7);
    expect(rescanIntervalDays('placeholder', false, { registeredAt: new Date(Date.now() - 10 * 86_400_000).toISOString() })).toBe(5);
  });

  it('espace un site qui ne bouge pas, jusqu’à un plafond', () => {
    expect(rescanIntervalDays('reachable', true, { unchangedStreak: 0 })).toBe(45);
    expect(rescanIntervalDays('reachable', true, { unchangedStreak: 3 })).toBe(90);
    expect(rescanIntervalDays('reachable', true, { unchangedStreak: 6 })).toBe(120);
  });

  it('ne touche pas au rythme d’un site cassé ou bloqué', () => {
    expect(rescanIntervalDays('broken', true, { unchangedStreak: 6 })).toBe(7);
    expect(rescanIntervalDays('blocked', true, { unchangedStreak: 6 })).toBe(90);
  });
});
