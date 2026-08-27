/**
 * Correspondance entre les colonnes d'un CSV et les champs du modèle.
 *
 * Deux modes :
 *   — détection automatique, sur des noms de colonnes courants ;
 *   — préréglage explicite, notamment pour le fichier SIRENE, dont les noms de
 *     colonnes sont stables et documentés.
 */

export type MappableField =
  | 'siren' | 'siret'
  | 'legalName' | 'commercialName'
  | 'domain' | 'phone' | 'email'
  | 'address' | 'postalCode' | 'city' | 'region'
  | 'lat' | 'lon'
  | 'industryCode' | 'industryLabel'
  | 'creationDate' | 'employeeRange' | 'status' | 'diffusion'
  | 'isHeadOffice';

export type ColumnMapping = Partial<Record<MappableField, string>>;

/** Noms de colonnes reconnus, du plus spécifique au plus générique. */
const ALIASES: Record<MappableField, string[]> = {
  siren: ['siren', 'n_siren', 'numero_siren'],
  siret: ['siret', 'n_siret', 'numero_siret'],
  legalName: ['raison_sociale', 'denomination', 'nom_entreprise', 'legal_name', 'company', 'societe', 'nom'],
  commercialName: ['enseigne', 'nom_commercial', 'commercial_name', 'trade_name', 'name'],
  domain: ['site', 'site_web', 'website', 'url', 'domaine', 'domain', 'web'],
  phone: ['telephone', 'tel', 'phone', 'tel_1', 'numero_telephone'],
  email: ['email', 'mail', 'e_mail', 'courriel'],
  address: ['adresse', 'address', 'rue', 'voie', 'adresse_1'],
  postalCode: ['code_postal', 'cp', 'postal_code', 'zip', 'zipcode'],
  city: ['ville', 'commune', 'city', 'localite'],
  region: ['region', 'departement'],
  lat: ['latitude', 'lat', 'y'],
  lon: ['longitude', 'lon', 'lng', 'x'],
  industryCode: ['naf', 'ape', 'code_naf', 'code_ape', 'activite_principale'],
  industryLabel: ['activite', 'libelle_naf', 'libelle_ape', 'secteur', 'industry'],
  creationDate: ['date_creation', 'creation_date', 'created'],
  employeeRange: ['effectif', 'tranche_effectif', 'employees'],
  status: ['etat', 'statut', 'status', 'etat_administratif'],
  diffusion: ['statut_diffusion', 'diffusion'],
  isHeadOffice: ['siege', 'etablissement_siege', 'is_head_office'],
};

/** Ramène un nom de colonne à une forme comparable. */
function canonical(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Devine la correspondance à partir des en-têtes.
 *
 * La détection est volontairement conservatrice : mieux vaut ne pas mapper une
 * colonne que la mapper au mauvais champ, ce qui produirait des entreprises
 * fausses et polluerait durablement la base.
 */
export function inferMapping(headers: string[]): ColumnMapping {
  const canonicalHeaders = new Map<string, string>();
  for (const header of headers) canonicalHeaders.set(canonical(header), header);

  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  for (const [field, aliases] of Object.entries(ALIASES) as [MappableField, string[]][]) {
    for (const alias of aliases) {
      const original = canonicalHeaders.get(alias);
      if (original && !used.has(original)) {
        mapping[field] = original;
        used.add(original);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Préréglage du fichier StockEtablissement de l'open data SIRENE.
 *
 * Les noms de colonnes proviennent de la documentation INSEE. Ils sont stables,
 * mais s'ils changeaient, la correction est un ajustement de ce tableau — pas
 * une reprise de l'adaptateur.
 */
export const SIRENE_ETABLISSEMENT_MAPPING: ColumnMapping = {
  siren: 'siren',
  siret: 'siret',
  legalName: 'denominationUsuelleEtablissement',
  commercialName: 'enseigne1Etablissement',
  postalCode: 'codePostalEtablissement',
  city: 'libelleCommuneEtablissement',
  industryCode: 'activitePrincipaleEtablissement',
  creationDate: 'dateCreationEtablissement',
  employeeRange: 'trancheEffectifsEtablissement',
  status: 'etatAdministratifEtablissement',
  diffusion: 'statutDiffusionEtablissement',
  isHeadOffice: 'etablissementSiege',
};

export const PRESETS: Record<string, ColumnMapping> = {
  sirene_etablissement: SIRENE_ETABLISSEMENT_MAPPING,
};
