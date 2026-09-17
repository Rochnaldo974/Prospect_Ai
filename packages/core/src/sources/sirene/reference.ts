import type { Db } from '../../db/client';
import type { Logger } from '../../logger';
import { normalizePostalCode } from '../../normalization';

/**
 * Le référentiel SIRENE local, depuis le fichier public de l'INSEE.
 *
 * StockEtablissement (licence ouverte, un fichier par mois, 2,9 Go zippés,
 * ~40 millions de lignes) est lu en flux : on ne garde que les
 * établissements actifs, diffusibles, des métiers de proximité que le
 * produit sait servir, avec ce qui identifie et localise — jamais une
 * personne physique (les entrepreneurs individuels sans enseigne n'ont
 * pas de nom d'enseigne, et leur nom n'est pas lu).
 *
 * Ce référentiel sert au rapprochement d'identité sans appel externe :
 * même enseigne, même code postal, un seul SIREN → identité établie.
 */

/** Les familles NAF qui font un client de freelance du web : commerces, restauration, artisans, services de proximité. */
export const TARGET_NAF_PREFIXES = [
  '10.7', '43', '45', '47', '49.3', '55', '56', '66.2', '68.3', '69', '71.1', '74.2',
  '75', '77', '79', '81', '85.5', '86', '90', '93', '95', '96',
];

export interface SireneReferenceRow {
  siret: string;
  siren: string;
  is_head_office: boolean;
  storefront_name: string | null;
  naf_code: string | null;
  postal_code: string | null;
  city: string | null;
  creation_date: string | null;
  active: boolean;
  diffusible: boolean;
  employee_range: string | null;
}

export function parseSireneHeader(headerLine: string): Record<string, number> {
  const columns: Record<string, number> = {};
  headerLine.replace(/^﻿/, '').split(',').forEach((name, index) => {
    columns[name.replace(/^"|"$/g, '').trim()] = index;
  });
  return columns;
}

/** Une ligne CSV de l'INSEE : virgules, guillemets seulement quand nécessaire. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out;
}

export function isTargetNaf(naf: string | null): boolean {
  if (!naf) return false;
  return TARGET_NAF_PREFIXES.some((prefix) => naf.startsWith(prefix));
}

/**
 * Lit une ligne : null si l'établissement ne nous concerne pas. Le nom
 * retenu est l'enseigne ou la dénomination usuelle — un nom de commerce,
 * jamais un nom de personne.
 */
export function parseSireneRow(columns: Record<string, number>, line: string): SireneReferenceRow | null {
  const cells = splitCsvLine(line);
  const get = (name: string): string => cells[columns[name] ?? -1]?.trim() ?? '';

  const siret = get('siret');
  const siren = get('siren');
  if (!/^\d{14}$/.test(siret) || !/^\d{9}$/.test(siren)) return null;

  const active = get('etatAdministratifEtablissement') === 'A';
  const diffusible = get('statutDiffusionEtablissement') === 'O';
  if (!active || !diffusible) return null;

  const naf = get('activitePrincipaleEtablissement') || null;
  if (!isTargetNaf(naf)) return null;

  const storefront = get('enseigne1Etablissement') || get('denominationUsuelleEtablissement') || get('enseigne2Etablissement') || null;

  return {
    siret,
    siren,
    is_head_office: get('etablissementSiege') === 'true',
    storefront_name: storefront ? storefront.slice(0, 200) : null,
    naf_code: naf,
    postal_code: normalizePostalCode(get('codePostalEtablissement') || null),
    city: get('libelleCommuneEtablissement') || null,
    creation_date: /^\d{4}-\d{2}-\d{2}$/.test(get('dateCreationEtablissement')) ? get('dateCreationEtablissement') : null,
    active,
    diffusible,
    employee_range: get('trancheEffectifsEtablissement') || null,
  };
}

export interface SireneImportReport {
  read: number;
  selected: number;
  written: number;
  errors: number;
}

export interface SireneImportOptions {
  limit?: number;
  batchSize?: number;
  logger?: Logger;
  signal?: AbortSignal;
}

/** Importe un flux de lignes CSV dans sirene_reference, par lots. */
export async function importSireneReference(
  db: Db,
  lines: AsyncIterable<string> | Iterable<string>,
  options: SireneImportOptions = {},
): Promise<SireneImportReport> {
  const report: SireneImportReport = { read: 0, selected: 0, written: 0, errors: 0 };
  const log = options.logger;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const batchSize = options.batchSize ?? 1000;
  let columns: Record<string, number> | null = null;
  let batch: SireneReferenceRow[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const current = batch;
    batch = [];
    const { error } = await db.from('sirene_reference').upsert(current, { onConflict: 'siret' });
    if (error) {
      report.errors += current.length;
      log?.warn('Lot SIRENE non enregistré', { size: current.length, error: error.message });
      return;
    }
    report.written += current.length;
    if (report.written % 100_000 === 0) log?.info('Import SIRENE', { read: report.read, written: report.written });
  };

  try {
    for await (const line of lines) {
      if (options.signal?.aborted) break;
      if (columns === null) { columns = parseSireneHeader(line); continue; }
      report.read += 1;
      const row = parseSireneRow(columns, line);
      if (!row) continue;
      report.selected += 1;
      batch.push(row);
      if (batch.length >= batchSize) await flush();
      if (report.selected >= limit) break;
    }
  } catch (cause: unknown) {
    if ((cause as { code?: string }).code !== 'ERR_USE_AFTER_CLOSE') throw cause;
  }
  await flush();
  log?.info('Import SIRENE terminé', { ...report });
  return report;
}

/**
 * Les unités légales : la dénomination des sociétés. Les entrepreneurs
 * individuels (catégorie juridique 1000) n'ont pas de dénomination, seulement
 * un nom de personne, que l'on ne lit pas.
 */
export interface SireneUnitRow {
  siren: string;
  legal_name: string;
  naf_code: string | null;
  creation_date: string | null;
  active: boolean;
  diffusible: boolean;
  legal_category: string | null;
}

export function parseSireneUnitRow(columns: Record<string, number>, line: string): SireneUnitRow | null {
  const cells = splitCsvLine(line);
  const get = (name: string): string => cells[columns[name] ?? -1]?.trim() ?? '';
  const siren = get('siren');
  if (!/^\d{9}$/.test(siren)) return null;
  const category = get('categorieJuridiqueUniteLegale') || null;
  if (category === '1000') return null;
  const active = get('etatAdministratifUniteLegale') === 'A';
  const diffusible = get('statutDiffusionUniteLegale') === 'O';
  if (!active || !diffusible) return null;
  const name = get('denominationUniteLegale') || get('denominationUsuelle1UniteLegale') || '';
  if (!name) return null;
  return {
    siren,
    legal_name: name.slice(0, 300),
    naf_code: get('activitePrincipaleUniteLegale') || null,
    creation_date: /^\d{4}-\d{2}-\d{2}$/.test(get('dateCreationUniteLegale')) ? get('dateCreationUniteLegale') : null,
    active,
    diffusible,
    legal_category: category,
  };
}

/** Importe les unités légales dans sirene_units, par lots. */
export async function importSireneUnits(
  db: Db,
  lines: AsyncIterable<string> | Iterable<string>,
  options: SireneImportOptions = {},
): Promise<SireneImportReport> {
  const report: SireneImportReport = { read: 0, selected: 0, written: 0, errors: 0 };
  const log = options.logger;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const batchSize = options.batchSize ?? 1000;
  let columns: Record<string, number> | null = null;
  let batch: SireneUnitRow[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const current = batch;
    batch = [];
    const { error } = await db.from('sirene_units').upsert(current, { onConflict: 'siren' });
    if (error) { report.errors += current.length; log?.warn('Lot SIRENE (unités) non enregistré', { size: current.length, error: error.message }); return; }
    report.written += current.length;
    if (report.written % 100_000 === 0) log?.info('Import SIRENE unités', { read: report.read, written: report.written });
  };

  try {
    for await (const line of lines) {
      if (options.signal?.aborted) break;
      if (columns === null) { columns = parseSireneHeader(line); continue; }
      report.read += 1;
      const row = parseSireneUnitRow(columns, line);
      if (!row) continue;
      report.selected += 1;
      batch.push(row);
      if (batch.length >= batchSize) await flush();
      if (report.selected >= limit) break;
    }
  } catch (cause: unknown) {
    if ((cause as { code?: string }).code !== 'ERR_USE_AFTER_CLOSE') throw cause;
  }
  await flush();
  log?.info('Import SIRENE unités terminé', { ...report });
  return report;
}
