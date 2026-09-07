import { z } from 'zod';
import { enqueueJob } from '../queue';
import type { JobHandler } from '../types';

/**
 * Le planificateur : la demande dicte le volume de scan.
 *
 * Avant lui, le pipeline était piloté par l'offre — 500 domaines par nuit,
 * quota fixe, aveugle au nombre d'abonnés comme à l'état du stock. Dix
 * clients ou zéro, même cadence : trop peu dès que ça décolle, du gâchis
 * de bande passante sinon.
 *
 * Chaque nuit, il calcule la MISSION du jour en trois temps :
 *
 *   la demande — ce que les abonnés consomment par jour (5 par payant,
 *   1/7 par gratuit) ;
 *   l'objectif — un stock d'avance de RUNWAY_DAYS jours de demande, avec
 *   un plancher : même sans aucun client, le moteur constitue sa base ;
 *   la mission — le déficit converti en domaines à scanner, calibré par le
 *   RENDEMENT MESURÉ des quatorze derniers jours (opportunités créées par
 *   domaine scanné), jamais par une constante décrétée. Le moteur apprend
 *   de ses propres passes : si le rendement monte, il scanne moins pour le
 *   même stock ; s'il baisse, il compense.
 *
 * La mission est bornée : un plancher pour que la découverte ne s'arrête
 * jamais, un plafond pour rester poli avec les sites visités — le scan
 * sort sur Internet, et sa politesse est une politique, pas un accident.
 */

export const PLANNING = {
  /** Jours de stock d'avance visés. */
  RUNWAY_DAYS: 7,
  /** Stock minimal visé même sans abonné : la base se constitue toute seule. */
  STOCK_FLOOR: 500,
  /** Rendement supposé tant qu'aucune mesure n'existe (1 opp / 100 domaines). */
  DEFAULT_YIELD: 0.01,
  /** Rendement plancher : en dessous, c'est un incident, pas une calibration. */
  MIN_YIELD: 0.002,
  /** Bornes de la mission quotidienne, en domaines. */
  MIN_DAILY_SCAN: 500,
  MAX_DAILY_SCAN: 20_000,
  /** Taille maximale d'un job de scan (le schéma du handler la borne). */
  JOB_SIZE: 2_000,
} as const;

export interface ScanPlan {
  dailyDemand: number;
  stock: number;
  target: number;
  deficit: number;
  yieldRate: number;
  scanQuota: number;
  jobs: number;
}

/** Le calcul de mission, pur : c'est lui que les tests tiennent. */
export function planScan(input: {
  premiumSlots: number;
  freeUsers: number;
  stock: number;
  measuredYield: number | null;
}): ScanPlan {
  const dailyDemand = input.premiumSlots + input.freeUsers / 7;
  const target = Math.max(PLANNING.STOCK_FLOOR, Math.ceil(dailyDemand * PLANNING.RUNWAY_DAYS));

  // Le déficit couvre l'écart à l'objectif ET la consommation du jour :
  // un stock pile à l'objectif fond dès le matin sinon.
  const deficit = Math.max(0, target - input.stock) + Math.ceil(dailyDemand);

  const yieldRate = Math.max(
    PLANNING.MIN_YIELD,
    input.measuredYield ?? PLANNING.DEFAULT_YIELD,
  );

  const scanQuota = Math.min(
    PLANNING.MAX_DAILY_SCAN,
    Math.max(PLANNING.MIN_DAILY_SCAN, Math.ceil(deficit / yieldRate)),
  );

  return {
    dailyDemand: Number(dailyDemand.toFixed(2)),
    stock: input.stock,
    target,
    deficit,
    yieldRate: Number(yieldRate.toFixed(4)),
    scanQuota,
    jobs: Math.ceil(scanQuota / PLANNING.JOB_SIZE),
  };
}

const planPayload = z.object({});

export const planScanningHandler: JobHandler<z.infer<typeof planPayload>> = {
  type: 'plan_scanning',
  schema: planPayload,
  defaultPriority: 80,

  async run(_payload, { db, logger }) {
    // ── La demande ──────────────────────────────────────────────────────
    const { data: profiles, error: profilesError } = await db
      .from('profiles')
      .select('plan, daily_opportunity_limit')
      .eq('onboarding_completed', true);
    if (profilesError) throw new Error(profilesError.message);

    let premiumSlots = 0;
    let freeUsers = 0;
    for (const profile of profiles ?? []) {
      if (profile.plan === 'premium') premiumSlots += profile.daily_opportunity_limit;
      else freeUsers += 1;
    }

    // ── Le stock ────────────────────────────────────────────────────────
    const { count: stock, error: stockError } = await db
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'available')
      .gt('expires_at', new Date().toISOString());
    if (stockError) throw new Error(stockError.message);

    // ── Le rendement mesuré : opportunités créées / domaines scannés,
    //    sur quatorze jours glissants. ────────────────────────────────────
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const [{ count: created }, { count: scanned }] = await Promise.all([
      db.from('opportunities').select('id', { count: 'exact', head: true })
        .gte('created_at', since),
      db.from('domains').select('domain', { count: 'exact', head: true })
        .gte('last_checked_at', since),
    ]);

    const measuredYield = scanned && scanned > 100 && created !== null
      ? created / scanned
      : null;

    const plan = planScan({
      premiumSlots,
      freeUsers,
      stock: stock ?? 0,
      measuredYield,
    });

    // ── La mission, en jobs ─────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    let enqueued = 0;
    let remaining = plan.scanQuota;
    for (let index = 0; index < plan.jobs; index += 1) {
      const limit = Math.min(PLANNING.JOB_SIZE, remaining);
      remaining -= limit;
      const id = await enqueueJob(db, 'scan_domains', { limit }, {
        priority: 65,
        // Idempotent par jour et par tranche : replanifier ne double rien.
        dedupeKey: `plan-scan-${today}-${index}`,
      });
      if (id !== null) enqueued += 1;
    }

    logger.info('Mission de scan planifiée', {
      demande_jour: plan.dailyDemand,
      stock: plan.stock,
      objectif: plan.target,
      deficit: plan.deficit,
      rendement: plan.yieldRate,
      quota_scan: plan.scanQuota,
      jobs: enqueued,
    });

    return {
      processed: plan.scanQuota,
      succeeded: enqueued,
      failed: plan.jobs - enqueued,
      metadata: { ...plan },
    };
  },
};
