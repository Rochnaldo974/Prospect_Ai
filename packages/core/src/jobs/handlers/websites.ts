import { z } from 'zod';
import { createCompaniesFromDomains } from '../../ingestion/domain-to-company';
import { scanDueDomains } from '../../enrichment/domain-scanner';
import { resolveWebsites } from '../../enrichment/website-resolver';
import { WebsiteFetcher } from '../../enrichment/fetcher';
import type { JobHandler } from '../types';

const scanPayload = z.object({
  limit: z.number().int().min(1).max(2000).default(200),
  /** Rescanner même les domaines dont l'échéance n'est pas atteinte. */
  force: z.boolean().default(false),
});

/**
 * Scan des sites connus.
 *
 * Un domaine est scanné une fois, quel que soit le nombre d'entreprises qui le
 * revendiquent : les enseignes de réseau partagent le site de la marque.
 *
 * Le débit est volontairement bas — une requête par seconde et par hôte,
 * robots.txt respecté. Un scan qui ferait tomber le site d'une boulangerie
 * serait un échec, quelle que soit la qualité des données récoltées.
 */
export const scanDomainsHandler: JobHandler<z.infer<typeof scanPayload>> = {
  type: 'scan_domains',
  schema: scanPayload,
  defaultPriority: 65,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await scanDueDomains(db, {
      limit: payload.limit,
      onlyDue: !payload.force,
      logger,
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.scanned,
      succeeded: report.reachable + report.placeholders,
      failed: report.errors,
      metadata: {
        reachable: report.reachable,
        placeholders: report.placeholders,
        broken: report.broken,
        unreachable: report.unreachable,
        excluded: report.excluded,
        // Inchangés : autant de diffs et d'analyses économisés.
        unchanged: report.unchanged,
        sirens_found: report.sirensFound,
        companies_attached: report.companiesAttached,
        companies_confirmed: report.companiesConfirmed,
        shared_sirens_skipped: report.sharedSirensSkipped,
      },
    };
  },
};

const resolvePayload = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
});

/**
 * Recherche de site pour les entreprises qui n'en déclarent aucun.
 *
 * On ne devine pas : un candidat n'est retenu que si le site apporte une
 * preuve d'appartenance — SIREN dans les mentions légales, ou téléphone connu.
 * Le nom et la ville seuls plafonnent sous le seuil d'attribution.
 */
export const resolveWebsitesHandler: JobHandler<z.infer<typeof resolvePayload>> = {
  type: 'resolve_websites',
  schema: resolvePayload,
  defaultPriority: 60,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await resolveWebsites(db, {
      limit: payload.limit,
      // Plus patient que le scan : on interroge des hôtes inconnus, parfois
      // inexistants, et rien ne presse.
      fetcher: new WebsiteFetcher({ timeoutMs: 10_000, perHostDelayMs: 1500 }),
      logger,
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.examined,
      succeeded: report.resolved,
      failed: report.errors,
      metadata: {
        probed: report.probed,
        inconclusive: report.inconclusive,
        by_evidence: report.byEvidence,
      },
    };
  },
};

const reversePayload = z.object({
  limit: z.number().int().min(1).max(2000).default(200),
});

/**
 * Découverte inverse : du site vers l'entreprise.
 *
 * Le chemin qui produit le plus de volume, et le seul qui livre à la fois
 * l'identité et le contact. Un SIREN lu dans des mentions légales suffit à
 * créer l'entreprise, avec le téléphone affiché sur la même page.
 */
export const companiesFromDomainsHandler: JobHandler<z.infer<typeof reversePayload>> = {
  type: 'companies_from_domains',
  schema: reversePayload,
  defaultPriority: 68,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    const report = await createCompaniesFromDomains(db, {
      limit: payload.limit,
      logger,
      ...(signal ? { signal } : {}),
    });

    return {
      processed: report.domainsExamined,
      succeeded: report.companiesCreated,
      failed: report.errors,
      metadata: {
        sirens_seen: report.sirensSeen,
        already_known: report.alreadyKnown,
        shared_skipped: report.sharedSkipped,
        ambiguous_ownership: report.ambiguousOwnership,
        not_found_in_registry: report.notFoundInRegistry,
      },
    };
  },
};
