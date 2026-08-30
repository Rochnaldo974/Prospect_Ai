import type { Metadata } from 'next';
import { ONBOARDING_STEPS } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { StepRail } from './step-rail';

export const metadata: Metadata = { title: 'Paramétrage' };

/**
 * Le paramétrage, une question par écran.
 *
 * Quatre écrans plutôt qu'un formulaire unique : chaque question porte une
 * décision réelle, et les empiler sur une même page les fait toutes traiter à
 * la va-vite. Le compte d'étapes est visible en permanence — savoir combien il
 * en reste est ce qui fait qu'on finit.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:grid-cols-[13rem_1fr] md:gap-14 md:py-16">
        <StepRail total={ONBOARDING_STEPS.length} />
        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
