import type { Db } from '../db/client';
import type { Logger } from '../logger';
import type { Company } from '../domain/types';
import { companyNameKey, normalizeCompanyName, normalizeDomainDetailed } from '../normalization';
import { analyzePage } from './page-analysis';
import { WebsiteFetcher } from './fetcher';

/**
 * Recherche du site d'une entreprise qui n'en déclare aucun.
 *
 * On ne devine pas : on propose des candidats plausibles, puis on exige une
 * PREUVE que le site appartient bien à cette entreprise. Sans preuve, aucune
 * attribution — un site attribué à tort envoie le freelance démarcher le
 * mauvais interlocuteur, ce qui coûte plus cher que l'absence d'information.
 */

export interface ResolutionEvidence {
  kind: 'siren_legal' | 'phone' | 'name_and_city' | 'name_only';
  detail: string;
}

export interface ResolutionResult {
  companyId: string;
  domain: string | null;
  confidence: number;
  evidence: ResolutionEvidence[];
  /** Candidats essayés, pour comprendre pourquoi une recherche n'a rien donné. */
  probed: string[];
}

/** En dessous, on n'attribue pas : on note que la recherche a été tentée. */
export const MIN_ASSIGNMENT_CONFIDENCE = 0.8;

/**
 * Candidats plausibles à partir du nom.
 *
 * Volontairement peu nombreux : chaque candidat coûte une requête DNS et une
 * requête HTTP. Mieux vaut trois hypothèses solides que vingt improbables.
 */
export function candidateDomains(company: Pick<Company, 'legal_name' | 'commercial_name'>): string[] {
  const source = company.commercial_name ?? company.legal_name;
  const normalized = normalizeCompanyName(source);
  const compact = companyNameKey(source);
  if (!normalized || !compact || compact.length < 4 || compact.length > 40) return [];

  const hyphenated = normalized.replace(/\s+/g, '-');
  const candidates = new Set<string>();

  for (const base of [compact, hyphenated]) {
    if (base.length < 4 || base.length > 40) continue;
    candidates.add(`${base}.fr`);
    candidates.add(`${base}.com`);
  }

  return [...candidates]
    .map((c) => normalizeDomainDetailed(c).domain)
    .filter((d): d is string => d !== null)
    .slice(0, 4);
}

/**
 * Confronte un candidat à ce qu'on sait de l'entreprise.
 *
 * L'ordre reflète la force de la preuve : le SIREN est une obligation légale
 * d'affichage, le téléphone une coïncidence très improbable, le nom seul ne
 * prouve rien — « Boulangerie Martin » existe partout.
 */
export function scoreMatch(
  company: Pick<Company, 'siren' | 'phone' | 'city' | 'legal_name' | 'commercial_name'>,
  page: { sirens: string[]; phones: string[]; title: string | null; text: string },
): { confidence: number; evidence: ResolutionEvidence[] } {
  const evidence: ResolutionEvidence[] = [];
  let confidence = 0;

  if (company.siren && page.sirens.includes(company.siren)) {
    evidence.push({ kind: 'siren_legal', detail: `SIREN ${company.siren} dans les mentions légales` });
    confidence = 0.99;
  }

  if (company.phone && page.phones.includes(company.phone)) {
    evidence.push({ kind: 'phone', detail: `téléphone ${company.phone} présent sur le site` });
    confidence = Math.max(confidence, 0.92);
  }

  const nameKey = normalizeCompanyName(company.commercial_name ?? company.legal_name);
  const haystack = `${page.title ?? ''} ${page.text}`.toLowerCase();
  const normalizedHaystack = normalizeCompanyName(haystack) ?? '';

  if (nameKey && normalizedHaystack.includes(nameKey)) {
    const cityKey = company.city ? normalizeCompanyName(company.city) : null;
    if (cityKey && normalizedHaystack.includes(cityKey)) {
      evidence.push({ kind: 'name_and_city', detail: `nom et ville présents sur le site` });
      confidence = Math.max(confidence, 0.7);
    } else {
      evidence.push({ kind: 'name_only', detail: 'nom présent, ville absente' });
      confidence = Math.max(confidence, 0.45);
    }
  }

  return { confidence, evidence };
}

export interface ResolveReport {
  examined: number;
  probed: number;
  resolved: number;
  /** Candidats trouvés mais sans preuve suffisante pour être attribués. */
  inconclusive: number;
  errors: number;
  byEvidence: Record<string, number>;
}

export interface ResolveOptions {
  limit?: number;
  fetcher?: WebsiteFetcher;
  logger?: Logger;
  signal?: AbortSignal;
}

/**
 * Cherche un site aux entreprises qui n'en ont pas.
 *
 * Chaque tentative est comptée sur l'entreprise, qu'elle aboutisse ou non :
 * c'est ce qui permettra plus tard de distinguer « site inconnu » de « pas de
 * site », et de n'émettre le signal d'absence que sur preuve positive.
 */
export async function resolveWebsites(
  db: Db,
  options: ResolveOptions = {},
): Promise<ResolveReport> {
  const report: ResolveReport = {
    examined: 0, probed: 0, resolved: 0, inconclusive: 0, errors: 0, byEvidence: {},
  };

  const fetcher = options.fetcher ?? new WebsiteFetcher();
  const log = options.logger;

  const { data: targets, error } = await db
    .from('companies')
    .select('id, legal_name, commercial_name, siren, phone, city, website_resolution_attempts')
    .is('domain', null)
    .eq('prospecting_allowed', true)
    .lt('website_resolution_attempts', 3)
    .order('website_resolution_attempts', { ascending: true })
    .limit(options.limit ?? 100);

  if (error) throw new Error(`resolveWebsites : ${error.message}`);

  for (const company of targets ?? []) {
    if (options.signal?.aborted) break;
    report.examined += 1;

    const candidates = candidateDomains(company);
    let best: { domain: string; confidence: number; evidence: ResolutionEvidence[] } | null = null;

    for (const candidate of candidates) {
      if (options.signal?.aborted) break;

      // Un domaine déjà revendiqué par une autre entreprise n'est pas un
      // candidat : le lui attribuer créerait un conflit, pas une découverte.
      const { data: taken } = await db
        .from('companies')
        .select('id')
        .eq('domain', candidate)
        .limit(1);
      if (taken && taken.length > 0) continue;

      report.probed += 1;
      const fetched = await fetcher.probeDomain(candidate, options.signal);
      if (fetched.html === null) continue;

      const analysis = analyzePage(fetched.html, fetched.finalUrl);
      if (analysis.placeholder) continue;

      const { confidence, evidence } = scoreMatch(company, {
        sirens: analysis.sirens,
        phones: analysis.phones,
        title: analysis.title,
        text: fetched.html.slice(0, 200_000),
      });

      if (!best || confidence > best.confidence) {
        best = { domain: candidate, confidence, evidence };
      }
      // Une preuve légale ne sera pas dépassée : inutile de continuer.
      if (confidence >= 0.99) break;
    }

    try {
      if (best && best.confidence >= MIN_ASSIGNMENT_CONFIDENCE) {
        await db
          .from('companies')
          .update({
            domain: best.domain,
            website_url: `https://${best.domain}`,
            website_confidence: best.confidence,
            website_last_resolved_at: new Date().toISOString(),
            website_resolution_attempts: company.website_resolution_attempts + 1,
          })
          .eq('id', company.id);

        report.resolved += 1;
        for (const item of best.evidence) {
          report.byEvidence[item.kind] = (report.byEvidence[item.kind] ?? 0) + 1;
        }

        log?.info('Site résolu', {
          company_id: company.id,
          domain: best.domain,
          confidence: best.confidence,
          evidence: best.evidence.map((e) => e.kind),
        });
      } else {
        // Sans preuve suffisante, on n'attribue rien — mais on note la
        // tentative, pour ne pas la refaire indéfiniment.
        await db
          .from('companies')
          .update({
            website_resolution_attempts: company.website_resolution_attempts + 1,
            website_last_resolved_at: new Date().toISOString(),
          })
          .eq('id', company.id);

        if (best) report.inconclusive += 1;
      }
    } catch (updateError: unknown) {
      report.errors += 1;
      log?.warn('Enregistrement de résolution en échec', {
        company_id: company.id,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }
  }

  log?.info('Résolution de sites terminée', {
    examined: report.examined,
    probed: report.probed,
    resolved: report.resolved,
    inconclusive: report.inconclusive,
  });

  return report;
}
