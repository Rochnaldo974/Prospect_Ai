import { DEFAULT_USER_AGENT, RateLimitedHttpClient } from '../http/client';

/**
 * BOAMP — Bulletin officiel des annonces de marchés publics.
 *
 * La seule source du produit où le besoin est déclaré et non déduit.
 *
 * Partout ailleurs, le moteur observe un fait — pas de site, site en panne,
 * certificat expiré — et en déduit qu'une proposition serait pertinente ;
 * l'explication doit alors préciser qu'on ignore si l'entreprise cherche
 * quelqu'un. Ici l'acheteur a écrit lui-même ce qu'il veut, avec une date
 * limite et une procédure. Il n'y a rien à inférer, donc rien à sur-promettre.
 *
 * Deux choses ne sont volontairement pas reprises :
 *
 *   — le nom et l'adresse électronique du contact. Ce sont des données
 *     nominatives, et la V1 n'en collecte aucune : c'est ce qui la maintient
 *     en régime allégé. On répond d'ailleurs à un avis sur la plateforme de
 *     dématérialisation, pas en appelant quelqu'un ;
 *   — les avis de travaux. « Refonte » y désigne une chaudière ou des portes
 *     d'atelier aussi souvent qu'un site, et un faux positif coûte plus cher
 *     au produit qu'une occasion manquée.
 */

const ENDPOINT =
  'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records';

/**
 * Codes CPV du vocabulaire européen des marchés publics.
 *
 * Plus sûrs qu'une recherche de mots : l'acheteur les choisit dans une
 * nomenclature fermée, là où l'intitulé est rédigé librement.
 */
// 79341400 « campagne publicitaire » a été retiré : il recouvre l'impression
// de supports et la signalétique autant que le numérique, et ramenait des
// marchés de brochures.
export const WEB_CPV_CODES: Record<string, string> = {
  '72413000': 'Conception de sites web',
  '72420000': 'Développement Internet',
  '72400000': 'Services Internet',
  '72212224': 'Développement de logiciels d’édition de pages web',
  '72230000': 'Développement de logiciels sur mesure',
  '72261000': 'Assistance logicielle',
  '72212200': 'Développement de logiciels de réseau',
};

/**
 * Expressions retenues à défaut de code CPV — tous les acheteurs n'en
 * renseignent pas. « Refonte » seul est écarté : il désigne une production de
 * froid ou un système de portes aussi souvent qu'un site.
 */
const WEB_PHRASES = [
  'site internet', 'site web', 'sites internet', 'sites web',
  'application mobile', 'application web', 'developpement web',
  'portail web', 'portail internet', 'plateforme numerique',
  'refonte du site', 'refonte des sites', 'creation de site',
  'conception de site', 'hebergement de site', 'referencement naturel',
];

export interface Tender {
  id: string;
  /** SIRET de l'acheteur : identité certaine, pas une correspondance de nom. */
  siret: string | null;
  buyerName: string;
  city: string | null;
  postalCode: string | null;
  departments: string[];
  /** Ce que l'acheteur cherche, dans ses propres mots. */
  subject: string;
  cpv: string | null;
  cpvLabel: string | null;
  publishedAt: string;
  /** Date limite de réponse : ce qui date l'opportunité, sans estimation. */
  deadline: string | null;
  procedure: string | null;
  /** Où répondre. Public, et sans donnée nominative. */
  noticeUrl: string;
  platformUrl: string | null;
}

interface BoampRecord {
  idweb?: string | null;
  objet?: string | null;
  nomacheteur?: string | null;
  dateparution?: string | null;
  datelimitereponse?: string | null;
  code_departement?: string[] | null;
  type_marche?: string[] | null;
  procedure_libelle?: string | null;
  url_avis?: string | null;
  donnees?: unknown;
}

/**
 * Toutes les valeurs textuelles du document, chemin compris.
 *
 * Le BOAMP publie sous deux schémas — l'ancien « FNSimple » et les eForms
 * européens — dont les arborescences n'ont rien de commun. Parcourir plutôt
 * que cibler évite de n'exploiter qu'un des deux, ce qui laissait les trois
 * quarts des avis sans identité.
 */
function* leaves(node: unknown, path = ''): Generator<[string, string]> {
  if (typeof node === 'string') {
    if (node !== '') yield [path, node];
  } else if (Array.isArray(node)) {
    for (const item of node) yield* leaves(item, path);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) yield* leaves(value, `${path}.${key}`);
  }
}

/**
 * SIRET de l'acheteur, quel que soit le schéma.
 *
 * Retenu seulement s'il est sans ambiguïté : un avis qui cite plusieurs
 * établissements — groupement de commandes, mandataire — ne permet pas de dire
 * lequel achète. Même discipline que pour les mentions légales d'un site :
 * en cas de doute, on ne crée rien.
 */
function findSiret(donnees: unknown): string | null {
  const found = new Set<string>();
  for (const [path, value] of leaves(donnees)) {
    if (!/^\d{14}$/.test(value)) continue;
    // Un montant ou une référence interne ne sont pas des identifiants.
    if (!/id|siret|national|party/i.test(path)) continue;
    found.add(value);
  }
  return found.size === 1 ? [...found][0]! : null;
}

/** Code CPV principal, cherché dans les deux schémas. */
function findCpv(donnees: unknown): string | null {
  for (const [path, value] of leaves(donnees)) {
    if (/cpv/i.test(path) && /^\d{8}$/.test(value)) return value;
  }
  return null;
}

const leaf = (node: unknown, path: string[]): string | null => {
  let current: unknown = node;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current !== '' ? current : null;
};

/** Le SIRET fait 14 chiffres ; un SIREN seul n'identifie pas un établissement. */
const asSiret = (value: string | null): string | null =>
  value !== null && /^\d{14}$/.test(value) ? value : null;

export function normalizeTender(record: BoampRecord): Tender | null {
  const id = record.idweb?.trim();
  const subject = record.objet?.trim();
  const buyerName = record.nomacheteur?.trim();
  const publishedAt = record.dateparution?.trim();
  if (!id || !subject || !buyerName || !publishedAt) return null;

  // Un marché de travaux n'est jamais un projet web, quel que soit son
  // intitulé : c'est ce filtre qui écarte les « refontes » de chaufferie.
  const kinds = record.type_marche ?? [];
  if (kinds.length > 0 && !kinds.some((k) => k === 'SERVICES' || k === 'FOURNITURES')) return null;

  const donnees = typeof record.donnees === 'string'
    ? (JSON.parse(record.donnees) as unknown)
    : record.donnees;

  const organisme = ['FNSimple', 'organisme'];
  const communication = ['FNSimple', 'initial', 'communication'];
  const cpv = findCpv(donnees);

  // Le filtre décisif, et il est appliqué ici plutôt que dans la requête :
  // l'API ne sait chercher que du texte dans l'ensemble du document, si bien
  // qu'un code CPV demandé au serveur ramenait des marchés de téléphonie ou de
  // progiciel médical. On retient donc un avis sur son code CPV s'il en porte
  // un, sur son intitulé sinon — jamais sur une correspondance ailleurs.
  const normalized = subject
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const relevant = (cpv !== null && cpv in WEB_CPV_CODES)
    || WEB_PHRASES.some((phrase) => normalized.includes(phrase));
  if (!relevant) return null;

  return {
    id,
    siret: asSiret(leaf(donnees, [...organisme, 'codeIdentificationNational']) ?? findSiret(donnees)),
    buyerName,
    city: leaf(donnees, [...organisme, 'ville']),
    postalCode: leaf(donnees, [...organisme, 'cp']),
    departments: record.code_departement ?? [],
    subject,
    cpv,
    cpvLabel: cpv ? WEB_CPV_CODES[cpv] ?? null : null,
    publishedAt,
    deadline: record.datelimitereponse ?? null,
    procedure: record.procedure_libelle ?? null,
    noticeUrl: record.url_avis ?? `https://www.boamp.fr/pages/avis/?q=idweb:${id}`,
    // Volontairement : ni nomContact, ni adresseMailContact, ni telContact.
    platformUrl: leaf(donnees, [...communication, 'urlProfilAch']),
  };
}

export interface FetchTendersOptions {
  /** N'inclure que les avis dont la date limite n'est pas passée. */
  openOnly?: boolean;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Avis de marché susceptibles d'intéresser un freelance web.
 *
 * Deux passes plutôt qu'une requête unique : les codes CPV donnent la
 * précision, les expressions rattrapent les acheteurs qui n'en renseignent
 * pas. L'union est déduplicquée sur l'identifiant de l'avis.
 */
export async function fetchWebTenders(
  options: FetchTendersOptions = {},
): Promise<Tender[]> {
  const http = new RateLimitedHttpClient({
    requestsPerSecond: 2,
    userAgent: DEFAULT_USER_AGENT,
    timeoutMs: 60_000,
  });
  const openOnly = options.openOnly !== false;
  const limit = Math.min(options.limit ?? 100, 100);

  const cpvClause = Object.keys(WEB_CPV_CODES)
    .map((code) => `search(donnees,"${code}")`)
    .join(' or ');
  const phraseClause = WEB_PHRASES
    .map((phrase) => `suggest(objet,"${phrase}")`)
    .join(' or ');

  const found = new Map<string, Tender>();

  for (const clause of [cpvClause, phraseClause]) {
    const where = openOnly ? `(${clause}) and datelimitereponse > now()` : `(${clause})`;
    const url = `${ENDPOINT}?where=${encodeURIComponent(where)}`
      + `&limit=${limit}&order_by=${encodeURIComponent('dateparution desc')}`;

    const response = await http.fetchJson<{ results?: BoampRecord[] }>(
      url, {}, options.signal,
    );
    for (const record of response?.results ?? []) {
      const tender = normalizeTender(record);
      if (tender) found.set(tender.id, tender);
    }
  }

  return [...found.values()];
}
