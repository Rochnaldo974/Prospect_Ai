import type { Db } from '../db/client';
import type { OpportunityType } from '../domain/types';
import { explainOpportunity, type Explanation } from '../opportunities/explain';
import { describeIndustry } from '../domain/industries';
import { loadWrittenCards } from './written-card';
import { screenshotUrl } from '../enrichment/screenshot';
import type { SiteScores } from '../enrichment/audit';
import { tierOf, type Tier } from './tier';

/**
 * Les opportunités du jour d'un freelance, prêtes à l'affichage.
 *
 * L'explication est reconstruite ici et non lue en base : améliorer la
 * formulation profite alors immédiatement à tout le stock, y compris aux
 * opportunités déjà attribuées.
 *
 * `is_control` n'est jamais exposé. Le freelance ne doit pas pouvoir
 * distinguer l'opportunité tirée au hasard des quatre autres — sinon la seule
 * mesure de la valeur du moteur ne mesure plus rien.
 */

export interface TodayOpportunity {
  assignmentId: string;
  rank: number;
  type: OpportunityType;
  matchScore: number;
  exclusiveUntil: string;
  /** Quand le dossier est arrivé : ce qui sépare « aujourd'hui » des jours précédents. */
  assignedAt: string;
  viewedAt: string | null;
  contactedAt: string | null;
  /** Mis de côté par le freelance — un marque-page, pas un droit de plus. */
  snoozedAt: string | null;
  company: {
    name: string;
    city: string | null;
    industry: string | null;
    /** Le signe du métier, pour la liste. */
    industryIcon: string;
    phone: string | null;
    /**
     * E-mail GÉNÉRIQUE relevé sur le site (contact@, info@…). Jamais un
     * e-mail nominatif : si rien de générique n'a été trouvé, null — on ne
     * montre pas plutôt que de risquer une adresse personnelle.
     */
    email: string | null;
    address: string | null;
    contactFormUrl: string | null;
    websiteUrl: string | null;
    /** Capture du site prise par le moteur à la vérification du dossier, quand elle existe. */
    screenshotUrl: string | null;
    /** La présence Google, quand elle a été relevée : ce que ses clients en disent. */
    google: { rating: number | null; reviewCount: number | null; photoCount: number | null; mapsUrl: string | null } | null;
  };
  /** Le palier : combien d'atouts le dossier réunit pour que l'appel aboutisse. */
  tier: Tier;
  /** La note du site mesurée par le moteur, quand le site a été audité. */
  audit: {
    score: number;
    scores: SiteScores;
    findings: string[];
    measuredAt: string | null;
  } | null;
  explanation: Explanation;
}

/** Préfixes d'adresse considérés comme non nominatifs, sans exception. */
const GENERIC_EMAIL_PREFIXES = new Set([
  'contact', 'info', 'infos', 'bonjour', 'hello', 'accueil', 'reservation',
  'reservations', 'commercial', 'boutique', 'atelier', 'cabinet', 'agence',
  'secretariat', 'commande', 'sav', 'support', 'administration',
]);

export function pickGenericEmail(emails: unknown): string | null {
  if (!Array.isArray(emails)) return null;
  for (const email of emails) {
    if (typeof email !== 'string') continue;
    const prefix = email.split('@')[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (prefix && GENERIC_EMAIL_PREFIXES.has(prefix)) return email;
  }
  return null;
}

interface ReasonData {
  trigger?: string | null;
  trigger_occurred_at?: string | null;
  need_breakdown?: { signal: string; points: number }[];
}

interface TenderPayload {
  objet?: string | null;
  deadline?: string | null;
}

export async function getTodayOpportunities(
  db: Db,
  userId: string,
): Promise<TodayOpportunity[]> {
  const { data, error } = await db
    .from('assignments')
    .select('id, rank, match_score, exclusive_until, assigned_at, viewed_at, contacted_at, snoozed_at, company_id, opportunities!inner(id, opportunity_type, confidence_score, reason_data), companies!inner(legal_name, commercial_name, city, industry_label, phone, address, postal_code, contact_form_url, social_links, siren, identity_confidence, google_rating, google_review_count, google_photo_count, google_maps_url, google_checked_at, website_url, domain, creation_date, employee_min)')
    .eq('user_id', userId)
    .in('status', ['active', 'contacted'])
    .order('rank', { ascending: true });

  if (error) throw new Error(`getTodayOpportunities : ${error.message}`);
  if (!data || data.length === 0) return [];

  const domains = [...new Set(
    data.map((row) => (row.companies as unknown as { domain: string | null }).domain)
      .filter((d): d is string => d !== null),
  )];

  const facts = new Map<string, {
    status: string; cms: string | null; copyright_year: number | null;
    ttfb_ms: number | null; has_ssl: boolean | null; http_status: number | null;
    ecommerce_detected: boolean | null; registered_at: string | null;
    tls_reason: string | null; tls_valid_to: string | null;
    tech_year: number | null; dated_components: unknown; screenshot_path?: string | null;
    site_score?: number | null; site_scores?: unknown; audited_at?: string | null;
  }>();

  for (let i = 0; i < domains.length; i += 100) {
    const { data: rows } = await db
      .from('domains')
      .select('domain, status, cms, copyright_year, ttfb_ms, has_ssl, http_status, ecommerce_detected, registered_at, tls_reason, tls_valid_to, tech_year, dated_components, emails_found, screenshot_path, site_score, site_scores, audited_at')
      .in('domain', domains.slice(i, i + 100));
    for (const row of rows ?? []) facts.set(row.domain, row);
  }

  // Le contenu d'un avis appartient à l'événement, qui reste la source de
  // vérité sur le fait lui-même.
  // Les fiches rédigées, quand elles existent : elles remplacent le relevé
  // dans ce que lit le freelance, jamais dans ce que le moteur a constaté.
  const writtenCards = await loadWrittenCards(db, data.map((row) => row.id));

  const tenders = new Map<string, TenderPayload>();
  const tenderCompanies = data
    .filter((row) => ((row.opportunities as unknown as { reason_data: ReasonData | null })
      .reason_data?.trigger) === 'tender_published')
    .map((row) => row.company_id);

  if (tenderCompanies.length > 0) {
    const { data: events } = await db
      .from('company_events')
      .select('company_id, payload')
      .eq('event_type', 'tender_published')
      .in('company_id', tenderCompanies)
      .order('occurred_at', { ascending: false });
    for (const event of events ?? []) {
      if (!tenders.has(event.company_id)) {
        tenders.set(event.company_id, (event.payload ?? {}) as TenderPayload);
      }
    }
  }

  return data.map((row) => {
    const company = row.companies as unknown as {
      legal_name: string; commercial_name: string | null; city: string | null;
      industry_label: string | null; phone: string | null; address: string | null;
      postal_code: string | null; contact_form_url: string | null;
      website_url: string | null; domain: string | null;
      creation_date: string | null; employee_min: number | null;
    };
    const opportunity = row.opportunities as unknown as {
      opportunity_type: string; confidence_score: number; reason_data: ReasonData | null;
    };

    const reason = opportunity.reason_data ?? {};
    const site = company.domain ? facts.get(company.domain) ?? null : null;
    const tender = tenders.get(row.company_id);
    // Le nom d'enseigne parle au freelance ; la raison sociale ne dit souvent
    // rien à personne, pas même au dirigeant au téléphone.
    const name = company.commercial_name ?? company.legal_name;

    return {
      assignmentId: row.id,
      rank: row.rank,
      type: opportunity.opportunity_type as OpportunityType,
      matchScore: Number(row.match_score),
      exclusiveUntil: row.exclusive_until,
      assignedAt: (row as unknown as { assigned_at: string }).assigned_at,
      viewedAt: row.viewed_at,
      contactedAt: row.contacted_at,
      snoozedAt: (row as unknown as { snoozed_at: string | null }).snoozed_at,
      company: {
        name,
        city: company.city,
        industry: describeIndustry(company.industry_label).label,
        industryIcon: describeIndustry(company.industry_label).icon,
        phone: company.phone,
        email: pickGenericEmail((site as unknown as { emails_found?: unknown })?.emails_found),
        address: [company.address, company.postal_code, company.city].filter(Boolean).join(', ') || null,
        contactFormUrl: company.contact_form_url,
        websiteUrl: company.website_url,
        screenshotUrl: screenshotUrl(process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '', site?.screenshot_path),
        google: readGoogle(company),
      },
      audit: readAudit(site),
      tier: tierOf({
        dated: (reason.trigger ?? null) !== null,
        phone: company.phone !== null,
        email: pickGenericEmail((site as unknown as { emails_found?: unknown })?.emails_found) !== null,
        contactForm: company.contact_form_url !== null,
        hasWebsite: company.domain !== null,
        siteScore: typeof site?.site_score === 'number' ? site.site_score : null,
        socialWithoutWebsite: company.domain === null
          && (company as { social_links?: Record<string, string> | null }).social_links != null
          && Object.keys((company as { social_links?: Record<string, string> | null }).social_links ?? {}).length > 0,
        identified: (company as { siren?: string | null }).siren != null
          && Number((company as { identity_confidence?: number }).identity_confidence ?? 0) >= 0.9,
        googleReviews: readGoogle(company)?.reviewCount ?? null,
        googleRating: readGoogle(company)?.rating ?? null,
      }),
      explanation: withWrittenCard(row.id, writtenCards, explainOpportunity({
        opportunityType: opportunity.opportunity_type as OpportunityType,
        companyName: name,
        city: company.city,
        industryLabel: describeIndustry(company.industry_label).label,
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
          googleRating: readGoogle(company)?.rating ?? null,
          googleReviews: readGoogle(company)?.reviewCount ?? null,
          socialLinks: (company as { social_links?: Record<string, string> | null }).social_links ?? null,
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
          tenderSubject: tender?.objet ?? null,
          tenderDeadline: tender?.deadline ?? null,
        },
        confidenceScore: Number(opportunity.confidence_score),
      })),
    };
  });
}

/** La fiche rédigée prend la place du relevé dans ce que lit le freelance ; les faits restent. */
function withWrittenCard(
  assignmentId: string,
  cards: Awaited<ReturnType<typeof loadWrittenCards>>,
  explanation: Explanation,
): Explanation {
  const card = cards.get(assignmentId);
  if (!card) return explanation;
  return {
    ...explanation,
    why: card.why,
    whyNow: card.whyNow,
    angle: card.angle,
    headline: card.headline,
    opener: card.opener,
    written: true,
  };
}

/** L'audit tel qu'il est rangé sur le domaine, relu prudemment. */
function readAudit(site: { site_score?: number | null; site_scores?: unknown; audited_at?: string | null } | null | undefined): TodayOpportunity['audit'] {
  if (!site || typeof site.site_score !== 'number') return null;
  const raw = site.site_scores as { scores?: Partial<SiteScores>; findings?: unknown } | null | undefined;
  const scores = raw?.scores ?? {};
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  return {
    score: site.site_score,
    scores: { speed: num(scores.speed), mobile: num(scores.mobile), seo: num(scores.seo), trust: num(scores.trust) },
    findings: Array.isArray(raw?.findings) ? raw.findings.filter((f): f is string => typeof f === 'string') : [],
    measuredAt: site.audited_at ?? null,
  };
}

/** La présence Google telle qu'elle est rangée sur l'entreprise, ou null si jamais relevée. */
function readGoogle(company: unknown): TodayOpportunity['company']['google'] {
  const c = company as {
    google_rating?: number | string | null; google_review_count?: number | null;
    google_photo_count?: number | null; google_maps_url?: string | null; google_place_id?: string | null;
    google_checked_at?: string | null;
  };
  if (!c.google_checked_at || (c.google_review_count == null && c.google_rating == null)) return null;
  return {
    rating: c.google_rating == null ? null : Number(c.google_rating),
    reviewCount: c.google_review_count ?? null,
    photoCount: c.google_photo_count ?? null,
    mapsUrl: c.google_maps_url ?? null,
  };
}
