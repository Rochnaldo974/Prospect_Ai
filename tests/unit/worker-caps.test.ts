import { describe, expect, it } from 'vitest';
import { claimableTypes, claimPlan, TYPE_CAPS } from '../../apps/worker/src/caps';

/**
 * Les types à une seule place ne doivent jamais remplir le pool : six jobs
 * de découverte réclamés d'un coup, c'est cinq places occupées à attendre
 * un client Overpass à une requête à la fois — et plus rien pour le scan.
 */
describe('plafonds par type de job', () => {
  const all = ['backfill_contacts', 'discover_osm', 'generate_opportunities', 'scan_domains'];

  it('sans rien en cours, tout est réclamable', () => {
    expect(claimableTypes(all, new Map())).toEqual(all);
  });

  it('un type plein sort de la réclamation, les autres restent', () => {
    const inFlight = new Map([['discover_osm', 1]]);
    expect(claimableTypes(all, inFlight)).toEqual(['backfill_contacts', 'generate_opportunities', 'scan_domains']);
  });

  it('les types sans plafond ne sont jamais exclus', () => {
    const inFlight = new Map([['scan_domains', 6], ['generate_opportunities', 3]]);
    expect(claimableTypes(all, inFlight)).toEqual(all);
  });

  it('la découverte OSM, l’identité locale et le backfill sont à une place', () => {
    expect(TYPE_CAPS['discover_osm']).toBe(1);
    expect(TYPE_CAPS['resolve_identity_local']).toBe(1);
    expect(TYPE_CAPS['backfill_contacts']).toBe(1);
  });

  it('un tour de boucle réclame un seul job par type plafonné, puis le reste', () => {
    const steps = claimPlan(6, all, new Map());
    expect(steps).toEqual([
      { types: ['backfill_contacts'], size: 1 },
      { types: ['discover_osm'], size: 1 },
      { types: ['generate_opportunities', 'scan_domains'], size: 4 },
    ]);
  });

  it('un type plafonné déjà en vol n’est pas réclamé ; toute la capacité va aux autres', () => {
    const steps = claimPlan(3, all, new Map([['discover_osm', 1], ['backfill_contacts', 1]]));
    expect(steps).toEqual([{ types: ['generate_opportunities', 'scan_domains'], size: 3 }]);
  });

  it('sans capacité, rien n’est réclamé', () => {
    expect(claimPlan(0, all, new Map())).toEqual([]);
  });
});
