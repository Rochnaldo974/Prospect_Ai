'use client';

import { useActionState } from 'react';
import { OPPORTUNITY_TYPE_LABELS, describeAvailability } from '@prospect/core';
import type { OpportunityType } from '@prospect/core';
import { saveServices, type StepState } from '../actions';
import { Choice, Step } from '@/components/onboarding-shell';

/**
 * Les familles qu'un freelance web propose réellement.
 *
 * L'ordre suit le volume du marché : presque toutes les entreprises ont un
 * site, très peu n'en ont pas. La réponse à appel d'offres ferme la liste —
 * c'est un travail à part, avec ses dossiers et ses délais, et tout le monde
 * n'en veut pas.
 */
const SERVICES = [
  'website_redesign', 'website_creation', 'ecommerce', 'maintenance',
  'seo', 'web_application', 'mobile_application', 'ai_automation',
  'tender_response',
] as const satisfies readonly OpportunityType[];

export function ServicesForm({
  selected,
  stock,
}: {
  selected: OpportunityType[];
  stock: Partial<Record<OpportunityType, number>>;
}) {
  const [state, action, pending] = useActionState<StepState, FormData>(saveServices, {});

  return (
    <form action={action}>
      <Step
        question="Que faites-vous ?"
        help="Une opportunité hors de cette liste ne vous sera jamais proposée, quel que soit son score. Ne rien cocher revient à tout accepter."
        problem={state.problem}
        pending={pending}
        submitLabel="Continuer"
      >
        {/* Apparition décalée : les cartes se posent l'une après l'autre plutôt
            que d'arriver en bloc. Quarante millisecondes d'écart suffisent à
            donner le sentiment d'une page qui se compose. Neutralisé par
            prefers-reduced-motion, comme toute animation du produit. */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {SERVICES.map((service, index) => (
            <div
              key={service}
              className="motion-safe:animate-[rise_.4s_cubic-bezier(.2,.7,.3,1)_both]"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Choice
                name="services"
                value={service}
                defaultChecked={selected.includes(service)}
                title={OPPORTUNITY_TYPE_LABELS[service]}
                note={<Stock count={stock[service] ?? 0} />}
              />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Les stocks indiqués sont ceux de maintenant. Ils se renouvellent chaque nuit et se
          vident dans la journée : une opportunité prise par quelqu&apos;un d&apos;autre ne
          revient pas.
        </p>
      </Step>
    </form>
  );
}

/**
 * Ce qu'il y a derrière la case.
 *
 * Cocher une famille vide, c'est réserver une des cinq places de sa journée à
 * du néant. Autant le dire au moment du choix plutôt que de laisser
 * l'utilisateur en tirer une conclusion sur le moteur.
 */
function Stock({ count }: { count: number }) {
  const { label, tone } = describeAvailability(count);

  return (
    <span
      className={
        tone === 'none'
          ? 'text-muted-foreground'
          : tone === 'thin'
            ? 'text-[var(--finding)]'
            : 'text-[var(--brand)]'
      }
    >
      {label}
    </span>
  );
}
