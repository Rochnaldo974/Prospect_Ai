import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getMyStatistics } from '@/lib/opportunities/mine';
import { Kpi, PageHeader, Panel, Workspace } from '@/components/dashboard/ui';
import { PlanToggleDev } from './plan-toggle-dev';

export const metadata: Metadata = { title: 'Abonnement' };

/**
 * L'abonnement : où j'en suis, et ce que l'autre plan donnerait.
 *
 * Pas de paiement ici pour l'instant — le raccordement bancaire viendra au
 * lancement, et cette page ne fait pas semblant. Elle dit le plan courant,
 * compare honnêtement, et montre ce que le plan a livré ce mois.
 */
const ROWS: Array<[string, string, string]> = [
  ['Dossiers livrés', '1 par semaine', '5 par jour'],
  ['Choix des dossiers', 'selon vos prestations', 'selon vos prestations, votre zone et vos technologies'],
  ['Le dossier complet', 'problème, preuves, angle d’appel', 'problème, preuves, angle d’appel'],
  ['Téléphone vérifié', 'oui', 'oui'],
  ['E-mail personnalisé', '—', 'rédigé, modifiable, envoyé depuis votre adresse'],
  ['Audit à votre nom', '—', 'une page à envoyer, vous savez quand elle est ouverte'],
  ['Exclusivité', '72 h', '72 h'],
  ['Suivi et relances', 'oui', 'oui'],
  ['Zone', 'toute la France', 'toute la France, tous les secteurs'],
];

export default async function SubscriptionPage() {
  const profile = await requireOnboardedUser();
  const premium = profile.plan === 'premium';
  const { monthly } = await getMyStatistics();
  const c = monthly.current;

  return (
    <main className="px-5 py-6 sm:px-6 xl:px-8">
      <PageHeader
        eyebrow="Compte"
        title="Abonnement"
        lead={<>Vous êtes sur le plan <span className="font-medium text-foreground">{premium ? 'Solo' : 'Gratuit'}</span>.</>}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Votre plan" value={premium ? 'Solo' : 'Gratuit'} hint={premium ? '39 € par mois' : '0 € par mois'} tone="brand" />
        <Kpi label="Cadence" value={premium ? 5 : 1} unit={premium ? '/ jour' : '/ sem.'} hint="dossiers livrés" />
        <Kpi label="Livrés sur 30 j" value={c.proposed} hint="par le moteur" tone={c.proposed === 0 ? 'muted' : 'default'} />
        <Kpi label="Appelés sur 30 j" value={c.contacted} hint={c.proposed > 0 ? `${Math.round((c.contacted / c.proposed) * 100)} % des livrés` : '—'} tone={c.contacted === 0 ? 'muted' : 'default'} />
      </div>

      <Workspace
        rail={(
          <>
            <Panel eyebrow="Ce mois" title="Ce que le plan a donné">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <div><dt className="text-[11px] text-muted-foreground">Proposées</dt><dd className="tabular font-mono text-lg font-medium">{c.proposed}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Appelées</dt><dd className="tabular font-mono text-lg font-medium">{c.contacted}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Réponses</dt><dd className="tabular font-mono text-lg font-medium">{c.responses}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Clientes</dt><dd className="tabular font-mono text-lg font-medium text-[var(--success)]">{c.clients}</dd></div>
              </dl>
            </Panel>
            {!premium ? (
              <Panel tone="brand" eyebrow="Passer en Solo" title="Cinq par jour au lieu d’un par semaine">
                <p className="text-[13px] leading-relaxed text-[var(--brand)]/80">
                  Le paiement en ligne ouvre avec le lancement. En attendant, le plan Solo est activé à la main pour les premiers utilisateurs : écrivez-nous depuis l’adresse de votre compte
                  {LEGAL.contactEmail ? <>, à <a href={`mailto:${LEGAL.contactEmail}`} className="underline underline-offset-4">{LEGAL.contactEmail}</a></> : null}.
                </p>
              </Panel>
            ) : (
              <Panel eyebrow="Solo" title="Votre plan est actif">
                <p className="text-[13px] leading-relaxed text-muted-foreground">Cinq dossiers chaque matin à 9 h, l’e-mail personnalisé et l’audit à votre nom. Pour une question sur votre abonnement, écrivez-nous depuis l’adresse de votre compte{LEGAL.contactEmail ? <>, à <a href={`mailto:${LEGAL.contactEmail}`} className="text-[var(--brand)] underline-offset-4 hover:underline">{LEGAL.contactEmail}</a></> : null}.</p>
              </Panel>
            )}
            <PlanToggleDev current={profile.plan} />
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard name="Gratuit" price="0" current={!premium} features={['1 dossier par semaine', 'Le dossier complet : problème, preuves, angle d’appel', 'Suivi de vos appels et relances']} />
          <PlanCard name="Solo" price="39" current={premium} featured features={['5 dossiers par jour, choisis selon ce que vous savez faire', 'E-mail personnalisé prêt à envoyer, modifiable', 'Audit à votre nom, ouvert sans compte', 'Exclusivité 72 h sur chaque entreprise', 'Toute la France, tous les secteurs']} />
        </div>

        <Panel title="Ce que chaque plan comprend" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-t text-left text-[11px] text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">&nbsp;</th>
                  <th className={`px-5 py-2.5 font-medium ${!premium ? 'text-[var(--brand)]' : ''}`}>Gratuit</th>
                  <th className={`px-5 py-2.5 font-medium ${premium ? 'text-[var(--brand)]' : ''}`}>Solo</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, free, solo]) => (
                  <tr key={label} className="border-t">
                    <td className="px-5 py-2.5 text-muted-foreground">{label}</td>
                    <td className={`px-5 py-2.5 ${free === '—' ? 'text-muted-foreground/50' : ''}`}>{free}</td>
                    <td className="px-5 py-2.5">{solo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Workspace>
    </main>
  );
}

function PlanCard({
  name, price, features, current, featured = false,
}: {
  name: string; price: string; features: string[]; current: boolean; featured?: boolean;
}) {
  return (
    <article className={`panel flex h-full flex-col rounded-xl border bg-card p-6 ${featured ? 'border-[var(--brand)] shadow-[0_24px_60px_-28px_rgba(44,75,255,.35)]' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
        {current ? <span className="rounded-full bg-[var(--brand-wash)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brand)]">Votre plan</span> : null}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="tabular text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">€ / mois</span>
      </p>
      <ul className="mt-5 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 text-[13px]"><span aria-hidden className="text-[var(--brand)]">✓</span><span>{feature}</span></li>
        ))}
      </ul>
    </article>
  );
}
