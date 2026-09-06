import 'server-only';
import {
  diagnoseEmptyDay, getFollowUps, getOutcomeStats, getServiceClient, getTodayOpportunities, markDayViewed,
  type EmptyDiagnosis, type FollowUp, type OutcomeStats, type TodayOpportunity,
} from '@prospect/core';
import { requireOnboardedUser } from '@/lib/auth/session';

/**
 * Les opportunités du jour de l'utilisateur connecté.
 *
 * La lecture doit joindre entreprises, domaines et événements, qui ne sont pas
 * exposés aux utilisateurs : elle passe donc par le client service_role. Pour
 * qu'aucun appelant ne puisse lire le lot de quelqu'un d'autre, l'identifiant
 * n'est pas un paramètre — il vient de la session, ici, et nulle part ailleurs.
 * C'est la seule porte d'entrée du chemin utilisateur.
 *
 * `server-only` fait échouer le build si ce module est importé depuis un
 * composant client : la clé service_role ne doit jamais approcher le navigateur.
 */
/**
 * Une opportunité du jour, avec le temps d'exclusivité déjà calculé.
 *
 * L'heure est lue ici et non pendant le rendu : une horloge appelée dans un
 * composant rend celui-ci impur, ce que le compilateur React refuse à juste
 * titre — deux rendus successifs du même arbre ne donneraient pas le même
 * résultat.
 */
export type DailyOpportunity = TodayOpportunity & { hoursLeft: number };

export async function getMyOpportunities(): Promise<{
  firstName: string;
  role: string;
  plan: 'free' | 'premium';
  opportunities: DailyOpportunity[];
  /** Renseigné seulement quand la journée est vide : dire POURQUOI. */
  diagnosis: EmptyDiagnosis | null;
  /** Le nombre de dossiers rouverts, pour que le matin ne les fasse pas oublier. */
  followUpCount: number;
}> {
  const profile = await requireOnboardedUser();
  const db = getServiceClient();

  const [opportunities, followUps] = await Promise.all([
    getTodayOpportunities(db, profile.id),
    getFollowUps(db, profile.id),
  ]);

  // « Livré et vu » : la mesure dont l'expérience a besoin pour comparer le
  // groupe témoin. Après la lecture, pour ne jamais retarder l'affichage.
  await markDayViewed(db, profile.id);

  const now = Date.now();

  return {
    firstName: profile.full_name?.split(' ')[0] ?? '',
    role: profile.role,
    plan: profile.plan,
    opportunities: opportunities.map((opportunity) => ({
      ...opportunity,
      hoursLeft: Math.floor(
        (new Date(opportunity.exclusiveUntil).getTime() - now) / 3_600_000,
      ),
    })),
    // Le diagnostic n'est calculé que s'il sert : trois requêtes de plus pour
    // expliquer une page pleine seraient du gaspillage.
    diagnosis: opportunities.length === 0 ? await diagnoseEmptyDay(db, profile.id) : null,
    followUpCount: followUps.length,
  };
}

/**
 * Un dossier du jour, seul — la page de travail.
 *
 * Réutilise la lecture du jour plutôt qu'une requête dédiée : le lot fait
 * cinq lignes, et une seule définition de « ce qu'est un dossier » vaut
 * mieux qu'une seconde qui divergera.
 */
export async function getMyOpportunity(assignmentId: string): Promise<{
  opportunity: DailyOpportunity;
  plan: 'free' | 'premium';
  firstName: string;
} | null> {
  const { opportunities, plan, firstName } = await getMyOpportunities();
  const opportunity = opportunities.find((o) => o.assignmentId === assignmentId);
  return opportunity ? { opportunity, plan, firstName } : null;
}

/** Le suivi : ce qui a été appelé et qui attend une suite. */
export async function getMyFollowUps(): Promise<{
  firstName: string;
  role: string;
  followUps: FollowUp[];
  stats: OutcomeStats;
}> {
  const profile = await requireOnboardedUser();
  const db = getServiceClient();

  const [followUps, stats] = await Promise.all([
    getFollowUps(db, profile.id),
    getOutcomeStats(db, profile.id),
  ]);

  return { firstName: profile.full_name?.split(' ')[0] ?? '', role: profile.role, followUps, stats };
}
