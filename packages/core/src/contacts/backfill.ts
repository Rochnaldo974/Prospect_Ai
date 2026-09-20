import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { upsertContacts } from './ingest';
import { resolveCompanyContacts } from './resolver';
import type { ContactCandidate } from './types';

/**
 * Récupérer les contacts déjà connus, sans rien recrawler.
 *
 * Avant toute nouvelle source, le pipeline a laissé des contacts sur le bord
 * de la route : des téléphones lus sur les sites (domains.phones_found)
 * jamais reportés sur l'entreprise, des e-mails de sites jamais utilisés,
 * l'e-mail des tags OpenStreetMap lu puis jeté. Ce backfill les ramasse et
 * les passe au resolver. Il avance par curseur sur l'identifiant
 * d'entreprise, se relance à l'identique après une interruption, et ne
 * change rien en `dryRun`.
 */

export interface BackfillOptions {
  limit?: number;
  /** Identifiant d'entreprise après lequel reprendre (exclu). */
  cursor?: string | null;
  /**
   * Ne servir que les entreprises dont la résolution est encore `pending`.
   * Chaque page traitée sort de l'attente : la passe reprend d'elle-même
   * après une interruption, sans curseur à conserver, et une entreprise
   * découverte plus tard entre dans la file sans commande.
   */
  pendingOnly?: boolean;
  dryRun?: boolean;
  logger?: Logger;
  signal?: AbortSignal;
}

export interface BackfillReport {
  examined: number;
  withCandidates: number;
  contactsWritten: number;
  resolved: number;
  /** Entreprises qui n'avaient ni téléphone ni formulaire et en ont maintenant un canal. */
  newlyContactable: number;
  newlyWithEmail: number;
  errors: number;
  /** Sans aucun candidat : datées comme telles, pour ne pas repasser dessus. */
  noCandidates: number;
  nextCursor: string | null;
  done: boolean;
}

interface CompanyRow {
  id: string;
  domain: string | null;
  phone: string | null;
  contact_form_url: string | null;
  social_links: Record<string, string> | null;
  best_email: string | null;
  has_contact: boolean;
}

export async function backfillContacts(db: Db, options: BackfillOptions = {}): Promise<BackfillReport> {
  // L'API tronque toute réponse à mille lignes : une page ne peut pas être plus grande.
  const limit = Math.min(options.limit ?? 1000, 1000);
  const log = options.logger;
  const report: BackfillReport = {
    examined: 0, withCandidates: 0, contactsWritten: 0, resolved: 0,
    newlyContactable: 0, newlyWithEmail: 0, errors: 0, noCandidates: 0, nextCursor: options.cursor ?? null, done: false,
  };

  let query = db
    .from('companies')
    .select('id, domain, phone, contact_form_url, social_links, best_email, has_contact')
    .order('id', { ascending: true })
    .limit(limit);
  if (options.pendingOnly) query = query.eq('contact_resolution_status', 'pending');
  if (options.cursor) query = query.gt('id', options.cursor);
  const { data, error } = await query;
  if (error) throw new Error(`backfillContacts : ${error.message}`);
  const companies = (data ?? []) as CompanyRow[];
  if (companies.length === 0) { report.done = true; return report; }

  // Ce que les sites ont déjà donné, par domaine, en une requête par page.
  const domains = [...new Set(companies.map((c) => c.domain).filter((d): d is string => d !== null))];
  const siteFacts = new Map<string, { phones: string[]; emails: string[]; form: string | null; finalUrl: string | null; legal: string | null; contact: string | null }>();
  for (let i = 0; i < domains.length; i += 200) {
    const { data: rows, error: domainError } = await db
      .from('domains')
      .select('domain, phones_found, emails_found, contact_form_url, final_url, legal_page_url')
      .in('domain', domains.slice(i, i + 200));
    if (domainError) throw new Error(`backfillContacts (domains) : ${domainError.message}`);
    for (const row of rows ?? []) {
      siteFacts.set(row.domain, {
        phones: row.phones_found ?? [], emails: row.emails_found ?? [], form: row.contact_form_url,
        finalUrl: row.final_url, legal: row.legal_page_url, contact: row.contact_form_url,
      });
    }
  }

  // L'e-mail et le téléphone des tags OpenStreetMap, gardés dans le payload
  // brut de la source alors que le candidat normalisé les avait perdus.
  const osmTags = new Map<string, Record<string, string>>();
  const ids = companies.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rows } = await db
      .from('company_sources')
      .select('company_id, raw_payload')
      .eq('source_name', 'openstreetmap')
      .in('company_id', ids.slice(i, i + 200));
    for (const row of rows ?? []) {
      const tags = (row.raw_payload as { tags?: Record<string, string> } | null)?.tags;
      if (tags) osmTags.set(row.company_id, tags);
    }
  }

  for (const company of companies) {
    if (options.signal?.aborted) break;
    report.examined += 1;
    report.nextCursor = company.id;

    const candidates: ContactCandidate[] = [];
    if (company.phone) candidates.push({ type: 'phone', value: company.phone, source: osmTags.has(company.id) ? 'osm' : 'other', confidence: 0.85 });
    if (company.contact_form_url) candidates.push({ type: 'contact_form', value: company.contact_form_url, source: 'website', sourceUrl: company.contact_form_url });
    for (const [network, url] of Object.entries(company.social_links ?? {})) {
      if (['linkedin', 'instagram', 'facebook', 'whatsapp'].includes(network)) {
        candidates.push({ type: network as ContactCandidate['type'], value: url, source: 'osm' });
      }
    }

    const tags = osmTags.get(company.id);
    if (tags) {
      for (const key of ['email', 'contact:email']) if (tags[key]) candidates.push({ type: 'email', value: tags[key]!, source: 'osm' });
      for (const key of ['phone', 'contact:phone', 'contact:mobile']) if (tags[key]) candidates.push({ type: 'phone', value: tags[key]!, source: 'osm' });
    }

    const site = company.domain ? siteFacts.get(company.domain) : undefined;
    if (site) {
      const pageUrl = site.contact ?? site.finalUrl ?? (company.domain ? `https://${company.domain}` : null);
      for (const phone of site.phones) candidates.push({ type: 'phone', value: phone, source: 'website', sourceUrl: pageUrl });
      for (const email of site.emails) candidates.push({ type: 'email', value: email, source: site.contact ? 'contact_page' : 'website', sourceUrl: pageUrl });
      if (site.form) candidates.push({ type: 'contact_form', value: site.form, source: 'contact_page', sourceUrl: site.form });
    }

    if (candidates.length === 0) {
      // Rien à examiner : l'entreprise sort de l'attente, sinon la passe
      // « en attente » la resservirait chaque nuit.
      report.noCandidates += 1;
      if (options.pendingOnly && !options.dryRun) {
        await db.from('companies')
          .update({ contact_resolution_status: 'failed', last_contact_resolution_at: new Date().toISOString() })
          .eq('id', company.id).eq('contact_resolution_status', 'pending');
      }
      continue;
    }
    report.withCandidates += 1;

    try {
      const written = await upsertContacts(db, company.id, candidates, { dryRun: options.dryRun ?? false });
      report.contactsWritten += written.written;
      const resolved = await resolveCompanyContacts(db, company.id, { dryRun: options.dryRun ?? false });
      report.resolved += 1;
      const hadChannel = company.has_contact || company.best_email !== null;
      const phone = company.phone ?? resolved.bestPhone;
      const form = company.contact_form_url ?? resolved.contactForm;
      const hasChannel = phone !== null || resolved.bestEmail !== null || form !== null;
      if (!hadChannel && hasChannel) report.newlyContactable += 1;
      if (company.best_email === null && resolved.bestEmail !== null) report.newlyWithEmail += 1;
    } catch (cause: unknown) {
      report.errors += 1;
      log?.warn('Backfill de contacts en échec', { company_id: company.id, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  // Fini quand la page n'est pas pleine — ou, en mode « en attente », quand
  // plus rien n'y change : une page entière d'échecs ne doit pas boucler.
  report.done = companies.length < limit
    || (options.pendingOnly === true && report.resolved + report.noCandidates === 0);
  log?.info('Backfill de contacts', {
    examined: report.examined, with_candidates: report.withCandidates, contacts_written: report.contactsWritten,
    newly_contactable: report.newlyContactable, newly_with_email: report.newlyWithEmail, errors: report.errors,
    next_cursor: report.nextCursor, dry_run: options.dryRun ?? false,
  });
  return report;
}
