import { z } from 'zod';
import { createCompaniesFromDomains } from '../../ingestion/domain-to-company';
import { scanDueDomains } from '../../enrichment/domain-scanner';
import { auditPerformance } from '../../enrichment/performance-audit';
import { isEnabled, SKIPPED_BY_FLAG } from '../../ops/flags';
import { resolveWebsites } from '../../enrichment/website-resolver';
import { WebsiteFetcher } from '../../enrichment/fetcher';
import { fanOut } from '../fan-out';
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
  limit: z.number().int().min(1).max(2000).default(100),
  /** Tranche d'une passe découpée en plusieurs jobs. */
  offset: z.number().int().min(0).optional(),
  /**
   * La passe de la nuit : `website_resolution_per_night` entreprises
   * (réglage), en tranches de mille qui tournent en parallèle. Chaque
   * recherche infructueuse sur une entreprise joignable et identifiée est
   * une preuve d'absence de site — la matière première des créations.
   */
  fanOut: z.boolean().default(false),
});

const RESOLVE_SLICE = 1000;
const RESOLVE_PER_NIGHT_DEFAULT = 3000;

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
    if (payload.fanOut) {
      const { data: perNight } = await db.rpc('engine_setting_int', { p_key: 'website_resolution_per_night', p_default: RESOLVE_PER_NIGHT_DEFAULT });
      const total = typeof perNight === 'number' && perNight > 0 ? perNight : RESOLVE_PER_NIGHT_DEFAULT;
      const out = await fanOut(db, { type: 'resolve_websites', total, chunk: RESOLVE_SLICE, priority: 60, prefix: 'resolve-websites' });
      logger.info('Recherche de sites planifiée', { entreprises: total, tranches: out.slices, jobs: out.enqueued });
      return { processed: total, succeeded: out.enqueued, failed: 0, metadata: { fan_out: true, slices: out.slices, enqueued: out.enqueued } };
    }

    const report = await resolveWebsites(db, {
      limit: payload.limit,
      ...(payload.offset !== undefined ? { offset: payload.offset } : {}),
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

const auditPayload = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
});

/** L'audit de performance approfondi, sur les sites présélectionnés par le scan. */
export const auditPerformanceHandler: JobHandler<z.infer<typeof auditPayload>> = {
  type: 'audit_performance',
  schema: auditPayload,
  defaultPriority: 70,
  maxAttempts: 2,

  async run(payload, { db, logger, signal }) {
    if (!(await isEnabled(db, 'enable_performance_audit'))) return SKIPPED_BY_FLAG('enable_performance_audit');
    let limit = payload.limit;
    if (limit === undefined) {
      const { data } = await db.rpc('engine_setting_int', { p_key: 'performance_audits_per_night', p_default: 200 });
      limit = data ?? 200;
    }
    const report = await auditPerformance(db, { limit, logger, ...(signal ? { signal } : {}) });
    return { processed: report.examined, succeeded: report.audited, failed: report.failed, metadata: { ...report } };
  },
};
