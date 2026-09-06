import type { Metadata } from 'next';
import { requireOnboardedUser } from '@/lib/auth/session';
import { PlanToggleDev } from './plan-toggle-dev';

export const metadata: Metadata = { title: 'Abonnement' };

/**
 * L'abonnement : où j'en suis, et ce que l'autre plan donnerait.
 *
 * Pas de paiement ici pour l'instant — le raccordement bancaire viendra au
 * lancement, et cette page ne fait pas semblant : pas de faux bouton de
 * carte, pas de « bientôt » cliquable. Elle dit le plan courant, compare
 * honnêtement, et en développement offre la bascule qui permet de tester
 * les deux visages du produit.
 */
export default async function SubscriptionPage() {
  const profile = await requireOnboardedUser();
  const premium = profile.plan === 'premium';

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">Abonnement</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Vous êtes sur le plan{' '}
          <span className="font-medium text-foreground">{premium ? 'Solo' : 'Gratuit'}</span>.
        </p>
      </header>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <PlanCard
          name="Gratuit"
          price="0"
          current={!premium}
          features={[
            '1 dossier par semaine',
            'Le dossier complet : problème, preuves, angle d’appel',
            'Suivi de vos appels et relances',
          ]}
        />
        <PlanCard
          name="Solo"
          price="39"
          current={premium}
          featured
          features={[
            '5 dossiers par jour, choisis selon ce que vous savez faire',
            'E-mail personnalisé prêt à envoyer, modifiable',
            'Exclusivité 72 h sur chaque entreprise',
            'Toute la France, tous les secteurs',
          ]}
        />
      </div>

      {!premium ? (
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Le paiement en ligne ouvre avec le lancement. En attendant, le plan Solo est activé
          manuellement pour les premiers utilisateurs — écrivez-nous depuis l’adresse de votre
          compte.
        </p>
      ) : null}

      <PlanToggleDev current={profile.plan} />
    </main>
  );
}

function PlanCard({
  name, price, features, current, featured = false,
}: {
  name: string;
  price: string;
  features: string[];
  current: boolean;
  featured?: boolean;
}) {
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border bg-card p-7 ${
        featured
          ? 'border-[var(--brand)] shadow-[0_1px_2px_rgba(11,13,20,.04),0_24px_60px_-24px_rgba(44,75,255,.35)]'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
        {current ? (
          <span className="rounded-full bg-[var(--brand-wash)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brand)]">
            Votre plan
          </span>
        ) : null}
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="tabular text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">€ / mois</span>
      </p>

      <ul className="mt-6 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm">
            <span aria-hidden className="text-[var(--brand)]">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
