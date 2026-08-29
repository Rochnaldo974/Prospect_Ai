import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { normalizeDomainDetailed } from '../normalization';
import { analyzePage, type PageAnalysis } from './page-analysis';
import type { TlsInspection } from './fetcher';
import { inspectTls, WebsiteFetcher, type FetchResult } from './fetcher';

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
  status: 'reachable' | 'placeholder' | 'broken' | 'unreachable' | 'blocked' | 'excluded';
  analysis: PageAnalysis | null;
  fetch: FetchResult;
  legalPageUrl: string | null;
  /** SIREN trouvés, accueil et mentions légales confondues. */
  sirens: string[];
  /** Le contenu a-t-il changé depuis le dernier passage ? */
  contentChanged: boolean;
  /** Certificat examiné, quand l'hôte répond en HTTPS. */
  tls: TlsInspection | null;
}

export interface ScanReport {
  scanned: number;
  reachable: number;
  placeholders: number;
  broken: number;
  unreachable: number;
  blocked: number;
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
  /**
   * Domaines traités de front. Chaque domaine est un hôte différent, et le
   * limiteur par hôte du récupérateur reste en vigueur : la concurrence
   * répartit la charge sur des hébergeurs distincts, elle ne l'accumule pas
   * sur un seul.
   */
  concurrency?: number;
}

/**
 * Codes par lesquels un serveur refuse notre requête sans rien dire de l'état
 * du site : authentification exigée, pare-feu applicatif, débit limité.
 */
const BLOCKING_STATUSES = new Set([401, 403, 429]);

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
    case 'blocked':
      // Rien à réessayer avant longtemps : c'est notre récupérateur qui est
      // refusé, et il le sera encore demain.
      return 90;
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

  // Avant toute branche : un certificat refusé fait échouer la récupération
  // elle-même. Constater le refus après coup reviendrait à ne jamais le
  // constater, et à ranger en « site injoignable » un site qui répond très
  // bien — avec un avertissement de sécurité devant.
  const tls = result.skippedReason === 'robots' ? null : await inspectTls(domain);

  if (result.skippedReason === 'robots') {
    return {
      domain, status: 'excluded', analysis: null, fetch: result,
      legalPageUrl: null, sirens: [], contentChanged: false, tls: null,
    };
  }

  if (result.html === null) {
    // 401, 403, 429 : le serveur refuse NOTRE requête, il ne tombe pas. Un
    // visiteur ordinaire voit le site normalement. En faire un besoin de
    // refonte serait la pire erreur que le produit puisse commettre.
    const status = result.status === null
      ? 'unreachable'
      : BLOCKING_STATUSES.has(result.status)
        ? 'blocked'
        : result.status >= 400
          ? 'broken'
          : 'unreachable';
    return {
      domain, status, analysis: null, fetch: result, tls,
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
    tls,
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
 * Les domaines sont traités par petits groupes simultanés. Le limiteur du
 * récupérateur est par hôte : deux domaines de la file appartenant au même
 * hébergeur restent sérialisés, tandis que deux hébergeurs différents sont
 * interrogés en même temps. C'est ce qui sépare un scan national réalisable
 * d'un scan qui prendrait des jours — le débit du scan est le plafond du
 * nombre d'opportunités que le produit peut trouver.
 *
 * La borne reste basse volontairement : faire tomber le site d'un artisan
 * serait un échec, quelle que soit la qualité des données récoltées.
 */
export async function scanDueDomains(db: Db, options: ScanOptions = {}): Promise<ScanReport> {
  const report: ScanReport = {
    scanned: 0, reachable: 0, placeholders: 0, broken: 0, unreachable: 0,
    blocked: 0, excluded: 0, unchanged: 0, sirensFound: 0, companiesAttached: 0,
    companiesConfirmed: 0, sharedSirensSkipped: 0, errors: 0,
  };

  const fetcher = options.fetcher ?? new WebsiteFetcher();
  const log = options.logger;

  let query = db
    .from('domains')
    .select('domain, content_hash, check_attempts')
    .neq('status', 'excluded')
    .order('next_check_at', { ascending: true })
    .limit(options.limit ?? 200);

  if (options.onlyDue !== false) query = query.lte('next_check_at', new Date().toISOString());

  const { data: due, error } = await query;
  if (error) throw new Error(`scanDueDomains : ${error.message}`);

  const queue = (due ?? []).slice();
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 8, 32));

  const worker = async (): Promise<void> => {
    for (;;) {
      const row = queue.shift();
      if (row === undefined) return;
      if (options.signal?.aborted) return;

      await scanOne(row);
    }
  };

  const scanOne = async (
    row: { domain: string; content_hash: string | null; check_attempts: number },
  ): Promise<void> => {
    try {
      const scan = await scanDomain(row.domain, fetcher, row.content_hash, options.signal);
      report.scanned += 1;

      switch (scan.status) {
        case 'reachable': report.reachable += 1; break;
        case 'placeholder': report.placeholders += 1; break;
        case 'broken': report.broken += 1; break;
        case 'unreachable': report.unreachable += 1; break;
        case 'blocked': report.blocked += 1; break;
        case 'excluded': report.excluded += 1; break;
      }

      if (row.content_hash !== null && !scan.contentChanged && scan.analysis) {
        report.unchanged += 1;
      }

      await persistScan(db, scan, row.check_attempts);
      await recordScanEvents(db, scan, row.content_hash, row.check_attempts);

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
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  log?.info('Scan de domaines terminé', {
    scanned: report.scanned,
    reachable: report.reachable,
    sirens_found: report.sirensFound,
    companies_attached: report.companiesAttached,
    companies_confirmed: report.companiesConfirmed,
  });

  return report;
}

async function persistScan(
  db: Db,
  scan: DomainScanResult,
  previousFailures: number,
): Promise<void> {
  const analysis = scan.analysis;
  const days = nextCheckDays(scan.status, scan.sirens.length > 0);

  // Échecs consécutifs. Une coupure d'une seconde arrive à n'importe quel
  // hébergeur : annoncer à un artisan que son site est en panne sur la foi
  // d'une seule requête ratée coûterait au freelance sa crédibilité dès le
  // premier appel. Le compteur repart à zéro dès que le site répond.
  const down = scan.status === 'broken' || scan.status === 'unreachable';

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
      check_attempts: down ? previousFailures + 1 : 0,
      tls_valid: scan.tls?.valid ?? null,
      tls_reason: scan.tls?.reason ?? null,
      tls_valid_to: scan.tls?.validTo?.slice(0, 10) ?? null,
      tls_issuer: scan.tls?.issuer ?? null,
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

/**
 * Transforme les changements observés en événements datés.
 *
 * Le scan constate un état ; l'événement enregistre une TRANSITION. C'est la
 * transition qui porte une date, et c'est elle qui autorise un déclencheur —
 * « le site est cassé » est un état permanent, « le site est tombé le 12 »
 * est un motif de contact.
 */
async function recordScanEvents(
  db: Db,
  scan: DomainScanResult,
  previousHash: string | null,
  previousFailures: number,
): Promise<void> {
  // Le domaine peut être revendiqué par plusieurs établissements : l'événement
  // concerne chacun d'eux.
  const { data: companies } = await db
    .from('companies')
    .select('id')
    .eq('domain', scan.domain);

  if (!companies || companies.length === 0) return;

  const now = new Date().toISOString();
  const events: {
    type: string;
    importance: number;
    confidence: number;
    payload: Record<string, Json>;
    key: string;
  }[] = [];

  if (scan.status === 'broken' || scan.status === 'unreachable') {
    // Seulement si le site répondait auparavant : un domaine jamais joignable
    // n'est pas « tombé ».
    if (previousHash !== null) {
      events.push({
        type: 'website_went_down',
        importance: 90,
        confidence: 0.95,
        payload: { domain: scan.domain, status: scan.status, http_status: scan.fetch.status },
        // La date du jour dans la clé : une nouvelle chute après remise en
        // ligne produit bien un nouvel événement.
        key: `website_went_down:${scan.domain}:${now.slice(0, 10)}`,
      });
    } else if (previousFailures >= 1) {
      // Un site que nous n'avons jamais vu fonctionner et qui ne répond
      // toujours pas au deuxième passage. On ne sait pas depuis quand il est
      // hors service — c'est un constat, pas une chute datée, et l'explication
      // livrée au freelance doit le dire dans ces termes.
      //
      // La clé ne porte pas la date : le fait est enregistré une fois, pas à
      // chaque passage. Sans cela, un site abandonné depuis des années
      // reviendrait indéfiniment et le produit redeviendrait un annuaire.
      events.push({
        type: 'website_found_down',
        importance: 85,
        confidence: 0.9,
        payload: {
          domain: scan.domain,
          status: scan.status,
          http_status: scan.fetch.status,
          observations: previousFailures + 1,
        },
        key: `website_found_down:${scan.domain}`,
      });
    }
  } else if (scan.tls && !scan.tls.valid && scan.tls.validTo
             && new Date(scan.tls.validTo).getTime() < Date.now()) {
    // Un certificat expiré porte sa propre date : c'est le jour où le site est
    // devenu inaccessible sans avertissement, connu à la seconde près et
    // vérifiable par n'importe qui. Rien à inférer.
    events.push({
      type: 'certificate_expired',
      importance: 88,
      confidence: 0.98,
      payload: {
        domain: scan.domain,
        expired_at: scan.tls.validTo,
        reason: scan.tls.reason,
        issuer: scan.tls.issuer,
      },
      key: `certificate_expired:${scan.domain}:${scan.tls.validTo.slice(0, 10)}`,
    });
  } else if (scan.contentChanged) {
    events.push({
      type: 'website_changed',
      importance: 60,
      confidence: 0.85,
      payload: { domain: scan.domain, previous_hash: previousHash },
      key: `website_changed:${scan.domain}:${now.slice(0, 10)}`,
    });
  }

  for (const event of events) {
    for (const company of companies) {
      await db.from('company_events').insert({
        company_id: company.id,
        event_type: event.type,
        payload: event.payload as Json,
        importance: event.importance,
        confidence: event.confidence,
        source: 'domain_scan',
        occurred_at: now,
        dedupe_key: `${event.key}:${company.id}`,
      });
    }
  }
}
