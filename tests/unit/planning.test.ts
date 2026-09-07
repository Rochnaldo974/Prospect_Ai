import { describe, expect, it } from 'vitest';
import { PLANNING, planScan } from '../../packages/core/src/jobs/handlers/planning';

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
});
