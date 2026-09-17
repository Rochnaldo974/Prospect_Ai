import { describe, expect, it } from 'vitest';
import { afnicDailyUrl, importAfnicDaily, parseAfnicDailyList } from '../../packages/core/src/sources/afnic/daily';
import { pickDueAreas, type DiscoveryArea } from '../../packages/core/src/discovery/planner';
import { decideBodaccMerge } from '../../packages/core/src/ingestion/bodacc-contacts';

/**
 * Lot 2 : la découverte en rotation, les .fr du jour, BODACC rapproché de
 * l'annuaire. Les décisions sont pures et testées sans réseau ; l'import
 * quotidien est testé avec un lecteur d'URL factice et une base factice.
 */

describe('AFNIC quotidien', () => {
  it('construit l’URL du jour au format de l’AFNIC', () => {
    expect(afnicDailyUrl(new Date('2026-09-16T10:00:00Z')))
      .toBe('https://www.afnic.fr/wp-media/ftp/domaineTLD_Afnic/20260916_CREA_fr.txt');
  });

  it('lit une liste : un domaine par ligne, normalisé, dédoublonné, .fr seulement', () => {
    const text = '# créés le 16/09\nBoulangerie-Martin.fr\nboulangerie-martin.fr\nexemple.fr;autre colonne\n\nhttp://www.site.fr/\nnot-fr.com\n';
    expect(parseAfnicDailyList(text)).toEqual(['boulangerie-martin.fr', 'exemple.fr', 'site.fr']);
  });

  it('met les nouveaux domaines en file avec une priorité haute, ignore les connus, tolère un jour absent', async () => {
    const calls: string[] = [];
    const upserted: string[] = [];
    const prioritized: string[] = [];
    const db = {
      from: () => ({
        upsert: (rows: { domain: string }[]) => ({
          select: async () => {
            const fresh = rows.filter((r) => r.domain !== 'connu.fr');
            upserted.push(...fresh.map((r) => r.domain));
            return { data: fresh, error: null };
          },
        }),
        update: () => ({ in: (_c: string, domains: string[]) => ({ is: async () => { prioritized.push(...domains); return { error: null }; } }) }),
      }),
    } as never;
    const report = await importAfnicDaily(db, {
      lookbackDays: 2,
      fetchText: async (url) => { calls.push(url); return url.includes('_CREA_fr') && calls.length === 1 ? 'neuf.fr\nconnu.fr\n' : null; },
    });
    expect(calls).toHaveLength(2);
    expect(report.fetched).toBe(1);
    expect(report.missing).toBe(1);
    expect(report.queued).toBe(1);
    expect(report.alreadyKnown).toBe(1);
    expect(upserted).toEqual(['neuf.fr']);
    expect(prioritized).toEqual(['neuf.fr']);
  });
});

const area = (over: Partial<DiscoveryArea>): DiscoveryArea => ({
  id: 1, name: 'Angers', area_type: 'commune', area_id: '49007', population: 150_000, priority: 80, status: 'active',
  last_scanned_at: null, next_scan_at: '2026-09-01T00:00:00Z', runs: 0, ...over,
});

describe('découverte en rotation', () => {
  const now = new Date('2026-09-17T00:00:00Z');

  it('prend les zones jamais vues avant les autres, puis la priorité, puis la population', () => {
    const chosen = pickDueAreas([
      area({ id: 1, name: 'Vue', last_scanned_at: '2026-08-01T00:00:00Z', priority: 90, population: 900_000 }),
      area({ id: 2, name: 'Jamais petite', priority: 50, population: 20_000 }),
      area({ id: 3, name: 'Jamais grande', priority: 50, population: 300_000 }),
      area({ id: 4, name: 'Jamais prioritaire', priority: 90, population: 25_000 }),
    ], 3, now);
    expect(chosen.map((a) => a.name)).toEqual(['Jamais prioritaire', 'Jamais grande', 'Jamais petite']);
  });

  it('ignore les zones en pause et celles qui ne sont pas encore dues', () => {
    const chosen = pickDueAreas([
      area({ id: 1, name: 'Pause', status: 'paused' }),
      area({ id: 2, name: 'Plus tard', next_scan_at: '2026-12-01T00:00:00Z' }),
      area({ id: 3, name: 'Due' }),
    ], 10, now);
    expect(chosen.map((a) => a.name)).toEqual(['Due']);
  });

  it('respecte le quota de la nuit', () => {
    const many = Array.from({ length: 50 }, (_, i) => area({ id: i, name: `Ville ${i}` }));
    expect(pickDueAreas(many, 20, now)).toHaveLength(20);
  });
});

describe('BODACC → annuaire', () => {
  it('fusionne sur un seul candidat sûr et joignable', () => {
    expect(decideBodaccMerge([
      { candidateId: 'a', score: 0.95, hasContact: true },
      { candidateId: 'b', score: 0.75, hasContact: true },
    ], 0.9)).toEqual({ action: 'merge', candidateId: 'a', score: 0.95 });
  });

  it('ne fusionne pas sur un candidat sans contact : la fusion n’apporterait rien', () => {
    expect(decideBodaccMerge([{ candidateId: 'a', score: 0.97, hasContact: false }], 0.9)).toEqual({ action: 'none' });
  });

  it('s’abstient quand deux candidats sont sûrs', () => {
    expect(decideBodaccMerge([
      { candidateId: 'a', score: 0.95, hasContact: true },
      { candidateId: 'b', score: 0.92, hasContact: true },
    ], 0.9)).toEqual({ action: 'ambiguous' });
  });
});
