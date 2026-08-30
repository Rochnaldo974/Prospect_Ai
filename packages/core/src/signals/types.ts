import type { Json } from '../db/database.types';
import type { Company, SignalCategory, SignalKind } from '../domain/types';

/** Ce qu'un détecteur reçoit : tout ce qu'on sait d'une entreprise, en une fois. */
export interface CompanyContext {
  company: Company;
  /** Analyse du site, partagée entre les entreprises qui le revendiquent. */
  domain: DomainSnapshot | null;
  /** Combien d'entreprises revendiquent ce domaine. Au-delà d'une, c'est un réseau. */
  domainCompanyCount: number;
  /** Événements datés récents, du plus récent au plus ancien. */
  events: ContextEvent[];
}

export interface DomainSnapshot {
  domain: string;
  status: string;
  http_status: number | null;
  cms: string | null;
  framework: string | null;
  technologies: string[];
  has_ssl: boolean | null;
  tls_valid: boolean | null;
  tls_reason: string | null;
  tls_valid_to: string | null;
  tls_issuer: string | null;
  has_viewport_meta: boolean | null;
  has_media_queries: boolean | null;
  responsive: boolean | null;
  ttfb_ms: number | null;
  html_bytes: number | null;
  ecommerce_detected: boolean;
  booking_detected: boolean;
  contact_form_detected: boolean;
  copyright_year: number | null;
  registered_at: string | null;
  tech_year: number | null;
  dated_components: unknown;
  sirens_found: string[];
  last_checked_at: string | null;
  first_seen_at: string;
}

export interface ContextEvent {
  id: string;
  event_type: string;
  /** Contenu de l'événement : certains déclencheurs en dépendent. */
  payload: unknown;
  importance: number;
  confidence: number;
  occurred_at: string;
  detected_at: string;
}

export interface DetectedSignal {
  signalType: string;
  /**
   * `trigger` : peut déclencher une opportunité, et porte donc une date.
   * `modifier` : ne fait que moduler un score, jamais déclencher.
   */
  kind: SignalKind;
  category: SignalCategory;
  /** À quel point le signal est marqué. */
  strength: number;
  /** À quel point on est sûr de l'observation elle-même. */
  confidence: number;
  evidence: Json;
  /** Obligatoire pour un déclencheur : c'est ce qui le date. */
  triggerEventId?: string | undefined;
  expiresAt?: Date | undefined;
  /** Empreinte stable : le même signal ne doit pas être recréé à chaque passage. */
  fingerprint: string;
}

export interface SignalDetector {
  readonly id: string;
  readonly describes: string;
  detect(context: CompanyContext): DetectedSignal[];
}

/** Âge en jours d'une date ISO, ou null. */
export function ageInDays(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / 86_400_000;
}

/** Ramène une valeur dans [0, 1]. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
