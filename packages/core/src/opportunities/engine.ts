import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import type { OpportunityType } from '../domain/types';
import { scoreAll, type ScoringSignal, type ScoredOpportunity, type ScoringInput } from './scoring';

/**
 * Moteur d'opportunités.
 *
 * Dernier maillon de la chaîne : fait → événement → signal → OPPORTUNITÉ.
 *
 * Le quality gate est ce qui sépare un produit d'une liste de prospects. Une
 * opportunité qui ne le franchit pas n'entre pas en stock — mieux vaut livrer
 * trois opportunités solides que cinq dont deux feront perdre son temps au
 * freelance et sa crédibilité au produit.
 */

export interface QualityGate {
  minBaseScore: number;
  minConfidence: number;
  minIdentityConfidence: number;
  /** Le gate de contact du V1 : téléphone ou formulaire. */
  requireContact: boolean;
  opportunityTtlDays: number;
}

export const DEFAULT_GATE: QualityGate = {
  minBaseScore: 55,
  minConfidence: 0.6,
  minIdentityConfidence: 0.75,
  requireContact: true,
  opportunityTtlDays: 30,
};

export interface OpportunityEngineReport {
  companiesExamined: number;
  scored: number;
  created: number;
  updated: number;
  /** Refusées par le gate, avec le motif : c'est ce qui permet de le calibrer. */
  rejected: number;
  rejectionReasons: Record<string, number>;
  byType: Record<string, number>;
  /** Retirées du stock parce que leur justification ne tient plus. */
  withdrawn: number;
  errors: number;
}

export interface OpportunityEngineOptions {
  limit?: number;
  gate?: Partial<QualityGate>;
  algorithmVersion?: string;
  logger?: Logger;
  signal?: AbortSignal;
  dryRun?: boolean;
}

interface CandidateRow {
  id: string;
  has_contact: boolean;
  identity_confidence: number;
  domain: string | null;
  prospecting_allowed: boolean;
  suppression_global: boolean;
  cooldown_until: string | null;
}

export async function runOpportunityEngine(
  db: Db,
  options: OpportunityEngineOptions = {},
): Promise<OpportunityEngineReport> {
  const report: OpportunityEngineReport = {
    companiesExamined: 0, scored: 0, created: 0, updated: 0,
    rejected: 0, rejectionReasons: {}, byType: {}, withdrawn: 0, errors: 0,
  };

  const log = options.logger;
  const gate = { ...DEFAULT_GATE, ...options.gate };
  const version = options.algorithmVersion ?? 'v0';
  const now = Date.now();

  // Deux populations, et une seule requête.
  //
  // Les entreprises portant un déclencheur actif produisent les opportunités
  // datées. Celles qui n'ont que des signaux d'état peuvent tout de même
  // produire une opportunité de diagnostic — refonte uniquement, et sous
  // condition de densité — d'où la seconde branche. Les entreprises sans
  // aucun signal ne sont jamais chargées.
  const { data: candidates, error } = await db
    .from('companies')
    .select('id, has_contact, identity_confidence, domain, prospecting_allowed, suppression_global, cooldown_until')
    .or('trigger_signal_count.gt.0,active_signal_count.gt.0')
    .eq('prospecting_allowed', true)
    .eq('suppression_global', false)
    .limit(options.limit ?? 2000);

  if (error) throw new Error(`runOpportunityEngine : ${error.message}`);

  const rows = (candidates ?? []) as CandidateRow[];
  if (rows.length === 0) return report;

  const reject = (reason: string): void => {
    report.rejected += 1;
    report.rejectionReasons[reason] = (report.rejectionReasons[reason] ?? 0) + 1;
  };

  const batchSize = 200;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    if (options.signal?.aborted) break;
    const batch = rows.slice(offset, offset + batchSize);
    const ids = batch.map((c) => c.id);

    // L'état du site conditionne le type d'opportunité possible : une adresse
    // réservée et vide appelle une création, un site en service une refonte.
    const domainNames = [...new Set(
      batch.map((c) => c.domain).filter((d): d is string => d !== null),
    )];
    const domainStatus = new Map<string, string>();
    if (domainNames.length > 0) {
      const { data: domains } = await db
        .from('domains')
        .select('domain, status')
        .in('domain', domainNames);
      for (const d of domains ?? []) domainStatus.set(d.domain, d.status);
    }

    const [signalsResult, existingResult] = await Promise.all([
      db
        .from('signals')
        .select('id, company_id, signal_type, kind, category, strength, confidence, trigger_event_id, detected_at')
        .in('company_id', ids)
        .eq('active', true),
      db
        .from('opportunities')
        .select('id, company_id, opportunity_type, base_score, status')
        .in('company_id', ids)
        .in('status', ['available', 'assigned']),
    ]);

    if (signalsResult.error) throw new Error(signalsResult.error.message);
    if (existingResult.error) throw new Error(existingResult.error.message);

    // Les événements portent la date réelle du fait, que le signal n'a pas :
    // un signal détecté aujourd'hui peut décrire une cession d'il y a un mois.
    const triggerEventIds = [...new Set(
      (signalsResult.data ?? [])
        .map((s) => s.trigger_event_id)
        .filter((id): id is string => id !== null),
    )];

    const eventDates = new Map<string, string>();
    if (triggerEventIds.length > 0) {
      const { data: events } = await db
        .from('company_events')
        .select('id, occurred_at, detected_at')
        .in('id', triggerEventIds);
      for (const event of events ?? []) {
        eventDates.set(event.id, event.occurred_at ?? event.detected_at);
      }
    }

    const signalsByCompany = new Map<string, ScoringSignal[]>();
    const signalIdsByCompany = new Map<string, Map<string, string>>();

    for (const row of signalsResult.data ?? []) {
      const list = signalsByCompany.get(row.company_id) ?? [];
      list.push({
        signalType: row.signal_type,
        kind: row.kind,
        category: row.category,
        strength: Number(row.strength),
        confidence: Number(row.confidence),
        occurredAt: row.trigger_event_id
          ? eventDates.get(row.trigger_event_id) ?? row.detected_at
          : null,
        triggerEventId: row.trigger_event_id,
      });
      signalsByCompany.set(row.company_id, list);

      const idMap = signalIdsByCompany.get(row.company_id) ?? new Map();
      idMap.set(row.signal_type, row.id);
      signalIdsByCompany.set(row.company_id, idMap);
    }

    const existingByCompany = new Map<
      string,
      Map<OpportunityType, { id: string; status: string }>
    >();
    for (const row of existingResult.data ?? []) {
      const map = existingByCompany.get(row.company_id) ?? new Map();
      map.set(row.opportunity_type, { id: row.id, status: row.status });
      existingByCompany.set(row.company_id, map);
    }

    const toInsert: Record<string, Json>[] = [];
    const toUpdate: { id: string; scored: ScoredOpportunity; signalIds: string[] }[] = [];
    const toWithdraw: string[] = [];

    for (const company of batch) {
      report.companiesExamined += 1;

      const signals = signalsByCompany.get(company.id) ?? [];
      if (signals.length === 0) continue;

      const scoredTypes = new Set<OpportunityType>();
      const scored = scoreAll({
        signals,
        identityConfidence: Number(company.identity_confidence),
        // Un domaine jamais scanné n'est pas un site constaté : on ne lui
        // prête ni l'un ni l'autre statut.
        websiteStatus: (company.domain !== null
          ? domainStatus.get(company.domain) ?? null
          : null) as ScoringInput['websiteStatus'],
        now,
      });

      report.scored += scored.length;
      const existing = existingByCompany.get(company.id) ?? new Map();
      const idMap = signalIdsByCompany.get(company.id) ?? new Map<string, string>();

      for (const opportunity of scored) {
        scoredTypes.add(opportunity.type);

        // ── Quality gate ────────────────────────────────────────────────
        //
        // L'ordre des contrôles va du plus structurel au plus fin : le motif
        // remonté doit désigner la cause première, pas une conséquence.
        if (gate.requireContact && !company.has_contact) { reject('entreprise injoignable'); continue; }
        if (company.cooldown_until !== null) { reject('cooldown actif'); continue; }
        if (Number(company.identity_confidence) < gate.minIdentityConfidence) {
          reject('identité mal établie'); continue;
        }
        if (opportunity.confidenceScore < gate.minConfidence) { reject('confiance insuffisante'); continue; }
        if (opportunity.baseScore < gate.minBaseScore) { reject('score sous le seuil'); continue; }

        report.byType[opportunity.type] = (report.byType[opportunity.type] ?? 0) + 1;

        const signalIds = opportunity.signalTypes
          .map((type) => idMap.get(type))
          .filter((id): id is string => id !== undefined);

        const current = existing.get(opportunity.type);
        if (current) {
          // Une opportunité déjà attribuée ne bouge plus : le freelance
          // travaille dessus avec les informations qu'on lui a données.
          if (current.status === 'assigned') continue;
          toUpdate.push({ id: current.id, scored: opportunity, signalIds });
        } else {
          toInsert.push(buildRow(company.id, opportunity, signalIds, version, gate));
        }
      }

      // Une opportunité dont la justification ne tient plus doit sortir du
      // stock, pas y rester en silence. Le cas s'est produit : un site dont on
      // avait conclu à tort qu'il n'était pas adapté au mobile gardait son
      // opportunité, et le constat corrigé n'y changeait rien — le freelance
      // aurait reçu un argument que l'entreprise pouvait réfuter en ouvrant
      // son téléphone.
      //
      // Les opportunités déjà attribuées ne sont pas touchées : le freelance
      // travaille dessus, et c'est l'expiration de l'attribution qui tranche.
      for (const [type, existingRow] of existing) {
        if (scoredTypes.has(type)) continue;
        if (existingRow.status === 'assigned') continue;
        toWithdraw.push(existingRow.id);
      }
    }

    if (options.dryRun) {
      report.created += toInsert.length;
      report.updated += toUpdate.length;
      report.withdrawn += toWithdraw.length;
      continue;
    }

    try {
      if (toWithdraw.length > 0) {
        const { error: withdrawError } = await db
          .from('opportunities')
          .update({ status: 'expired' })
          .in('id', toWithdraw);
        if (withdrawError) report.errors += 1;
        else report.withdrawn += toWithdraw.length;
      }

      if (toInsert.length > 0) {
        const { data, error: insertError } = await db
          .from('opportunities')
          .insert(toInsert as never)
          .select('id');
        if (insertError) throw new Error(insertError.message);
        report.created += data?.length ?? 0;
      }

      for (const entry of toUpdate) {
        const { error: updateError } = await db
          .from('opportunities')
          .update({
            need_score: entry.scored.needScore,
            timing_score: entry.scored.timingScore,
            freshness_factor: entry.scored.freshnessFactor,
            confidence_score: entry.scored.confidenceScore,
            base_score: entry.scored.baseScore,
            reason_data: entry.scored.reason as Json,
            signal_ids: entry.signalIds,
            trigger_event_id: entry.scored.triggerEventId,
            algorithm_version: version,
          })
          .eq('id', entry.id);

        if (updateError) { report.errors += 1; continue; }
        report.updated += 1;
      }
    } catch (batchError: unknown) {
      report.errors += batch.length;
      log?.error('Lot d’opportunités en échec', {
        error: batchError instanceof Error ? batchError.message : String(batchError),
      });
    }
  }

  log?.info('Moteur d’opportunités terminé', {
    examined: report.companiesExamined,
    created: report.created,
    updated: report.updated,
    withdrawn: report.withdrawn,
    rejected: report.rejected,
  });

  return report;
}

function buildRow(
  companyId: string,
  opportunity: ScoredOpportunity,
  signalIds: string[],
  version: string,
  gate: QualityGate,
): Record<string, Json> {
  return {
    company_id: companyId,
    opportunity_type: opportunity.type,
    need_score: opportunity.needScore,
    timing_score: opportunity.timingScore,
    freshness_factor: opportunity.freshnessFactor,
    confidence_score: opportunity.confidenceScore,
    base_score: opportunity.baseScore,
    trigger_event_id: opportunity.triggerEventId,
    signal_ids: signalIds,
    reason_data: opportunity.reason as Json,
    algorithm_version: version,
    expires_at: new Date(Date.now() + gate.opportunityTtlDays * 86_400_000).toISOString(),
  };
}
