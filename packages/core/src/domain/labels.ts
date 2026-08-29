import type {
  AssignmentOutcome,
  AssignmentStatus,
  LocationMode,
  OpportunityType,
} from './types';

/**
 * Libellés destinés à l'interface.
 *
 * Centralisés ici pour que l'app utilisateur et la console admin ne divergent
 * pas, et pour que l'ajout d'une valeur d'enum casse la compilation plutôt que
 * d'afficher une chaîne technique.
 */
export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  website_creation: 'Création de site',
  website_redesign: 'Refonte de site',
  ecommerce: 'E-commerce',
  web_application: 'Application web',
  mobile_application: 'Application mobile',
  ai_automation: 'Automatisation / IA',
  seo: 'SEO / visibilité',
  maintenance: 'Maintenance / optimisation',
  other: 'Autre',
  tender_response: 'Réponse à appel d’offres',
};

export const LOCATION_MODE_LABELS: Record<LocationMode, string> = {
  france: 'Toute la France',
  region: 'Ma région',
  city: 'Ma ville et sa proximité',
  france_remote: 'France + remote',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  active: 'Pas encore contactée',
  contacted: 'Contactée',
  completed: 'Terminée',
  expired: 'Expirée',
  released: 'Rendue au stock',
};

export const OUTCOME_LABELS: Record<AssignmentOutcome, string> = {
  no_response: 'Pas de réponse',
  not_interested: 'Pas intéressé',
  interested: 'Intéressé',
  meeting: 'Rendez-vous',
  proposal: 'Devis envoyé',
  client: 'Client',
};

/**
 * Ordre d'affichage des issues, du plus froid au plus chaud.
 * Sert aussi à l'entonnoir de conversion de la console admin.
 */
export const OUTCOME_FUNNEL: readonly AssignmentOutcome[] = [
  'no_response',
  'not_interested',
  'interested',
  'meeting',
  'proposal',
  'client',
] as const;
