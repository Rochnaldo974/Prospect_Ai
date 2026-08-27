'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CsvCompanySource,
  ingestFromSource,
  inferMapping,
  parseCsv,
  PRESETS,
  SIRENE_ETABLISSEMENT_MAPPING,
  logger,
  type ColumnMapping,
  type Db,
  type IngestReport,
} from '@prospect/core';
import { getAdminDb } from '@/lib/supabase/admin';

/** Plafond de l'import interactif. Les gros fichiers passent par `pnpm ingest:csv`. */
const MAX_BYTES = 4 * 1024 * 1024;

const optionsSchema = z.object({
  sourceName: z.string().trim().min(1).max(40).default('import-csv'),
  preset: z.enum(['auto', 'sirene_etablissement']).default('auto'),
  localCommerceOnly: z.coerce.boolean().default(false),
  dryRun: z.coerce.boolean().default(true),
});

export interface ImportState {
  error?: string;
  report?: IngestReport;
  mapping?: ColumnMapping;
  headers?: string[];
  unmapped?: string[];
  malformed?: number;
  dryRun?: boolean;
  sourceName?: string;
}

export async function importCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const db: Db = await getAdminDb();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Aucun fichier sélectionné.' };
  }
  if (file.size > MAX_BYTES) {
    return {
      error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). ` +
        `L'import interactif est limité à 4 Mo — utilise « pnpm ingest:csv » pour un stock complet.`,
    };
  }

  const parsedOptions = optionsSchema.safeParse({
    sourceName: formData.get('sourceName') || undefined,
    preset: formData.get('preset') || undefined,
    localCommerceOnly: formData.get('localCommerceOnly') === 'on',
    dryRun: formData.get('dryRun') === 'on',
  });
  if (!parsedOptions.success) {
    return { error: parsedOptions.error.issues[0]?.message ?? 'Options invalides' };
  }
  const options = parsedOptions.data;

  const content = await file.text();

  // Aperçu de la correspondance avant d'écrire quoi que ce soit : un mapping
  // erroné produirait des entreprises fausses, très coûteuses à retirer ensuite.
  const preview = parseCsv(content, { limit: 1 });
  if (preview.headers.length === 0) {
    return { error: 'Fichier vide ou illisible.' };
  }

  const usesSirene = options.preset === 'sirene_etablissement';
  const mapping: ColumnMapping = usesSirene
    ? (PRESETS['sirene_etablissement'] ?? SIRENE_ETABLISSEMENT_MAPPING)
    : inferMapping(preview.headers);

  if (Object.keys(mapping).length === 0) {
    return {
      error: 'Aucune colonne reconnue. Vérifie les intitulés ou choisis le préréglage SIRENE.',
      headers: preview.headers,
    };
  }

  // Sans colonne de nom, chaque ligne sera écartée : autant le dire avant de
  // lancer l'analyse plutôt que de laisser un rapport « 0 exploitable » sans
  // explication. C'est le cas typique d'un fichier SIRENE passé en détection
  // automatique, dont les intitulés ne ressemblent à rien de courant.
  if (!mapping.legalName && !mapping.commercialName) {
    return {
      error:
        'Aucune colonne de nom d’entreprise reconnue — toutes les lignes seraient écartées. ' +
        'S’il s’agit d’un fichier SIRENE, choisis le préréglage « SIRENE — StockEtablissement ».',
      headers: preview.headers,
      mapping,
    };
  }

  const mappedColumns = new Set(Object.values(mapping));
  const unmapped = preview.headers.filter((h) => !mappedColumns.has(h));

  const source = new CsvCompanySource({
    sourceName: options.sourceName,
    content,
    mapping,
    sireneConventions: usesSirene,
    localCommerceOnly: options.localCommerceOnly,
    confidence: usesSirene ? 0.99 : 0.8,
  });

  let report: IngestReport;
  try {
    report = await ingestFromSource(db, source, {
      dryRun: options.dryRun,
      logger: logger.child({ component: 'import-csv', file: file.name }),
    });
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  if (!options.dryRun) {
    revalidatePath('/admin/companies');
    revalidatePath('/admin');
  }

  return {
    report,
    mapping,
    headers: preview.headers,
    unmapped,
    malformed: source.malformedLines.length,
    dryRun: options.dryRun,
    sourceName: options.sourceName,
  };
}
