import type { Db } from '../db/client';
import type { Logger } from '../logger';

/**
 * Ce qui s'est passé après l'appel.
 *
 * La partie du produit dont dépend tout le reste. Sans elle :
 *
 *   — le groupe contrôle ne mesure rien, et c'est la seule façon de savoir si
 *     le moteur vaut mieux qu'un tirage au hasard ;
 *   — le moteur n'apprend rien : on ignore quels signaux mènent à un client et
 *     lesquels font perdre du temps ;
 *   — et surtout, on rappellerait indéfiniment des commerçants qui ont déjà
 *     dit non.
 *
 * Ce dernier point n'est pas une question de politesse. Une entreprise
 * démarchée trois fois en trois mois par le même service se plaint, et elle a
 * raison. Le cooldown est ce qui rend le produit tenable dans la durée.
 */

/**
 * Combien de temps une entreprise reste hors circuit, selon ce qu'a donné
 * l'appel. Ces durées sont des choix produit, pas des constantes techniques.
 */
const COOLDOWN_DAYS: Record<string, number | 'permanent'> = {
  // Injoignable : rien ne dit qu'elle n'est pas intéressée, mais insister la
  // semaine suivante serait du harcèlement.
  no_response: 45,
  // Elle a dit non. Revenir dans deux mois, c'est ne pas avoir écouté.
  not_interested: 180,
  // Le freelance travaille dessus : personne d'autre ne doit l'appeler
  // pendant ce temps, et lui-même n'a pas besoin qu'on la lui repropose.
  interested: 120,
  meeting: 120,
  proposal: 120,
  // Elle a un prestataire. La reproposer ferait perdre son temps à tout le
  // monde, y compris au freelance qui l'a gagnée.
  client: 'permanent',
};

/**
 * Les issues qu'un utilisateur peut déclarer lui-même.
 *
 * Sous-ensemble de l'énumération en base, qui compte aussi des motifs de
 * cooldown produits par le système — expiration, opposition, décision
 * manuelle — et qu'aucun freelance n'a à choisir dans une liste.
 */
export type DeclarableOutcome =
  | 'no_response' | 'not_interested' | 'interested' | 'meeting' | 'proposal' | 'client';

export interface OutcomeReport {
  assignmentId: string;
  companyId: string;
  cooldownUntil: string | null;
  permanent: boolean;
}

/**
 * Enregistre le résultat d'un contact.
 *
 * L'identifiant de l'utilisateur est vérifié contre l'attribution : on ne
 * clôt pas l'opportunité de quelqu'un d'autre, même par erreur de
 * programmation.
 */
export async function recordOutcome(
  db: Db,
  input: {
    assignmentId: string;
    userId: string;
    outcome: DeclarableOutcome;
    notes?: string | null;
  },
  options: { logger?: Logger } = {},
): Promise<OutcomeReport> {
  const { data: assignment, error } = await db
    .from('assignments')
    .select('id, user_id, company_id, opportunity_id, contacted_at, status')
    .eq('id', input.assignmentId)
    .maybeSingle();

  if (error) throw new Error(`recordOutcome : ${error.message}`);
  if (!assignment) throw new Error('Attribution introuvable');
  if (assignment.user_id !== input.userId) throw new Error('Attribution appartenant à un autre utilisateur');

  const now = new Date();
  const nowIso = now.toISOString();

  // La base l'exige, et elle a raison : on ne peut pas rendre compte d'un
  // appel qu'on n'a pas passé.
  const contactedAt = assignment.contacted_at ?? nowIso;

  const { error: updateError } = await db
    .from('assignments')
    .update({
      status: 'completed',
      outcome: input.outcome,
      outcome_at: nowIso,
      contacted_at: contactedAt,
      // La note vit ici, sur l'attribution : c'est la mémoire du freelance,
      // et l'écran À relancer la lui remontre. La copie dans le cooldown ne
      // sert qu'au diagnostic interne.
      notes: input.notes ?? null,
    })
    .eq('id', assignment.id);

  if (updateError) throw new Error(`recordOutcome : ${updateError.message}`);

  const duration = COOLDOWN_DAYS[input.outcome] ?? 45;
  const permanent = duration === 'permanent';
  const endsAt = permanent
    ? null
    : new Date(now.getTime() + (duration as number) * 86_400_000).toISOString();

  const { error: cooldownError } = await db.from('company_cooldowns').insert({
    company_id: assignment.company_id,
    reason: input.outcome,
    starts_at: nowIso,
    // La base l'impose, et elle a raison : un cooldown permanent n'a pas de
    // date de fin. Lui en donner une, même lointaine, serait affirmer qu'il
    // s'arrête un jour.
    ends_at: endsAt,
    permanent,
    assignment_id: assignment.id,
    notes: input.notes ?? null,
  });

  if (cooldownError) throw new Error(`recordOutcome : ${cooldownError.message}`);

  // L'opportunité a été consommée : elle ne retourne pas au stock. Une autre
  // pourra naître du même fait plus tard, si le fait tient toujours.
  await db
    .from('opportunities')
    .update({ status: 'expired' })
    .eq('id', assignment.opportunity_id);

  options.logger?.info('Résultat enregistré', {
    assignment_id: assignment.id,
    outcome: input.outcome,
    permanent,
  });

  return {
    assignmentId: assignment.id,
    companyId: assignment.company_id,
    cooldownUntil: endsAt,
    permanent,
  };
}

/**
 * L'entreprise demande à ne plus être démarchée.
 *
 * Distinct d'un refus commercial : ce n'est pas « non merci » mais « ne me
 * recontactez plus ». La suppression est globale et définitive, et elle
 * s'applique quel que soit le freelance — c'est une demande faite au service,
 * pas à la personne qui a appelé.
 */
export async function recordOptOut(
  db: Db,
  input: { assignmentId: string; userId: string; notes?: string | null },
  options: { logger?: Logger } = {},
): Promise<OutcomeReport> {
  const { data: assignment, error } = await db
    .from('assignments')
    .select('id, user_id, company_id, opportunity_id, contacted_at')
    .eq('id', input.assignmentId)
    .maybeSingle();

  if (error) throw new Error(`recordOptOut : ${error.message}`);
  if (!assignment) throw new Error('Attribution introuvable');
  if (assignment.user_id !== input.userId) throw new Error('Attribution appartenant à un autre utilisateur');

  const nowIso = new Date().toISOString();

  await db
    .from('assignments')
    .update({
      status: 'completed',
      outcome: 'not_interested',
      outcome_at: nowIso,
      contacted_at: assignment.contacted_at ?? nowIso,
    })
    .eq('id', assignment.id);

  await db.from('company_cooldowns').insert({
    company_id: assignment.company_id,
    reason: 'opt_out',
    starts_at: nowIso,
    ends_at: null,
    permanent: true,
    assignment_id: assignment.id,
    notes: input.notes ?? null,
  });

  // La suppression globale coupe l'entreprise de toute la chaîne, pas
  // seulement de l'attribution : plus de signaux, plus d'opportunités.
  await db
    .from('companies')
    .update({
      suppression_global: true,
      suppression_reason: 'Demande de l’entreprise, transmise par un utilisateur',
      prospecting_allowed: false,
    })
    .eq('id', assignment.company_id);

  await db
    .from('opportunities')
    .update({ status: 'expired' })
    .eq('company_id', assignment.company_id)
    .in('status', ['available']);

  options.logger?.info('Opposition enregistrée', {
    assignment_id: assignment.id,
    company_id: assignment.company_id,
  });

  return {
    assignmentId: assignment.id,
    companyId: assignment.company_id,
    cooldownUntil: null,
    permanent: true,
  };
}

/**
 * Marque comme vues toutes les attributions du jour d'un utilisateur.
 *
 * Appelée quand la page du matin se rend : « livré et vu » est la mesure
 * dont l'expérience a besoin pour comparer le groupe témoin. L'ouverture
 * d'un dossier précis n'est pas traquée — un <details> natif n'émet rien
 * au serveur, et c'est un choix : pas de télémétrie de lecture.
 */
export async function markDayViewed(db: Db, userId: string): Promise<void> {
  await db
    .from('assignments')
    .update({ viewed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['active', 'contacted'])
    .is('viewed_at', null);
}

/** Marque l'opportunité comme vue. Sert à mesurer, jamais à contraindre. */
export async function markViewed(
  db: Db,
  input: { assignmentId: string; userId: string },
): Promise<void> {
  await db
    .from('assignments')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', input.assignmentId)
    .eq('user_id', input.userId)
    .is('viewed_at', null);
}

/** Marque qu'un contact a été tenté, sans encore en connaître l'issue. */
export async function markContacted(
  db: Db,
  input: { assignmentId: string; userId: string },
): Promise<void> {
  const nowIso = new Date().toISOString();

  await db
    .from('assignments')
    .update({ status: 'contacted', contacted_at: nowIso })
    .eq('id', input.assignmentId)
    .eq('user_id', input.userId)
    .is('contacted_at', null);
}
