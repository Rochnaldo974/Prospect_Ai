import type { Db } from '../db/client';
import type { Logger } from '../logger';
import type { OpportunityType } from '../domain/types';
import type { Json } from '../db/database.types';
import {
  isEligible, explainMatch,
  type OpportunityCandidate, type MatchingPreferences, type MatchExplanation,
} from './fit';
import { defaultVerifier, type OpportunityVerifier } from './verify';

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
  /** Écartées à la vérification avant livraison : le site ne montre plus le défaut. */
  rejectedByVerification: number;
  /** Dossiers échangés pour qu'un lot compte au moins une adresse e-mail. */
  swappedForEmail: number;
  /** Dossiers sautés une première fois pour garder le lot varié. */
  passedOverForDiversity: number;
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
  /**
   * Vérification avant livraison. Par défaut, chaque dossier choisi est
   * revisité et recalculé à l'instant ; `false` la désactive (tests,
   * mesures), une fonction la remplace.
   */
  verify?: OpportunityVerifier | false;
}

interface CandidateRow extends OpportunityCandidate {
  opportunityId: string;
  companyId: string;
  /** Ce qui porte le dossier : le fait daté, sinon le constat le plus lourd. */
  theme: string;
  /** Une adresse écrite exploitable (best_email) : l'e-mail est envoyable. */
  hasEmail: boolean;
  /** Un téléphone : le dossier d'un compte gratuit. */
  phoneReady: boolean;
}

/** Combien de dossiers d'un même thème dans un lot : au-delà, la journée se répète. */
const MAX_PER_THEME = 2;

/** Les plafonds de variété d'un lot : thème, type d'opportunité, secteur. */
export interface DiversityCaps { perTheme: number; perType: number; perIndustry: number }

/** Le secteur au sens du lot : les deux premiers chiffres du NAF, « 56 » pour toute la restauration. */
export const industryFamily = (code: string | null): string => (code ?? '??').slice(0, 2);

/**
 * Un dossier de plus tient-il dans le lot sans le rendre répétitif ?
 *
 * Trois compteurs, trois plafonds. On descend le classement en refusant ce
 * qui dépasse ; si le stock ne permet pas la variété, l'appelant complète
 * ensuite sans la contrainte plutôt que de livrer moins.
 */
export function withinCaps(
  candidate: { theme: string; opportunityType: string; industryCode: string | null },
  counts: { theme: Map<string, number>; type: Map<string, number>; industry: Map<string, number> },
  caps: DiversityCaps,
): boolean {
  // Un secteur inconnu n'est pas « le même secteur » : deux entreprises sans
  // code NAF n'ont rien en commun qu'on puisse répéter.
  const industryOk = candidate.industryCode === null
    || (counts.industry.get(industryFamily(candidate.industryCode)) ?? 0) < caps.perIndustry;
  return (counts.theme.get(candidate.theme) ?? 0) < caps.perTheme
    && (counts.type.get(candidate.opportunityType) ?? 0) < caps.perType
    && industryOk;
}

/** Les plafonds, puis le double, puis plus de plafond. */
export const RELAXATION_STEPS = [1, 2, Number.POSITIVE_INFINITY] as const;

export function relaxCaps(caps: DiversityCaps, factor: number): DiversityCaps {
  return { perTheme: caps.perTheme * factor, perType: caps.perType * factor, perIndustry: caps.perIndustry * factor };
}

function uncountIn(
  candidate: { theme: string; opportunityType: string; industryCode: string | null },
  counts: { theme: Map<string, number>; type: Map<string, number>; industry: Map<string, number> },
): void {
  counts.theme.set(candidate.theme, Math.max(0, (counts.theme.get(candidate.theme) ?? 0) - 1));
  counts.type.set(candidate.opportunityType, Math.max(0, (counts.type.get(candidate.opportunityType) ?? 0) - 1));
  const family = industryFamily(candidate.industryCode);
  counts.industry.set(family, Math.max(0, (counts.industry.get(family) ?? 0) - 1));
}

function countIn(
  candidate: { theme: string; opportunityType: string; industryCode: string | null },
  counts: { theme: Map<string, number>; type: Map<string, number>; industry: Map<string, number> },
): void {
  counts.theme.set(candidate.theme, (counts.theme.get(candidate.theme) ?? 0) + 1);
  counts.type.set(candidate.opportunityType, (counts.type.get(candidate.opportunityType) ?? 0) + 1);
  const family = industryFamily(candidate.industryCode);
  counts.industry.set(family, (counts.industry.get(family) ?? 0) + 1);
}

/**
 * Combien de dossiers avec e-mail un lot doit compter, quand le stock le
 * permet : deux sur cinq, un sur moins. L'outil vend l'e-mail personnalisé ;
 * un matin sans une seule adresse à qui l'envoyer est un matin où il ne sert
 * à rien.
 */
function emailFloor(limit: number): number {
  return limit >= 5 ? 2 : Math.min(1, limit);
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
    rejectedByGuards: 0, rejectedByVerification: 0, swappedForEmail: 0, passedOverForDiversity: 0, errors: 0,
  };

  const log = options.logger;
  const random = options.random ?? Math.random;
  const version = options.algorithmVersion ?? 'v0';
  const verify: OpportunityVerifier | null = options.verify === false
    ? null
    : options.verify ?? defaultVerifier(db, { ...(log ? { logger: log } : {}) });
  // Un dossier vérifié une fois dans la passe l'est pour tout le monde : le
  // site ne change pas entre deux abonnés servis à quelques secondes d'écart.
  const verdicts = new Map<string, boolean>();

  let profileQuery = db
    .from('profiles')
    .select('id, city, region, daily_opportunity_limit, plan')
    .eq('onboarding_completed', true);

  if (options.userId) profileQuery = profileQuery.eq('id', options.userId);

  const { data: profiles, error } = await profileQuery;
  if (error) throw new Error(`runAllocation : ${error.message}`);
  if (!profiles || profiles.length === 0) return report;

  // L'ordre de service est MÉLANGÉ à chaque passe. Sans cela, les profils
  // sortent de la requête dans un ordre stable : quand deux abonnés ont des
  // préférences qui se recouvrent, le même passe premier tous les jours et
  // rafle systématiquement les meilleurs scores. Le tirage utilise le
  // générateur du run — déterministe pour une graine donnée, donc les tests
  // restent rejouables.
  const order = [...profiles];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  // Une entreprise n'a qu'une attribution vivante à la fois : la base le
  // garantit, mais s'y fier seul ferait perdre au deuxième servi une place de
  // sa journée à chaque collision, au lieu de lui donner la suivante. On tient
  // donc le compte de ce qui vient d'être pris.
  const taken = new Set<string>();

  for (const profile of order) {
    if (options.signal?.aborted) break;
    report.usersExamined += 1;

    try {
      const served = await allocateFor(
        db, profile, taken, report, random, version, log, verify, verdicts,
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
 * Les candidates d'un profil, choisies en base.
 *
 * La fonction SQL fait tout ce qui n'a pas besoin de lire le dossier :
 * statut et validité de l'opportunité, garde-fous de l'entreprise, mémoire
 * du freelance (issue déclarée = jamais, sinon trente jours), services
 * choisis, secteurs exclus, zone, téléphone exigé pour le gratuit. Ce qui
 * revient est trié par score ; Node applique l'adéquation fine et la
 * vérification. Le plafond se règle en base (allocation_candidates_per_user).
 */
interface RankedEntry { candidate: CandidateRow; score: number; explanation: MatchExplanation }

async function loadDiversityCaps(db: Db): Promise<DiversityCaps> {
  const [{ data: perType }, { data: perIndustry }] = await Promise.all([
    db.rpc('engine_setting_int', { p_key: 'allocation_max_per_type', p_default: 3 }),
    db.rpc('engine_setting_int', { p_key: 'allocation_max_per_industry', p_default: 2 }),
  ]);
  return { perTheme: MAX_PER_THEME, perType: perType ?? 3, perIndustry: perIndustry ?? 2 };
}

async function loadCandidatesFor(
  db: Db,
  profile: { id: string; plan: 'free' | 'premium' },
  preferences: MatchingPreferences,
): Promise<CandidateRow[]> {
  const { data: perUser } = await db.rpc('engine_setting_int', { p_key: 'allocation_candidates_per_user', p_default: 300 });
  const total = perUser ?? 300;

  // Un appel par service coché, à part égale : trié par score global, le
  // stock d'un seul type — les refontes, toujours mieux notées — remplirait
  // les trois cents places et les créations n'arriveraient jamais jusqu'au
  // lot. Sans service coché, un seul appel, tous types confondus.
  const services: (OpportunityType[])[] = preferences.services.length > 1
    ? preferences.services.map((s) => [s as OpportunityType])
    : [preferences.services as OpportunityType[]];
  const share = Math.max(20, Math.ceil(total / services.length));

  const rows: Awaited<ReturnType<typeof selectFor>> = [];
  const selectFor = async (list: OpportunityType[]) => {
    const { data, error } = await db.rpc('select_allocation_candidates', {
      p_user_id: profile.id,
      p_services: list,
      p_location_mode: preferences.locationMode,
      p_city: preferences.city,
      p_region: preferences.region,
      p_excluded_industries: preferences.excludedIndustries,
      p_require_phone: profile.plan === 'free',
      p_limit: share,
      p_exclude_associations: preferences.excludeAssociations,
    });
    if (error) throw new Error(`loadCandidatesFor : ${error.message}`);
    return data ?? [];
  };
  for (const list of services) rows.push(...(await selectFor(list)));

  return rows.map((row) => {
    const reason = row.reason_data as { trigger?: string | null; trigger_occurred_at?: string | null; need_breakdown?: { signal: string; points: number }[] } | null;
    const strongest = [...(reason?.need_breakdown ?? [])].sort((a, b) => b.points - a.points)[0]?.signal;
    return {
      opportunityId: row.opportunity_id,
      companyId: row.company_id,
      theme: reason?.trigger ?? strongest ?? row.opportunity_type,
      hasEmail: row.best_email !== null,
      phoneReady: row.phone_ready,
      opportunityType: row.opportunity_type as OpportunityType,
      baseScore: Number(row.base_score),
      confidenceScore: Number(row.confidence_score),
      city: row.city,
      region: row.region,
      industryCode: row.industry_code,
      cms: row.cms,
      triggerType: reason?.trigger ?? null,
      triggerOccurredAt: reason?.trigger_occurred_at ?? null,
      createdAt: row.created_at,
    };
  });
}

async function allocateFor(
  db: Db,
  profile: { id: string; city: string | null; region: string | null; daily_opportunity_limit: number; plan: 'free' | 'premium' },
  taken: Set<string>,
  report: AllocationReport,
  random: () => number,
  version: string,
  log: Logger | undefined,
  verify: OpportunityVerifier | null,
  verdicts: Map<string, boolean>,
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

  // Le stock, filtré en base pour ce profil : statut, validité, garde-fous,
  // mémoire du freelance, services choisis, secteurs exclus, zone, canal.
  // Plus de plafond à mille lignes chargées pour tout le monde : chaque
  // profil reçoit ses trois cents meilleures candidates, déjà triées.
  const candidates = (await loadCandidatesFor(db, profile, preferences))
    .filter((c) => !taken.has(c.companyId));

  // La mémoire par personne : les exclusions globales — cooldown,
  // exclusivité — n'empêchent pas une entreprise de REVENIR AU MÊME
  // freelance après leur échéance. Or celui qui a déclaré une issue l'a
  // déjà travaillée : la lui reproposer, même six mois après, c'est lui
  // faire rappeler son propre historique. Exclusion définitive dans ce
  // cas ; trente jours de silence pour un dossier expiré sans avoir été
  // traité — le remontrer plus tard est une seconde chance, le remontrer
  // le lendemain est un bégaiement.
  const { data: history } = await db
    .from('assignments')
    .select('company_id, outcome, assigned_at')
    .eq('user_id', profile.id);

  const recentCutoff = Date.now() - 30 * 86_400_000;
  const alreadySeen = new Set<string>();
  for (const row of history ?? []) {
    if (row.outcome !== null || new Date(row.assigned_at).getTime() > recentCutoff) {
      alreadySeen.add(row.company_id);
    }
  }

  // Un compte gratuit prospecte au téléphone : sans numéro, le dossier ne
  // lui sert à rien. Le premium reçoit tout ce qui se prospecte.
  const eligible = candidates.filter(
    (c) => !alreadySeen.has(c.companyId) && isEligible(c, preferences)
      && (profile.plan !== 'free' || c.phoneReady),
  );
  if (eligible.length === 0) return 0;

  const limit = profile.plan === 'free' ? 1 : profile.daily_opportunity_limit;
  const ranked = eligible
    .map((c) => {
      const explanation = explainMatch(c, preferences);
      return { candidate: c, score: explanation.match, explanation };
    })
    .sort((a, b) => b.score - a.score);
  const caps = await loadDiversityCaps(db);

  // Chaque dossier est vérifié avant d'être retenu : on descend le
  // classement jusqu'à en avoir assez qui tiennent. Un dossier écarté ici
  // n'est pas perdu pour le produit — le moteur l'a retiré du stock, et il
  // reviendra si les faits reviennent.
  const holds = async (entry: RankedEntry): Promise<boolean> => {
    if (verify === null) return true;
    const cached = verdicts.get(entry.candidate.opportunityId);
    if (cached !== undefined) return cached;
    let verdict = false;
    try {
      verdict = await verify({
        companyId: entry.candidate.companyId,
        opportunityId: entry.candidate.opportunityId,
      });
    } catch (cause: unknown) {
      // Une vérification qui échoue n'est pas une vérification réussie.
      log?.warn('Vérification avant livraison en échec', {
        company_id: entry.candidate.companyId,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
    verdicts.set(entry.candidate.opportunityId, verdict);
    if (!verdict) report.rejectedByVerification += 1;
    return verdict;
  };

  // Un lot varié : cinq « certificat expiré » d'affilée, même vrais, font
  // une journée qui se répète et un freelance qui ne clique plus. On descend
  // le classement en limitant chaque thème ; si le stock ne permet pas la
  // variété, on complète ensuite sans la contrainte plutôt que de livrer
  // moins.
  // Trois passes, de la plus exigeante à la plus souple : les plafonds tels
  // quels, puis doublés, puis levés. Un stock étroit — un seul service coché,
  // tous les dossiers dans la restauration — remplit quand même le lot, mais
  // la variété est cherchée d'abord, pas abandonnée au premier refus.
  const chosen: RankedEntry[] = [];
  const counts = { theme: new Map<string, number>(), type: new Map<string, number>(), industry: new Map<string, number>() };
  const inBatchIds = new Set<string>();
  for (const factor of RELAXATION_STEPS) {
    const step = relaxCaps(caps, factor);
    for (const entry of ranked) {
      if (chosen.length >= limit) break;
      if (inBatchIds.has(entry.candidate.opportunityId)) continue;
      if (verdicts.get(entry.candidate.opportunityId) === false) continue;
      if (!withinCaps(entry.candidate, counts, step)) { if (factor === 1) report.passedOverForDiversity += 1; continue; }
      if (await holds(entry)) {
        chosen.push(entry);
        inBatchIds.add(entry.candidate.opportunityId);
        countIn(entry.candidate, counts);
      }
    }
    if (chosen.length >= limit) break;
  }


  // Le tirage de contrôle remplace une place, il n'en ajoute pas : le
  // freelance reçoit toujours le même nombre d'opportunités, dont une qui ne
  // doit rien au moteur. La remplacée est la dernière du classement — celle
  // dont on perd le moins en la sacrifiant. Le dossier tiré est vérifié
  // comme les autres : le hasard ne dispense pas de la vérité.
  let controlIndex: number | null = null;
  if (chosen.length === limit && limit >= CONTROL_RATE) {
    const pool = ranked.filter((e) => !inBatchIds.has(e.candidate.opportunityId) && verdicts.get(e.candidate.opportunityId) !== false);
    for (let attempt = 0; attempt < 3 && pool.length > 0; attempt += 1) {
      const at = Math.floor(random() * pool.length);
      const drawn = pool.splice(at, 1)[0]!;
      if (await holds(drawn)) {
        controlIndex = chosen.length - 1;
        chosen[controlIndex] = drawn;
        break;
      }
    }
  }

  // Un lot où l'on peut écrire. Le freelance paie pour un e-mail
  // personnalisé : s'il n'a que des téléphones, il ne l'utilisera pas. Quand
  // le lot manque d'adresses, on cède la place du moins bien classé des
  // dossiers sans e-mail — jamais celle du tirage de contrôle — au meilleur
  // dossier avec e-mail qui tient encore à la vérification. Sans stock
  // d'adresses, le lot reste tel quel : on ne livre pas moins pour ça.
  const floor = emailFloor(limit);
  let emailed = chosen.filter((entry) => entry.candidate.hasEmail).length;
  if (emailed < floor && chosen.length === limit) {
    const inBatch = new Set(chosen.map((entry) => entry.candidate.opportunityId));
    const spare = ranked.filter((entry) => entry.candidate.hasEmail
      && !inBatch.has(entry.candidate.opportunityId)
      && verdicts.get(entry.candidate.opportunityId) !== false);
    // L'échange respecte la variété, plafonds doublés : gagner une adresse
    // ne doit pas rendre au lot le quatrième restaurant qu'on venait d'écarter.
    const swapCaps = relaxCaps(caps, 2);
    for (const entry of spare) {
      if (emailed >= floor) break;
      let seat = -1;
      for (let i = chosen.length - 1; i >= 0; i -= 1) {
        if (i !== controlIndex && !chosen[i]!.candidate.hasEmail) { seat = i; break; }
      }
      if (seat < 0) break;
      const leaving = chosen[seat]!.candidate;
      uncountIn(leaving, counts);
      if (!withinCaps(entry.candidate, counts, swapCaps) || !(await holds(entry))) { countIn(leaving, counts); continue; }
      chosen[seat] = entry;
      countIn(entry.candidate, counts);
      emailed += 1;
      report.swappedForEmail += 1;
    }
    // Le rang suit le score, contrôle exclu : un dossier entré par la petite
    // porte n'a pas à passer devant ceux qui l'avaient mérité.
    const control = controlIndex === null ? null : chosen[controlIndex]!;
    const others = chosen.filter((entry) => entry !== control).sort((a, b) => b.score - a.score);
    chosen.splice(0, chosen.length, ...others, ...(control ? [control] : []));
    if (control) controlIndex = chosen.length - 1;
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
    // L'attribution et le passage de l'opportunité à « assigned » dans une
    // seule transaction : une opportunité prise entre-temps fait échouer
    // l'appel, et rien n'est écrit.
    const { error: insertError } = await db.rpc('assign_opportunity', {
      p_user_id: profile.id,
      p_opportunity_id: entry.candidate.opportunityId,
      p_batch_id: batch?.id ?? null,
      p_rank: index + 1,
      p_match_score: entry.score,
      p_is_control: index === controlIndex,
      p_exclusive_until: exclusiveUntil,
      p_match_data: entry.explanation as unknown as Json,
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
    .select('services, technologies, location_mode, city, region, preferred_industries, excluded_industries, exclude_associations')
    .eq('user_id', profile.id)
    .maybeSingle();

  return {
    services: (data?.services ?? []) as string[],
    technologies: (data?.technologies ?? []) as string[],
    // Sans préférence enregistrée, on ne restreint rien : mieux vaut proposer
    // large que ne rien proposer à un freelance qui n'a pas fini son
    // paramétrage.
    locationMode: (data?.location_mode ?? 'france') as MatchingPreferences['locationMode'],
    city: data?.city ?? profile.city,
    region: data?.region ?? profile.region,
    preferredIndustries: (data?.preferred_industries ?? []) as string[],
    excludedIndustries: (data?.excluded_industries ?? []) as string[],
    excludeAssociations: data?.exclude_associations ?? false,
  };
}
