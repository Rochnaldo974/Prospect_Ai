import type { Db } from '../db/client';
import type { Logger } from '../logger';
import type { OpportunityType } from '../domain/types';
import {
  isEligible, matchScore,
  type OpportunityCandidate, type MatchingPreferences,
} from './fit';

/**
 * Attribution quotidienne.
 *
 * Le moment où le produit tient ou ne tient pas sa promesse : cinq
 * opportunités, une fois par jour, pour ce freelance-là.
 *
 * Trois invariants sont garantis par la base et jamais par ce code — une
 * entreprise n'a qu'une attribution vivante à la fois, le plafond quotidien
 * est un déclencheur, une entreprise en cooldown ou en suppression est
 * refusée à l'insertion. Le moteur les respecte par construction, mais c'est
 * la base qui les fait respecter : un bug ici ne peut pas produire deux
 * freelances appelant le même commerçant le même matin.
 *
 * GROUPE CONTRÔLE — une opportunité sur cinq est tirée au hasard parmi les
 * candidates éligibles au lieu d'être choisie par le score, et marquée
 * `is_control`. Le drapeau n'apparaît nulle part dans l'interface : le
 * freelance ne doit pas pouvoir distinguer celle-là des autres, sinon la
 * comparaison ne mesure plus rien. C'est la seule façon de savoir si le
 * moteur vaut mieux que le hasard.
 */

export interface AllocationReport {
  usersExamined: number;
  usersServed: number;
  /** Déjà servis aujourd'hui : l'attribution est rejouable sans dégât. */
  usersAlreadyServed: number;
  assignmentsCreated: number;
  controlsPlaced: number;
  /** Servis en dessous de leur plafond, faute de stock à leur portée. */
  usersUnderserved: number;
  /** Refusées à l'écriture par les garde-fous de la base. */
  rejectedByGuards: number;
  errors: number;
}

export interface AllocationOptions {
  /** Restreindre à un utilisateur, pour tester ou rattraper. */
  userId?: string;
  logger?: Logger;
  signal?: AbortSignal;
  /** Tirage du groupe contrôle, injectable pour rendre les tests déterministes. */
  random?: () => number;
  algorithmVersion?: string;
}

interface CandidateRow extends OpportunityCandidate {
  opportunityId: string;
  companyId: string;
}

/** Une opportunité sur cinq, conformément à la décision de départ. */
const CONTROL_RATE = 5;

export async function runAllocation(
  db: Db,
  options: AllocationOptions = {},
): Promise<AllocationReport> {
  const report: AllocationReport = {
    usersExamined: 0, usersServed: 0, usersAlreadyServed: 0,
    assignmentsCreated: 0, controlsPlaced: 0, usersUnderserved: 0,
    rejectedByGuards: 0, errors: 0,
  };

  const log = options.logger;
  const random = options.random ?? Math.random;
  const version = options.algorithmVersion ?? 'v0';

  let profileQuery = db
    .from('profiles')
    .select('id, city, region, daily_opportunity_limit, plan')
    .eq('onboarding_completed', true);

  if (options.userId) profileQuery = profileQuery.eq('id', options.userId);

  const { data: profiles, error } = await profileQuery;
  if (error) throw new Error(`runAllocation : ${error.message}`);
  if (!profiles || profiles.length === 0) return report;

  const candidates = await loadCandidates(db);

  // Une entreprise n'a qu'une attribution vivante à la fois : la base le
  // garantit, mais s'y fier seul ferait perdre au deuxième servi une place de
  // sa journée à chaque collision, au lieu de lui donner la suivante. On tient
  // donc le compte de ce qui vient d'être pris.
  const taken = new Set<string>();

  for (const profile of profiles) {
    if (options.signal?.aborted) break;
    report.usersExamined += 1;

    try {
        const served = await allocateFor(
        db, profile, candidates.filter((c) => !taken.has(c.companyId)),
        taken, report, random, version, log,
      );
      if (served === null) report.usersAlreadyServed += 1;
    } catch (cause: unknown) {
      report.errors += 1;
      log?.error('Attribution en échec', {
        user_id: profile.id,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  log?.info('Attribution quotidienne terminée', {
    users_served: report.usersServed,
    assignments: report.assignmentsCreated,
    controls: report.controlsPlaced,
    underserved: report.usersUnderserved,
  });

  return report;
}

/**
 * Opportunités attribuables, chargées une seule fois pour tous les
 * utilisateurs — le stock est le même pour tout le monde, et le relire par
 * personne coûterait autant de requêtes que d'abonnés.
 */
async function loadCandidates(db: Db): Promise<CandidateRow[]> {
  const { data, error } = await db
    .from('opportunities')
    .select('id, company_id, opportunity_type, base_score, confidence_score, companies!inner(id, city, region, industry_code, prospecting_allowed, suppression_global, cooldown_until, has_live_assignment)')
    .eq('status', 'available')
    .gt('expires_at', new Date().toISOString())
    .order('base_score', { ascending: false })
    .limit(1000);

  if (error) throw new Error(`loadCandidates : ${error.message}`);

  const rows: CandidateRow[] = [];
  for (const row of data ?? []) {
    const company = row.companies as unknown as {
      city: string | null; region: string | null; industry_code: string | null;
      prospecting_allowed: boolean; suppression_global: boolean;
      cooldown_until: string | null; has_live_assignment: boolean;
    };

    // Ces conditions sont aussi des garde-fous en base ; les appliquer ici
    // évite de proposer une entreprise que l'insertion refusera, ce qui
    // coûterait une place dans la journée du freelance.
    if (!company.prospecting_allowed) continue;
    if (company.suppression_global) continue;
    if (company.cooldown_until !== null) continue;
    if (company.has_live_assignment) continue;

    rows.push({
      opportunityId: row.id,
      companyId: row.company_id,
      opportunityType: row.opportunity_type as OpportunityType,
      baseScore: Number(row.base_score),
      confidenceScore: Number(row.confidence_score),
      city: company.city,
      region: company.region,
      industryCode: company.industry_code,
    });
  }

  return rows;
}

async function allocateFor(
  db: Db,
  profile: { id: string; city: string | null; region: string | null; daily_opportunity_limit: number; plan: 'free' | 'premium' },
  candidates: CandidateRow[],
  taken: Set<string>,
  report: AllocationReport,
  random: () => number,
  version: string,
  log?: Logger,
): Promise<number | null> {
  const today = new Date();
  const dayStart = new Date(Date.UTC(
    today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(),
  ));

  // Le gratuit vit à la semaine : un dossier tous les sept jours, assez pour
  // juger le produit sur pièce, pas assez pour prospecter avec. La fenêtre
  // du payant reste la journée.
  const windowStart = profile.plan === 'free'
    ? new Date(dayStart.getTime() - 6 * 86_400_000).toISOString()
    : dayStart.toISOString();

  // Rejouable : relancer l'attribution deux fois dans la fenêtre ne double
  // pas les lots, et un incident nocturne se rattrape sans précaution.
  const { count } = await db
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .gte('assigned_at', windowStart);

  if ((count ?? 0) > 0) return null;

  const preferences = await loadPreferences(db, profile);
  const eligible = candidates.filter((c) => isEligible(c, preferences));
  if (eligible.length === 0) return 0;

  const limit = profile.plan === 'free' ? 1 : profile.daily_opportunity_limit;
  const ranked = eligible
    .map((c) => ({ candidate: c, score: matchScore(c, preferences) }))
    .sort((a, b) => b.score - a.score);

  const chosen = ranked.slice(0, limit);

  // Le tirage de contrôle remplace une place, il n'en ajoute pas : le
  // freelance reçoit toujours le même nombre d'opportunités, dont une qui ne
  // doit rien au moteur. La remplacée est la dernière du classement — celle
  // dont on perd le moins en la sacrifiant.
  let controlIndex: number | null = null;
  if (chosen.length === limit && limit >= CONTROL_RATE) {
    const pool = ranked.slice(limit);
    if (pool.length > 0) {
      const drawn = pool[Math.floor(random() * pool.length)]!;
      controlIndex = chosen.length - 1;
      chosen[controlIndex] = drawn;
    }
  }

  // Le lot est créé avant les attributions, qui le référencent. Son compte
  // livré est corrigé ensuite : ce qui compte est ce qui a réellement été
  // écrit, pas ce qu'on avait prévu d'écrire.
  const { data: batch, error: batchError } = await db
    .from('daily_batches')
    .insert({
      user_id: profile.id,
      batch_date: dayStart.toISOString().slice(0, 10),
      algorithm_version: version,
      requested_count: limit,
      delivered_count: 0,
      status: 'empty',
    })
    .select('id')
    .maybeSingle();

  if (batchError) throw new Error(`lot quotidien : ${batchError.message}`);

  const exclusiveUntil = new Date(Date.now() + 72 * 3_600_000).toISOString();
  let created = 0;

  for (const [index, entry] of chosen.entries()) {
    // Insertion une par une : les garde-fous lèvent une exception par ligne,
    // et un lot entier échouerait pour une seule entreprise devenue
    // inéligible entre le chargement et l'écriture.
    const { error: insertError } = await db.from('assignments').insert({
      user_id: profile.id,
      company_id: entry.candidate.companyId,
      opportunity_id: entry.candidate.opportunityId,
      batch_id: batch?.id ?? null,
      rank: index + 1,
      match_score: entry.score,
      is_control: index === controlIndex,
      exclusive_until: exclusiveUntil,
    });

    if (insertError) {
      // Une entreprise devenue inéligible entre le chargement et l'écriture
      // est un cas normal — les garde-fous font leur travail. Le taire
      // entièrement masquerait en revanche une erreur de programmation.
      report.rejectedByGuards += 1;
      log?.debug?.('Attribution refusée à l’insertion', {
        company_id: entry.candidate.companyId,
        error: insertError.message,
      });
      continue;
    }

    created += 1;
    taken.add(entry.candidate.companyId);
    if (index === controlIndex) report.controlsPlaced += 1;

    await db
      .from('opportunities')
      .update({ status: 'assigned' })
      .eq('id', entry.candidate.opportunityId);
  }

  if (batch) {
    await db
      .from('daily_batches')
      .update({
        delivered_count: created,
        status: created === 0 ? 'empty' : created < limit ? 'partial' : 'ready',
      })
      .eq('id', batch.id);
  }

  report.assignmentsCreated += created;
  if (created > 0) report.usersServed += 1;
  if (created < limit) report.usersUnderserved += 1;

  return created;
}

async function loadPreferences(
  db: Db,
  profile: { id: string; city: string | null; region: string | null },
): Promise<MatchingPreferences> {
  const { data } = await db
    .from('user_preferences')
    .select('services, location_mode, city, region, preferred_industries, excluded_industries')
    .eq('user_id', profile.id)
    .maybeSingle();

  return {
    services: (data?.services ?? []) as string[],
    // Sans préférence enregistrée, on ne restreint rien : mieux vaut proposer
    // large que ne rien proposer à un freelance qui n'a pas fini son
    // paramétrage.
    locationMode: (data?.location_mode ?? 'france') as MatchingPreferences['locationMode'],
    city: data?.city ?? profile.city,
    region: data?.region ?? profile.region,
    preferredIndustries: (data?.preferred_industries ?? []) as string[],
    excludedIndustries: (data?.excluded_industries ?? []) as string[],
  };
}
