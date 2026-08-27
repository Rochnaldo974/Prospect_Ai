/**
 * Normalisation de texte français.
 *
 * Sert de socle au rapprochement de noms : deux graphies d'un même commerce
 * doivent produire la même clé, sans quoi la déduplication passera à côté.
 */

/** Retire les accents et met en minuscules. */
export function foldText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Formes juridiques françaises, retirées pour comparer les noms.
 * « DUPONT SARL » et « Dupont » désignent la même entreprise.
 */
const LEGAL_FORMS = [
  'sarl', 'eurl', 'sas', 'sasu', 'sa', 'snc', 'scs', 'sca', 'sci', 'scp', 'scm',
  'selarl', 'selas', 'sel', 'scop', 'sem', 'gie', 'gaec', 'earl', 'scea',
  'ei', 'eirl', 'association', 'asso', 'auto entrepreneur', 'micro entreprise',
  'societe', 'ste', 'ets', 'etablissements', 'entreprise', 'cie', 'compagnie',
  'groupe', 'holding', 'france', 'international',
];

const LEGAL_FORM_PATTERN = new RegExp(
  `\\b(${LEGAL_FORMS.join('|')})\\b`,
  'g',
);

/**
 * Clé de comparaison d'un nom d'entreprise.
 *
 * « SARL Boulangerie DUPONT & Fils » → « boulangerie dupont fils »
 *
 * Ne remplace jamais la valeur affichée : c'est une clé interne de
 * rapprochement, le nom original reste stocké tel quel.
 */
export function normalizeCompanyName(input: string | null | undefined): string | null {
  if (!input) return null;

  let value = foldText(input);

  // & → et, avant de retirer la ponctuation
  value = value.replace(/&/g, ' et ');
  value = value.replace(/['’]/g, ' ');
  value = value.replace(/[^a-z0-9]+/g, ' ');
  value = value.replace(LEGAL_FORM_PATTERN, ' ');
  value = value.replace(/\s+/g, ' ').trim();

  return value.length > 0 ? value : null;
}

/**
 * Clé de nom encore plus agressive : sans espaces ni mots vides.
 * Utile en dernier recours quand le nom commercial et la raison sociale
 * diffèrent par la ponctuation seule.
 */
const STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'au', 'aux', 'a', 'et', 'chez']);

export function companyNameKey(input: string | null | undefined): string | null {
  const normalized = normalizeCompanyName(input);
  if (!normalized) return null;

  const words = normalized.split(' ').filter((w) => !STOP_WORDS.has(w));
  const key = (words.length > 0 ? words : normalized.split(' ')).join('');

  return key.length > 0 ? key : null;
}
