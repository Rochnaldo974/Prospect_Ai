/**
 * Téléphones français, ramenés en E.164.
 *
 * Le téléphone est l'un des deux canaux du gate de contact du V1, et une clé
 * de déduplication de bon niveau. Les formats d'entrée sont très variés.
 *
 * Le point délicat est l'outre-mer : les départements d'outre-mer utilisent le
 * plan de numérotation français en national (0262 pour La Réunion) mais ont
 * leur propre indicatif pays en international (+262). Traiter 0262… comme un
 * numéro métropolitain produirait +33262…, c'est-à-dire un fixe du nord-ouest
 * de la France — un appel dans le vide.
 */

/**
 * Préfixes nationaux à 3 chiffres (après le 0) qui relèvent d'un indicatif
 * pays distinct. Fixes et mobiles de chaque territoire.
 */
const OVERSEAS_NATIONAL_PREFIXES: Record<string, string> = {
  262: '262', 263: '262', 692: '262', 693: '262', // Réunion, Mayotte
  590: '590', 690: '590', 691: '590',             // Guadeloupe, Saint-Martin, Saint-Barthélemy
  594: '594', 694: '594',                         // Guyane
  596: '596', 696: '596', 697: '596',             // Martinique
};

/** Indicatifs pays suivis de 9 chiffres, comme la métropole. */
const NINE_DIGIT_COUNTRY_CODES = new Set(['33', '262', '590', '594', '596']);

/** Territoires du Pacifique et Saint-Pierre-et-Miquelon : 6 chiffres. */
const SIX_DIGIT_COUNTRY_CODES = new Set(['508', '681', '687', '689']);

/** Premier chiffre valide d'un numéro national à 9 chiffres. */
const VALID_LEADING = new Set(['1', '2', '3', '4', '5', '6', '7', '9']);

/** Transforme un numéro national de 9 chiffres en E.164. */
function fromNationalNumber(nineDigits: string): string | null {
  if (nineDigits.length !== 9) return null;

  const leading = nineDigits[0];
  if (!leading || !VALID_LEADING.has(leading)) return null;

  const countryCode = OVERSEAS_NATIONAL_PREFIXES[nineDigits.slice(0, 3)];
  if (countryCode) return `+${countryCode}${nineDigits}`;

  return `+33${nineDigits}`;
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  let value = input.trim().replace(/[^\d+]/g, '');
  if (!value) return null;

  // 0033… → +33…
  if (value.startsWith('00')) value = `+${value.slice(2)}`;

  if (value.startsWith('+')) {
    const digits = value.slice(1);

    // Indicatifs à 3 chiffres, testés avant « 33 » qui n'en fait que 2.
    for (const code of [...NINE_DIGIT_COUNTRY_CODES, ...SIX_DIGIT_COUNTRY_CODES]) {
      if (code.length === 3 && digits.startsWith(code)) {
        const rest = digits.slice(3);
        if (SIX_DIGIT_COUNTRY_CODES.has(code)) {
          return rest.length === 6 ? `+${code}${rest}` : null;
        }
        return rest.length === 9 && VALID_LEADING.has(rest[0] ?? '')
          ? `+${code}${rest}`
          : null;
      }
    }

    if (!digits.startsWith('33')) return null;
    return fromNationalNumber(digits.slice(2));
  }

  // Numéro national, avec ou sans le 0 initial.
  const national = value.startsWith('0') ? value.slice(1) : value;
  return fromNationalNumber(national);
}

/**
 * Numéro mobile ? Un mobile atteint plus souvent le dirigeant qu'un standard,
 * ce qui pourra pondérer la qualité du contact.
 */
export function isMobile(phone: string | null): boolean {
  if (!phone) return false;
  if (/^\+33[67]/.test(phone)) return true;
  // Outre-mer : mobiles en 69x.
  return /^\+(262|590|594|596)69/.test(phone);
}

/** Affichage français : +33123456789 → 01 23 45 67 89 */
export function formatPhoneForDisplay(phone: string | null): string | null {
  if (!phone) return null;
  if (!phone.startsWith('+')) return phone;

  const digits = phone.slice(1);

  for (const code of NINE_DIGIT_COUNTRY_CODES) {
    if (digits.startsWith(code) && digits.length === code.length + 9) {
      const national = `0${digits.slice(code.length)}`;
      return national.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    }
  }

  for (const code of SIX_DIGIT_COUNTRY_CODES) {
    if (digits.startsWith(code)) {
      const rest = digits.slice(code.length);
      return `+${code} ${rest.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`;
    }
  }

  return phone;
}
