'use server';

import { revalidatePath } from 'next/cache';
import {
  ensureAuditShare, getServiceClient, logger, markContacted, recordOptOut, recordOutcome,
  setSnoozed, simulateNextDelivery,
} from '@prospect/core';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity } from '@/lib/email/identity';
import type { DeclarableOutcome } from '@prospect/core';
import { requireAdmin, requireUser } from '@/lib/auth/session';

/**
 * Ce que le freelance déclare après son appel.
 *
 * L'identifiant de l'utilisateur ne vient jamais du formulaire mais de la
 * session : une action serveur reçoit ce que le navigateur veut bien envoyer,
 * et rien d'autre ne doit décider à qui appartient une attribution. Le moteur
 * revérifie de son côté que l'attribution est bien la sienne.
 *
 * Ces écritures passent par le client de service parce qu'elles touchent aux
 * cooldowns et à la suppression, que l'utilisateur ne doit pas pouvoir écrire
 * directement.
 */

const OUTCOMES = new Set<DeclarableOutcome>([
  'no_response', 'not_interested', 'interested', 'meeting', 'proposal', 'client',
]);

export async function declareContacted(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const assignmentId = String(formData.get('assignmentId') ?? '');
  if (!assignmentId) return;

  await markContacted(getServiceClient(), { assignmentId, userId: profile.id });
  revalidatePath('/dashboard');
}

export async function declareOutcome(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const assignmentId = String(formData.get('assignmentId') ?? '');
  const outcome = String(formData.get('outcome') ?? '') as DeclarableOutcome;
  if (!assignmentId || !OUTCOMES.has(outcome)) return;

  const notes = String(formData.get('notes') ?? '').trim();

  await recordOutcome(getServiceClient(), {
    assignmentId,
    userId: profile.id,
    outcome,
    notes: notes.length > 0 ? notes.slice(0, 2000) : null,
  });
  revalidatePath('/dashboard');
}

/**
 * L'entreprise a demandé à ne plus être démarchée.
 *
 * Distinct d'un refus commercial. La suppression est globale et définitive :
 * la demande est faite au service, pas à la personne qui a appelé.
 */
export async function declareOptOut(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const assignmentId = String(formData.get('assignmentId') ?? '');
  if (!assignmentId) return;

  const notes = String(formData.get('notes') ?? '').trim();

  await recordOptOut(getServiceClient(), {
    assignmentId,
    userId: profile.id,
    notes: notes.length > 0 ? notes.slice(0, 2000) : null,
  });
  revalidatePath('/dashboard');
}


/** Mettre de côté, ou reprendre. Un marque-page — l'exclusivité court. */
export async function toggleSnooze(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const assignmentId = String(formData.get('assignmentId') ?? '');
  if (!assignmentId) return;

  await setSnoozed(getServiceClient(), {
    assignmentId,
    userId: profile.id,
    snoozed: formData.get('snoozed') === 'true',
  });
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/plus-tard');
  revalidatePath(`/dashboard/opportunite/${assignmentId}`);
}

/**
 * Avancer son propre compte d'un jour et recevoir la livraison suivante.
 *
 * Un outil d'administration, pas une fonction du produit : il n'existe que
 * pour voir ce que donne « demain » sans attendre demain. Le rôle est
 * vérifié contre la base avant que le client de service soit créé, et la
 * simulation ne porte que sur le compte de l'appelant — un admin ne fait
 * pas avancer la journée de quelqu'un d'autre.
 */
export async function simulateMyNextDelivery(): Promise<void> {
  const profile = await requireAdmin();
  await simulateNextDelivery(getServiceClient(), profile.id, { logger });

  for (const path of [
    '/dashboard', '/dashboard/plus-tard', '/dashboard/suivi',
    '/dashboard/historique', '/dashboard/statistiques',
  ]) {
    revalidatePath(path);
  }
}

/**
 * Préparer l'audit d'une page pour un dossier.
 *
 * Le lien est créé une fois par dossier, figé, et réservé au plan Solo
 * comme l'e-mail : c'est un livrable au nom du freelance, il suppose une
 * signature. L'identifiant du dossier passe par la session, jamais par le
 * formulaire seul.
 */
export async function shareAudit(formData: FormData): Promise<void> {
  const profile = await requireUser();
  if (profile.plan !== 'premium') return;
  const assignmentId = String(formData.get('assignmentId') ?? '');
  if (!assignmentId) return;

  const found = await getMyOpportunity(assignmentId);
  if (!found) return;
  const identity = await getIdentity(profile.id);

  await ensureAuditShare(getServiceClient(), {
    assignmentId,
    userId: profile.id,
    opportunity: found.opportunity,
    author: {
      name: identity.fromName || (profile.full_name ?? ''),
      title: identity.title,
      company: identity.company,
      phone: identity.phone,
      website: identity.website,
      email: profile.email,
      logoUrl: identity.logoUrl,
    },
  });
  revalidatePath(`/dashboard/opportunite/${assignmentId}`);
  revalidatePath(`/dashboard/opportunite/${assignmentId}/email`);
}
