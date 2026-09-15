'use client';

import { useFormStatus } from 'react-dom';

/**
 * Le bouton « lendemain » de l'administrateur.
 *
 * Il ne dit pas ce qu'il fait techniquement — reculer des dates, relancer
 * l'attribution — mais ce qu'on va voir : la livraison suivante. L'attente
 * est affichée, parce que l'attribution prend une ou deux secondes et qu'un
 * second clic pendant ce temps ferait avancer de deux jours.
 */
export function SimulateButton({ plan }: { plan: 'free' | 'premium' }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-dashed px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-wash)] hover:text-[var(--brand)] disabled:cursor-wait disabled:opacity-60"
      title={
        plan === 'free'
          ? 'Avance votre compte de sept jours et relance l’attribution — outil admin'
          : 'Avance votre compte d’un jour et relance l’attribution — outil admin'
      }
    >
      {pending
        ? 'Attribution en cours…'
        : plan === 'free'
          ? 'Simuler la semaine suivante'
          : 'Simuler le lendemain'}
    </button>
  );
}
