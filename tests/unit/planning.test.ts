import { describe, expect, it } from 'vitest';
import { PLANNING, planScan } from '../../packages/core/src/jobs/handlers/planning';
import { planSlices } from '../../packages/core/src/jobs/fan-out';

/**
 * La mission de scan : la demande dicte le volume.
 *
 * C'est l'arithmétique qui décide chaque nuit combien de sites le moteur
 * visite. Trop bas, les abonnés trouvent des matinées vides ; trop haut,
 * on martèle des serveurs pour rien. Les tests tiennent les deux bords et
 * la boucle d'apprentissage du rendement.
 */
describe('mission de scan', () => {
  it('sans aucun client, le moteur constitue quand même sa base', () => {
    const plan = planScan({ premiumSlots: 0, freeUsers: 0, stock: 0, measuredYield: null });
    expect(plan.target).toBe(PLANNING.STOCK_FLOOR);
    expect(plan.scanQuota).toBeGreaterThanOrEqual(PLANNING.MIN_DAILY_SCAN);
  });

  it('la demande gonfle l’objectif : plus de clients, plus de scan', () => {
    // Rendement volontairement bon (5 %) pour rester sous le plafond : ce
    // test regarde la pente, pas la borne.
    // Chacun proche de son objectif, pour lire la pente sans saturer le plafond.
    const small = planScan({ premiumSlots: 2 * 5, freeUsers: 0, stock: 1_900, measuredYield: 0.05 });
    const big = planScan({ premiumSlots: 100 * 5, freeUsers: 0, stock: 3_400, measuredYield: 0.05 });

    // 100 abonnés × 5/j × 7 j d'avance = 3 500 d'objectif, au-dessus du plancher.
    expect(big.target).toBe(100 * 5 * PLANNING.RUNWAY_DAYS);
    expect(big.scanQuota).toBeGreaterThan(small.scanQuota);
  });

  it('un stock plein ramène la mission au plancher, jamais à zéro', () => {
    const plan = planScan({ premiumSlots: 50, freeUsers: 10, stock: 10_000, measuredYield: 0.01 });
    // Le déficit se réduit à la consommation du jour ; la découverte continue.
    expect(plan.scanQuota).toBe(Math.max(PLANNING.MIN_DAILY_SCAN, Math.ceil(plan.deficit / 0.01)));
    expect(plan.scanQuota).toBeGreaterThanOrEqual(PLANNING.MIN_DAILY_SCAN);
  });

  it('le rendement mesuré calibre : meilleur rendement, moins de scan', () => {
    const poor = planScan({ premiumSlots: 20, freeUsers: 0, stock: 1_900, measuredYield: 0.02 });
    const rich = planScan({ premiumSlots: 20, freeUsers: 0, stock: 1_900, measuredYield: 0.08 });
    expect(rich.scanQuota).toBeLessThan(poor.scanQuota);
    expect(poor.scanQuota).toBeLessThan(PLANNING.MAX_DAILY_SCAN);
  });

  it('un rendement effondré ne fait pas exploser la mission : le plafond tient', () => {
    const plan = planScan({ premiumSlots: 500, freeUsers: 0, stock: 0, measuredYield: 0.0001 });
    expect(plan.yieldRate).toBe(PLANNING.MIN_YIELD);
    expect(plan.scanQuota).toBe(PLANNING.MAX_DAILY_SCAN);
  });

  it('les gratuits pèsent un septième d’un dossier par jour', () => {
    const plan = planScan({ premiumSlots: 0, freeUsers: 70, stock: 0, measuredYield: 0.01 });
    expect(plan.dailyDemand).toBe(10);
  });

  it('l’amorçage prime : la base se constitue à pleine cadence', () => {
    // 4,5 millions de domaines jamais visités : peu importe le stock du
    // jour, la mission est la cadence d'amorçage.
    const plan = planScan({
      premiumSlots: 0, freeUsers: 0, stock: 10_000,
      measuredYield: 0.05, unscanned: 4_500_000,
    });
    expect(plan.bootstrap).toBe(true);
    expect(plan.scanQuota).toBe(PLANNING.BOOTSTRAP_DAILY_SCAN);
  });

  it('l’amorçage s’éteint quand le parc est couvert', () => {
    const plan = planScan({
      premiumSlots: 20, freeUsers: 0, stock: 400,
      measuredYield: 0.02, unscanned: 12_000,
    });
    expect(plan.bootstrap).toBe(false);
    expect(plan.scanQuota).toBeLessThan(PLANNING.BOOTSTRAP_DAILY_SCAN);
  });

  it('la mission se découpe en jobs de deux mille au plus', () => {
    const plan = planScan({ premiumSlots: 300, freeUsers: 0, stock: 0, measuredYield: 0.005 });
    expect(plan.jobs).toBe(Math.ceil(plan.scanQuota / PLANNING.JOB_SIZE));
    expect(plan.jobs * PLANNING.JOB_SIZE).toBeGreaterThanOrEqual(plan.scanQuota);
  });

  it('les réglages du propriétaire relèvent le stock visé et le plancher, sans abonné', () => {
    // Avant le lancement : 2 477 en stock, zéro abonné. Sans réglage, la
    // mission retombait au plancher de 500. Avec un stock visé de 20 000
    // et un plancher de 3 000, elle repart — bornée par le plafond réglé.
    const before = planScan({ premiumSlots: 0, freeUsers: 0, stock: 2_477, measuredYield: 0.0577 });
    expect(before.scanQuota).toBe(PLANNING.MIN_DAILY_SCAN);

    const after = planScan(
      { premiumSlots: 0, freeUsers: 0, stock: 2_477, measuredYield: 0.0577 },
      { stockFloor: 20_000, minDailyScan: 3_000, maxDailyScan: 15_000 },
    );
    expect(after.target).toBe(20_000);
    expect(after.deficit).toBe(20_000 - 2_477);
    expect(after.scanQuota).toBe(15_000);

    // Stock atteint : le plancher réglé tient, pas l'ancien.
    const full = planScan(
      { premiumSlots: 0, freeUsers: 0, stock: 25_000, measuredYield: 0.05 },
      { stockFloor: 20_000, minDailyScan: 3_000, maxDailyScan: 15_000 },
    );
    expect(full.scanQuota).toBe(3_000);
  });

  it('un plafond réglé sous le plancher ne peut pas inverser les bornes', () => {
    const plan = planScan(
      { premiumSlots: 0, freeUsers: 0, stock: 0, measuredYield: 0.01 },
      { stockFloor: 20_000, minDailyScan: 3_000, maxDailyScan: 100 },
    );
    expect(plan.scanQuota).toBe(3_000);
  });
});

describe('une passe complète, en tranches', () => {
  it('couvre toute la base, la dernière tranche plus courte', () => {
    const slices = planSlices(236_145, 20_000);
    expect(slices).toHaveLength(12);
    expect(slices[0]).toEqual({ offset: 0, limit: 20_000 });
    expect(slices[11]).toEqual({ offset: 220_000, limit: 16_145 });
    expect(slices.reduce((sum, s) => sum + s.limit, 0)).toBe(236_145);
  });

  it('ne planifie rien pour une base vide ou une tranche invalide', () => {
    expect(planSlices(0, 20_000)).toEqual([]);
    expect(planSlices(10, 0)).toEqual([]);
  });
});
