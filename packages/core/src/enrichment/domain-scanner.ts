import type { Db } from '../db/client';
import { detectTechnologies, type DetectedTechnology } from './technology-detector';
import { isPerformanceSuspect, readPerformanceFacts, type PerformanceFacts } from './performance-audit';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { normalizeDomainDetailed } from '../normalization';
import { analyzePage, type PageAnalysis } from './page-analysis';
import type { TlsInspection } from './fetcher';
import { inspectTls, WebsiteFetcher, type FetchResult } from './fetcher';
import { upsertContacts } from '../contacts/ingest';
import { resolveCompanyContacts } from '../contacts/resolver';
import type { ContactCandidate } from '../contacts/types';

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
  /** Technologies avec version quand la page la révèle. */
  technologies: DetectedTechnology[];
  /** Faits de performance mesurés sans télécharger les ressources. */
  performance: PerformanceFacts | null;
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
  /** Le site s'adapte-t-il au mobile ? null quand on n'a pas pu conclure. */
  responsive: boolean | null;
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

/**
 * Intervalle avant le prochain passage, selon ce qu'on a trouvé — et selon
 * l'histoire du domaine. Un site qui n'a pas bougé en trois passages peut
 * attendre ; un domaine déposé le mois dernier est à revoir dans la semaine,
 * c'est le moment où le site apparaît ; un site cassé se recontrôle vite.
 */
export function rescanIntervalDays(
  status: DomainScanResult['status'],
  hasSiren: boolean,
  history: { unchangedStreak?: number; registeredAt?: string | null } = {},
): number {
  const base = nextCheckDays(status, hasSiren);
  if (status !== 'reachable' && status !== 'placeholder') return base;
  const registered = history.registeredAt ? Date.parse(history.registeredAt) : Number.NaN;
  const recentDomain = Number.isFinite(registered) && Date.now() - registered < 60 * 86_400_000;
  if (recentDomain) return Math.min(base, status === 'placeholder' ? 5 : 7);
  const streak = history.unchangedStreak ?? 0;
  if (streak >= 6) return Math.min(120, base * 3);
  if (streak >= 3) return Math.min(90, base * 2);
  return base;
}

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

/** L'hôte que le visiteur voit réellement : celui de l'URL finale en HTTPS, sinon le domaine. */
function landingHostOf(result: FetchResult, domain: string): string {
  try {
    const final = new URL(result.finalUrl);
    if (final.protocol === 'https:' && final.hostname.length > 0) return final.hostname;
  } catch {
    // URL finale illisible : on retombe sur le domaine.
  }
  return domain;
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
  //
  // Le certificat examiné est celui de l'adresse où le visiteur ATTERRIT.
  // Beaucoup de sites ne servent que « www » : le domaine nu redirige, et son
  // certificat, s'il ne couvre pas le nom nu, n'est vu par personne — le
  // navigateur suit la redirection avant de l'inspecter. Constaté sur une
  // fiche livrée : « certificat invalide » sur un site irréprochable.
  const landingHost = landingHostOf(result, domain);
  const tls = result.skippedReason === 'robots' ? null : await inspectTls(landingHost);

  if (result.skippedReason === 'robots') {
    return {
      domain, status: 'excluded', analysis: null, fetch: result,
      legalPageUrl: null, sirens: [], contentChanged: false, tls: null,
      responsive: null, technologies: [], performance: null,
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
      legalPageUrl: null, sirens: [], contentChanged: false, responsive: null,
      technologies: [], performance: null,
    };
  }

  const analysis = analyzePage(result.html, result.finalUrl);

  // Adaptation au mobile : conclusion tirée d'une lecture effective, pas du
  // seul HTML. La quasi-totalité des sites tiennent leur mise en page dans un
  // fichier séparé, si bien qu'un HTML sans media query ne prouve rien — on
  // l'a vérifié sur des enseignes nationales au site parfaitement adapté.
  //
  // Une requête de plus, et seulement quand la page ne tranche pas : c'est le
  // prix d'un constat qu'on peut défendre devant le commerçant.
  const responsive = analysis.hasMediaQueries
    ? true
    : await readsAsResponsive(analysis.stylesheets, result.finalUrl, fetcher, signal);
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

  // La page Contact : c'est là que vivent l'e-mail et le formulaire, presque
  // jamais sur l'accueil. Une requête de plus, seulement quand l'accueil n'a
  // rien donné — et ce qu'elle apporte remonte dans l'analyse de l'accueil,
  // qui est ce que le reste du moteur lit.
  const contactTarget = analysis.contactPageLinks[0];
  if (contactTarget && (analysis.emails.length === 0 || !analysis.hasContactForm)) {
    const contact = await fetcher.fetchPage(contactTarget, signal);
    if (contact.html !== null) {
      const found = analyzePage(contact.html, contact.finalUrl);
      analysis.emails = [...new Set([...analysis.emails, ...found.emails])];
      analysis.phones = [...new Set([...analysis.phones, ...found.phones])];
      for (const siren of found.sirens) sirens.add(siren);
      if (/<form\b/i.test(contact.html) && !/type=["']search["']/i.test(contact.html)) {
        analysis.hasContactForm = true;
        analysis.contactFormUrl = contact.finalUrl;
      }
    }
  }

  return {
    domain,
    status: analysis.placeholder ? 'placeholder' : 'reachable',
    tls,
    responsive,
    analysis,
    fetch: result,
    legalPageUrl,
    sirens: [...sirens],
    contentChanged: previousHash !== null && previousHash !== analysis.contentHash,
    technologies: detectTechnologies(result.html, { technologies: analysis.technologies, datedComponents: analysis.datedComponents }),
    performance: readPerformanceFacts(result.html, { ttfbMs: result.ttfbMs, bytes: result.bytes }),
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
    .select('domain, content_hash, check_attempts, tech_year, unchanged_streak, registered_at, status, cms, title, tech_hash, ecommerce_detected, phones_found, emails_found, performance_audit_status, last_performance_audit_at')
    .neq('status', 'excluded')
    // Le parc national compte 4,59 millions de domaines : l'ordre de passage
    // décide de ce qu'on trouve les premiers jours. La priorité est calculée
    // avant toute visite, sur le nom et l'âge du domaine — un « boulangerie »
    // déposé il y a quinze ans passe avant un domaine anonyme de l'an dernier.
    .order('scan_priority', { ascending: false })
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

  const scanOne = (row: DueRow): Promise<void> => scanAndPersist(db, row, fetcher, report, log, options.signal);

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

/**
 * Le site s'adapte-t-il au mobile, d'après ses feuilles de style ?
 *
 * On en lit au plus deux : au-delà, le coût dépasse l'information. Une absence
 * de media query dans les deux premières ne prouve rien — d'où `null` plutôt
 * que `false`. On ne conclut à l'inadaptation que si l'on a effectivement lu
 * du CSS sans y trouver aucune règle d'adaptation.
 */
async function readsAsResponsive(
  stylesheets: string[],
  siteUrl: string,
  fetcher: WebsiteFetcher,
  signal?: AbortSignal,
): Promise<boolean | null> {
  const candidates = layoutStylesheets(stylesheets, siteUrl);
  if (candidates.length === 0) return null;

  let read = 0;
  for (const href of candidates.slice(0, 3)) {
    if (signal?.aborted) break;

    const sheet = await fetcher.fetchPage(href, signal, /text\/css/i);
    if (sheet.html === null) continue;

    read += 1;
    if (/@media[^{]*\((?:max|min)-width/i.test(sheet.html)) return true;
  }

  return read > 0 ? false : null;
}

/**
 * Les feuilles susceptibles de porter la mise en page.
 *
 * Une police web et un jeu d'icônes n'adaptent rien : les lire d'abord faisait
 * conclure à tort qu'un site n'était pas responsive, alors que sa feuille
 * principale arrivait en troisième position — constaté sur le site d'une
 * chaîne de supermarchés dont la mise en page s'adapte parfaitement.
 *
 * On sert donc d'abord les feuilles du site lui-même, et on écarte ce qui ne
 * peut rien contenir d'utile.
 */
function layoutStylesheets(stylesheets: string[], siteUrl: string): string[] {
  let host: string;
  try {
    host = new URL(siteUrl).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }

  const useful = stylesheets.filter((href) => !/fonts\.googleapis|font-?awesome|\bprint\.css/i.test(href));

  // Tri stable : les feuilles du domaine d'abord, dans l'ordre de la page.
  return [
    ...useful.filter((href) => href.includes(host)),
    ...useful.filter((href) => !href.includes(host)),
  ];
}

async function persistScan(
  db: Db,
  scan: DomainScanResult,
  previousFailures: number,
  history: { unchangedStreak?: number; registeredAt?: string | null; previousHash?: string | null; performanceAuditStatus?: string; lastPerformanceAuditAt?: string | null } = {},
): Promise<void> {
  const analysis = scan.analysis;
  // La série d'« inchangé » : repart à zéro dès que le contenu bouge ou que le site tombe.
  const unchanged = scan.analysis !== null && history.previousHash != null && !scan.contentChanged;
  const streak = unchanged ? (history.unchangedStreak ?? 0) + 1 : 0;
  const days = rescanIntervalDays(scan.status, scan.sirens.length > 0, { unchangedStreak: streak, registeredAt: history.registeredAt ?? null });

  // Échecs consécutifs. Une coupure d'une seconde arrive à n'importe quel
  // hébergeur : annoncer à un artisan que son site est en panne sur la foi
  // d'une seule requête ratée coûterait au freelance sa crédibilité dès le
  // premier appel. Le compteur repart à zéro dès que le site répond.
  const down = scan.status === 'broken' || scan.status === 'unreachable';

  // Présélection : un site suspect est mis en attente d'audit approfondi,
  // sauf s'il en a reçu un depuis moins de trente jours. Un site qui ne
  // l'est plus sort de la file.
  const auditAge = history.lastPerformanceAuditAt ? (Date.now() - new Date(history.lastPerformanceAuditAt).getTime()) / 86_400_000 : Infinity;
  const suspect = scan.performance !== null && scan.status === 'reachable' && isPerformanceSuspect(scan.performance);
  const auditStatus = suspect
    ? (auditAge > 30 ? 'pending' : undefined)
    : (history.performanceAuditStatus === 'pending' ? 'none' : undefined);

  const { error } = await db
    .from('domains')
    .update({
      performance_facts: (scan.performance ?? null) as unknown as Json,
      ...(auditStatus ? { performance_audit_status: auditStatus } : {}),
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
      responsive: scan.responsive,
      tech_year: analysis?.technologyYear ?? null,
      dated_components: (analysis?.datedComponents ?? []) as unknown as Json,
      legal_page_url: scan.legalPageUrl,
      legal_page_checked_at: scan.legalPageUrl ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      check_error: scan.fetch.error,
      check_attempts: down ? previousFailures + 1 : 0,
      unchanged_streak: streak,
      seo_facts: (analysis?.seo ?? null) as unknown as Json,
      commerce_facts: (analysis?.commerce ?? null) as unknown as Json,
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
  previousTechYear: number | null,
  changes: DomainChange[] = [],
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

  // Un site revenu en ligne après une chute : la chute était réelle, et
  // l'hébergement n'est pas fiable. Distinct des branches exclusives qui
  // suivent — il s'ajoute à ce que le scan constate par ailleurs.
  if (changes.some((c) => c.kind === 'site_came_back_online')) {
    events.push({
      type: 'website_came_back_online',
      importance: 55,
      confidence: 0.9,
      payload: { domain: scan.domain, status: scan.status },
      key: `website_came_back_online:${scan.domain}:${now.slice(0, 10)}`,
    });
  }

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
  } else if (scan.contentChanged && previousTechYear !== null
             && new Date().getFullYear() - previousTechYear >= 5) {
    // Un site immobile depuis des années qui bouge enfin.
    //
    // C'est le meilleur moment pour appeler, et le plus difficile à
    // reproduire pour un concurrent : l'entreprise vient de décider que son
    // site comptait. Elle a peut-être commencé seule, ou pris quelqu'un —
    // l'explication doit poser la question plutôt que de trancher.
    //
    // Distinct de website_changed, qu'un site vivant déclenche chaque semaine
    // sans que cela signifie quoi que ce soit.
    events.push({
      type: 'frozen_site_woke_up',
      importance: 86,
      confidence: 0.85,
      payload: {
        domain: scan.domain,
        previous_tech_year: previousTechYear,
        new_tech_year: scan.analysis?.technologyYear ?? null,
      },
      key: `frozen_site_woke_up:${scan.domain}:${now.slice(0, 10)}`,
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

interface DueRow {
  domain: string; content_hash: string | null;
  check_attempts: number; tech_year: number | null;
  unchanged_streak?: number; registered_at?: string | null;
  status?: string; cms?: string | null; title?: string | null; tech_hash?: string | null;
  ecommerce_detected?: boolean; phones_found?: string[]; emails_found?: string[];
  performance_audit_status?: string; last_performance_audit_at?: string | null;
}

/** Ce qui a changé entre le dernier scan et celui-ci. */
export type DomainChangeKind = 'site_appeared' | 'site_disappeared' | 'site_came_back_online' | 'technology_changed' | 'new_ecommerce' | 'contact_changed' | 'major_redesign';
export interface DomainChange { kind: DomainChangeKind; before: Record<string, Json>; after: Record<string, Json> }

const LIVE = new Set(['reachable', 'placeholder']);
const DOWN = new Set(['broken', 'unreachable']);
const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((v) => b.includes(v));

/**
 * Compare l'état précédent au scan. Pur : rien n'est écrit ici.
 *
 * Un changement de quelques caractères n'est pas une refonte : la refonte
 * majeure exige que le contenu ait changé ET que le titre, le CMS ou la
 * pile technique aient changé avec lui.
 */
export function detectChanges(previous: DueRow, scan: DomainScanResult): DomainChange[] {
  const out: DomainChange[] = [];
  const prevStatus = previous.status ?? null;
  const a = scan.analysis;
  if (prevStatus !== null && !LIVE.has(prevStatus) && LIVE.has(scan.status)) {
    out.push({ kind: DOWN.has(prevStatus) ? 'site_came_back_online' : 'site_appeared', before: { status: prevStatus }, after: { status: scan.status } });
  }
  if (prevStatus !== null && LIVE.has(prevStatus) && DOWN.has(scan.status)) {
    out.push({ kind: 'site_disappeared', before: { status: prevStatus }, after: { status: scan.status, http_status: scan.fetch.status } });
  }
  if (!a) return out;
  const prevCms = previous.cms ?? null;
  if (prevStatus !== null && LIVE.has(prevStatus) && prevCms !== null && a.cms !== null && prevCms !== a.cms) {
    out.push({ kind: 'technology_changed', before: { cms: prevCms }, after: { cms: a.cms } });
  }
  if (previous.ecommerce_detected === false && a.ecommerceDetected) {
    out.push({ kind: 'new_ecommerce', before: { ecommerce: false }, after: { ecommerce: true, platform: a.commerce?.platform ?? null } });
  }
  if (prevStatus !== null && LIVE.has(prevStatus) && (!sameSet(previous.phones_found, a.phones) || !sameSet(previous.emails_found, a.emails))) {
    out.push({ kind: 'contact_changed', before: { phones: previous.phones_found ?? [], emails: previous.emails_found ?? [] }, after: { phones: a.phones, emails: a.emails } });
  }
  const techHash = a.technologies.slice().sort().join('|');
  if (scan.contentChanged && prevStatus !== null && LIVE.has(prevStatus)
      && ((previous.title ?? null) !== (a.title ?? null) || prevCms !== a.cms || (previous.tech_hash ?? null) !== techHash)) {
    out.push({ kind: 'major_redesign', before: { title: previous.title ?? null, cms: prevCms, tech_hash: previous.tech_hash ?? null }, after: { title: a.title, cms: a.cms, tech_hash: techHash } });
  }
  return out;
}

async function recordDomainChanges(db: Db, previous: DueRow, scan: DomainScanResult, log: Logger | undefined): Promise<DomainChange[]> {
  const changes = detectChanges(previous, scan);
  if (changes.length === 0) return changes;
  const { error } = await db.from('domain_changes').insert(changes.map((c) => ({ domain: scan.domain, kind: c.kind, before: c.before as Json, after: c.after as Json })));
  if (error) log?.warn('Changements de site non enregistrés', { domain: scan.domain, error: error.message });
  return changes;
}

/** Les technologies vues, avec leur version : première fois insérée, revue mise à jour. */
async function recordTechnologies(db: Db, scan: DomainScanResult, log: Logger | undefined): Promise<void> {
  if (scan.technologies.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await db.from('domain_technologies').upsert(
    scan.technologies.map((t) => ({ domain: scan.domain, technology: t.technology, version: t.version, confidence: t.confidence, source: t.source, last_seen_at: now })),
    { onConflict: 'domain,technology' },
  );
  if (error) log?.warn('Technologies non enregistrées', { domain: scan.domain, error: error.message });
}

/** Scanne un domaine et enregistre tout ce qui en découle : faits, événements, rattachements. */
async function scanAndPersist(
  db: Db,
  row: DueRow,
  fetcher: WebsiteFetcher,
  report: ScanReport,
  log: Logger | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {

    try {
      const scan = await scanDomain(row.domain, fetcher, row.content_hash, signal);
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

      await persistScan(db, scan, row.check_attempts, {
        unchangedStreak: row.unchanged_streak ?? 0, registeredAt: row.registered_at ?? null, previousHash: row.content_hash,
        ...(row.performance_audit_status ? { performanceAuditStatus: row.performance_audit_status } : {}),
        lastPerformanceAuditAt: row.last_performance_audit_at ?? null,
      });
      await recordTechnologies(db, scan, log);
      const changes = await recordDomainChanges(db, row, scan, log);

      // Un formulaire trouvé est un moyen de contact : il ouvre la porte de
      // qualité pour l'entreprise qui revendique ce site et n'en avait pas.
      if (scan.analysis?.contactFormUrl) {
        await db
          .from('companies')
          .update({ contact_form_url: scan.analysis.contactFormUrl })
          .eq('domain', scan.domain)
          .is('contact_form_url', null);
      }

      // Téléphones, e-mails et formulaire lus sur le site : des contacts
      // avec leur page d'origine, pour chaque entreprise qui revendique ce
      // domaine, puis le meilleur canal reporté sur l'entreprise. C'est ici
      // que le téléphone d'un site cesse de rester au bord de la route.
      await recordScanContacts(db, scan, log);
      await recordScanEvents(db, scan, row.content_hash, row.check_attempts, row.tech_year, changes);

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

/**
 * Rescanne un seul domaine, tout de suite.
 *
 * Sert à la vérification avant livraison : un dossier choisi pour un
 * freelance est revisité à l'instant de l'attribution, et ses faits sont
 * recalculés sur ce que le site montre MAINTENANT, pas sur ce qu'il montrait
 * la nuit du scan. Un état transitoire — certificat en cours de
 * renouvellement, hébergeur en maintenance — ne doit jamais devenir un
 * argument de prospection.
 */
export async function rescanDomain(
  db: Db,
  domain: string,
  options: { fetcher?: WebsiteFetcher; logger?: Logger; signal?: AbortSignal } = {},
): Promise<ScanReport> {
  const report: ScanReport = {
    scanned: 0, reachable: 0, placeholders: 0, broken: 0, unreachable: 0,
    blocked: 0, excluded: 0, unchanged: 0, sirensFound: 0,
    companiesAttached: 0, companiesConfirmed: 0, sharedSirensSkipped: 0, errors: 0,
  };
  const { data: row, error } = await db
    .from('domains')
    .select('domain, content_hash, check_attempts, tech_year, unchanged_streak, registered_at, status, cms, title, tech_hash, ecommerce_detected, phones_found, emails_found, performance_audit_status, last_performance_audit_at')
    .eq('domain', domain)
    .maybeSingle();
  if (error) throw new Error(`rescanDomain : ${error.message}`);
  if (!row) return report;

  await scanAndPersist(db, row, options.fetcher ?? new WebsiteFetcher(), report, options.logger, options.signal);
  return report;
}

/** Les contacts qu'un scan a lus, rattachés aux entreprises du domaine. */
async function recordScanContacts(db: Db, scan: DomainScanResult, log?: Logger): Promise<void> {
  const analysis = scan.analysis;
  if (!analysis) return;
  const pageUrl = scan.fetch?.finalUrl ?? `https://${scan.domain}`;
  const contacts: ContactCandidate[] = [
    ...analysis.phones.map((value): ContactCandidate => ({ type: 'phone', value, source: 'website', sourceUrl: pageUrl })),
    ...analysis.emails.map((value): ContactCandidate => ({ type: 'email', value, source: analysis.contactFormUrl ? 'contact_page' : 'website', sourceUrl: analysis.contactFormUrl ?? pageUrl })),
    ...(analysis.contactFormUrl ? [{ type: 'contact_form', value: analysis.contactFormUrl, source: 'contact_page', sourceUrl: analysis.contactFormUrl } as ContactCandidate] : []),
  ];
  if (contacts.length === 0) return;

  const { data: owners } = await db.from('companies').select('id').eq('domain', scan.domain).limit(5);
  for (const owner of owners ?? []) {
    try {
      await upsertContacts(db, owner.id, contacts);
      await resolveCompanyContacts(db, owner.id);
    } catch (error: unknown) {
      log?.warn('Contacts du scan non enregistrés', { domain: scan.domain, company_id: owner.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
