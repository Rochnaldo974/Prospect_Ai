'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { completeOnboarding, getServiceClient, OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import type { OpportunityType } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';

export interface OnboardingState {
  problem?: string;
}

/**
 * Enregistre le paramétrage initial.
 *
 * L'identifiant vient de la session, jamais du formulaire. L'écriture passe
 * par le client de service parce qu'elle pose `onboarding_completed`, que le
 * garde-fou de la base interdit à un utilisateur de modifier lui-même — sans
 * quoi n'importe qui pourrait s'ouvrir l'attribution sans avoir répondu.
 */
export async function saveOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const profile = await requireUser();

  const services = formData.getAll('services')
    .map(String)
    .filter((value): value is OpportunityType => value in OPPORTUNITY_TYPE_LABELS);

  const allowed = ['france', 'france_remote', 'region', 'city'] as const;
  const submitted = String(formData.get('locationMode') ?? 'france');
  const mode = (allowed as readonly string[]).includes(submitted)
    ? submitted as (typeof allowed)[number]
    : 'france';

  const trimmed = (name: string): string | null => {
    const value = String(formData.get(name) ?? '').trim();
    return value.length > 0 ? value.slice(0, 120) : null;
  };

  const result = await completeOnboarding(getServiceClient(), profile.id, {
    services,
    locationMode: mode,
    city: trimmed('city'),
    region: trimmed('region'),
    excludedIndustries: formData.getAll('excluded').map(String).slice(0, 40),
  });

  if (!result.ok) return { problem: result.problem ?? 'Enregistrement impossible.' };

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
