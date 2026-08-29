import type { Db } from '../../db/client';
import type { Logger } from '../../logger';
import { normalizeDomainDetailed } from '../../normalization';

/**
 * Open data AFNIC : tous les noms de domaine en .fr.
 *
 * Le fichier mensuel recense 10,1 millions de domaines, dont 4,6 millions
 * encore actifs, avec leur date de création et leur date de retrait.
 *
 * Deux usages, et le second est le plus important :
 *
 *   1. Un domaine déposé il y a peu est un fait DATÉ : quelqu'un construit sa
 *      présence en ligne en ce moment. 185 000 dépôts sur 90 jours, soit
 *      environ 2 000 par jour.
 *
 *   2. Surtout, c'est l'index inverse dont le produit manquait. Crawler un
 *      domaine et lire le SIREN de ses mentions légales rattache le site à
 *      l'entreprise sans aucun rapprochement approché — et la page livre au
 *      passage le téléphone, que ni SIRENE ni BODACC ne fournissent.
 *
 * Mesuré sur 80 dépôts récents : 71 % sont de vrais sites, 11 % affichent un
 * téléphone dès l'accueil, 6 % sont des pages d'attente — ces dernières étant
 * les meilleurs prospects, puisque le domaine est réservé mais le site
 * n'existe pas.
 */

export interface AfnicRow {
  domain: string;
  createdAt: Date;
  withdrawnAt: Date | null;
  registrarCountry: string | null;
  registrarDepartment: string | null;
}

export interface AfnicImportReport {
  read: number;
  /** Domaines retenus : actifs, dans la fenêtre demandée. */
  selected: number;
  queued: number;
  alreadyKnown: number;
  malformed: number;
  errors: number;
}

export interface AfnicImportOptions {
  /** N'importer que les domaines déposés depuis moins de N jours. */
  maxAgeDays?: number;
  /** Plafond de domaines mis en file. */
  limit?: number;
  logger?: Logger;
  signal?: AbortSignal;
  batchSize?: number;
}

const HEADER_DOMAIN = 'Nom de domaine';
const HEADER_CREATED = 'Date de création';
const HEADER_WITHDRAWN = 'Date de retrait du WHOIS';
const HEADER_REGISTRAR_COUNTRY = 'Pays BE';
const HEADER_REGISTRAR_DEPT = 'Departement BE';

/** Date française JJ-MM-AAAA. */
function parseFrenchDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Analyse une ligne du fichier AFNIC.
 *
 * Le fichier est en point-virgule et sans guillemets sur les données : un
 * découpage direct suffit, et évite de faire passer 700 Mo par un analyseur
 * CSV générique.
 */
export function parseAfnicLine(line: string, columns: Record<string, number>): AfnicRow | null {
  const fields = line.split(';');
  const rawDomain = fields[columns[HEADER_DOMAIN] ?? 0];
  if (!rawDomain) return null;

  const domain = normalizeDomainDetailed(rawDomain).domain;
  if (!domain) return null;

  const createdAt = parseFrenchDate(fields[columns[HEADER_CREATED] ?? 10] ?? '');
  if (!createdAt) return null;

  const withdrawnRaw = fields[columns[HEADER_WITHDRAWN] ?? 11]?.trim();

  return {
    domain,
    createdAt,
    withdrawnAt: withdrawnRaw ? parseFrenchDate(withdrawnRaw) : null,
    registrarCountry: fields[columns[HEADER_REGISTRAR_COUNTRY] ?? 1]?.trim() || null,
    registrarDepartment: fields[columns[HEADER_REGISTRAR_DEPT] ?? 2]?.trim() || null,
  };
}

export function parseAfnicHeader(headerLine: string): Record<string, number> {
  const columns: Record<string, number> = {};
  headerLine.split(';').forEach((name, index) => {
    columns[name.replace(/^﻿/, '').replace(/^"|"$/g, '').trim()] = index;
  });
  return columns;
}

/**
 * Importe un flux de lignes AFNIC dans la file de scan.
 *
 * On ne crée pas d'entreprise ici : un domaine n'est pas une entreprise. Il
 * entre dans `domains`, le scanner le visite, et c'est le SIREN de ses
 * mentions légales qui fera — ou non — le rattachement.
 */
export async function importAfnicDomains(
  db: Db,
  lines: AsyncIterable<string> | Iterable<string>,
  options: AfnicImportOptions = {},
): Promise<AfnicImportReport> {
  const report: AfnicImportReport = {
    read: 0, selected: 0, queued: 0, alreadyKnown: 0, malformed: 0, errors: 0,
  };

  const log = options.logger;
  const maxAgeDays = options.maxAgeDays ?? 90;
  const limit = options.limit ?? 50_000;
  const batchSize = options.batchSize ?? 1000;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;

  let columns: Record<string, number> | null = null;
  let batch: { domain: string; registered_at: string }[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const current = batch;
    batch = [];

    // `ignoreDuplicates` : un domaine déjà connu garde son historique de scan.
    const { data, error } = await db
      .from('domains')
      .upsert(current, { onConflict: 'domain', ignoreDuplicates: true })
      .select('domain');

    if (error) {
      report.errors += current.length;
      log?.warn('Lot de domaines non enregistré', { size: current.length, error: error.message });
      return;
    }

    const inserted = data?.length ?? 0;
    report.queued += inserted;
    report.alreadyKnown += current.length - inserted;
  };

  for await (const line of lines) {
    if (options.signal?.aborted) break;
    if (!line.trim()) continue;

    if (columns === null) {
      columns = parseAfnicHeader(line);
      continue;
    }

    report.read += 1;

    const row = parseAfnicLine(line, columns);
    if (!row) {
      report.malformed += 1;
      continue;
    }

    // Un domaine retiré n'a plus de site : il n'y a rien à visiter.
    if (row.withdrawnAt !== null) continue;
    if (row.createdAt.getTime() < cutoff) continue;

    report.selected += 1;
    batch.push({
      domain: row.domain,
      // Date de dépôt, pas date de découverte : first_seen_at reste à notre
      // horloge, registered_at appartient au monde. Les confondre ferait
      // dépendre l'âge d'un domaine du jour où on a lu le fichier.
      registered_at: row.createdAt.toISOString().slice(0, 10),
    });

    if (batch.length >= batchSize) await flush();
    if (report.selected >= limit) break;
  }

  await flush();

  log?.info('Import AFNIC terminé', {
    read: report.read,
    selected: report.selected,
    queued: report.queued,
    already_known: report.alreadyKnown,
  });

  return report;
}
