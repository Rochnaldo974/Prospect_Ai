'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  completeOnboarding, getServiceClient, saveStep, OPPORTUNITY_TYPE_LABELS,
} from '@prospect/core';
import type { OpportunityType } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';

export interface StepState {
  problem?: string;
}

/**
 * Chaque étape écrit dès qu'elle est validée.
 *
 * L'identifiant vient de la session, jamais du formulaire. L'écriture passe
 * par le client de service : poser `onboarding_completed` est interdit à
 * l'utilisateur par le garde-fou de la base, sans quoi n'importe qui pourrait
 * s'ouvrir l'attribution sans avoir répondu.
 */

export async function saveServices(_prev: StepState, formData: FormData): Promise<StepState> {
  const profile = await requireUser();

  const services = formData.getAll('services')
    .map(String)
    .filter((value): value is OpportunityType => value in OPPORTUNITY_TYPE_LABELS);

  const result = await saveStep(getServiceClient(), profile.id, { services });
  if (!result.ok) return { problem: result.problem ?? 'Enregistrement impossible.' };

  redirect('/onboarding/secteurs');
}

export async function saveSectors(_prev: StepState, formData: FormData): Promise<StepState> {
  const profile = await requireUser();

  const result = await saveStep(getServiceClient(), profile.id, {
    excludedIndustries: formData.getAll('excluded').map(String).slice(0, 40),
  });
  if (!result.ok) return { problem: result.problem ?? 'Enregistrement impossible.' };

  redirect('/onboarding/recapitulatif');
}

/**
 * Dernière étape : c'est elle qui ouvre le compte à l'attribution.
 *
 * Elle ne lit rien du formulaire — tout a déjà été enregistré étape par étape.
 * Les deux paramètres sont imposés par la signature d'une action de
 * formulaire ; les nommer sans les utiliser est le seul moyen de la respecter.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function finish(_prev: StepState, _formData: FormData): Promise<StepState> {
  const profile = await requireUser();
  const db = getServiceClient();

  const { readPreferences } = await import('@prospect/core');
  const answers = await readPreferences(db, profile.id);

  const result = await completeOnboarding(db, profile.id, answers);
  if (!result.ok) return { problem: result.problem ?? 'Enregistrement impossible.' };

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
