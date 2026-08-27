import type { Database } from '../db/database.types';

type Public = Database['public'];
type TableName = keyof Public['Tables'];

/** Ligne telle que lue en base. */
export type Row<T extends TableName> = Public['Tables'][T]['Row'];
/** Charge utile d'insertion. */
export type Insert<T extends TableName> = Public['Tables'][T]['Insert'];
/** Charge utile de mise à jour. */
export type Update<T extends TableName> = Public['Tables'][T]['Update'];

// ─── Enums du domaine ────────────────────────────────────────────────────────

export type OpportunityType = Public['Enums']['opportunity_type'];
export type LocationMode = Public['Enums']['location_mode'];
export type CompanyStatus = Public['Enums']['company_status'];
export type CompanySegment = Public['Enums']['company_segment'];
export type SignalKind = Public['Enums']['signal_kind'];
export type SignalCategory = Public['Enums']['signal_category'];
export type OpportunityStatus = Public['Enums']['opportunity_status'];
export type AssignmentStatus = Public['Enums']['assignment_status'];
export type AssignmentOutcome = Public['Enums']['assignment_outcome'];
export type CooldownReason = Public['Enums']['cooldown_reason'];
export type JobStatus = Public['Enums']['job_status'];
export type AppRole = Public['Enums']['app_role'];

// ─── Entités ─────────────────────────────────────────────────────────────────

export type Company = Row<'companies'>;
export type CompanySource = Row<'company_sources'>;
export type WebsiteSnapshot = Row<'website_snapshots'>;
export type CompanyEvent = Row<'company_events'>;
export type Signal = Row<'signals'>;
export type Opportunity = Row<'opportunities'>;
export type Assignment = Row<'assignments'>;
export type DailyBatch = Row<'daily_batches'>;
export type UserPreferences = Row<'user_preferences'>;
export type Profile = Row<'profiles'>;
export type Job = Row<'job_queue'>;

/**
 * Fiche figée livrée à l'utilisateur.
 *
 * Ne contient jamais `is_control` ni la décomposition interne du score :
 * exposer l'un fausserait la mesure du groupe témoin, exposer l'autre
 * révélerait le fonctionnement du moteur.
 */
export interface AssignmentCard {
  company: {
    legal_name: string;
    commercial_name: string | null;
    city: string | null;
    postal_code: string | null;
    industry_label: string | null;
    website_url: string | null;
    phone: string | null;
    contact_form_url: string | null;
  };
  opportunity: {
    type: OpportunityType;
    score: number;
  };
  signals: Array<{ label: string; detail: string | null }>;
  why: string | null;
  why_now: string | null;
  recommended_angle: string | null;
  generated_at: string;
}
