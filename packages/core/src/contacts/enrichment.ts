import type { Db } from '../db/client';
import type { Logger } from '../logger';
import type { ContactCandidate } from './types';
import { resolveCompanyContacts, type ResolvedContacts } from './resolver';
import { rescanDomain } from '../enrichment/domain-scanner';

/**
 * L'enrichissement des contacts, du gratuit vers le payant.
 *
 * Une chaîne de fournisseurs derrière une même interface. Les gratuits
 * viennent d'abord — ce que le produit sait déjà, ce que le site montre,
 * ce qu'OpenStreetMap a donné. Un fournisseur commercial ne s'engage que
 * sur une opportunité qualifiée, bien notée, à qui il manque un canal
 * requis, et quand la demande des freelances le justifie. Aucun n'est
 * branché aujourd'hui : l'interface existe, la règle existe, le coût se
 * mesure — c'est ce qui permettra de calculer le coût par OUTREACH_READY
 * le jour où l'on en branche un.
 */

export type MissingChannel = 'phone' | 'email';

export interface EnrichmentContext {
  companyId: string;
  domain: string | null;
  missing: MissingChannel[];
  /** Score de l'opportunité qui motive l'enrichissement, si elle existe. */
  opportunityScore?: number | null;
  opportunityQualified?: boolean;
  /** Des freelances attendent ce type de dossier : la demande justifie le coût. */
  userDemand?: boolean;
}

export interface EnrichmentOutcome {
  provider: string;
  costCents: number;
  creditsUsed: number;
  /** Contacts proposés par le fournisseur, à passer par l'ingestion habituelle. */
  found: ContactCandidate[];
  /** Ce que le fournisseur a résolu, quand il relit les contacts connus. */
  resolved?: ResolvedContacts;
  skipped?: string;
}

export interface ContactEnrichmentProvider {
  id: string;
  paid: boolean;
  costCents: number;
  resolve(db: Db, context: EnrichmentContext, options?: { logger?: Logger; signal?: AbortSignal }): Promise<EnrichmentOutcome>;
}

const stillMissing = (resolved: ResolvedContacts | undefined, missing: MissingChannel[]): MissingChannel[] => {
  if (!resolved) return missing;
  return missing.filter((m) => (m === 'phone' ? !resolved.bestPhone : !resolved.bestEmail));
};

/** Ce que le produit sait déjà : les contacts enregistrés, relus et arbitrés. */
export const freePublicResolver: ContactEnrichmentProvider = {
  id: 'free_public', paid: false, costCents: 0,
  async resolve(db, context, options = {}) {
    const resolved = await resolveCompanyContacts(db, context.companyId, { ...(options.logger ? { logger: options.logger } : {}) });
    return { provider: 'free_public', costCents: 0, creditsUsed: 0, found: [], resolved };
  },
};

/** Le site de l'entreprise, revisité s'il n'a pas été vu depuis une semaine. */
export const websiteResolver: ContactEnrichmentProvider = {
  id: 'website', paid: false, costCents: 0,
  async resolve(db, context, options = {}) {
    if (!context.domain) return { provider: 'website', costCents: 0, creditsUsed: 0, found: [], skipped: 'no_domain' };
    const { data: domain } = await db.from('domains').select('last_checked_at').eq('domain', context.domain).maybeSingle();
    const age = domain?.last_checked_at ? (Date.now() - new Date(domain.last_checked_at).getTime()) / 86_400_000 : Infinity;
    if (age > 7) {
      await rescanDomain(db, context.domain, { ...(options.logger ? { logger: options.logger } : {}), ...(options.signal ? { signal: options.signal } : {}) });
    }
    const resolved = await resolveCompanyContacts(db, context.companyId, { ...(options.logger ? { logger: options.logger } : {}) });
    return { provider: 'website', costCents: 0, creditsUsed: 0, found: [], resolved, ...(age > 7 ? {} : { skipped: 'scan_recent' }) };
  },
};

/** OpenStreetMap : déjà lu à la découverte. Rien à ajouter sans nouvelle passe de zone. */
export const osmResolver: ContactEnrichmentProvider = {
  id: 'osm', paid: false, costCents: 0,
  async resolve() {
    return { provider: 'osm', costCents: 0, creditsUsed: 0, found: [], skipped: 'already_ingested' };
  },
};

/**
 * Le fournisseur commercial : l'emplacement existe, rien n'est branché.
 * Quand il le sera, il rendra des candidats avec `source: 'enrichment_provider'`
 * et son coût, enregistré par la chaîne.
 */
export const commercialResolver: ContactEnrichmentProvider = {
  id: 'commercial', paid: true, costCents: 0,
  async resolve() {
    return { provider: 'commercial', costCents: 0, creditsUsed: 0, found: [], skipped: 'not_configured' };
  },
};

export const DEFAULT_ENRICHMENT_CHAIN: ContactEnrichmentProvider[] = [freePublicResolver, websiteResolver, osmResolver, commercialResolver];

export interface CommercialGate {
  qualified: boolean;
  score: number | null;
  minScore: number;
  missingRequired: boolean;
  userDemand: boolean;
}

/** La règle, en pur : un fournisseur payant seulement si tout est réuni. */
export function shouldUseCommercialProvider(gate: CommercialGate): boolean {
  return gate.qualified && gate.score !== null && gate.score >= gate.minScore && gate.missingRequired && gate.userDemand;
}

export async function recordEnrichmentCost(
  db: Db,
  entry: { companyId: string | null; provider: string; costCents: number; creditsUsed?: number; outcome: string },
): Promise<void> {
  await db.from('enrichment_costs').insert({
    company_id: entry.companyId, provider: entry.provider, cost_cents: entry.costCents,
    credits_used: entry.creditsUsed ?? 0, outcome: entry.outcome,
  });
}

export interface EnrichmentRunReport {
  steps: { provider: string; costCents: number; skipped: string | null; stillMissing: MissingChannel[] }[];
  resolved: ResolvedContacts | null;
  costCents: number;
}

/**
 * Déroule la chaîne jusqu'à ce que plus rien ne manque. Les gratuits sans
 * condition ; le payant derrière la règle. Chaque appel payant est compté.
 */
export async function runEnrichmentChain(
  db: Db,
  context: EnrichmentContext,
  options: { providers?: ContactEnrichmentProvider[]; minScore?: number; logger?: Logger; signal?: AbortSignal } = {},
): Promise<EnrichmentRunReport> {
  const providers = options.providers ?? DEFAULT_ENRICHMENT_CHAIN;
  const report: EnrichmentRunReport = { steps: [], resolved: null, costCents: 0 };
  let missing = context.missing;
  for (const provider of providers) {
    if (missing.length === 0) break;
    if (provider.paid) {
      const allowed = shouldUseCommercialProvider({
        qualified: context.opportunityQualified ?? false,
        score: context.opportunityScore ?? null,
        minScore: options.minScore ?? 70,
        missingRequired: missing.length > 0,
        userDemand: context.userDemand ?? false,
      });
      if (!allowed) { report.steps.push({ provider: provider.id, costCents: 0, skipped: 'gate_closed', stillMissing: missing }); continue; }
    }
    const outcome = await provider.resolve(db, { ...context, missing }, { ...(options.logger ? { logger: options.logger } : {}), ...(options.signal ? { signal: options.signal } : {}) });
    if (outcome.resolved) report.resolved = outcome.resolved;
    missing = stillMissing(outcome.resolved, missing);
    if (provider.paid && !outcome.skipped) {
      report.costCents += outcome.costCents;
      await recordEnrichmentCost(db, { companyId: context.companyId, provider: provider.id, costCents: outcome.costCents, creditsUsed: outcome.creditsUsed, outcome: missing.length === 0 ? 'resolved' : 'partial' });
    }
    report.steps.push({ provider: provider.id, costCents: outcome.costCents, skipped: outcome.skipped ?? null, stillMissing: missing });
  }
  return report;
}
