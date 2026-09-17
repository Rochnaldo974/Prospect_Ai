import type { Db } from '../db/client';
import type { Logger } from '../logger';
import { classifyEmail } from '../normalization/email';
import type { ContactSource, ContactType, StoredContact } from './types';
import { contactReadiness, type Readiness } from './readiness';

/**
 * ContactResolver V1 : choisir, parmi ce qu'on sait déjà, le meilleur moyen
 * de joindre une entreprise.
 *
 * Étape la moins chère de la chaîne, et la seule de ce lot : aucune requête
 * externe, aucun crawl, aucune API. Le resolver relit company_contacts,
 * choisit le meilleur téléphone et la meilleure adresse écrite, calcule un
 * score de contactabilité et le reporte sur l'entreprise. Les étapes
 * suivantes (page contact, mentions légales, fournisseur payant) viendront
 * derrière ce resolver, jamais avant lui : on n'appelle pas une API payante
 * pour une entreprise dont on a déjà le contact@.
 */

export interface ResolvedContacts {
  contacts: StoredContact[];
  bestPhone: string | null;
  bestEmail: string | null;
  contactForm: string | null;
  contactabilityScore: number;
  readiness: Readiness;
}

const PHONE_SOURCE_RANK: Record<ContactSource, number> = {
  manual: 10, sirene: 9, legal_page: 8, contact_page: 7, osm: 6, website: 5, boamp: 4, csv: 3, enrichment_provider: 2, bodacc: 1, other: 0,
};

/** Le choix, en pur : testable sans base. */
export function selectBestContacts(contacts: StoredContact[]): Omit<ResolvedContacts, 'contacts'> {
  const usable = contacts.filter((c) => c.prospectingAllowed);

  const phones = usable.filter((c) => c.type === 'phone')
    .sort((a, b) => b.confidence - a.confidence || PHONE_SOURCE_RANK[b.source] - PHONE_SOURCE_RANK[a.source]);
  const bestPhone = phones[0]?.normalizedValue ?? null;

  // L'adresse : jamais nominative, jamais grand public. Générique d'abord,
  // rôle ensuite, et à qualité égale la source la plus sûre.
  const emails = usable.filter((c) => c.type === 'email')
    .map((c) => ({ c, q: classifyEmail(c.normalizedValue) }))
    .filter(({ q }) => q.category === 'GENERIC_BUSINESS' || q.category === 'ROLE_BASED')
    .sort((a, b) => b.q.quality - a.q.quality || b.c.confidence - a.c.confidence);
  const bestEmail = emails[0]?.c.normalizedValue ?? null;

  const forms = usable.filter((c) => c.type === 'contact_form').sort((a, b) => b.confidence - a.confidence);
  const contactForm = forms[0]?.normalizedValue ?? null;

  const hasSocial = usable.some((c) => (['linkedin', 'instagram', 'facebook', 'whatsapp'] as ContactType[]).includes(c.type));
  const hasPersonalEmail = usable.some((c) => c.type === 'email' && c.isPersonal);

  let score = 0;
  if (bestPhone) score += 50;
  if (bestEmail) score += emails[0]?.q.category === 'GENERIC_BUSINESS' ? 30 : 20;
  else if (hasPersonalEmail) score += 10;
  if (contactForm) score += 15;
  if (hasSocial) score += 5;
  score = Math.min(100, score);

  return {
    bestPhone,
    bestEmail,
    contactForm,
    contactabilityScore: score,
    readiness: contactReadiness({ phone: bestPhone, bestEmail, contactFormUrl: contactForm }),
  };
}

export async function loadContacts(db: Db, companyId: string): Promise<StoredContact[]> {
  const { data, error } = await db
    .from('company_contacts')
    .select('id, company_id, type, value, normalized_value, source, source_url, is_generic, is_personal, confidence, prospecting_allowed, first_seen_at, last_seen_at')
    .eq('company_id', companyId);
  if (error) throw new Error(`loadContacts : ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    type: row.type as ContactType,
    value: row.value,
    normalizedValue: row.normalized_value,
    source: row.source as ContactSource,
    sourceUrl: row.source_url,
    isGeneric: row.is_generic,
    isPersonal: row.is_personal,
    confidence: Number(row.confidence),
    prospectingAllowed: row.prospecting_allowed,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export interface ContactResolveOptions {
  dryRun?: boolean;
  logger?: Logger;
}

/**
 * Résout les contacts d'une entreprise et reporte le résultat sur sa ligne.
 *
 * `companies.phone` n'est rempli que s'il est vide (il porte déjà le gate
 * historique et une provenance dans company_field_provenance) ;
 * `best_email` et `contactability_score` sont recalculés à chaque passage.
 * Le statut dit s'il reste quelque chose à chercher : `resolved` quand on
 * peut appeler ET écrire, `partial` quand un seul canal manque, `failed`
 * quand on n'a rien — c'est la file du resolver de niveau 2.
 */
export async function resolveCompanyContacts(
  db: Db,
  companyId: string,
  options: ContactResolveOptions = {},
): Promise<ResolvedContacts> {
  const contacts = await loadContacts(db, companyId);
  const chosen = selectBestContacts(contacts);
  const result: ResolvedContacts = { contacts, ...chosen };
  if (options.dryRun) return result;

  const { data: company, error } = await db
    .from('companies')
    .select('phone, contact_form_url, contact_resolution_attempts')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(`resolveCompanyContacts : ${error.message}`);
  if (!company) return result;

  const phone = company.phone ?? chosen.bestPhone;
  const form = company.contact_form_url ?? chosen.contactForm;
  const readiness = contactReadiness({ phone, bestEmail: chosen.bestEmail, contactFormUrl: form });
  const status = readiness.phoneAndEmailReady ? 'resolved'
    : readiness.contactable ? 'partial' : 'failed';

  const now = new Date().toISOString();
  const { error: updateError } = await db.from('companies').update({
    ...(company.phone === null && chosen.bestPhone ? { phone: chosen.bestPhone } : {}),
    ...(company.contact_form_url === null && chosen.contactForm ? { contact_form_url: chosen.contactForm } : {}),
    best_email: chosen.bestEmail,
    contactability_score: chosen.contactabilityScore,
    contact_resolution_status: status,
    contact_resolution_attempts: (company.contact_resolution_attempts ?? 0) + 1,
    last_contact_resolution_at: now,
    // Rien à chercher tant qu'on a les deux canaux ; sinon, on repassera
    // quand le niveau 2 existera — dans une semaine, pas demain.
    next_contact_resolution_at: status === 'resolved' ? null : new Date(Date.now() + 7 * 86_400_000).toISOString(),
  }).eq('id', companyId);
  if (updateError) throw new Error(`resolveCompanyContacts : ${updateError.message}`);

  return { ...result, readiness };
}
