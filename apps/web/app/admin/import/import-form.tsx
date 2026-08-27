'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { importCsv, type ImportState } from './actions';
import { Count, Pill, Section } from '@/components/admin/primitives';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Traitement…' : 'Analyser le fichier'}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useActionState<ImportState, FormData>(importCsv, {});
  const { report } = state;

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4 rounded-lg border bg-card p-5">
        <div className="space-y-2">
          <label htmlFor="file" className="text-sm font-medium">
            Fichier CSV
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">
            4 Mo maximum. Pour un stock national complet, utiliser{' '}
            <code className="font-mono">pnpm ingest:csv &lt;fichier&gt;</code>.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="sourceName" className="text-sm font-medium">
              Nom de la source
            </label>
            <input
              id="sourceName"
              name="sourceName"
              defaultValue="import-csv"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Conservé sur chaque entreprise, pour retrouver son origine.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="preset" className="text-sm font-medium">
              Format
            </label>
            <select
              id="preset"
              name="preset"
              defaultValue="auto"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="auto">Détection automatique des colonnes</option>
              <option value="sirene_etablissement">SIRENE — StockEtablissement</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Le préréglage SIRENE applique aussi le statut de diffusion et les codes NAF.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="localCommerceOnly" className="size-4" />
            N&apos;ingérer que le segment commerce et artisanat local
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dryRun" defaultChecked className="size-4" />
            Simulation — mesurer sans rien écrire
          </label>
        </div>

        <SubmitButton />
      </form>

      {state.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
          {state.headers ? (
            <p className="mt-2 font-mono text-xs">
              Colonnes détectées : {state.headers.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <>
          <div
            className={
              state.dryRun
                ? 'rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning'
                : 'rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success'
            }
          >
            {state.dryRun
              ? 'Simulation — rien n’a été écrit. Décoche « Simulation » pour importer réellement.'
              : `Import effectué depuis la source « ${state.sourceName} ».`}
          </div>

          <Section title="Résultat">
            <table className="w-full max-w-md text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5">Lignes lues</td>
                  <td className="py-1.5 text-right">
                    <Count value={report.read} />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5">{state.dryRun ? 'Exploitables' : 'Créées'}</td>
                  <td className="py-1.5 text-right">
                    <Count value={report.created} tone="success" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5">Fusionnées avec une entreprise existante</td>
                  <td className="py-1.5 text-right">
                    <Count value={report.merged} />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5">Écartées</td>
                  <td className="py-1.5 text-right">
                    <Count value={report.rejected} tone="danger" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5">Erreurs</td>
                  <td className="py-1.5 text-right">
                    <Count value={report.errors} tone="danger" />
                  </td>
                </tr>
                {state.malformed ? (
                  <tr>
                    <td className="py-1.5">Lignes mal formées (ignorées)</td>
                    <td className="py-1.5 text-right">
                      <Count value={state.malformed} tone="danger" />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Colonnes reconnues" count={Object.keys(state.mapping ?? {}).length}>
              <ul className="space-y-1 text-sm">
                {Object.entries(state.mapping ?? {}).map(([field, column]) => (
                  <li key={field} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{field}</span>
                    <span className="text-muted-foreground">←</span>
                    <span className="font-mono text-xs">{column}</span>
                  </li>
                ))}
              </ul>
              {state.unmapped?.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ignorées : <span className="font-mono">{state.unmapped.join(', ')}</span>
                </p>
              ) : null}
            </Section>

            <Section
              title="Champs écartés à la normalisation"
              count={Object.keys(report.fieldRejections).length}
              empty="Aucun — toutes les valeurs présentes ont été retenues."
            >
              <ul className="space-y-1 text-sm">
                {Object.entries(report.fieldRejections)
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <li key={reason} className="flex items-center justify-between gap-2">
                      <span className="text-xs">{reason}</span>
                      <Count value={count} tone="danger" />
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                L&apos;entreprise est conservée, seul le champ en cause est ignoré.
              </p>
            </Section>
          </div>

          {report.sample.length > 0 ? (
            <Section title="Premières erreurs" count={report.sample.length}>
              <ul className="space-y-1 font-mono text-xs">
                {report.sample.map((entry, index) => (
                  <li key={`${entry.line}-${index}`}>
                    <Pill tone="danger">{entry.line}</Pill> {entry.reason}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
