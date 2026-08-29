import type { Json } from '../db/database.types';
import type { OpportunityType } from '../domain/types';
import { OPPORTUNITY_RULES, RISK_PENALTIES, TRIGGER_HALF_LIVES, type OpportunityRule } from './rules';

/**
 * Scoring d'une opportunité.
 *
 * Quatre composantes, jamais un chiffre unique — et deux d'entre elles sont
 * des ATTÉNUATEURS multiplicatifs, pas des mérites additifs :
 *
 *   besoin      l'entreprise semble-t-elle avoir besoin de cette prestation ?
 *   timing      y a-t-il une raison de la contacter maintenant ?
 *   fraîcheur   × décroissance depuis le fait qui la déclenche
 *   confiance   × ce qu'on sait vraiment, identité comprise
 *
 * Une opportunité à fort besoin mais mal établie doit passer DERRIÈRE une
 * opportunité moyenne et sûre. Une somme pondérée ferait l'inverse : c'est le
 * défaut qu'on a corrigé dès la conception du schéma.
 */

export interface ScoringSignal {
  signalType: string;
  kind: 'trigger' | 'modifier';
  category: 'need' | 'timing' | 'risk' | 'quality';
  strength: number;
  confidence: number;
  /** Événement daté, pour les déclencheurs. */
  occurredAt: string | null;
  triggerEventId: string | null;
}

export interface ScoringInput {
  signals: ScoringSignal[];
  identityConfidence: number;
  /**
   * État du site, pas seulement son existence.
   *
   * Un domaine réservé qui n'affiche qu'une page d'attente n'est pas un site :
   * l'entreprise a pris l'adresse sans rien monter derrière. Le confondre avec
   * un site en service rendait la règle « création de site » inatteignable
   * pour exactement les entreprises qu'elle vise.
   */
  websiteStatus: 'reachable' | 'placeholder' | 'broken' | 'unreachable' | 'blocked' | 'excluded' | null;
  now?: number;
}

export interface NeedContribution {
  signal: string;
  weight: number;
  strength: number;
  points: number;
}

export interface ScoredOpportunity {
  type: OpportunityType;
  needScore: number;
  timingScore: number;
  freshnessFactor: number;
  confidenceScore: number;
  baseScore: number;
  triggerEventId: string | null;
  triggerType: string | null;
  signalTypes: string[];
  /** Décomposition complète : la console admin ne doit rien avoir à deviner. */
  reason: Record<string, Json>;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Décroissance exponentielle depuis le fait déclencheur. */
export function freshnessOf(triggerType: string, occurredAt: string | null, now = Date.now()): number {
  if (!occurredAt) return 0.3;

  const halfLife = TRIGGER_HALF_LIVES[triggerType] ?? TRIGGER_HALF_LIVES['default'] ?? 30;
  const ageDays = (now - new Date(occurredAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays)) return 0.3;

  // Un fait daté dans le futur est une donnée aberrante, pas une aubaine.
  if (ageDays < 0) return 0.5;

  return clamp(Math.exp((-Math.LN2 * ageDays) / halfLife), 0.01, 1);
}

/**
 * Confiance globale.
 *
 * Prend la confiance moyenne des signaux qui portent le besoin, la pondère par
 * la confiance d'identité — une opportunité sur une entreprise qu'on identifie
 * mal ne vaut rien — puis retire les pénalités de risque.
 */
export function confidenceOf(
  contributingSignals: ScoringSignal[],
  identityConfidence: number,
  riskSignals: ScoringSignal[],
): number {
  if (contributingSignals.length === 0) return 0;

  const mean =
    contributingSignals.reduce((sum, s) => sum + s.confidence, 0) / contributingSignals.length;

  let confidence = mean * identityConfidence;

  for (const risk of riskSignals) {
    const penalty = RISK_PENALTIES[risk.signalType];
    if (penalty) confidence *= 1 - penalty * risk.strength;
  }

  return clamp(confidence, 0, 1);
}

/** Évalue un type d'opportunité, ou renvoie null s'il n'a pas de sens ici. */
export function scoreOpportunity(
  rule: OpportunityRule,
  input: ScoringInput,
): ScoredOpportunity | null {
  const now = input.now ?? Date.now();
  const active = input.signals;
  const present = new Set(active.map((s) => s.signalType));

  // ── Conditions d'existence ────────────────────────────────────────────
  // Un site cassé reste un site : il y a quelque chose à refaire. Une page
  // d'attente ou une adresse qui ne répond pas, non : il n'y a rien.
  // Un site refusé à notre récupérateur existe et fonctionne pour ses
  // visiteurs : il interdit de proposer une création, sans autoriser pour
  // autant d'affirmer quoi que ce soit sur son état.
  const hasWebsite = input.websiteStatus === 'reachable'
    || input.websiteStatus === 'broken'
    || input.websiteStatus === 'blocked';
  if (rule.requiresWebsite !== null && rule.requiresWebsite !== hasWebsite) return null;
  if (rule.blockedBy?.some((blocker) => present.has(blocker))) return null;

  // ── Besoin ────────────────────────────────────────────────────────────
  const contributions: NeedContribution[] = [];
  let needScore = 0;

  for (const signal of active) {
    const weight = rule.needWeights[signal.signalType];
    if (!weight) continue;

    const points = weight * signal.strength;
    needScore += points;
    contributions.push({
      signal: signal.signalType,
      weight,
      strength: Number(signal.strength.toFixed(2)),
      points: Number(points.toFixed(1)),
    });
  }

  needScore = clamp(needScore, 0, 100);
  if (needScore < rule.minNeed) return null;

  // ── Timing : le déclencheur le plus fort décide ───────────────────────
  const triggers = active.filter((s) => s.kind === 'trigger');
  if (triggers.length === 0) return null;

  const best = triggers.reduce((a, b) => (b.strength > a.strength ? b : a));
  const timingScore = clamp(best.strength * 100, 0, 100);
  const freshnessFactor = freshnessOf(best.signalType, best.occurredAt, now);

  // ── Confiance ─────────────────────────────────────────────────────────
  const contributingTypes = new Set(contributions.map((c) => c.signal));
  const contributingSignals = active.filter(
    (s) => contributingTypes.has(s.signalType) || s === best,
  );
  const riskSignals = active.filter((s) => s.category === 'risk');
  const confidenceScore = confidenceOf(contributingSignals, input.identityConfidence, riskSignals);

  // ── Assemblage ────────────────────────────────────────────────────────
  const weighted = needScore * 0.55 + timingScore * 0.45;
  const confidenceFactor = 0.4 + 0.6 * confidenceScore;
  const baseScore = clamp(weighted * freshnessFactor * confidenceFactor, 0, 100);

  return {
    type: rule.type,
    needScore: Number(needScore.toFixed(2)),
    timingScore: Number(timingScore.toFixed(2)),
    freshnessFactor: Number(freshnessFactor.toFixed(3)),
    confidenceScore: Number(confidenceScore.toFixed(2)),
    baseScore: Number(baseScore.toFixed(2)),
    triggerEventId: best.triggerEventId,
    triggerType: best.signalType,
    signalTypes: [...contributingTypes],
    reason: {
      trigger: best.signalType,
      trigger_strength: Number(best.strength.toFixed(2)),
      trigger_occurred_at: best.occurredAt,
      need_breakdown: contributions as unknown as Json,
      risks: riskSignals.map((r) => ({
        signal: r.signalType,
        penalty: RISK_PENALTIES[r.signalType] ?? 0,
      })) as unknown as Json,
      formula: '(besoin × 0,55 + timing × 0,45) × fraîcheur × (0,40 + 0,60 × confiance)',
      weighted: Number(weighted.toFixed(2)),
      confidence_factor: Number(confidenceFactor.toFixed(3)),
    },
  };
}

/**
 * Évalue tous les types et renvoie ceux qui tiennent, du meilleur au moins bon.
 *
 * Une même entreprise peut porter plusieurs opportunités — une refonte et un
 * e-commerce, par exemple. C'est l'allocation qui choisira laquelle proposer.
 */
export function scoreAll(input: ScoringInput): ScoredOpportunity[] {
  return OPPORTUNITY_RULES
    .map((rule) => scoreOpportunity(rule, input))
    .filter((o): o is ScoredOpportunity => o !== null)
    .sort((a, b) => b.baseScore - a.baseScore);
}
