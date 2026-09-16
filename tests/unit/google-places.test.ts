import { describe, expect, it } from 'vitest';
import { pickPlace, type PlaceCandidate } from '../../packages/core/src/sources/google/places';

/** Attribuer à une boulangerie les avis de sa voisine ferait perdre l'appel : le rapprochement est strict. */
const place = (over: Partial<PlaceCandidate>): PlaceCandidate => ({
  id: 'p', name: 'X', address: null, lat: null, lon: null, rating: 4.5, reviewCount: 120, photoCount: 3, mapsUrl: null, ...over,
});

describe('choix de la fiche Google', () => {
  it('prend la fiche au même nom, dans le bon code postal', () => {
    const found = pickPlace(
      { legal_name: 'Boulangerie Moreau', commercial_name: null, postal_code: '49000', city: 'Angers', lat: null, lon: null },
      [place({ id: 'a', name: 'Boulangerie Moreau', address: '3 rue Plantagenêt, 49000 Angers' })],
    );
    expect(found?.id).toBe('a');
  });

  it('refuse une fiche au même nom dans une autre ville', () => {
    expect(pickPlace(
      { legal_name: 'Café Saint-Pierre', commercial_name: null, postal_code: '69001', city: 'Lyon', lat: null, lon: null },
      [place({ name: 'Café Saint-Pierre', address: '135 Rue Saint-Pierre, 14000 Caen' })],
    )).toBeNull();
  });

  it('accepte un nom proche quand la fiche est à moins de 150 m', () => {
    const found = pickPlace(
      { legal_name: 'Les Terrasses Saint Pierre', commercial_name: null, postal_code: null, city: 'Lyon', lat: 45.7675, lon: 4.8335 },
      [place({ id: 'b', name: 'Terrasses Saint Pierre Bistrot', lat: 45.7676, lon: 4.8336 })],
    );
    expect(found?.id).toBe('b');
  });

  it('refuse un nom seulement proche quand la fiche est loin', () => {
    expect(pickPlace(
      { legal_name: 'Les Terrasses Saint Pierre', commercial_name: null, postal_code: null, city: 'Lyon', lat: 45.7675, lon: 4.8335 },
      [place({ name: 'Terrasses Saint Pierre Bistrot', lat: 45.80, lon: 4.90 })],
    )).toBeNull();
  });
});
