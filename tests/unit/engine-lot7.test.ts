import { describe, expect, it } from 'vitest';
import { classifyTender, normalizeTender } from '../../packages/core/src/sources/boamp/adapter';
import { normalizeAssociationNotice } from '../../packages/core/src/sources/joafe/adapter';
import { normalizePermit, premisesKindOf } from '../../packages/core/src/sources/sitadel/adapter';
import { ingestAssociations } from '../../packages/core/src/ingestion/associations';
import { ingestPermits } from '../../packages/core/src/ingestion/permits';
import { runEnrichmentChain, shouldUseCommercialProvider, type ContactEnrichmentProvider } from '../../packages/core/src/contacts/enrichment';
import { associationNoticeDetector, newPremisesDetector } from '../../packages/core/src/signals/detectors/organizations';
import { intentOf } from '../../packages/core/src/opportunities/scoring';
import type { CompanyContext } from '../../packages/core/src/signals/types';

/**
 * Lot 7 : trois sources datées de plus, une chaîne d'enrichissement qui
 * compte ses coûts, l'opposition explicite, la rétention.
 */

describe('BOAMP V2 : familles et classification', () => {
  it('classe un avis par famille, web d’abord, mots courts entre limites', () => {
    expect(classifyTender('Refonte du site internet de la commune et référencement', null)).toEqual({ category: 'web', matchedKeywords: ['site internet', 'refonte du site', 'referencement'] });
    expect(classifyTender('Développement d’une application mobile iOS et Android', null).category).toBe('mobile');
    expect(classifyTender('Audit d’accessibilité RGAA du portail', null).category).toBe('seo_accessibility');
    expect(classifyTender('Mission de conseil en ergonomie et expérience utilisateur', null).category).toBe('ux_ui');
    expect(classifyTender('Fourniture de radios pour la police municipale', null).category).toBeNull();
    expect(classifyTender('Voyage à Séoul', null).matchedKeywords).toEqual([]);
  });
  it('un code CPV web suffit, sans expression', () => {
    expect(classifyTender('Prestation 2026', '72413000').category).toBe('web');
  });
  it('l’avis normalisé porte sa famille et ses mots', () => {
    const t = normalizeTender({ idweb: '26_1', objet: 'Création de site web', nomacheteur: 'Mairie', dateparution: '2026-09-10', type_marche: ['SERVICES'], donnees: {} });
    expect(t?.category).toBe('web');
    expect(t?.matchedKeywords).toContain('site web');
  });
});

describe('JOAFE : une annonce devient une association', () => {
  const record = { id: '202600371045', source: 'joafe', typeavis: 'Création', dateparution: '2026-09-15', titre: 'CAIRN - SPORT AVENTURE', objet: 'promouvoir le sport', siteweb: 'https://www.cairn-sport.fr/', numero_rna: 'W402010252', adresse_actuelle: '540 chemin de Pecam', codepostal_actuel: '40200', commune_actuelle: 'Pontenx-les-Forges', domaine_activite_libelle_categorise: ['Sports, activités de plein air/'] };
  it('lit le RNA, le site, l’adresse, l’activité', () => {
    const n = normalizeAssociationNotice(record)!;
    expect(n.kind).toBe('creation');
    expect(n.rna).toBe('W402010252');
    expect(n.domain).toBe('cairn-sport.fr');
    expect(n.postalCode).toBe('40200');
    expect(n.activityLabel).toBe('Sports, activités de plein air');
  });
  it('ignore une dissolution, un dépôt de comptes, un RNA malformé', () => {
    expect(normalizeAssociationNotice({ ...record, typeavis: 'Dissolution' })).toBeNull();
    expect(normalizeAssociationNotice({ ...record, source: 'dca' })).toBeNull();
    expect(normalizeAssociationNotice({ ...record, numero_rna: '12345' })).toBeNull();
  });
  it('crée l’association une fois, avec son événement, sans la recréer', async () => {
    const inserted: Record<string, unknown[]> = { companies: [], company_sources: [], company_events: [] };
    let known = false;
    const db = {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: known ? { company_id: 'c1' } : null }) }) }) }) }),
        insert: (row: unknown) => {
          inserted[table]!.push(row);
          return { select: () => ({ maybeSingle: async () => ({ data: { id: 'c1' }, error: null }) }), then: (r: (v: { error: null }) => void) => r({ error: null }) };
        },
        update: () => ({ eq: () => ({ is: async () => ({ error: null }), eq: async () => ({ error: null }) }) }),
      }),
    } as never;
    const notice = normalizeAssociationNotice(record)!;
    const first = await ingestAssociations(db, { fetch: async () => [notice] });
    expect(first.companiesCreated).toBe(1);
    expect((inserted['companies']![0] as { organization_type: string }).organization_type).toBe('association');
    expect((inserted['company_events']![0] as { event_type: string }).event_type).toBe('association_created');
    known = true;
    const second = await ingestAssociations(db, { fetch: async () => [notice] });
    expect(second.companiesKnown).toBe(1);
    expect(second.companiesCreated).toBe(0);
  });
});

describe('Sitadel : un permis est un signal, pas un lead', () => {
  const row = { COMM: '01267', TYPE_DAU: 'PC', NUM_DAU: '00126722H0003', SIRET_DEM: '53930110100017', DENOM_DEM: 'LONGO TP', APE_DEM: '43.12A', ADR_NUM_TER: '15', ADR_LIBVOIE_TER: 'CHEMIN DE GRAVIERE', ADR_CODPOST_TER: '01460', ADR_LOCALITE_TER: 'NURIEUX', SURF_COM_CREEE: 120, SURF_ENT_CREEE: 4, DATE_REELLE_AUTORISATION: '2026-08-14' };
  it('normalise et nomme la sorte de local par la surface dominante', () => {
    const p = normalizePermit(row, '2026-09-18')!;
    expect(p.permitId).toBe('01267-00126722H0003');
    expect(p.applicantSiren).toBe('539301101');
    expect(p.premisesKind).toBe('commercial');
    expect(p.siteAddress).toBe('15 CHEMIN DE GRAVIERE');
    expect(premisesKindOf({ office: 300, commercial: 20 })).toBe('office');
    expect(premisesKindOf({})).toBe('other');
  });
  it('refuse une autorisation datée dans le futur', () => {
    expect(normalizePermit({ ...row, DATE_REELLE_AUTORISATION: '2026-12-22' }, '2026-09-18')).toBeNull();
  });
  it('ne crée pas d’entreprise : sans SIRET connu, le permis est stocké sans événement', async () => {
    const events: unknown[] = [];
    let knownSiret = false;
    const db = {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ limit: (n: number) => n === 1 ? ({ maybeSingle: async () => ({ data: knownSiret ? { id: 'c9' } : null }) }) : Promise.resolve({ data: [] }) }) }),
        upsert: async () => ({ error: null }),
        insert: async (row: unknown) => { if (table === 'company_events') events.push(row); return { error: null }; },
      }),
    } as never;
    const permit = normalizePermit(row, '2026-09-18')!;
    const r1 = await ingestPermits(db, { fetch: async () => [permit] });
    expect(r1).toMatchObject({ stored: 1, matched: 0, eventsCreated: 0 });
    knownSiret = true;
    const r2 = await ingestPermits(db, { fetch: async () => [permit] });
    expect(r2).toMatchObject({ stored: 1, matched: 1, eventsCreated: 1 });
    expect((events[0] as { event_type: string }).event_type).toBe('new_business_premises');
  });
});

describe('déclencheurs des nouvelles sources', () => {
  const ctx = (company: Record<string, unknown>, events: { id: string; event_type: string; occurred_at: string; payload?: unknown }[]): CompanyContext =>
    ({ company: company as CompanyContext['company'], domain: null, domainCompanyCount: 0, events: events as CompanyContext['events'] });
  const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  it('une association créée il y a dix jours est un déclencheur ; une entreprise avec le même événement, non', () => {
    const ev = [{ id: 'e1', event_type: 'association_created', occurred_at: d(10) }];
    expect(associationNoticeDetector.detect(ctx({ organization_type: 'association' }, ev))[0]?.kind).toBe('trigger');
    expect(associationNoticeDetector.detect(ctx({ organization_type: 'company' }, ev))).toEqual([]);
  });
  it('un local commercial pèse plus qu’un entrepôt, et renforce l’intention avec une création', () => {
    const shop = newPremisesDetector.detect(ctx({}, [{ id: 'p1', event_type: 'new_business_premises', occurred_at: d(20), payload: { premises_kind: 'commercial' } }]))[0]!;
    const depot = newPremisesDetector.detect(ctx({}, [{ id: 'p2', event_type: 'new_business_premises', occurred_at: d(20), payload: { premises_kind: 'warehouse' } }]))[0]!;
    expect(shop.strength).toBeGreaterThan(depot.strength);
    const intent = intentOf([
      { signalType: 'company_recently_created', kind: 'trigger', category: 'timing', strength: 0.8, confidence: 0.9, occurredAt: d(15), triggerEventId: 'e' },
      { signalType: 'new_business_premises', kind: 'trigger', category: 'timing', strength: 0.6, confidence: 0.9, occurredAt: d(20), triggerEventId: 'p' },
    ]);
    expect(intent.families.sort()).toEqual(['company', 'premises']);
  });
});

describe('enrichissement : le payant en dernier recours', () => {
  it('la règle : qualifiée, bien notée, canal manquant, demande réelle', () => {
    const ok = { qualified: true, score: 75, minScore: 70, missingRequired: true, userDemand: true };
    expect(shouldUseCommercialProvider(ok)).toBe(true);
    expect(shouldUseCommercialProvider({ ...ok, score: 60 })).toBe(false);
    expect(shouldUseCommercialProvider({ ...ok, userDemand: false })).toBe(false);
    expect(shouldUseCommercialProvider({ ...ok, missingRequired: false })).toBe(false);
  });
  it('la chaîne s’arrête dès que plus rien ne manque, et ne compte que le payant utilisé', async () => {
    const costs: unknown[] = [];
    const db = { from: () => ({ insert: async (row: unknown) => { costs.push(row); return { error: null }; } }) } as never;
    const free: ContactEnrichmentProvider = { id: 'free', paid: false, costCents: 0, resolve: async () => ({ provider: 'free', costCents: 0, creditsUsed: 0, found: [], resolved: { contacts: [], bestPhone: '+33100000000', bestEmail: null, contactForm: null, contactabilityScore: 50, readiness: {} as never } }) };
    const paid: ContactEnrichmentProvider = { id: 'paid', paid: true, costCents: 40, resolve: async () => ({ provider: 'paid', costCents: 40, creditsUsed: 1, found: [], resolved: { contacts: [], bestPhone: '+33100000000', bestEmail: 'a@b.fr', contactForm: null, contactabilityScore: 90, readiness: {} as never } }) };
    const closed = await runEnrichmentChain(db, { companyId: 'c', domain: null, missing: ['phone', 'email'], opportunityQualified: true, opportunityScore: 50, userDemand: true }, { providers: [free, paid] });
    expect(closed.steps.map((s) => s.skipped)).toEqual([null, 'gate_closed']);
    expect(closed.costCents).toBe(0);
    const open = await runEnrichmentChain(db, { companyId: 'c', domain: null, missing: ['phone', 'email'], opportunityQualified: true, opportunityScore: 80, userDemand: true }, { providers: [free, paid] });
    expect(open.costCents).toBe(40);
    expect(open.steps[1]!.stillMissing).toEqual([]);
    expect(costs).toHaveLength(1);
    const done = await runEnrichmentChain(db, { companyId: 'c', domain: null, missing: ['phone'] }, { providers: [free, paid] });
    expect(done.steps).toHaveLength(1);
  });
});
