import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { resolveCompanyContacts } from '../contacts/resolver';
import { moveContactsBeforeMerge } from '../contacts/ingest';

/**
 * BODACC → contact.
 *
 * Une annonce BODACC est un fait daté, fiable, identifié par SIREN — et
 * sans aucun moyen de joindre l'entreprise. Toutes celles créées par la
 * synchronisation finissaient « injoignables » au gate. Ici, chaque
 * entreprise BODACC sans contact est rapprochée de l'annuaire (les
 * entreprises OpenStreetMap, qui ont le téléphone) par le détecteur de
 * doublons existant ; si le rapprochement est sûr, les deux fiches
 * fusionnent — le SIREN et la date de création d'un côté, le téléphone et
 * le site de l'autre — puis le ContactResolver choisit les canaux.
 *
 * Aucun appel externe : le rapprochement lit la base, rien d'autre.
 */

export interface BodaccContactsReport {
  examined: number;
  matched: number;
  merged: number;
  resolved: number;
  nowContactable: number;
  ambiguous: number;
  unmatched: number;
  errors: number;
}

export interface BodaccContactsOptions {
  limit?: number;
  /** Score du détecteur de doublons au-dessus duquel on fusionne sans revue. */
  minScore?: number;
  dryRun?: boolean;
  logger?: Logger;
  signal?: AbortSignal;
}

/** La décision, en pur : un seul candidat sûr et joignable, sinon rien. */
export function decideBodaccMerge(
  candidates: { candidateId: string; score: number; hasContact: boolean }[],
  minScore: number,
): { action: 'merge'; candidateId: string; score: number } | { action: 'ambiguous' } | { action: 'none' } {
  const strong = candidates.filter((c) => c.score >= minScore && c.hasContact);
  if (strong.length === 1) return { action: 'merge', candidateId: strong[0]!.candidateId, score: strong[0]!.score };
  if (strong.length > 1) return { action: 'ambiguous' };
  return { action: 'none' };
}

export async function resolveBodaccContacts(db: Db, options: BodaccContactsOptions = {}): Promise<BodaccContactsReport> {
  const report: BodaccContactsReport = { examined: 0, matched: 0, merged: 0, resolved: 0, nowContactable: 0, ambiguous: 0, unmatched: 0, errors: 0 };
  const log = options.logger;
  const minScore = options.minScore ?? 0.9;
  const limit = Math.min(options.limit ?? 500, 1000);

  // Les entreprises nées d'une annonce : un SIREN, pas de source d'annuaire,
  // aucun canal, et un événement BODACC récent. On commence par les plus
  // récentes : c'est là que l'intention est la plus chaude.
  const { data: events, error } = await db
    .from('company_events')
    .select('company_id, occurred_at')
    .like('event_type', 'bodacc_%')
    .gte('occurred_at', new Date(Date.now() - 120 * 86_400_000).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(limit * 4);
  if (error) throw new Error(`resolveBodaccContacts : ${error.message}`);

  const ids = [...new Set((events ?? []).map((e) => e.company_id))];
  const targets: { id: string }[] = [];
  for (let i = 0; i < ids.length && targets.length < limit; i += 200) {
    const { data: rows } = await db
      .from('companies')
      .select('id')
      .in('id', ids.slice(i, i + 200))
      .eq('has_contact', false)
      .is('best_email', null)
      .eq('prospecting_allowed', true)
      .not('siren', 'is', null);
    for (const row of rows ?? []) if (targets.length < limit) targets.push(row);
  }

  for (const target of targets) {
    if (options.signal?.aborted) break;
    report.examined += 1;
    try {
      const { data: found, error: findError } = await db.rpc('find_duplicate_candidates', {
        target_id: target.id, min_score: 0.7, max_results: 5,
      });
      if (findError) throw new Error(findError.message);

      const candidateIds = (found ?? []).map((c) => c.candidate_id);
      const contactable = new Set<string>();
      if (candidateIds.length > 0) {
        const { data: rows } = await db.from('companies').select('id, has_contact, best_email').in('id', candidateIds);
        for (const row of rows ?? []) if (row.has_contact || row.best_email) contactable.add(row.id);
      }
      const decision = decideBodaccMerge(
        (found ?? []).map((c) => ({ candidateId: c.candidate_id, score: Number(c.score), hasContact: contactable.has(c.candidate_id) })),
        minScore,
      );

      if (decision.action === 'none') { report.unmatched += 1; continue; }
      if (decision.action === 'ambiguous') { report.ambiguous += 1; continue; }
      report.matched += 1;
      if (options.dryRun) continue;

      // Le survivant est choisi par la règle commune (identité la plus sûre,
      // le plus de données) ; la fusion garde ce que chacun apporte.
      const { data: survivorId, error: pickError } = await db.rpc('pick_merge_survivor', { a_id: target.id, b_id: decision.candidateId });
      if (pickError || !survivorId) throw new Error(pickError?.message ?? 'survivant introuvable');
      const absorbed = survivorId === target.id ? decision.candidateId : target.id;
      const evidence = (found ?? []).find((c) => c.candidate_id === decision.candidateId)?.evidence ?? [];
      // Les contacts de l'absorbée passent au survivant AVANT la fusion :
      // la fusion supprime la ligne absorbée, et ses contacts avec elle.
      await moveContactsBeforeMerge(db, absorbed, survivorId);
      const { error: mergeError } = await db.rpc('merge_companies', {
        p_survivor_id: survivorId, p_absorbed_id: absorbed, p_score: decision.score, p_evidence: evidence, p_decided_by: 'bodacc-contacts',
      });
      if (mergeError) throw new Error(mergeError.message);
      report.merged += 1;

      const resolved = await resolveCompanyContacts(db, survivorId);
      report.resolved += 1;
      if (resolved.readiness.contactable) report.nowContactable += 1;
    } catch (cause: unknown) {
      report.errors += 1;
      log?.warn('Rapprochement BODACC en échec', { company_id: target.id, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  log?.info('BODACC → contacts', { ...report, dry_run: options.dryRun ?? false });
  return report;
}
