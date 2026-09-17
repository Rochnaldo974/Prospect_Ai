import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminStats, getEngineMetrics, getInventory, getOpenAlerts, getPipelineHealth, getQueueHealth, getSourcePerformance, getSuccessMetrics, getTypePerformance, OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import { Section, StatCard } from '@/components/admin/primitives';

export const metadata: Metadata = { title: 'Vue d’ensemble' };

const n = (value: number | null) => (value ?? 0).toLocaleString('fr-FR');
const m = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

export default async function AdminOverviewPage() {
  const db = await getAdminDb();
  const [stats, inventory, metrics, sources, types, queue, alerts, pipeline, success] = await Promise.all([
    getAdminStats(db), getInventory(db), getEngineMetrics(db), getSourcePerformance(db), getTypePerformance(db), getQueueHealth(db), getOpenAlerts(db), getPipelineHealth(db), getSuccessMetrics(db),
  ]);

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

      {alerts.length > 0 ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="mb-2 text-sm font-medium">Alertes ouvertes</h2>
          <ul className="space-y-1 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                <span className={a.severity === 'critical' ? 'font-medium text-destructive' : 'font-medium'}>{a.severity === 'critical' ? 'Critique' : a.severity === 'warning' ? 'Attention' : 'Info'}</span>
                <span>{a.message}</span>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Aujourd’hui</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Entreprises découvertes" value={n(m(metrics.discovery['companies_discovered_today']))} />
          <StatCard label="Domaines découverts" value={n(m(metrics.domains['domains_discovered_today']))} />
          <StatCard label="Sites scannés" value={n(m(metrics.domains['domains_scanned_today']))} />
          <StatCard label="Contacts trouvés" value={n(m(metrics.contacts['contacts_found_today']))} />
          <StatCard label="Qualifiées" value={n(m(metrics.opportunities['qualified_created_today']))} />
          <StatCard label="PHONE_READY" value={n(m(metrics.opportunities['phone_ready_created_today']))} />
          <StatCard label="OUTREACH_READY" value={n(m(metrics.opportunities['outreach_ready_created_today']))} />
          <StatCard label="Rejetées" value={n(m(metrics.rejections['opportunities_rejected_today']))} hint={Object.entries((metrics.rejections['rejections_by_reason'] as Record<string, number>) ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ') || undefined} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Stock et pipeline</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Stock qualifié" value={n(m(metrics.opportunities['stock_qualified']))} />
          <StatCard label="Stock PHONE_READY" value={n(m(metrics.opportunities['stock_phone_ready']))} />
          <StatCard label="Stock OUTREACH_READY" value={n(m(metrics.opportunities['stock_outreach_ready']))} />
          <StatCard label="Tél + e-mail" value={n(m(metrics.opportunities['stock_phone_and_email_ready']))} />
          <StatCard label="Domaines dus au scan" value={n(m(metrics.domains['domains_due_for_scan']))} />
          <StatCard label="Jobs en attente" value={n(queue.pending)} hint={queue.oldestPendingAt ? `le plus ancien : ${new Date(queue.oldestPendingAt).toLocaleString('fr-FR')}` : undefined} tone={queue.pending > 200 ? 'warning' : 'default'} />
          <StatCard label="Jobs en cours" value={n(queue.running)} />
          <StatCard label="Jobs en échec" value={n(queue.failed)} tone={queue.failed > 0 ? 'danger' : 'default'} />
        </div>
      </section>

      {success ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Critères de succès</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Entreprises" value={n(success.companies.total)} />
            <StatCard label="Avec téléphone" value={n(success.companies.with_phone)} hint={`${success.companies.phone_pct ?? 0} %`} />
            <StatCard label="Avec e-mail" value={n(success.companies.with_email)} hint={`${success.companies.email_pct ?? 0} %`} />
            <StatCard label="Téléphone et e-mail" value={n(success.companies.with_phone_and_email)} hint={`${success.companies.both_pct ?? 0} %`} />
            <StatCard label="Produites en 24 h" value={n(success.last_24h.qualified)} hint={`${n(success.last_24h.phone_ready)} PHONE_READY · ${n(success.last_24h.outreach_ready)} OUTREACH_READY`} />
            <StatCard label="Offre / jour" value={n(Math.round(success.supply_demand.daily_supply_phone_ready))} hint={`${n(Math.round(success.supply_demand.daily_supply_outreach_ready))} OUTREACH_READY · moyenne 7 j`} />
            <StatCard label="Demande / jour" value={success.supply_demand.daily_demand.toFixed(1)} hint={`${n(success.supply_demand.free_users)} gratuits · ${n(success.supply_demand.premium_users)} premium`} />
            <StatCard label="Offre ÷ demande" value={success.supply_demand.supply_demand_ratio === null ? '—' : success.supply_demand.supply_demand_ratio.toFixed(1)} hint="objectif ≥ 3" tone={success.supply_demand.supply_demand_ratio !== null && success.supply_demand.supply_demand_ratio < 3 ? 'danger' : 'default'} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Par service : {Object.entries(success.supply_demand.by_service).map(([k, v]) => `${OPPORTUNITY_TYPE_LABELS[k as keyof typeof OPPORTUNITY_TYPE_LABELS] ?? k} ${v.ratio === null ? '—' : v.ratio}`).join(' · ') || 'aucun compte paramétré'}
          </p>
        </section>
      ) : null}

      {pipeline ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Pipeline</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sites à résoudre" value={n(pipeline.pending_domain_resolution)} hint="entreprises sans site cherché" />
            <StatCard label="Contacts à résoudre" value={n(pipeline.pending_contact_resolution)} />
            <StatCard label="Scans dus" value={n(pipeline.pending_scan)} hint={`${n(pipeline.never_scanned)} jamais scannés`} />
            <StatCard label="Audits de performance" value={n(pipeline.pending_deep_scan)} hint="en attente" />
            <StatCard label="Identités à chercher" value={n(pipeline.pending_identity)} hint="sans SIREN, jamais tentées" />
            <StatCard label="Changements (7 j)" value={n(Object.values(pipeline.changes_7d ?? {}).reduce((a, b) => a + Number(b), 0))} hint={Object.entries(pipeline.changes_7d ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ') || 'aucun'} />
            <StatCard label="Coût (7 j)" value={`${((pipeline.economics_7d ?? []).reduce((a, e) => a + Number(e.cost_cents), 0) / 100).toFixed(2)} €`} hint={(() => { const e = pipeline.economics_7d ?? []; const out = e.reduce((a, x) => a + Number(x.outreach_ready_created), 0); const cost = e.reduce((a, x) => a + Number(x.cost_cents), 0); return out > 0 ? `${(cost / out).toFixed(1)} c par OUTREACH_READY` : 'aucun OUTREACH_READY sur 7 j'; })()} />
            <StatCard label="Technologies" value={n(pipeline.top_technologies?.length ?? 0)} hint={(pipeline.top_technologies ?? []).slice(0, 5).map((t) => `${t.technology} ${t.domains}`).join(' · ') || 'aucune'} />
          </div>
        </section>
      ) : null}

      <Section title="Performance par source" count={sources.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Source</th><th className="py-2 pr-3 text-right">Vues</th><th className="py-2 pr-3 text-right">Joignables</th><th className="py-2 pr-3 text-right">Tél</th><th className="py-2 pr-3 text-right">E-mail</th><th className="py-2 pr-3 text-right">Opp. créées</th><th className="py-2 pr-3 text-right">PHONE_READY</th><th className="py-2 pr-3 text-right">OUTREACH_READY</th><th className="py-2 pr-3 text-right">Attribuées</th><th className="py-2 pr-3 text-right">Contactées</th><th className="py-2 text-right">Positives</th>
            </tr></thead>
            <tbody>
              {sources.map((row) => (
                <tr key={row.source ?? '?'} className="border-t">
                  <td className="py-2 pr-3">{row.source}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.companies_seen)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.companies_contactable)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.companies_with_phone)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.companies_with_email)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.opportunities_created)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.stock_phone_ready)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.stock_outreach_ready)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.assigned)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.contacted)}</td>
                  <td className="py-2 text-right tabular-nums">{n(row.positive_outcomes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Performance par type" count={types.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Type</th><th className="py-2 pr-3 text-right">Créées</th><th className="py-2 pr-3 text-right">Stock</th><th className="py-2 pr-3 text-right">PHONE_READY</th><th className="py-2 pr-3 text-right">OUTREACH_READY</th><th className="py-2 pr-3 text-right">Attribuées</th><th className="py-2 pr-3 text-right">Contactées</th><th className="py-2 pr-3 text-right">Intéressées</th><th className="py-2 pr-3 text-right">RDV</th><th className="py-2 pr-3 text-right">Devis</th><th className="py-2 text-right">Clients</th>
            </tr></thead>
            <tbody>
              {types.map((row) => (
                <tr key={row.opportunity_type ?? '?'} className="border-t">
                  <td className="py-2 pr-3">{row.opportunity_type ? OPPORTUNITY_TYPE_LABELS[row.opportunity_type] : '?'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.created)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.stock)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.stock_phone_ready)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.stock_outreach_ready)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.assigned)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.contacted)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.interested)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.meetings)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{n(row.quotes)}</td>
                  <td className="py-2 text-right tabular-nums">{n(row.clients)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

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
