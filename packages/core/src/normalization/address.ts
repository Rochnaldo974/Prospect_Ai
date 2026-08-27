import { foldText } from './text';

/**
 * Adresses françaises.
 *
 * L'adresse normalisée est un critère de déduplication de niveau moyen : deux
 * entreprises peuvent partager une adresse (centre commercial, pépinière), donc
 * elle n'est jamais probante seule — mais elle départage efficacement des
 * homonymes dans une même ville.
 */

const STREET_TYPES: Record<string, string> = {
  av: 'avenue', ave: 'avenue', avn: 'avenue',
  bd: 'boulevard', bld: 'boulevard', blvd: 'boulevard',
  r: 'rue',
  pl: 'place',
  imp: 'impasse',
  all: 'allee', allee: 'allee',
  ch: 'chemin',
  rte: 'route',
  sq: 'square',
  qu: 'quai',
  fbg: 'faubourg', fg: 'faubourg',
  res: 'residence',
  zi: 'zone industrielle', za: 'zone artisanale', zac: 'zone amenagement concerte',
  st: 'saint', ste: 'sainte',
};

export function normalizeAddress(input: string | null | undefined): string | null {
  if (!input) return null;

  let value = foldText(input);
  value = value.replace(/['’]/g, ' ');
  value = value.replace(/[^a-z0-9]+/g, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  if (!value) return null;

  const words = value.split(' ').map((word) => STREET_TYPES[word] ?? word);

  return words.join(' ').replace(/\s+/g, ' ').trim() || null;
}

/**
 * Code postal français : 5 chiffres.
 * Les codes d'outre-mer (97xxx, 98xxx) sont valides et ne doivent pas être écartés.
 */
export function normalizePostalCode(input: string | null | undefined): string | null {
  if (!input) return null;

  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length !== 5) return null;

  // 00xxx n'existe pas.
  if (digits.startsWith('00')) return null;

  return digits;
}

/**
 * Département déduit du code postal.
 * Corse (2A/2B) et outre-mer (3 chiffres) sont les deux cas particuliers.
 */
export function departmentFromPostalCode(postalCode: string | null): string | null {
  const normalized = normalizePostalCode(postalCode);
  if (!normalized) return null;

  if (normalized.startsWith('97') || normalized.startsWith('98')) {
    return normalized.slice(0, 3);
  }

  if (normalized.startsWith('20')) {
    // 20000-20190 → 2A (Corse-du-Sud), au-delà → 2B (Haute-Corse).
    return Number(normalized) <= 20190 ? '2A' : '2B';
  }

  return normalized.slice(0, 2);
}

export function normalizeCity(input: string | null | undefined): string | null {
  if (!input) return null;

  let value = foldText(input);
  value = value.replace(/['’]/g, ' ');
  value = value.replace(/\bcedex\b.*$/, '');
  value = value.replace(/\b\d+\b/g, ' ');   // « PARIS 11 » → « paris »
  value = value.replace(/[^a-z]+/g, ' ');
  value = value.replace(/\s+/g, ' ').trim();

  return value || null;
}
