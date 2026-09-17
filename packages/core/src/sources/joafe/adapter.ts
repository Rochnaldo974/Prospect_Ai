import { httpClientFor } from '../http/policy';
import { normalizeDomainDetailed, normalizePostalCode } from '../../normalization';

/**
 * JOAFE : les annonces d'associations au Journal officiel, par l'API DILA.
 *
 * Une association qui vient d'être créée, ou qui vient de modifier son
 * objet ou son siège, est dans le même moment qu'une entreprise
 * nouvelle : elle a un nom, une adresse, souvent pas de site. La source
 * donne le RNA, le titre, l'objet, l'adresse du siège, parfois le site.
 * Jamais une personne : les dirigeants ne figurent pas dans l'annonce.
 */

const ENDPOINT = 'https://journal-officiel-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/jo_associations/records';

export type AssociationNoticeKind = 'creation' | 'modification';

export interface AssociationNotice {
  id: string;
  kind: AssociationNoticeKind;
  rna: string;
  name: string;
  purpose: string | null;
  /** Domaine du site déclaré, quand l'annonce en porte un. */
  domain: string | null;
  websiteUrl: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  departmentCode: string | null;
  activityLabel: string | null;
  publishedAt: string;
  declaredAt: string | null;
}

interface JoafeRecord {
  id?: string | null;
  source?: string | null;
  typeavis?: string | null;
  dateparution?: string | null;
  datedeclaration?: string | null;
  titre?: string | null;
  objet?: string | null;
  siteweb?: string | null;
  numero_rna?: string | null;
  adresse_actuelle?: string | null;
  codepostal_actuel?: string | null;
  commune_actuelle?: string | null;
  departement_code?: string | null;
  domaine_activite_libelle_categorise?: string[] | string | null;
}

export function normalizeAssociationNotice(record: JoafeRecord): AssociationNotice | null {
  const id = record.id?.trim();
  const rna = record.numero_rna?.trim();
  const name = record.titre?.trim();
  const publishedAt = record.dateparution?.trim();
  if (!id || !rna || !/^W\d{9}$/.test(rna) || !name || !publishedAt) return null;
  if (record.source && record.source !== 'joafe') return null;
  const kind: AssociationNoticeKind | null = record.typeavis === 'Création' ? 'creation'
    : record.typeavis === 'Modification' ? 'modification' : null;
  if (kind === null) return null;

  const website = record.siteweb?.trim() || null;
  const domain = website ? normalizeDomainDetailed(website).domain : null;
  const activity = Array.isArray(record.domaine_activite_libelle_categorise)
    ? record.domaine_activite_libelle_categorise[0] ?? null
    : record.domaine_activite_libelle_categorise ?? null;

  return {
    id,
    kind,
    rna,
    name: name.slice(0, 300),
    purpose: record.objet?.trim().slice(0, 1000) || null,
    domain,
    websiteUrl: domain ? website : null,
    address: record.adresse_actuelle?.trim() || null,
    postalCode: normalizePostalCode(record.codepostal_actuel ?? null),
    city: record.commune_actuelle?.trim() || null,
    departmentCode: record.departement_code?.trim() || null,
    activityLabel: activity ? activity.replace(/\/$/, '').trim() || null : null,
    publishedAt,
    declaredAt: record.datedeclaration ?? null,
  };
}

export interface FetchAssociationOptions {
  /** Depuis quelle date de parution (AAAA-MM-JJ). */
  since?: string;
  limit?: number;
  signal?: AbortSignal;
}

/** Les créations et modifications, de la plus récente à la plus ancienne, par pages de cent. */
export async function fetchAssociationNotices(options: FetchAssociationOptions = {}): Promise<AssociationNotice[]> {
  const http = httpClientFor('joafe');
  const limit = Math.min(options.limit ?? 500, 5000);
  const pageSize = 100;
  const since = options.since ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const where = `source='joafe' and typeavis in ('Création','Modification') and dateparution >= date'${since}'`;
  const out: AssociationNotice[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < limit; offset += pageSize) {
    if (options.signal?.aborted) break;
    const url = `${ENDPOINT}?where=${encodeURIComponent(where)}&limit=${Math.min(pageSize, limit - offset)}&offset=${offset}`
      + `&order_by=${encodeURIComponent('dateparution desc, id')}`;
    const response = await http.fetchJson<{ results?: JoafeRecord[] }>(url, {}, options.signal);
    const results = response?.results ?? [];
    for (const record of results) {
      const notice = normalizeAssociationNotice(record);
      if (notice && !seen.has(notice.id)) { seen.add(notice.id); out.push(notice); }
    }
    if (results.length < pageSize) break;
  }
  return out;
}
