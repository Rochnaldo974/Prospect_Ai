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

  it('le plan sépare les types plafonnés encore libres des autres', () => {
    expect(claimPlan(all, new Map())).toEqual({
      capped: ['backfill_contacts', 'discover_osm'],
      uncapped: ['generate_opportunities', 'scan_domains'],
    });
  });

  it('un type plafonné déjà en vol sort du plan ; les autres restent réclamables', () => {
    expect(claimPlan(all, new Map([['discover_osm', 1], ['backfill_contacts', 1]]))).toEqual({
      capped: [],
      uncapped: ['generate_opportunities', 'scan_domains'],
    });
  });
});
