import { notFound } from 'next/navigation';
import { ONBOARDING_STEPS } from '@prospect/core';
import { StepRail } from '@/app/onboarding/step-rail';
import { ServicesForm } from '@/app/onboarding/services/services-form';
import { SectorsForm } from '@/app/onboarding/secteurs/sectors-form';
import { FinishForm } from '@/app/onboarding/recapitulatif/finish-form';

/**
 * Aperçu du paramétrage, hors session — développement uniquement.
 *
 * Les trois écrans sont empilés pour juger le rendu d'un seul regard ; le
 * parcours réel les sert un par un. Les formulaires portent de vraies
 * actions serveur : soumettre échouerait faute de session — c'est un banc
 * de rendu, pas un banc fonctionnel.
 */
export default function OnboardingPreview() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:grid-cols-[13rem_1fr] md:gap-14 md:py-16">
        <StepRail total={ONBOARDING_STEPS.length} />
        <main className="min-w-0 space-y-20 pb-16">
          <p className="rounded-lg border border-dashed bg-card px-4 py-2 font-mono text-[11px] text-muted-foreground">
            Aperçu de développement · les trois écrans empilés · /apercu-dev/onboarding
          </p>

          <ServicesForm
            selected={['website_redesign', 'website_creation']}
            stock={{ website_redesign: 143, website_creation: 38, ecommerce: 21, mobile_application: 6, seo: 17, maintenance: 12, tender_response: 4 }}
          />

          <SectorsForm excluded={['68']} />

          <FinishForm
            total={181}
            rows={[
              { label: 'Ce que vous faites', value: 'Refonte de site, création de site', href: '/apercu-dev/onboarding' },
              { label: 'Secteurs écartés', value: 'Immobilier', href: '/apercu-dev/onboarding' },
            ]}
          />
        </main>
      </div>
    </div>
  );
}
