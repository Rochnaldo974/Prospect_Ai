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

/**
 * Grandes familles de secteurs, pour l'écran de paramétrage.
 *
 * Regroupements de préfixes NAF, pas la nomenclature complète : on demande à
 * un freelance ce qu'il ne veut pas voir, pas de connaître le code 56.10A. Le
 * filtre d'exclusion applique les préfixes de façon hiérarchique, donc
 * exclure « 56 » écarte bien toute la restauration.
 */
export const INDUSTRY_GROUPS: { codes: string[]; label: string }[] = [
  { codes: ['56'],             label: 'Restauration, bars' },
  { codes: ['47'],             label: 'Commerce de détail' },
  { codes: ['96.02'],          label: 'Coiffure, esthétique' },
  { codes: ['45'],             label: 'Automobile, garages' },
  { codes: ['41', '42', '43'], label: 'Bâtiment, artisanat' },
  { codes: ['86', '87', '88'], label: 'Santé, social' },
  { codes: ['68'],             label: 'Immobilier' },
  { codes: ['69', '70'],       label: 'Conseil, juridique, comptabilité' },
  { codes: ['55', '79'],       label: 'Hébergement, tourisme' },
  { codes: ['85'],             label: 'Enseignement, formation' },
  { codes: ['84'],             label: 'Administration, collectivités' },
];
