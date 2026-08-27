import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { normalizeDomainDetailed } from '../normalization';
import { analyzePage, type PageAnalysis } from './page-analysis';
import { WebsiteFetcher, type FetchResult } from './fetcher';

/**
 * Scan d'un domaine.
 *
 * Deux passages au plus : la page d'accueil, puis la page de mentions légales
 * si l'accueil n'a pas livré de SIREN. C'est là qu'il se trouve le plus
 * souvent, et c'est ce qui justifie la seconde requête — sans lui, on n'a
 * qu'une inférence de plus.
 */

export interface DomainScanResult {
  domain: string;
  status: 'reachable' | 'placeholder' | 'broken' | 'unreachable' | 'excluded';
  analysis: PageAnalysis | null;
  fetch: FetchResult;
  legalPageUrl: string | null;
  /** SIREN trouvés, accueil et mentions légales confondues. */
  sirens: string[];
  /** Le contenu a-t-il changé depuis le dernier passage ? */
  contentChanged: boolean;
}

export interface ScanReport {
  scanned: number;
  reachable: number;
  placeholders: number;
  broken: number;
  unreachable: number;
  excluded: number;
  unchanged: number;
  sirensFound: number;
  /** Entreprises qui n'avaient pas de site et à qui celui-ci est attribué. */
  companiesAttached: number;
  /** Attributions existantes confirmées par les mentions légales du site. */
  companiesConfirmed: number;
  /** SIREN écartés parce que présents sur plusieurs domaines — agences web. */
  sharedSirensSkipped: number;
  errors: number;
}

export interface ScanOptions {
  limit?: number;
  /** Ne rescanner que les domaines dont l'échéance est passée. */
  onlyDue?: boolean;
  fetcher?: WebsiteFetcher;
  logger?: Logger;
  signal?: AbortSignal;
}

/** Intervalle avant le prochain passage, selon ce qu'on a trouvé. */
function nextCheckDays(status: DomainScanResult['status'], hasSiren: boolean): number {
  switch (status) {
    case 'reachable':
      // Un site rattaché au répertoire est stable : on peut espacer.
      return hasSiren ? 45 : 30;
    case 'placeholder':
      // Un domaine parké peut devenir un vrai site : c'est un signal fort.
      return 14;
    case 'broken':
      return 7;
    case 'unreachable':
      return 21;
    case 'excluded':
      return 180;
  }
}

export async function scanDomain(
  domain: string,
  fetcher: WebsiteFetcher,
  previousHash: string | null,
  signal?: AbortSignal,
): Promise<DomainScanResult> {
  const result = await fetcher.probeDomain(domain, signal);

  if (result.skippedReason === 'robots') {
    return {
      domain, status: 'excluded', analysis: null, fetch: result,
      legalPageUrl: null, sirens: [], contentChanged: false,
    };
  }

  if (result.html === null) {
    const status = result.status !== null && result.status >= 400 ? 'broken' : 'unreachable';
    return {
      domain, status, analysis: null, fetch: result,
      legalPageUrl: null, sirens: [], contentChanged: false,
    };
  }

  const analysis = analyzePage(result.html, result.finalUrl);
  const sirens = new Set(analysis.sirens);
  let legalPageUrl: string | null = null;

  // Seconde requête vers les mentions légales, uniquement si l'accueil n'a
  // rien donné : c'est un coût qu'on n'engage que quand il peut rapporter le
  // rattachement déterministe.
  if (sirens.size === 0 && analysis.legalPageLinks.length > 0) {
    const target = analysis.legalPageLinks[0];
    if (target) {
      const legal = await fetcher.fetchPage(target, signal);
      if (legal.html !== null) {
        legalPageUrl = legal.finalUrl;
        for (const siren of analyzePage(legal.html, legal.finalUrl).sirens) sirens.add(siren);
      }
    }
  }

  return {
    domain,
    status: analysis.placeholder ? 'placeholder' : 'reachable',
    analysis,
    fetch: result,
    legalPageUrl,
    sirens: [...sirens],
    contentChanged: previousHash !== null && previousHash !== analysis.contentHash,
  };
}

/**
 * Parcourt la file de domaines à scanner.
 *
 * Les domaines sont traités un par un et non en parallèle : le limiteur du
 * récupérateur est par hôte, mais rien n'empêcherait d'ouvrir cent connexions
 * vers cent hébergeurs différents. À l'échelle d'un scan national, la
 * concurrence viendra du nombre de workers, pas de la boucle.
 */
export async function scanDueDomains(db: Db, options: ScanOptions = {}): Promise<ScanReport> {
  const report: ScanReport = {
    scanned: 0, reachable: 0, placeholders: 0, broken: 0, unreachable: 0,
    excluded: 0, unchanged: 0, sirensFound: 0, companiesAttached: 0,
    companiesConfirmed: 0, sharedSirensSkipped: 0, errors: 0,
  };

  const fetcher = options.fetcher ?? new WebsiteFetcher();
  const log = options.logger;

  let query = db
    .from('domains')
    .select('domain, content_hash')
    .neq('status', 'excluded')
    .order('next_check_at', { ascending: true })
    .limit(options.limit ?? 200);

  if (options.onlyDue !== false) query = query.lte('next_check_at', new Date().toISOString());

  const { data: due, error } = await query;
  if (error) throw new Error(`scanDueDomains : ${error.message}`);

  for (const row of due ?? []) {
    if (options.signal?.aborted) break;

    try {
      const scan = await scanDomain(row.domain, fetcher, row.content_hash, options.signal);
      report.scanned += 1;

      switch (scan.status) {
        case 'reachable': report.reachable += 1; break;
        case 'placeholder': report.placeholders += 1; break;
        case 'broken': report.broken += 1; break;
        case 'unreachable': report.unreachable += 1; break;
        case 'excluded': report.excluded += 1; break;
      }

      if (row.content_hash !== null && !scan.contentChanged && scan.analysis) {
        report.unchanged += 1;
      }

      await persistScan(db, scan);

      if (scan.sirens.length > 0) {
        report.sirensFound += 1;
        const { data: outcome } = await db.rpc('attach_domain_by_legal_siren', {
          p_domain: scan.domain,
        });

        const row = outcome?.[0];
        if (row) {
          report.companiesAttached += row.attached ?? 0;
          report.companiesConfirmed += row.confirmed ?? 0;
          report.sharedSirensSkipped += row.skipped_shared ?? 0;

          if ((row.attached ?? 0) > 0 || (row.confirmed ?? 0) > 0) {
            log?.info('Mentions légales exploitées', {
              domain: scan.domain,
              sirens: scan.sirens,
              attached: row.attached,
              confirmed: row.confirmed,
            });
          }
        }
      }
    } catch (scanError: unknown) {
      report.errors += 1;
      const message = scanError instanceof Error ? scanError.message : String(scanError);
      log?.warn('Scan en échec', { domain: row.domain, error: message });

      await db
        .from('domains')
        .update({
          check_error: message,
          last_checked_at: new Date().toISOString(),
          next_check_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        })
        .eq('domain', row.domain);
    }
  }

  log?.info('Scan de domaines terminé', {
    scanned: report.scanned,
    reachable: report.reachable,
    sirens_found: report.sirensFound,
    companies_attached: report.companiesAttached,
    companies_confirmed: report.companiesConfirmed,
  });

  return report;
}

async function persistScan(db: Db, scan: DomainScanResult): Promise<void> {
  const analysis = scan.analysis;
  const days = nextCheckDays(scan.status, scan.sirens.length > 0);

  const { error } = await db
    .from('domains')
    .update({
      status: scan.status,
      http_status: scan.fetch.status,
      final_url: scan.fetch.finalUrl,
      redirect_chain: scan.fetch.redirectChain as unknown as Json,
      title: analysis?.title ?? null,
      meta_description: analysis?.metaDescription ?? null,
      content_hash: analysis?.contentHash ?? null,
      tech_hash: analysis ? analysis.technologies.slice().sort().join('|') : null,
      cms: analysis?.cms ?? null,
      framework: analysis?.framework ?? null,
      technologies: (analysis?.technologies ?? []) as unknown as Json,
      has_ssl: scan.fetch.hasSsl,
      has_viewport_meta: analysis?.hasViewportMeta ?? null,
      has_media_queries: analysis?.hasMediaQueries ?? null,
      html_bytes: scan.fetch.bytes,
      ttfb_ms: scan.fetch.ttfbMs,
      ecommerce_detected: analysis?.ecommerceDetected ?? false,
      booking_detected: analysis?.bookingDetected ?? false,
      contact_form_detected: analysis?.hasContactForm ?? false,
      contact_form_url: analysis?.contactFormUrl ?? null,
      sirens_found: scan.sirens,
      phones_found: analysis?.phones ?? [],
      emails_found: analysis?.emails ?? [],
      copyright_year: analysis?.copyrightYear ?? null,
      legal_page_url: scan.legalPageUrl,
      legal_page_checked_at: scan.legalPageUrl ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      check_error: scan.fetch.error,
    })
    .eq('domain', scan.domain);

  if (error) throw new Error(`persistScan(${scan.domain}) : ${error.message}`);
}

/** Ajoute un domaine à la file de scan, sans passer par une entreprise. */
export async function enqueueDomain(db: Db, input: string): Promise<string | null> {
  const domain = normalizeDomainDetailed(input).domain;
  if (!domain) return null;

  await db.from('domains').upsert({ domain }, { onConflict: 'domain', ignoreDuplicates: true });
  return domain;
}
