/**
 * SIREN et SIRET.
 *
 * Ce sont les seules clés d'identité vraiment fiables du répertoire français.
 * Les valider ici évite de créer des entreprises sur des identifiants
 * fantaisistes venus d'un CSV mal rempli, qui contamineraient ensuite la
 * déduplication.
 */

const DIGITS_ONLY = /[^0-9]/g;

/**
 * Clé de Luhn.
 *
 * SIREN et SIRET la respectent, à une exception près : La Poste
 * (SIREN 356000000) dont les SIRET suivent une règle différente.
 */
function passesLuhn(value: string): boolean {
  let sum = 0;
  const length = value.length;

  for (let i = 0; i < length; i += 1) {
    const digit = value.charCodeAt(length - 1 - i) - 48;
    if (digit < 0 || digit > 9) return false;

    if (i % 2 === 1) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }

  return sum % 10 === 0;
}

/** SIREN de La Poste : ses SIRET ne suivent pas la clé de Luhn. */
const LA_POSTE_SIREN = '356000000';

function laPosteSiretIsValid(siret: string): boolean {
  // Règle publiée par l'INSEE : la somme des chiffres doit être un multiple de 5.
  let sum = 0;
  for (const char of siret) sum += char.charCodeAt(0) - 48;
  return sum % 5 === 0;
}

export function normalizeSiren(input: string | null | undefined): string | null {
  if (!input) return null;

  const digits = input.replace(DIGITS_ONLY, '');
  if (digits.length !== 9) return null;

  // Un SIREN entièrement à zéro passe la clé de Luhn (somme nulle) alors qu'il
  // n'existe pas. C'est la valeur de remplissage la plus courante dans les
  // exports mal renseignés, elle ne doit surtout pas créer une entreprise.
  if (/^0+$/.test(digits)) return null;

  if (!passesLuhn(digits)) return null;
  return digits;
}

export function normalizeSiret(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(DIGITS_ONLY, '');
  if (digits.length !== 14) return null;
  if (/^0+$/.test(digits)) return null;

  const valid = digits.startsWith(LA_POSTE_SIREN)
    ? laPosteSiretIsValid(digits)
    : passesLuhn(digits);
  if (!valid) return null;

  // Un SIRET dont les 9 premiers chiffres ne forment pas un SIREN valide est
  // incohérent, même si sa propre clé passe.
  if (!normalizeSiren(digits.slice(0, 9))) return null;

  return digits;
}

/** Extrait le SIREN d'un SIRET. */
export function sirenFromSiret(siret: string | null | undefined): string | null {
  const normalized = normalizeSiret(siret);
  return normalized ? normalized.slice(0, 9) : null;
}

/**
 * Cherche un SIREN dans du texte libre.
 *
 * Sert à extraire l'identifiant des mentions légales d'un site : c'est le
 * rattachement site → entreprise le plus fiable qui existe, puisqu'il est
 * déterministe là où la correspondance par nom ne l'est jamais.
 */
export function extractSirenFromText(text: string): string[] {
  const found = new Set<string>();

  // 9 chiffres, éventuellement groupés par 3 — le format d'affichage courant.
  const pattern = /\b(\d{3})[  . -]?(\d{3})[  . -]?(\d{3})\b/g;

  for (const match of text.matchAll(pattern)) {
    const candidate = `${match[1]}${match[2]}${match[3]}`;
    const siren = normalizeSiren(candidate);
    if (siren) found.add(siren);
  }

  return [...found];
}
