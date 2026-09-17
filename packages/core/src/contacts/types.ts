/**
 * Un contact : un moyen de joindre une entreprise, avec sa provenance.
 *
 * Une entreprise n'est pas une opportunité, un signal n'est pas une
 * opportunité, un contact non plus — mais sans contact il n'y a rien à
 * prospecter. Chaque contact dit d'où il vient (la source, l'URL de la page
 * s'il y en a une), s'il est générique ou nominatif, et à quel point on y
 * croit. C'est ce qui permet de choisir le meilleur canal sans jamais
 * confondre la boîte contact@ d'un commerce et l'adresse gmail de son gérant.
 */

export type ContactType =
  | 'phone' | 'email' | 'contact_form' | 'linkedin' | 'instagram' | 'facebook' | 'whatsapp' | 'other';

export type ContactSource =
  | 'osm' | 'website' | 'legal_page' | 'contact_page' | 'sirene' | 'bodacc' | 'boamp'
  | 'csv' | 'manual' | 'enrichment_provider' | 'other';

/** Ce qu'une source propose, avant normalisation et dédoublonnage. */
export interface ContactCandidate {
  type: ContactType;
  value: string;
  source: ContactSource;
  sourceUrl?: string | null;
  confidence?: number;
  personName?: string | null;
  role?: string | null;
  metadata?: Record<string, unknown>;
}

/** Un contact prêt à être écrit : normalisé, classé, dédoublonné. */
export interface PreparedContact {
  type: ContactType;
  value: string;
  normalizedValue: string;
  source: ContactSource;
  sourceUrl: string | null;
  isGeneric: boolean;
  isPersonal: boolean;
  personName: string | null;
  role: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
}

/** Une ligne de company_contacts, telle qu'on la relit. */
export interface StoredContact {
  id: number;
  companyId: string;
  type: ContactType;
  value: string;
  normalizedValue: string;
  source: ContactSource;
  sourceUrl: string | null;
  isGeneric: boolean;
  isPersonal: boolean;
  confidence: number;
  prospectingAllowed: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** La priorité d'une source quand deux disent la même chose : la plus sûre gagne. */
export const SOURCE_CONFIDENCE: Record<ContactSource, number> = {
  manual: 0.99,
  sirene: 0.95,
  boamp: 0.95,
  legal_page: 0.92,
  contact_page: 0.90,
  osm: 0.85,
  website: 0.80,
  csv: 0.75,
  bodacc: 0.70,
  enrichment_provider: 0.70,
  other: 0.50,
};
