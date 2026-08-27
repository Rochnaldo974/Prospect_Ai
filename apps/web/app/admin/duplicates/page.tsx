import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getDuplicateCounts,
  listPendingDuplicates,
  type CompanySide,
} from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';
import { Field, Pill, ScoreBadge, Section, StatCard } from '@/components/admin/primitives';
import { DecisionForm } from './decision-form';

export const metadata: Metadata = { title: 'Doublons' };

function Side({ company, label }: { company: CompanySide; label: string }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/admin/companies/${company.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {company.commercialName ?? company.legalName}
        </Link>
        <Pill>{label}</Pill>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="Raison sociale">{company.legalName}</Field>
        <Field label="SIRET">
          <span className="font-mono text-xs">{company.siret ?? '—'}</span>
        </Field>
        <Field label="Téléphone">{company.phone}</Field>
        <Field label="Domaine">{company.domain}</Field>
        <Field label="Adresse">{company.address}</Field>
        <Field label="Commune">
          {company.city} {company.postalCode}
        </Field>
        <Field label="Activité">{company.industryLabel}</Field>
        <Field label="Confiance / sources">
          {company.identityConfidence} · {company.sourceCount}
        </Field>
      </dl>
    </div>
  );
}

/** Rend lisible le faisceau d'indices qui a produit le score. */
function Evidence({ evidence }: { evidence: Record<string, unknown> }) {
  const items: { label: string; strong: boolean }[] = [];

  if (evidence['phone'] === true) items.push({ label: 'même téléphone', strong: true });
  if (evidence['address'] === true) items.push({ label: 'même adresse', strong: true });
  if (evidence['domain'] === true) {
    const shared = Number(evidence['domain_shared_by'] ?? 0);
    items.push({
      label: shared > 2 ? `domaine partagé par ${shared} entreprises` : 'même domaine',
      strong: shared <= 2,
    });
  }
  if (evidence['postal'] === true) items.push({ label: 'même commune', strong: false });
  if (evidence['industry'] === true) items.push({ label: 'même activité', strong: false });

  const similarity = Number(evidence['name_similarity'] ?? 0);
  items.push({
    label: `similarité de nom ${similarity.toFixed(2)}`,
    strong: similarity >= 0.85,
  });

  const distance = evidence['distance_m'];
  if (distance !== null && distance !== undefined) {
    const metres = Number(distance);
    items.push({ label: `${metres} m d’écart`, strong: metres < 30 });
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item.label}>
          <Pill tone={item.strong ? 'info' : 'neutral'}>{item.label}</Pill>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDuplicatesPage() {
  const db = await getAdminDb();
  const [pairs, counts] = await Promise.all([
    listPendingDuplicates(db, 50),
    getDuplicateCounts(db),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Doublons</h1>
        <p className="text-sm text-muted-foreground">
          Paires trop proches pour être ignorées, trop incertaines pour être fusionnées seules.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="À arbitrer" value={counts.pending} tone={counts.pending > 0 ? 'warning' : 'default'} />
        <StatCard label="Fusionnées après revue" value={counts.merged} />
        <StatCard label="Écartées" value={counts.rejected} />
        <StatCard label="Fusions automatiques" value={counts.autoMerges} hint="score ≥ 0,90" />
      </div>

      <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">Dans le doute, garder distinctes.</p>
        <p className="mt-1 text-muted-foreground">
          Une fusion abusive détruit de la donnée et fait disparaître un prospect. Un doublon
          qui subsiste ne coûte qu&apos;une ligne — et sera repéré plus tard, quand une source
          aura apporté un SIRET. Deux établissements identifiés ne peuvent jamais être
          fusionnés : la base le refuse.
        </p>
      </div>

      <Section
        title="En attente"
        count={pairs.length}
        empty="Aucune paire à arbitrer. Le job detect_duplicates tourne chaque nuit."
      >
        <div className="space-y-5">
          {pairs.map((pair) => (
            <article key={pair.id} className="rounded-lg border p-4">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ScoreBadge score={pair.score * 100} />
                  <span className="text-xs text-muted-foreground">
                    score {pair.score.toFixed(3)}
                  </span>
                </div>
                <DecisionForm pairId={pair.id} />
              </header>

              <Evidence evidence={pair.evidence} />

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Side company={pair.a} label="A" />
                <Side company={pair.b} label="B" />
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                En cas de fusion, l&apos;identité la mieux établie subsiste — SIRET, puis SIREN,
                puis confiance d&apos;identité. L&apos;autre fiche est conservée dans le journal
                des fusions.
              </p>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
