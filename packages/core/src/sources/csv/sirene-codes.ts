/**
 * Codes du répertoire SIRENE.
 *
 * Isolés ici parce qu'ils sont susceptibles d'évoluer indépendamment du reste,
 * et parce qu'ils portent des décisions produit — notamment le statut de
 * diffusion, qui détermine ce qu'on a le droit d'exploiter.
 */

/** Tranches d'effectifs salariés (INSEE). */
const EMPLOYEE_RANGES: Record<string, [number, number]> = {
  NN: [0, 0], // non employeur ou non renseigné
  '00': [0, 0],
  '01': [1, 2],
  '02': [3, 5],
  '03': [6, 9],
  '11': [10, 19],
  '12': [20, 49],
  '21': [50, 99],
  '22': [100, 199],
  '31': [200, 249],
  '32': [250, 499],
  '41': [500, 999],
  '42': [1000, 1999],
  '51': [2000, 4999],
  '52': [5000, 9999],
  '53': [10000, 20000],
};

export function parseEmployeeRange(code: string | null | undefined): {
  min: number | null;
  max: number | null;
} {
  if (!code) return { min: null, max: null };

  const range = EMPLOYEE_RANGES[code.trim().toUpperCase()];
  if (!range) return { min: null, max: null };

  return { min: range[0], max: range[1] };
}

/**
 * Statut de diffusion.
 *
 *   O — diffusible : exploitable sans restriction particulière
 *   P — diffusion partielle : nom et adresse masqués pour les personnes physiques
 *   N — non diffusible
 *
 * Seul « O » est retenu comme prospectable. C'est le choix prudent : une part
 * importante des entrepreneurs individuels — c'est-à-dire une part importante
 * du segment visé — n'est pas en diffusion complète, et exploiter ces données
 * demanderait une analyse juridique qu'on ne fait pas au V1.
 */
export function isProspectable(diffusionStatus: string | null | undefined): boolean {
  if (!diffusionStatus) return false;
  return diffusionStatus.trim().toUpperCase() === 'O';
}

/** État administratif : A = actif, F = fermé. */
export function parseAdministrativeStatus(
  code: string | null | undefined,
): 'active' | 'closed' | 'unknown' {
  if (!code) return 'unknown';
  const value = code.trim().toUpperCase();
  if (value === 'A' || value === 'ACTIF' || value === 'ACTIVE') return 'active';
  if (value === 'F' || value === 'FERME' || value === 'CLOSED') return 'closed';
  return 'unknown';
}

/**
 * Codes NAF du segment « commerce et artisanat local » du V1.
 *
 * Sert de pré-filtre : ingérer 30 millions d'établissements pour n'en exploiter
 * qu'une fraction coûte du stockage, du scan et de la déduplication pour rien.
 */
const LOCAL_COMMERCE_PREFIXES = [
  '10.7', '10.8',          // boulangerie, pâtisserie, autres alimentaires
  '45.2', '45.3', '45.4',  // entretien, réparation, commerce de véhicules
  '47.',                   // commerce de détail
  '55.',                   // hébergement
  '56.',                   // restauration
  '43.2', '43.3', '43.9',  // installation et finition du bâtiment
  '41.2',                  // construction de bâtiments
  '81.2', '81.3',          // nettoyage, aménagement paysager
  '95.',                   // réparation d'ordinateurs et de biens personnels
  '96.',                   // autres services personnels
  '86.9', '75.',           // santé et vétérinaire de proximité
  '85.5',                  // enseignement, auto-écoles
  '93.1',                  // sport
  '68.3',                  // agences immobilières
];

/** Normalise un code NAF : « 5610A », « 56.10A » → « 56.10A ». */
export function normalizeNafCode(code: string | null | undefined): string | null {
  if (!code) return null;

  const value = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^\d{4}[A-Z]$/.test(value)) return null;

  return `${value.slice(0, 2)}.${value.slice(2)}`;
}

export function isLocalCommerce(nafCode: string | null | undefined): boolean {
  const normalized = normalizeNafCode(nafCode);
  if (!normalized) return false;

  return LOCAL_COMMERCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** Date SIRENE (AAAA-MM-JJ) vers date ISO, ou null. */
export function parseSireneDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  // Une date de création future est une donnée aberrante.
  if (date.getTime() > Date.now() + 86_400_000) return null;

  return trimmed;
}
