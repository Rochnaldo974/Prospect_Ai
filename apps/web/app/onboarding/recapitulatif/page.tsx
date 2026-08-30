import {
  availabilityByType, getServiceClient, readPreferences,
  INDUSTRY_GROUPS, OPPORTUNITY_TYPE_LABELS,
} from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { FinishForm } from './finish-form';

/**
 * Ce qui a été retenu, et ce que ça donne.
 *
 * La vérification ne se contente pas de répéter les réponses : elle annonce le
 * stock qui correspond réellement à ce paramétrage. Découvrir demain matin
 * qu'on a coché une combinaison sans stock serait une mauvaise surprise
 * évitable ici.
 */
export default async function RecapStep() {
  const profile = await requireUser();
  const db = getServiceClient();

  const [answers, stock] = await Promise.all([
    readPreferences(db, profile.id),
    availabilityByType(db),
  ]);

  const retained = answers.services.length === 0
    ? stock
    : stock.filter((entry) => answers.services.includes(entry.type));
  const total = retained.reduce((sum, entry) => sum + entry.available, 0);

  const sectors = INDUSTRY_GROUPS
    .filter((group) => group.codes.some((code) => answers.excludedIndustries.includes(code)))
    .map((group) => group.label);

  return (
    <FinishForm
      total={total}
      rows={[
        {
          label: 'Ce que tu fais',
          value: answers.services.length === 0
            ? 'Tout — aucune restriction'
            : answers.services.map((s) => OPPORTUNITY_TYPE_LABELS[s]).join(', '),
          href: '/onboarding/services',
        },
        {
          label: 'Ce que tu évites',
          value: sectors.length === 0 ? 'Rien d’exclu' : sectors.join(', '),
          href: '/onboarding/secteurs',
        },
      ]}
    />
  );
}
