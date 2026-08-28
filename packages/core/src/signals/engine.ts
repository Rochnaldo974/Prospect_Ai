import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import type { Company } from '../domain/types';
import { ALL_DETECTORS } from './detectors';
import { materializeCreationEvents } from './events';
import type {
  CompanyContext,
  ContextEvent,
  DetectedSignal,
  DomainSnapshot,
  SignalDetector,
} from './types';

/**
 * Moteur de signaux.
 *
 * Chaîne stricte : fait → événement daté → signal → opportunité. Chaque
 * maillon est nécessaire, et le moteur ne saute jamais une étape.
 *
 * Le travail se fait par différence, jamais par table rase : un signal
 * toujours vrai garde son identité et sa date de détection, un signal devenu
 * faux est désactivé plutôt que supprimé. Sans cela, la fraîcheur d'un signal
 * refléterait la dernière exécution du moteur au lieu du moment où le fait a
 * été constaté.
 */

export interface SignalEngineReport {
  examined: number;
  created: number;
  /** Signaux déjà présents et toujours valides : ni recréés, ni redatés. */
  unchanged: number;
  deactivated: number;
  errors: number;
  byType: Record<string, number>;
  triggersFound: number;
  /** Entreprises portant au moins un déclencheur : celles qui peuvent produire une opportunité. */
  companiesWithTrigger: number;
}

export interface SignalEngineOptions {
  limit?: number;
  /** N'examiner que ce qui a bougé depuis cette date. */
  since?: Date;
  batchSize?: number;
  detectors?: SignalDetector[];
  logger?: Logger;
  signal?: AbortSignal;
  /** Ne rien écrire : sert à mesurer ce que le moteur produirait. */
  dryRun?: boolean;
}

interface ExistingSignal {
  id: string;
  fingerprint: string;
  strength: number;
  confidence: number;
}

/** Applique tous les détecteurs à un contexte. */
export function detectAll(
  context: CompanyContext,
  detectors: SignalDetector[] = ALL_DETECTORS,
): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  const seen = new Set<string>();

  for (const detector of detectors) {
    let produced: DetectedSignal[];
    try {
      produced = detector.detect(context);
    } catch {
      // Un détecteur défaillant ne doit pas priver l'entreprise de tous ses
      // autres signaux.
      continue;
    }

    for (const signal of produced) {
      // Deux détecteurs peuvent viser le même fait : la première empreinte gagne.
      if (seen.has(signal.fingerprint)) continue;
      seen.add(signal.fingerprint);
      signals.push(signal);
    }
  }

  return signals;
}

export async function runSignalEngine(
  db: Db,
  options: SignalEngineOptions = {},
): Promise<SignalEngineReport> {
  const report: SignalEngineReport = {
    examined: 0, created: 0, unchanged: 0, deactivated: 0, errors: 0,
    byType: {}, triggersFound: 0, companiesWithTrigger: 0,
  };

  const log = options.logger;
  const detectors = options.detectors ?? ALL_DETECTORS;
  const batchSize = options.batchSize ?? 200;

  // Les faits datés doivent exister comme événements avant que les détecteurs
  // ne les cherchent : sinon un déclencheur n'aurait rien à quoi s'adosser.
  if (!options.dryRun) {
    await materializeCreationEvents(db, { limit: options.limit ?? 2000, ...(log ? { logger: log } : {}) });
  }

  const { data: targets, error } = await db.rpc('companies_needing_signals', {
    p_limit: options.limit ?? 1000,
    ...(options.since ? { p_since: options.since.toISOString() } : {}),
  });

  if (error) throw new Error(`runSignalEngine : ${error.message}`);
  const ids = (targets ?? []).map((row) => row as unknown as string);

  for (let offset = 0; offset < ids.length; offset += batchSize) {
    if (options.signal?.aborted) break;
    const batch = ids.slice(offset, offset + batchSize);

    try {
      await processBatch(db, batch, detectors, report, options);
    } catch (batchError: unknown) {
      report.errors += batch.length;
      log?.error('Lot de détection en échec', {
        size: batch.length,
        error: batchError instanceof Error ? batchError.message : String(batchError),
      });
    }
  }

  log?.info('Moteur de signaux terminé', {
    examined: report.examined,
    created: report.created,
    unchanged: report.unchanged,
    deactivated: report.deactivated,
    companies_with_trigger: report.companiesWithTrigger,
  });

  return report;
}

async function processBatch(
  db: Db,
  companyIds: string[],
  detectors: SignalDetector[],
  report: SignalEngineReport,
  options: SignalEngineOptions,
): Promise<void> {
  const [contexts, existing] = await Promise.all([
    db.rpc('load_signal_context', { p_company_ids: companyIds, p_event_window_days: 180 }),
    db
      .from('signals')
      .select('id, company_id, fingerprint, strength, confidence')
      .in('company_id', companyIds)
      .eq('active', true),
  ]);

  if (contexts.error) throw new Error(contexts.error.message);
  if (existing.error) throw new Error(existing.error.message);

  const existingByCompany = new Map<string, ExistingSignal[]>();
  for (const row of existing.data ?? []) {
    const list = existingByCompany.get(row.company_id) ?? [];
    list.push({
      id: row.id,
      fingerprint: row.fingerprint,
      strength: Number(row.strength),
      confidence: Number(row.confidence),
    });
    existingByCompany.set(row.company_id, list);
  }

  const toInsert: Record<string, Json>[] = [];
  const toDeactivate: string[] = [];

  for (const row of contexts.data ?? []) {
    const company = row.company as unknown as Company;
    if (!company?.id) continue;

    report.examined += 1;

    const context: CompanyContext = {
      company,
      domain: (row.domain as unknown as DomainSnapshot | null) ?? null,
      domainCompanyCount: row.domain_company_count ?? 0,
      events: (row.events as unknown as ContextEvent[]) ?? [],
    };

    const detected = detectAll(context, detectors);
    const current = existingByCompany.get(company.id) ?? [];
    const currentByFingerprint = new Map(current.map((s) => [s.fingerprint, s]));
    const detectedFingerprints = new Set(detected.map((s) => s.fingerprint));

    let hasTrigger = false;

    for (const signal of detected) {
      if (signal.kind === 'trigger') {
        hasTrigger = true;
        report.triggersFound += 1;
      }
      report.byType[signal.signalType] = (report.byType[signal.signalType] ?? 0) + 1;

      if (currentByFingerprint.has(signal.fingerprint)) {
        // Toujours vrai : on ne le recrée pas, et surtout on ne le redate pas.
        report.unchanged += 1;
        continue;
      }

      report.created += 1;
      toInsert.push({
        company_id: company.id,
        signal_type: signal.signalType,
        kind: signal.kind,
        category: signal.category,
        strength: signal.strength,
        confidence: signal.confidence,
        source: 'signal_engine',
        evidence: signal.evidence,
        trigger_event_id: signal.triggerEventId ?? null,
        expires_at: signal.expiresAt?.toISOString() ?? null,
        fingerprint: signal.fingerprint,
      });
    }

    if (hasTrigger) report.companiesWithTrigger += 1;

    // Un signal qui n'est plus détecté est désactivé, jamais supprimé :
    // l'historique explique pourquoi une opportunité passée avait été créée.
    for (const stale of current) {
      if (!detectedFingerprints.has(stale.fingerprint)) {
        toDeactivate.push(stale.id);
        report.deactivated += 1;
      }
    }
  }

  if (options.dryRun) return;

  if (toInsert.length > 0) {
    const { error } = await db.from('signals').insert(toInsert as never);
    if (error) throw new Error(`insertion de signaux : ${error.message}`);
  }

  if (toDeactivate.length > 0) {
    const { error } = await db
      .from('signals')
      .update({ active: false })
      .in('id', toDeactivate);
    if (error) throw new Error(`désactivation de signaux : ${error.message}`);
  }
}
