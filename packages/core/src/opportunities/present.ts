import type { Db } from '../db/client';
import type { OpportunityType } from '../domain/types';
import { explainOpportunity, type Explanation } from './explain';

/**
 * Mise en forme d'une opportunité pour lecture.
 *
 * L'explication est reconstruite à la lecture, jamais figée en base au moment
 * du scoring. C'est un choix : améliorer la formulation profite alors
 * immédiatement à tout le stock existant, sans régénération. Le prix à payer
 * est une jointure de plus par opportunité affichée — négligeable devant cinq
 * opportunités par jour et par freelance.
 *
 * Ce que voit le freelance, c'est ceci. Une liste d'entreprises ne vaut rien :
 * ce qu'il ne peut pas produire seul, c'est la raison — datée, vérifiable,
 * propre à cette entreprise — pour laquelle celle-ci vaut un appel.
 */

export interface PresentedOpportunity {
  id: string;
  type: OpportunityType;
  baseScore: number;
  confidenceScore: number;
  company: {
    id: string;
    name: string;
    city: string | null;
    industry: string | null;
    phone: string | null;
    contactFormUrl: string | null;
    domain: string | null;
  };
  explanation: Explanation;
}

interface ReasonData {
  trigger?: string | null;
  trigger_occurred_at?: string | null;
  need_breakdown?: { signal: string; points: number }[];
}

interface TenderPayload {
  objet?: string | null;
  deadline?: string | null;
  notice_url?: string | null;
  cpv_label?: string | null;
}

export async function presentOpportunities(
  db: Db,
  options: { ids?: string[]; limit?: number } = {},
): Promise<PresentedOpportunity[]> {
  // Des identifiants explicites valent demande explicite : la console admin
  // doit pouvoir relire une opportunité expirée ou déjà attribuée.
  const byId = options.ids !== undefined && options.ids.length > 0;

  let query = db
    .from('opportunities')
    // Littéral d'un seul tenant : la forme du résultat est déduite de ce
    // texte, et une concaténation la rendrait indéchiffrable au compilateur.
    .select('id, company_id, opportunity_type, base_score, confidence_score, reason_data, companies!inner(id, legal_name, commercial_name, city, industry_label, phone, contact_form_url, domain, creation_date, employee_min)')
    .order('base_score', { ascending: false })
    .limit(options.limit ?? 20);

  query = byId ? query.in('id', options.ids!) : query.eq('status', 'available');

  const { data, error } = await query;
  if (error) throw new Error(`presentOpportunities : ${error.message}`);
  if (!data || data.length === 0) return [];

  // Les faits mesurés sur le site sont ce qui permet de citer des valeurs
  // plutôt que des adjectifs : « 2,4 s » se vérifie, « site lent » non.
  const domains = [...new Set(
    data.map((row) => (row.companies as unknown as { domain: string | null }).domain)
      .filter((d): d is string => d !== null),
  )];

  const facts = new Map<string, {
    status: string; cms: string | null; copyright_year: number | null;
    ttfb_ms: number | null; has_ssl: boolean | null; http_status: number | null;
    ecommerce_detected: boolean | null; registered_at: string | null;
    tls_reason: string | null; tls_valid_to: string | null;
    tech_year: number | null; dated_components: unknown;
  }>();

  for (let i = 0; i < domains.length; i += 100) {
    const { data: rows } = await db
      .from('domains')
      .select('domain, status, cms, copyright_year, ttfb_ms, has_ssl, http_status, ecommerce_detected, registered_at, tls_reason, tls_valid_to, tech_year, dated_components')
      .in('domain', domains.slice(i, i + 100));
    for (const row of rows ?? []) facts.set(row.domain, row);
  }

  // Le contenu de l'avis n'est pas dans reason_data : il appartient à
  // l'événement, qui reste la source de vérité sur le fait lui-même.
  const tenderIds = data
    .map((row) => (row.reason_data as ReasonData | null)?.trigger === 'tender_published'
      ? row.company_id : null)
    .filter((id): id is string => id !== null);

  const tenders = new Map<string, TenderPayload>();
  if (tenderIds.length > 0) {
    const { data: events } = await db
      .from('company_events')
      .select('company_id, payload, occurred_at')
      .eq('event_type', 'tender_published')
      .in('company_id', tenderIds)
      .order('occurred_at', { ascending: false });
    for (const event of events ?? []) {
      if (!tenders.has(event.company_id)) {
        tenders.set(event.company_id, (event.payload ?? {}) as TenderPayload);
      }
    }
  }

  return data.map((row) => {
    const company = row.companies as unknown as {
      id: string; legal_name: string; commercial_name: string | null;
      city: string | null; industry_label: string | null; phone: string | null;
      contact_form_url: string | null; domain: string | null;
      creation_date: string | null; employee_min: number | null;
    };

    const reason = (row.reason_data ?? {}) as ReasonData;
    const site = company.domain ? facts.get(company.domain) ?? null : null;

    return {
      id: row.id,
      type: row.opportunity_type as OpportunityType,
      baseScore: Number(row.base_score),
      confidenceScore: Number(row.confidence_score),
      company: {
        id: company.id,
        // Le nom d'enseigne parle au freelance ; la raison sociale ne dit
        // souvent rien à personne, pas même au dirigeant au téléphone.
        name: company.commercial_name ?? company.legal_name,
        city: company.city,
        industry: company.industry_label,
        phone: company.phone,
        contactFormUrl: company.contact_form_url,
        domain: company.domain,
      },
      explanation: explainOpportunity({
        opportunityType: row.opportunity_type as OpportunityType,
        companyName: company.commercial_name ?? company.legal_name,
        city: company.city,
        industryLabel: company.industry_label,
        triggerType: reason.trigger ?? null,
        triggerOccurredAt: reason.trigger_occurred_at ?? null,
        needSignals: (reason.need_breakdown ?? []).map((c) => ({
          signal: c.signal, points: c.points,
        })),
        facts: {
          domain: company.domain,
          cms: site?.cms ?? null,
          copyrightYear: site?.copyright_year ?? null,
          ttfbMs: site?.ttfb_ms ?? null,
          hasSsl: site?.has_ssl ?? null,
          httpStatus: site?.http_status ?? null,
          creationDate: company.creation_date,
          employeeMin: company.employee_min,
          ecommerceDetected: site?.ecommerce_detected ?? null,
          phone: company.phone,
          domainRegisteredAt: site?.registered_at ?? null,
          websiteStatus: site?.status ?? null,
          tlsReason: site?.tls_reason ?? null,
          tlsValidTo: site?.tls_valid_to ?? null,
          techYear: site?.tech_year ?? null,
          datedComponents: Array.isArray(site?.dated_components)
            ? site.dated_components as { name: string; version: string; year: number }[]
            : null,
          domainAgeYears: site?.registered_at
            ? Math.floor((Date.now() - new Date(site.registered_at).getTime()) / (365.25 * 86_400_000))
            : null,
          tenderSubject: tenders.get(row.company_id)?.objet ?? null,
          tenderDeadline: tenders.get(row.company_id)?.deadline ?? null,
          tenderUrl: tenders.get(row.company_id)?.notice_url ?? null,
          tenderCpvLabel: tenders.get(row.company_id)?.cpv_label ?? null,
        },
        confidenceScore: Number(row.confidence_score),
      }),
    };
  });
}
