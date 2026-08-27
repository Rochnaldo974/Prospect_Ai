import type { CompanySegment, CompanyStatus } from '../domain/types';
import type { Json } from '../db/database.types';

/** Donnée brute telle que la source la fournit, avant toute interprétation. */
export interface RawCompany {
  sourceName: string;
  /** Identifiant stable chez la source : SIRET, id OSM, ligne de CSV… */
  sourceExternalId: string;
  payload: Record<string, Json>;
  /** Confiance intrinsèque de la source dans cette donnée. */
  confidence: number;
}

/** Candidat normalisé, prêt pour la résolution d'identité. */
export interface NormalizedCompanyCandidate {
  siren: string | null;
  siret: string | null;
  legalName: string;
  commercialName: string | null;

  domain: string | null;
  websiteUrl: string | null;

  phone: string | null;
  contactFormUrl: string | null;

  address: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lon: number | null;

  industryCode: string | null;
  industryLabel: string | null;
  segment: CompanySegment;

  employeeMin: number | null;
  employeeMax: number | null;
  creationDate: string | null;
  companyStatus: CompanyStatus;

  prospectingAllowed: boolean;
  identityConfidence: number;

  raw: RawCompany;
  /** Champs présents mais écartés à la normalisation, avec le motif. */
  rejections: { field: string; value: string; reason: string }[];
}

export interface DiscoveryParams {
  /** Plafond de lignes à produire. Sans lui, une source peut être infinie. */
  limit?: number;
  /** Reprise d'une collecte interrompue. */
  cursor?: string;
  /** Restriction géographique, quand la source le permet. */
  departments?: string[];
  signal?: AbortSignal;
}

/**
 * Contrat commun à toutes les sources.
 *
 * `discover` renvoie un flux asynchrone et non un tableau : le fichier SIRENE
 * complet fait plusieurs Go et des millions de lignes. Une source qui promet
 * `RawCompany[]` ne peut pas être branchée sur le stock national.
 */
export interface CompanySourceAdapter {
  readonly sourceName: string;
  discover(params?: DiscoveryParams): AsyncIterable<RawCompany>;
  normalize(raw: RawCompany): NormalizedCompanyCandidate | null;
  /** Collecte incrémentale, quand la source expose un curseur de mise à jour. */
  refresh?(cursor?: string): AsyncIterable<RawCompany>;
}
