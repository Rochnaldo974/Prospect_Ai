import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServiceClient, readPreferences } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Paramétrage' };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ modifier?: string }>;
}) {
  const profile = await requireUser();
  const { modifier } = await searchParams;

  // Un compte déjà paramétré ne repasse pas ici par accident : il faut le
  // demander explicitement.
  if (profile.onboarding_completed && modifier === undefined) redirect('/dashboard');

  const initial = await readPreferences(getServiceClient(), profile.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.onboarding_completed ? 'Tes préférences' : 'Trois questions, et c’est parti'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Elles servent à ne pas te faire perdre de temps. Le moteur fonctionne très bien avec
          des réponses larges — mieux vaut trop d&apos;opportunités que pas assez.
        </p>
      </header>

      <OnboardingForm initial={initial} />
    </main>
  );
}
