import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminStats, getInventory, OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import { Section, StatCard } from '@/components/admin/primitives';

export const metadata: Metadata = { title: 'Vue d’ensemble' };

const n = (value: number | null) => (value ?? 0).toLocaleString('fr-FR');

export default async function AdminOverviewPage() {
  const db = await getAdminDb();
  const [stats, inventory] = await Promise.all([getAdminStats(db), getInventory(db)]);

  if (!stats) {
    return <p className="text-sm text-muted-foreground">Compteurs indisponibles.</p>;
  }

  const contactRate =
    stats.assignments_live && stats.contacts_made
      ? Math.round((stats.contacts_made / (stats.assignments_live + stats.contacts_made)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
        <p className="text-sm text-muted-foreground">État du moteur en un écran.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Collecte</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Entreprises" value={n(stats.companies_total)} />
          <StatCard label="Ajoutées aujourd’hui" value={n(stats.companies_added_today)} />
          <StatCard
            label="Avec site"
            value={n(stats.companies_with_website)}
            hint={
              stats.companies_total
                ? `${Math.round(((stats.companies_with_website ?? 0) / stats.companies_total) * 100)} %`
                : undefined
            }
          />
          <StatCard
            label="Joignables"
            value={n(stats.companies_with_contact)}
            hint="téléphone ou formulaire"
          />
          <StatCard label="Scannées" value={n(stats.companies_scanned)} />
          <StatCard
            label="Exclues"
            value={n(stats.companies_excluded)}
            hint="suppression ou non prospectable"
            tone={stats.companies_excluded ? 'warning' : 'default'}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Moteur</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Signaux actifs" value={n(stats.signals_active)} />
          <StatCard label="Opportunités en stock" value={n(stats.opportunities_available)} />
          <StatCard label="Opportunités attribuées" value={n(stats.opportunities_assigned)} />
          <StatCard label="Attributions aujourd’hui" value={n(stats.assignments_today)} />
          <StatCard label="Attributions vivantes" value={n(stats.assignments_live)} />
          <StatCard label="Utilisateurs" value={n(stats.users_total)} hint={`${n(stats.users_onboarded)} onboardés`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Conversion</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Contacts déclarés" value={n(stats.contacts_made)} hint={`${contactRate} % des attributions`} />
          <StatCard label="Rendez-vous" value={n(stats.meetings)} />
          <StatCard label="Clients" value={n(stats.clients)} />
          <StatCard
            label="Jobs en attente"
            value={n(stats.jobs_pending)}
            hint={`${n(stats.jobs_running)} en cours`}
            tone={(stats.jobs_dead ?? 0) > 0 ? 'danger' : 'default'}
          />
        </div>
      </section>

      <Section
        title="Inventaire par type d’opportunité"
        count={inventory.length}
        empty="Aucune opportunité en base. La collecte n’a pas encore tourné."
      >
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 text-right font-medium">En stock</th>
              <th className="pb-2 text-right font-medium">Attribuées</th>
              <th className="pb-2 text-right font-medium">Score moyen</th>
              <th className="pb-2 text-right font-medium">Conso / jour</th>
              <th className="pb-2 text-right font-medium">Jours de stock</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((row) => {
              const days = row.days_of_inventory === null ? null : Number(row.days_of_inventory);
              return (
                <tr key={row.opportunity_type} className="border-t">
                  <td className="py-1.5">
                    {row.opportunity_type ? OPPORTUNITY_TYPE_LABELS[row.opportunity_type] : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{n(row.available)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {n(row.assigned)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {row.avg_score ?? '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {row.consumed_per_day ?? 0}
                  </td>
                  <td
                    className={
                      days !== null && days < 7
                        ? 'py-1.5 text-right font-semibold tabular-nums text-destructive'
                        : 'py-1.5 text-right tabular-nums'
                    }
                  >
                    {days ?? <span className="text-muted-foreground">pas de conso</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          Sous 7 jours de stock, la découverte doit remonter en priorité pour ce type — c&apos;est la
          règle « la collecte suit la demande ».
        </p>
      </Section>

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/companies" className="font-medium text-foreground hover:underline">
          Explorer les entreprises →
        </Link>
      </p>
    </div>
  );
}
