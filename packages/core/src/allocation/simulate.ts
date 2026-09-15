import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { runAllocation, type AllocationReport } from './engine';
import type { OpportunityVerifier } from './verify';
import { writeCards } from './writing';

/**
 * Simuler la prochaine livraison d'un freelance, sans attendre la nuit.
 *
 * Le produit vit au rythme d'une attribution par jour : pour voir ce que
 * donne « demain » — quels dossiers arrivent, lesquels expirent, comment le
 * relevé bouge — il faudrait attendre demain. Cette fonction avance le
 * compte d'un jour à la place : tout l'historique de l'utilisateur recule
 * d'autant (attributions, lots, dates de vue, d'appel, d'issue), puis la
 * mécanique réelle s'exécute — expiration des exclusivités échues, puis
 * attribution — exactement comme le fait le worker chaque matin.
 *
 * Rien n'est inventé : les dossiers qui arrivent sont ceux que le moteur
 * aurait livrés. Un dossier de la veille encore sous exclusivité reste
 * affiché, comme il le serait réellement ; trois simulations d'affilée
 * font tourner tout le lot.
 *
 * Le plan gratuit reçoit un dossier par semaine : pour lui, « la prochaine
 * livraison » est à sept jours, et c'est ce que la simulation avance.
 *
 * Réservé à l'administration : la fonction ne vérifie pas qui appelle, c'est
 * à l'action serveur de le faire avant de lui donner le client de service.
 */

export interface SimulationResult {
  daysShifted: number;
  assignmentsShifted: number;
  batchesShifted: number;
  /** Attributions expirées par la mécanique réelle après le décalage. */
  expired: number;
  allocation: AllocationReport;
}

export interface SimulationOptions {
  logger?: Logger;
  /** Tirage du groupe contrôle, injectable pour rendre les tests déterministes. */
  random?: () => number;
  /** Vérification avant livraison : `false` la désactive (tests), une fonction la remplace. */
  verify?: OpportunityVerifier | false;
}

const DATE_FIELDS = [
  'assigned_at', 'exclusive_until', 'viewed_at', 'contacted_at', 'outcome_at', 'snoozed_at',
] as const;

type DateField = (typeof DATE_FIELDS)[number];

const DAY_MS = 86_400_000;

function shiftTimestamp(value: string, days: number): string {
  return new Date(new Date(value).getTime() - days * DAY_MS).toISOString();
}

function shiftDate(value: string, days: number): string {
  return shiftTimestamp(`${value}T00:00:00Z`, days).slice(0, 10);
}

export async function simulateNextDelivery(
  db: Db,
  userId: string,
  options: SimulationOptions = {},
): Promise<SimulationResult> {
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new Error(`simulateNextDelivery : ${profileError.message}`);
  if (!profile) throw new Error('simulateNextDelivery : profil introuvable');

  const days = profile.plan === 'free' ? 7 : 1;

  // Les lots sont uniques par (utilisateur, date) : on recule le plus ancien
  // d'abord, pour que chaque date libère la place avant que la suivante ne
  // vienne l'occuper.
  const { data: batches, error: batchError } = await db
    .from('daily_batches')
    .select('id, batch_date')
    .eq('user_id', userId)
    .order('batch_date', { ascending: true });

  if (batchError) throw new Error(`simulateNextDelivery : ${batchError.message}`);

  for (const batch of batches ?? []) {
    const { error } = await db
      .from('daily_batches')
      .update({ batch_date: shiftDate(batch.batch_date, days) })
      .eq('id', batch.id);
    if (error) throw new Error(`simulateNextDelivery : lot ${batch.id} : ${error.message}`);
  }

  // La liste des colonnes est écrite en clair : le typage des requêtes se
  // fait sur la chaîne littérale, une chaîne construite le perdrait.
  const { data: assignments, error: assignmentError } = await db
    .from('assignments')
    .select('id, assigned_at, exclusive_until, viewed_at, contacted_at, outcome_at, snoozed_at')
    .eq('user_id', userId);

  if (assignmentError) throw new Error(`simulateNextDelivery : ${assignmentError.message}`);

  for (const row of assignments ?? []) {
    const patch: Partial<Record<DateField, string>> = {};
    for (const field of DATE_FIELDS) {
      const value = row[field];
      if (value !== null) patch[field] = shiftTimestamp(value, days);
    }
    const { error } = await db.from('assignments').update(patch).eq('id', row.id);
    if (error) throw new Error(`simulateNextDelivery : attribution ${row.id} : ${error.message}`);
  }

  // À partir d'ici, plus rien de simulé : c'est la nuit du worker.
  const { data: expired, error: expireError } = await db.rpc('expire_stale_assignments');
  if (expireError) throw new Error(`simulateNextDelivery : expiration : ${expireError.message}`);

  const allocation = await runAllocation(db, {
    userId,
    ...(options.logger ? { logger: options.logger } : {}),
    ...(options.random ? { random: options.random } : {}),
    ...(options.verify !== undefined ? { verify: options.verify } : {}),
  });

  // Comme le matin réel : la fiche est rédigée juste après l'attribution.
  await writeCards(db, { userId, ...(options.logger ? { logger: options.logger } : {}) });

  options.logger?.info('Livraison simulée', {
    user_id: userId,
    days,
    expired: expired ?? 0,
    assignments: allocation.assignmentsCreated,
  });

  return {
    daysShifted: days,
    assignmentsShifted: assignments?.length ?? 0,
    batchesShifted: batches?.length ?? 0,
    expired: expired ?? 0,
    allocation,
  };
}
