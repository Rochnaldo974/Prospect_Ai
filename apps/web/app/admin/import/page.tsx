import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { ImportForm } from './import-form';

export const metadata: Metadata = { title: 'Import CSV' };

export default async function AdminImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Normalisation, déduplication sur identifiants exacts, conservation du payload brut.
        </p>
      </div>

      <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">Toujours commencer par une simulation.</p>
        <p className="mt-1 text-muted-foreground">
          Elle mesure ce que le fichier produirait — colonnes reconnues, lignes exploitables,
          champs écartés — sans rien écrire. Une correspondance de colonnes erronée crée des
          entreprises fausses, bien plus coûteuses à retirer qu&apos;à éviter.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
