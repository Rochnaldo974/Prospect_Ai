import { describe, expect, it } from 'vitest';
import { measureControlGroup } from '../../packages/core/src/allocation/experiment';
import type { Db } from '../../packages/core/src/db/client';

/**
 * Mesure du groupe contrôle.
 *
 * Ces tests protègent surtout un refus : celui de conclure trop tôt. Un écart
 * de trente points sur cinq attributions ne veut rien dire, et l'afficher
 * comme un résultat conduirait à prendre des décisions produit sur du bruit —
 * en croyant s'appuyer sur une mesure.
 */

const db = (rows: { is_control: boolean; contacted_at: string | null; outcome: string | null }[]) =>
  ({
    from: () => ({
      select: () => ({ eq: async () => ({ data: rows, error: null }) }),
    }),
  }) as unknown as Db;

const lot = (count: number, over: { is_control: boolean; outcome: string | null }) =>
  Array.from({ length: count }, () => ({
    is_control: over.is_control,
    contacted_at: new Date().toISOString(),
    outcome: over.outcome,
  }));

describe('quand on refuse de conclure', () => {
  it('ne dit rien sur un échantillon minuscule', async () => {
    const report = await measureControlGroup(db([
      ...lot(4, { is_control: false, outcome: 'client' }),
      ...lot(1, { is_control: true, outcome: 'no_response' }),
    ]));

    expect(report.verdict).toBe('échantillon insuffisant');
    expect(report.lift).toBeNull();
  });

  it('ne conclut pas sur un écart inférieur au bruit', async () => {
    // 30 % contre 27 % : trois points d'écart ne départagent rien.
    const report = await measureControlGroup(db([
      ...lot(30, { is_control: false, outcome: 'interested' }),
      ...lot(70, { is_control: false, outcome: 'no_response' }),
      ...lot(27, { is_control: true, outcome: 'interested' }),
      ...lot(73, { is_control: true, outcome: 'no_response' }),
    ]));

    expect(report.verdict).toBe('aucun écart net');
  });

  it('exige les deux groupes, pas seulement le plus fourni', async () => {
    // Cent attributions du moteur ne compensent pas deux du contrôle : c'est
    // la comparaison qui manque, pas le volume.
    const report = await measureControlGroup(db([
      ...lot(100, { is_control: false, outcome: 'client' }),
      ...lot(2, { is_control: true, outcome: 'no_response' }),
    ]));

    expect(report.verdict).toBe('échantillon insuffisant');
  });
});

describe('quand la mesure est lisible', () => {
  it('donne l’avantage au moteur quand il est net', async () => {
    const report = await measureControlGroup(db([
      ...lot(40, { is_control: false, outcome: 'meeting' }),
      ...lot(60, { is_control: false, outcome: 'no_response' }),
      ...lot(10, { is_control: true, outcome: 'meeting' }),
      ...lot(90, { is_control: true, outcome: 'no_response' }),
    ]));

    expect(report.verdict).toBe('moteur devant');
    expect(report.lift).toBe(30);
  });

  it('le dit aussi quand le moteur fait moins bien que le hasard', async () => {
    // Le cas qu'on n'a pas envie de voir, et pour lequel la mesure existe.
    const report = await measureControlGroup(db([
      ...lot(10, { is_control: false, outcome: 'meeting' }),
      ...lot(90, { is_control: false, outcome: 'no_response' }),
      ...lot(40, { is_control: true, outcome: 'meeting' }),
      ...lot(60, { is_control: true, outcome: 'no_response' }),
    ]));

    expect(report.verdict).toBe('moteur derrière');
    expect(report.lift).toBe(-30);
  });

  it('compte comme suite tout ce qui n’a pas fermé la conversation', async () => {
    const report = await measureControlGroup(db([
      ...lot(30, { is_control: false, outcome: 'proposal' }),
      ...lot(30, { is_control: true, outcome: 'not_interested' }),
    ]));

    expect(report.engine.positiveRate).toBe(100);
    expect(report.control.positiveRate).toBe(0);
  });
});
