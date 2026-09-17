import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { rescanDomain } from '../enrichment/domain-scanner';
import { captureAndStore } from '../enrichment/screenshot';
import { enrichGooglePresence } from '../sources/google/places';
import { runOpportunityEngine } from '../opportunities/engine';
import { runSignalEngine } from '../signals/engine';

/**
 * Vérification avant livraison.
 *
 * Une opportunité est calculée sur ce que le site montrait la nuit d'un
 * scan. Entre ce scan et le matin où un freelance décroche son téléphone,
 * tout peut avoir changé — et un état transitoire peut avoir été pris pour
 * un défaut : certificat en cours de renouvellement, hébergeur en
 * maintenance, redirection mal suivie. Vécu sur la première fiche livrée :
 * « certificat invalide, pas de HTTPS » sur un site irréprochable. Le
 * freelance appelle, le commerçant ouvre son site, et la crédibilité du
 * produit meurt en trente secondes.
 *
 * On revisite donc le site à l'instant de l'attribution, on recalcule les
 * signaux et l'opportunité de cette entreprise-là, et on ne livre que si le
 * dossier tient toujours. Le moteur d'opportunités retire lui-même du stock
 * ce qui ne tient plus : la vérification se contente de le déclencher et
 * de lire le résultat.
 *
 * Coût : une visite de site par dossier livré, quelques secondes. Ce que ça
 * achète est la promesse affichée sur le tableau de bord — « chacune
 * vérifiée cette nuit ».
 */

export interface VerificationTarget {
  companyId: string;
  opportunityId: string;
}

export type OpportunityVerifier = (target: VerificationTarget) => Promise<boolean>;

export interface VerifyOptions {
  logger?: Logger;
  signal?: AbortSignal;
  /** Âge maximal d'un scan pour être réutilisé sans revisiter le site. Défaut : réglage `verify_scan_max_age_hours`. */
  maxScanAgeHours?: number;
}

/**
 * Faut-il revisiter le site ?
 *
 * Le scan nocturne suffit s'il est assez récent : le revisiter quelques
 * heures plus tard ne dit rien de plus et triple la charge (scan de nuit,
 * scan d'attribution, capture). Passé le seuil, ou sans scan, on revisite.
 */
export function shouldRescan(lastCheckedAt: string | null, maxAgeHours: number, now = Date.now()): boolean {
  if (!lastCheckedAt) return true;
  const age = (now - new Date(lastCheckedAt).getTime()) / 3_600_000;
  return !Number.isFinite(age) || age < 0 || age > maxAgeHours;
}

export async function verifyOpportunity(
  db: Db,
  target: VerificationTarget,
  options: VerifyOptions = {},
): Promise<boolean> {
  const log = options.logger;

  const { data: company, error } = await db
    .from('companies')
    .select('id, domain')
    .eq('id', target.companyId)
    .maybeSingle();
  if (error) throw new Error(`verifyOpportunity : ${error.message}`);
  if (!company) return false;

  if (company.domain) {
    let maxAge = options.maxScanAgeHours;
    if (maxAge === undefined) {
      const { data } = await db.rpc('engine_setting_int', { p_key: 'verify_scan_max_age_hours', p_default: 36 });
      maxAge = data ?? 36;
    }
    const { data: scanned } = await db.from('domains').select('last_checked_at').eq('domain', company.domain).maybeSingle();
    if (shouldRescan(scanned?.last_checked_at ?? null, maxAge)) {
      await rescanDomain(db, company.domain, {
        ...(log ? { logger: log } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } else {
      log?.debug?.('Scan récent réutilisé à la vérification', { domain: company.domain, last_checked_at: scanned?.last_checked_at });
    }
  }

  await runSignalEngine(db, {
    companyIds: [company.id],
    ...(log ? { logger: log } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  await runOpportunityEngine(db, {
    companyIds: [company.id],
    ...(log ? { logger: log } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const { data: opportunity } = await db
    .from('opportunities')
    .select('status')
    .eq('id', target.opportunityId)
    .maybeSingle();

  const holds = opportunity?.status === 'available';

  // Le dossier tient : on photographie le site tel qu'il est à cet instant.
  // C'est ce que le freelance verra, et la preuve datée de ce qu'on affirme.
  // Une capture manquée n'empêche pas la livraison — le constat, lui, tient.
  if (holds && company.domain) {
    try {
      await captureAndStore(db, company.domain, { ...(log ? { logger: log } : {}) });
    } catch (cause: unknown) {
      log?.debug?.('Capture non prise', {
        domain: company.domain, error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  // Et sa présence Google — la note qui dit que le commerce marche. Un
  // appel payant, donc seulement ici, sur un dossier qui va être livré.
  if (holds) {
    try {
      await enrichGooglePresence(db, company.id, { ...(log ? { logger: log } : {}) });
    } catch (cause: unknown) {
      log?.debug?.('Présence Google non relevée', {
        company_id: company.id, error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  if (!holds) {
    log?.info('Dossier écarté à la vérification : les faits ne tiennent plus', {
      company_id: company.id, opportunity_id: target.opportunityId,
      domain: company.domain, status: opportunity?.status ?? 'absente',
    });
  }
  return holds;
}

/** Un vérificateur branché sur la base : ce que l'attribution utilise par défaut. */
export function defaultVerifier(db: Db, options: VerifyOptions = {}): OpportunityVerifier {
  return (target) => verifyOpportunity(db, target, options);
}
