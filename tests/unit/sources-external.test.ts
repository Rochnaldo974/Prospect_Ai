import { describe, expect, it } from 'vitest';
import { BodaccSource, FAMILY_MEANING, OsmCompanySource } from '../../packages/core/src/sources';
import type { RawCompany } from '../../packages/core/src/sources';

/**
 * Adaptateurs des sources externes.
 *
 * Testés sur des extraits réels capturés depuis Overpass et BODACC, sans
 * appel réseau : une suite de tests qui dépend de services publics est une
 * suite qui échoue au hasard.
 */

const osmRaw = (tags: Record<string, string>, extra: Record<string, unknown> = {}): RawCompany => ({
  sourceName: 'openstreetmap',
  sourceExternalId: 'node/1',
  payload: { type: 'node', id: 1, lat: 47.4784, lon: -0.5632, tags, ...extra } as never,
  confidence: 0.85,
});

describe('source OpenStreetMap', () => {
  const source = new OsmCompanySource();

  it('normalise un POI complet', () => {
    // Extrait réel : un restaurant lyonnais taggé par la communauté.
    const candidate = source.normalize(
      osmRaw({
        amenity: 'restaurant',
        name: "L'Esprit Bistrot",
        phone: '+33 4 78 74 38 42',
        website: 'https://www.lespritbistrot.com/lesprit-bistrot-monplaisir/',
        'ref:FR:SIRET': '53178387600034',
        'addr:housenumber': '12',
        'addr:street': 'avenue des Frères Lumière',
        'addr:postcode': '69008',
        'addr:city': 'Lyon',
      }),
    );

    expect(candidate).toMatchObject({
      legalName: "L'Esprit Bistrot",
      siret: '53178387600034',
      siren: '531783876',
      phone: '+33478743842',
      domain: 'lespritbistrot.com',
      postalCode: '69008',
      city: 'Lyon',
      address: '12 avenue des freres lumiere',
      segment: 'local_commerce',
      industryLabel: 'restaurant',
    });
  });

  it('donne sa plus haute confiance à un POI rattaché au répertoire', () => {
    const withSiret = source.normalize(
      osmRaw({ name: 'Boulangerie', shop: 'bakery', 'ref:FR:SIRET': '53178387600034' }),
    );
    const withoutSiret = source.normalize(
      osmRaw({ name: 'Boulangerie', shop: 'bakery', 'addr:postcode': '69008' }),
    );
    const bare = source.normalize(osmRaw({ name: 'Boulangerie', shop: 'bakery' }, { lat: null, lon: null }));

    expect(withSiret?.identityConfidence).toBe(0.95);
    expect(withoutSiret?.identityConfidence).toBe(0.6);
    expect(bare?.identityConfidence).toBe(0.4);
  });

  it('accepte les étiquettes de contact alternatives', () => {
    const candidate = source.normalize(
      osmRaw({
        name: 'Coiffeur',
        shop: 'hairdresser',
        'contact:phone': '02 41 22 24 79',
        'contact:website': 'exemple.fr',
      }),
    );
    expect(candidate).toMatchObject({ phone: '+33241222479', domain: 'exemple.fr' });
  });

  it('écarte une page de plateforme, sans perdre le POI', () => {
    const candidate = source.normalize(
      osmRaw({ name: 'Le Fournil', shop: 'bakery', website: 'https://facebook.com/lefournil' }),
    );
    expect(candidate?.domain).toBeNull();
    expect(candidate?.rejections).toContainEqual(
      expect.objectContaining({ field: 'domain', reason: 'plateforme' }),
    );
  });

  it('ignore un POI sans nom', () => {
    expect(source.normalize(osmRaw({ shop: 'bakery' }))).toBeNull();
  });

  it('lit le centre d’un contour plutôt qu’un point', () => {
    const candidate = source.normalize(
      osmRaw({ name: 'Centre commercial', shop: 'mall' }, {
        type: 'way',
        lat: undefined,
        lon: undefined,
        center: { lat: 45.75, lon: 4.85 },
      }),
    );
    expect(candidate).toMatchObject({ lat: 45.75, lon: 4.85 });
  });

  it('exige un périmètre géographique', async () => {
    const bare = new OsmCompanySource();
    await expect(async () => {
      for await (const _ of bare.discover()) break;
    }).rejects.toThrow(/cities.*boundingBox/);
  });
});

describe('source BODACC', () => {
  const source = new BodaccSource();

  const record = (over: Record<string, unknown> = {}) => ({
    id: 'A20260163233',
    registre: ['912145794', '912 145 794'],
    familleavis_lib: 'Ventes et cessions',
    dateparution: '2026-08-27',
    ville: 'Montrabé',
    cp: '31850',
    numerodepartement: '31',
    commercant: 'CS-INNO',
    tribunal: 'Greffe du Tribunal de Commerce de Toulouse',
    url_complete: 'https://www.bodacc.fr/…',
    ...over,
  });

  it('extrait le SIREN parmi les graphies du registre', () => {
    const announcement = source.normalize(record());
    expect(announcement).toMatchObject({
      siren: '912145794',
      family: 'Ventes et cessions',
      eventType: 'bodacc_cession',
      excludes: false,
      publishedAt: '2026-08-27',
      department: '31',
    });
  });

  it('marque comme exclusion les procédures collectives et les radiations', () => {
    expect(source.normalize(record({ familleavis_lib: 'Procédures collectives' })?? {})?.excludes).toBe(true);
    expect(source.normalize(record({ familleavis_lib: 'Radiations' }))?.excludes).toBe(true);
    expect(source.normalize(record({ familleavis_lib: 'Créations' }))?.excludes).toBe(false);
  });

  it('classe les créations et cessions au-dessus des modifications', () => {
    const creation = source.normalize(record({ familleavis_lib: 'Créations' }));
    const cession = source.normalize(record({ familleavis_lib: 'Ventes et cessions' }));
    const modification = source.normalize(record({ familleavis_lib: 'Modifications diverses' }));

    expect(creation!.importance).toBeGreaterThan(modification!.importance);
    expect(cession!.importance).toBeGreaterThan(modification!.importance);
  });

  it('ignore une annonce sans SIREN exploitable', () => {
    expect(source.normalize(record({ registre: [] }))).toBeNull();
    expect(source.normalize(record({ registre: ['000000000'] }))).toBeNull();
    expect(source.normalize(record({ registre: 'pas-un-siren' }))).toBeNull();
  });

  it('ignore une famille d’annonce non traitée', () => {
    expect(source.normalize(record({ familleavis_lib: 'Dépôts des comptes' }))).toBeNull();
  });

  it('ignore une annonce sans date de parution', () => {
    expect(source.normalize(record({ dateparution: null }))).toBeNull();
  });

  it('couvre toutes les familles qu’il déclare traiter', () => {
    for (const [family, meaning] of Object.entries(FAMILY_MEANING)) {
      const announcement = source.normalize(record({ familleavis_lib: family }));
      expect(announcement, family).not.toBeNull();
      expect(announcement!.eventType).toBe(meaning.eventType);
    }
  });
});
