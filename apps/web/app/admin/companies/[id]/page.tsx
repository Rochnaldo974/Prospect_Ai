import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompanyDetail } from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import {
  Field,
  Pill,
  Section,
  formatDate,
  formatDateTime,
  relativeDays,
} from '@/components/admin/primitives';
import { ScoreBreakdown } from '@/components/admin/score-breakdown';

export const metadata: Metadata = { title: 'Fiche entreprise' };

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getAdminDb();
  const detail = await getCompanyDetail(db, id);
  if (!detail) notFound();

  const {
    company, overview, sources, snapshots, events, signals,
    opportunities, assignments, cooldowns, domain, domainSiblings,
  } = detail;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/companies" className="text-sm text-muted-foreground hover:underline">
            ← Entreprises
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {company.commercial_name ?? company.legal_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.commercial_name ? `${company.legal_name} · ` : ''}
            {company.city ?? 'ville inconnue'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {company.suppression_global ? <Pill tone="danger">supprimée</Pill> : null}
          {!company.prospecting_allowed ? <Pill tone="danger">non prospectable</Pill> : null}
          {overview?.in_cooldown ? <Pill tone="warning">cooldown</Pill> : null}
          {overview?.assigned_user_id ? <Pill tone="info">attribuée</Pill> : null}
          <Pill tone={company.company_status === 'active' ? 'success' : 'danger'}>
            {company.company_status}
          </Pill>
        </div>
      </div>

      {company.suppression_global ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Entreprise en liste de suppression — motif : {company.suppression_reason}. Elle ne peut
          plus être attribuée, la base refuse l&apos;insertion.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Identité">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Raison sociale">{company.legal_name}</Field>
              <Field label="Nom commercial">{company.commercial_name}</Field>
              <Field label="SIREN">
                <span className="font-mono text-xs">{company.siren ?? '—'}</span>
              </Field>
              <Field label="SIRET">
                <span className="font-mono text-xs">{company.siret ?? '—'}</span>
              </Field>
              <Field label="Activité">{company.industry_label}</Field>
              <Field label="Code NAF">
                <span className="font-mono text-xs">{company.industry_code ?? '—'}</span>
              </Field>
              <Field label="Adresse">{company.address}</Field>
              <Field label="Code postal">{company.postal_code}</Field>
              <Field label="Région">{company.region}</Field>
              <Field label="Création">{formatDate(company.creation_date)}</Field>
              <Field label="Effectif">
                {company.employee_min !== null ? `${company.employee_min}–${company.employee_max}` : null}
              </Field>
              <Field label="Segment">{company.segment}</Field>
            </dl>
          </Section>

          <Section title="Présence web">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Domaine">
                {company.domain ? (
                  <a
                    href={company.website_url ?? `https://${company.domain}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:underline"
                  >
                    {company.domain}
                  </a>
                ) : null}
              </Field>
              <Field label="Confiance du rattachement">
                {company.website_confidence !== null ? (
                  <span className="flex items-center gap-1.5">
                    {company.website_confidence.toFixed(2)}
                    {company.website_confidence >= 0.99 ? (
                      <Pill tone="success">mentions légales</Pill>
                    ) : null}
                  </span>
                ) : null}
              </Field>
              <Field label="Tentatives de résolution">{company.website_resolution_attempts}</Field>

              <Field label="État">
                {domain ? (
                  <Pill
                    tone={
                      domain.status === 'reachable' ? 'success'
                      : domain.status === 'placeholder' ? 'warning'
                      : domain.status === 'unknown' ? 'neutral' : 'danger'
                    }
                  >
                    {domain.status}
                  </Pill>
                ) : null}
              </Field>
              <Field label="Statut HTTP">{domain?.http_status}</Field>
              <Field label="TTFB">{domain?.ttfb_ms ? `${domain.ttfb_ms} ms` : null}</Field>

              <Field label="CMS">{domain?.cms}</Field>
              <Field label="Framework">{domain?.framework}</Field>
              <Field label="Technologies">
                {Array.isArray(domain?.technologies) && domain.technologies.length > 0
                  ? (domain.technologies as string[]).join(', ')
                  : null}
              </Field>

              <Field label="SSL">{domain ? (domain.has_ssl ? 'oui' : 'non') : null}</Field>
              <Field label="Responsive">
                {domain?.has_viewport_meta !== null && domain?.has_viewport_meta !== undefined
                  ? domain.has_viewport_meta ? 'viewport présent' : 'pas de viewport'
                  : null}
              </Field>
              <Field label="Copyright">{domain?.copyright_year}</Field>

              <Field label="E-commerce">{domain?.ecommerce_detected ? 'détecté' : null}</Field>
              <Field label="Réservation">{domain?.booking_detected ? 'détectée' : null}</Field>
              <Field label="Dernier scan">{formatDateTime(domain?.last_checked_at ?? null)}</Field>
            </dl>

            {domain && domain.sirens_found.length > 0 ? (
              <p className="mt-3 text-xs">
                <span className="text-muted-foreground">SIREN dans les mentions légales : </span>
                <span className="font-mono">{domain.sirens_found.join(', ')}</span>
                {domain.sirens_found.includes(company.siren ?? '') ? (
                  <span className="ml-2">
                    <Pill tone="success">rattachement confirmé</Pill>
                  </span>
                ) : null}
              </p>
            ) : null}

            {domain?.check_error ? (
              <p className="mt-2 text-xs text-destructive">{domain.check_error}</p>
            ) : null}

            {domainSiblings.length > 0 ? (
              <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <p className="font-medium text-warning">
                  Ce site est partagé par {domainSiblings.length + 1} établissements.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Enseigne de réseau : le domaine n&apos;identifie pas cet établissement, et une
                  refonte ne se propose qu&apos;une fois pour l&apos;ensemble.
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {domainSiblings.slice(0, 8).map((sibling) => (
                    <li key={sibling.id}>
                      <Link href={`/admin/companies/${sibling.id}`} className="hover:underline">
                        <Pill>{sibling.legal_name}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          <Section title="Opportunités" count={opportunities.length} empty="Aucune opportunité générée. Le moteur exige un événement daté pour en créer une.">
            <div className="space-y-3">
              {opportunities.map((opportunity) => (
                <ScoreBreakdown key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          </Section>

          <Section title="Signaux" count={signals.length} empty="Aucun signal détecté.">
            <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 pb-2 font-medium">Signal</th>
                  <th className="px-2 pb-2 font-medium">Rôle</th>
                  <th className="px-2 pb-2 font-medium">Composante</th>
                  <th className="px-2 pb-2 text-right font-medium">Intensité</th>
                  <th className="px-2 pb-2 text-right font-medium">Confiance</th>
                  <th className="px-2 pb-2 font-medium">Source</th>
                  <th className="px-2 pb-2 font-medium">Détecté</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => (
                  <tr key={signal.id} className="border-t">
                    <td className="px-2 py-1.5 font-mono text-xs">{signal.signal_type}</td>
                    <td className="py-1.5">
                      <Pill tone={signal.kind === 'trigger' ? 'success' : 'neutral'}>
                        {signal.kind === 'trigger' ? 'déclencheur' : 'modificateur'}
                      </Pill>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{signal.category}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{signal.strength}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{signal.confidence}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{signal.source}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {relativeDays(signal.detected_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Événements" count={events.length} empty="Aucun événement daté.">
            <ol className="space-y-2.5">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {relativeDays(event.occurred_at ?? event.detected_at)}
                  </span>
                  <span className="min-w-0">
                    <span className="font-mono text-xs">{event.event_type}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {event.source} · importance {event.importance} · confiance {event.confidence}
                    </span>
                    {event.occurred_at && event.occurred_at !== event.detected_at ? (
                      <span className="block text-xs text-muted-foreground">
                        survenu le {formatDate(event.occurred_at)}, détecté le{' '}
                        {formatDate(event.detected_at)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Historique des scans" count={snapshots.length} empty="Site jamais scanné.">
            <table className="w-full text-sm [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 pb-2 font-medium">Date</th>
                  <th className="px-2 pb-2 font-medium">HTTP</th>
                  <th className="px-2 pb-2 font-medium">CMS</th>
                  <th className="px-2 pb-2 text-right font-medium">TTFB</th>
                  <th className="px-2 pb-2 text-right font-medium">Perf</th>
                  <th className="px-2 pb-2 text-right font-medium">Mobile</th>
                  <th className="px-2 pb-2 font-medium">Profondeur</th>
                  <th className="px-2 pb-2 font-medium">Empreinte</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={`${snapshot.id}-${snapshot.captured_at}`} className="border-t">
                    <td className="px-2 py-1.5 text-xs">{formatDateTime(snapshot.captured_at)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{snapshot.http_status}</td>
                    <td className="px-2 py-1.5 text-xs">{snapshot.cms ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{snapshot.ttfb_ms}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{snapshot.performance_score}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{snapshot.mobile_score}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{snapshot.scan_depth}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {snapshot.html_hash?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Contact">
            <dl className="space-y-3">
              <Field label="Téléphone">
                {company.phone ? <a href={`tel:${company.phone}`} className="hover:underline">{company.phone}</a> : null}
              </Field>
              <Field label="Formulaire">
                {company.contact_form_url ? (
                  <a href={company.contact_form_url} target="_blank" rel="noreferrer noopener" className="hover:underline">
                    lien
                  </a>
                ) : null}
              </Field>
              <Field label="Joignable">
                <Pill tone={company.has_contact ? 'success' : 'danger'}>
                  {company.has_contact ? 'oui' : 'non'}
                </Pill>
              </Field>
            </dl>
          </Section>

          <Section title="Qualité">
            <dl className="space-y-3">
              <Field label="Confiance d’identité">{company.identity_confidence}</Field>
              <Field label="Score de qualité des données">{company.data_quality_score} / 100</Field>
              <Field label="Priorité de scan">{company.scan_priority}</Field>
              <Field label="Dernier scan">{formatDateTime(company.last_scanned_at)}</Field>
              <Field label="Prochain scan">{formatDateTime(company.next_scan_at)}</Field>
              <Field label="Ajoutée le">{formatDateTime(company.created_at)}</Field>
            </dl>
          </Section>

          <Section title="Sources" count={sources.length} empty="Aucune source rattachée.">
            <ul className="space-y-3">
              {sources.map((source) => (
                <li key={source.id}>
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone="info">{source.source_name}</Pill>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {source.confidence}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {source.source_external_id}
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      payload brut
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                      {JSON.stringify(source.raw_payload, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Attributions" count={assignments.length} empty="Jamais attribuée.">
            <ul className="space-y-2 text-sm">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="border-t pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={assignment.status === 'active' ? 'info' : 'neutral'}>
                      {assignment.status}
                    </Pill>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      rang {assignment.rank} · {assignment.match_score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(assignment.assigned_at)}
                    {assignment.outcome ? ` · issue : ${assignment.outcome}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Cooldowns" count={cooldowns.length} empty="Aucun cooldown.">
            <ul className="space-y-2 text-sm">
              {cooldowns.map((cooldown) => (
                <li key={cooldown.id} className="border-t pt-2 first:border-0 first:pt-0">
                  <Pill tone={cooldown.permanent ? 'danger' : 'warning'}>{cooldown.reason}</Pill>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cooldown.permanent
                      ? 'permanent'
                      : `jusqu’au ${formatDate(cooldown.ends_at)}`}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
