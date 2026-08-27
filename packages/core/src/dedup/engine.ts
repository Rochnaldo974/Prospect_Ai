import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';

/**
 * Déduplication approchée.
 *
 * Les clés exactes — SIRET, SIREN, domaine — traitent la majorité des cas au
 * moment de l'ingestion. Ce module s'occupe du reste : les entreprises sans
 * identifiant, qui se recréaient à chaque import.
 *
 * Trois issues, jamais deux :
 *
 *   ≥ 0,90  fusion automatique — le faisceau d'indices ne laisse pas de doute
 *   ≥ 0,70  mise en revue — trop proche pour être ignoré, trop incertain pour
 *           décider seul
 *   <  0,70 entreprises distinctes
 *
 * Le seuil de fusion est volontairement haut. Une fusion abusive détruit de la
 * donnée et fait disparaître un prospect ; un doublon subsistant ne coûte
 * qu'une ligne et une attribution potentiellement redondante.
 */
export const AUTO_MERGE_THRESHOLD = 0.9;
export const REVIEW_THRESHOLD = 0.7;

export interface DuplicateCandidate {
  candidateId: string;
  score: number;
  evidence: Record<string, Json>;
}

export interface DedupReport {
  examined: number;
  merged: number;
  queued: number;
  skipped: number;
  errors: number;
  /** Répartition des scores, pour calibrer les seuils sur des données réelles. */
  scoreBuckets: Record<string, number>;
}

export interface DedupOptions {
  /** Nombre d'entreprises examinées. */
  limit?: number;
  /** N'examiner que les entreprises créées ou modifiées depuis cette date. */
  since?: Date;
  autoMergeThreshold?: number;
  reviewThreshold?: number;
  /** Ne rien fusionner : tout part en revue. Utile pour calibrer. */
  reviewOnly?: boolean;
  logger?: Logger;
  signal?: AbortSignal;
}

function bucketOf(score: number): string {
  if (score >= 0.95) return '0.95+';
  if (score >= 0.9) return '0.90-0.95';
  if (score >= 0.8) return '0.80-0.90';
  return '0.70-0.80';
}

/**
 * Parcourt les entreprises et traite leurs doublons.
 *
 * Une entreprise déjà fusionnée dans cette passe est ignorée : son identifiant
 * n'existe plus, et la retraiter produirait une erreur.
 */
export async function detectDuplicates(
  db: Db,
  options: DedupOptions = {},
): Promise<DedupReport> {
  const report: DedupReport = {
    examined: 0,
    merged: 0,
    queued: 0,
    skipped: 0,
    errors: 0,
    scoreBuckets: {},
  };

  const log = options.logger;
  const autoMerge = options.autoMergeThreshold ?? AUTO_MERGE_THRESHOLD;
  const review = options.reviewThreshold ?? REVIEW_THRESHOLD;
  const limit = options.limit ?? 1000;

  let query = db
    .from('companies')
    .select('id')
    // Les entreprises sans identifiant fort sont celles qui se dupliquent :
    // les autres sont déjà traitées par les clés exactes à l'ingestion.
    .is('siret', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.since) query = query.gte('updated_at', options.since.toISOString());

  const { data: targets, error } = await query;
  if (error) throw new Error(`detectDuplicates : ${error.message}`);

  const absorbed = new Set<string>();

  for (const target of targets ?? []) {
    if (options.signal?.aborted) break;
    if (absorbed.has(target.id)) {
      report.skipped += 1;
      continue;
    }

    report.examined += 1;

    const { data: candidates, error: candidateError } = await db.rpc(
      'find_duplicate_candidates',
      { target_id: target.id, min_score: review, max_results: 10 },
    );

    if (candidateError) {
      report.errors += 1;
      log?.warn('Recherche de doublons en échec', {
        company_id: target.id,
        error: candidateError.message,
      });
      continue;
    }

    for (const candidate of candidates ?? []) {
      if (absorbed.has(candidate.candidate_id)) continue;

      const score = Number(candidate.score);
      report.scoreBuckets[bucketOf(score)] = (report.scoreBuckets[bucketOf(score)] ?? 0) + 1;

      if (score >= autoMerge && !options.reviewOnly) {
        try {
          const { data: survivorId, error: pickError } = await db.rpc('pick_merge_survivor', {
            a_id: target.id,
            b_id: candidate.candidate_id,
          });
          if (pickError || !survivorId) throw new Error(pickError?.message ?? 'survivant introuvable');

          const loserId = survivorId === target.id ? candidate.candidate_id : target.id;

          const { error: mergeError } = await db.rpc('merge_companies', {
            p_survivor_id: survivorId,
            p_absorbed_id: loserId,
            p_score: score,
            p_evidence: candidate.evidence,
            p_decided_by: 'auto',
          });
          if (mergeError) throw new Error(mergeError.message);

          absorbed.add(loserId);
          report.merged += 1;

          log?.debug('Doublon fusionné', { survivor: survivorId, absorbed: loserId, score });

          // Le survivant peut être la cible elle-même : si elle a été absorbée,
          // inutile de continuer à lui chercher des doublons.
          if (loserId === target.id) break;
        } catch (mergeFailure: unknown) {
          report.errors += 1;
          log?.warn('Fusion refusée', {
            company_id: target.id,
            candidate_id: candidate.candidate_id,
            error: mergeFailure instanceof Error ? mergeFailure.message : String(mergeFailure),
          });
        }
        continue;
      }

      // Paire ordonnée : un même couple ne doit apparaître qu'une fois.
      const [a, b] = target.id < candidate.candidate_id
        ? [target.id, candidate.candidate_id]
        : [candidate.candidate_id, target.id];

      const { error: queueError } = await db
        .from('company_duplicate_candidates')
        .insert({ company_a_id: a, company_b_id: b, score, evidence: candidate.evidence });

      // 23505 : la paire est déjà en file, ce n'est pas une erreur.
      if (queueError && queueError.code !== '23505') {
        report.errors += 1;
        log?.warn('Mise en revue impossible', { error: queueError.message });
      } else if (!queueError) {
        report.queued += 1;
      }
    }
  }

  log?.info('Déduplication terminée', {
    examined: report.examined,
    merged: report.merged,
    queued: report.queued,
    errors: report.errors,
  });

  return report;
}

/** Arbitrage d'une paire mise en revue. */
export async function decideDuplicate(
  db: Db,
  pairId: string,
  decision: 'merge' | 'reject',
  decidedBy: string,
): Promise<{ survivorId: string | null }> {
  const { data: pair, error } = await db
    .from('company_duplicate_candidates')
    .select('*')
    .eq('id', pairId)
    .single();

  if (error) throw new Error(`decideDuplicate : ${error.message}`);
  if (pair.status !== 'pending') {
    throw new Error(`Cette paire a déjà été arbitrée (${pair.status}).`);
  }

  if (decision === 'reject') {
    await db
      .from('company_duplicate_candidates')
      .update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: decidedBy })
      .eq('id', pairId);
    return { survivorId: null };
  }

  const { data: survivorId, error: pickError } = await db.rpc('pick_merge_survivor', {
    a_id: pair.company_a_id,
    b_id: pair.company_b_id,
  });
  if (pickError || !survivorId) {
    throw new Error(`decideDuplicate : ${pickError?.message ?? 'survivant introuvable'}`);
  }

  const loserId = survivorId === pair.company_a_id ? pair.company_b_id : pair.company_a_id;

  const { error: mergeError } = await db.rpc('merge_companies', {
    p_survivor_id: survivorId,
    p_absorbed_id: loserId,
    p_score: Number(pair.score),
    p_evidence: pair.evidence,
    p_decided_by: decidedBy,
  });
  if (mergeError) throw new Error(`decideDuplicate : ${mergeError.message}`);

  // Sans effet dans le cas courant : la suppression de l'entreprise absorbée
  // a fait disparaître la paire par cascade. La trace de la décision vit dans
  // company_merges, qui enregistre le score, les indices et l'arbitre.
  await db
    .from('company_duplicate_candidates')
    .update({ status: 'merged', decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq('id', pairId);

  return { survivorId };
}
