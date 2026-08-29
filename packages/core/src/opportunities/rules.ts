import type { OpportunityType } from '../domain/types';

/**
 * Ce qui rend une opportunité plausible.
 *
 * Une règle décrit un type de prestation : quels signaux de besoin y
 * contribuent, à quel poids, et sous quelles conditions elle a seulement un
 * sens. Les conditions comptent autant que les poids — proposer une refonte à
 * une entreprise sans site n'est pas une erreur de score, c'est un contresens.
 */

export interface OpportunityRule {
  type: OpportunityType;
  /** Signaux de besoin et leur contribution, en points sur 100. */
  needWeights: Record<string, number>;
  /**
   * Signaux qui rendent le type impossible, quel que soit le reste.
   * Ce ne sont pas des malus : ce sont des interdictions.
   */
  blockedBy?: string[];
  /** Le type n'a de sens que si l'entreprise a — ou n'a pas — un site. */
  requiresWebsite: boolean | null;
  /** Plancher de besoin : en dessous, le type ne mérite pas d'être proposé. */
  minNeed: number;
  label: string;
}

export const OPPORTUNITY_RULES: OpportunityRule[] = [
  {
    type: 'tender_response',
    label: 'Réponse à appel d’offres',
    // Un acheteur peut avoir un site excellent et chercher tout de même un
    // prestataire : l'état de son site ne dit rien du marché qu'il publie.
    requiresWebsite: null,
    minNeed: 50,
    needWeights: {
      // Le besoin est déclaré. C'est le seul poids du moteur qui ne repose sur
      // aucune inférence, et il n'a donc pas à être partagé avec d'autres.
      tender_published: 95,
    },
  },
  {
    type: 'website_creation',
    label: 'Création de site',
    requiresWebsite: false,
    minNeed: 40,
    needWeights: {
      // Preuve positive d'absence, jamais une simple recherche infructueuse.
      no_website_proven: 70,
      website_placeholder: 65,
      company_recently_created: 20,
      // Une adresse réservée sans site derrière : l'intention est déjà prise,
      // il manque la réalisation.
      domain_recently_registered: 25,
      bodacc_creation: 20,
      bodacc_immatriculation: 18,
      active_business: 10,
    },
  },
  {
    type: 'website_redesign',
    label: 'Refonte de site',
    requiresWebsite: true,
    minNeed: 40,
    needWeights: {
      website_broken: 55,
      website_found_down: 50,
      // Le site existe et fonctionne : c'est la porte d'entrée qui est fermée.
      invalid_certificate: 50,
      certificate_expired: 20,
      dated_platform: 45,
      no_ssl: 40,
      stale_content: 30,
      slow_website: 25,
      no_contact_form: 15,
      bodacc_cession: 25,
      domain_recently_registered: 20,
    },
    // Le site appartient au réseau : le gérant d'un point de vente n'a aucune
    // prise dessus. Constaté sur des enseignes partageant un même domaine.
    blockedBy: ['shared_domain'],
  },
  {
    type: 'ecommerce',
    label: 'E-commerce',
    requiresWebsite: true,
    minNeed: 45,
    needWeights: {
      retail_without_ecommerce: 60,
      dated_platform: 20,
      active_business: 15,
      bodacc_cession: 15,
    },
    blockedBy: ['shared_domain'],
  },
  {
    type: 'maintenance',
    label: 'Maintenance / optimisation',
    requiresWebsite: true,
    minNeed: 45,
    needWeights: {
      slow_website: 45,
      // Remettre un certificat en état est une intervention courte et
      // chiffrable : c'est exactement le périmètre d'une maintenance.
      invalid_certificate: 55,
      certificate_expired: 25,
      no_ssl: 35,
      no_contact_form: 30,
      stale_content: 20,
    },
    blockedBy: ['shared_domain'],
  },
];

/**
 * Demi-vies de fraîcheur, par type d'événement déclencheur.
 *
 * Un fait vieillit à des rythmes très différents : une cession de fonds reste
 * un motif de contact plusieurs mois, un site tombé cesse d'en être un dès
 * qu'il est réparé.
 */
export const TRIGGER_HALF_LIVES: Record<string, number> = {
  company_recently_created: 45,
  bodacc_creation: 45,
  bodacc_immatriculation: 45,
  bodacc_cession: 60,
  bodacc_modification: 25,
  // La fraîcheur d'un avis ne dit rien : c'est sa date limite qui compte, et
  // le détecteur la porte déjà dans sa force. Demi-vie longue pour ne pas
  // pénaliser deux fois le même écoulement du temps.
  tender_published: 120,
  website_went_down: 7,
  // La fenêtre court depuis notre constat : le fait ne se périme pas vite,
  // mais il a été livré une fois et n'a pas à revenir.
  website_found_down: 45,
  certificate_expired: 60,
  website_changed: 14,
  // Une adresse déposée reste un motif de contact quelques semaines : passé
  // ce délai, soit le site est monté, soit le projet a été abandonné.
  domain_recently_registered: 30,
  default: 30,
};

/**
 * Signaux de risque et ce qu'ils retirent à la confiance.
 *
 * Ils n'empêchent pas l'opportunité : ils disent qu'on en sait moins qu'il n'y
 * paraît. Une identité mal établie sur un score commercial élevé doit rester
 * en dessous d'une identité sûre sur un score moyen.
 */
export const RISK_PENALTIES: Record<string, number> = {
  weak_identity: 0.35,
  website_unscanned: 0.2,
  shared_domain: 0.15,
};

export function ruleFor(type: OpportunityType): OpportunityRule | undefined {
  return OPPORTUNITY_RULES.find((r) => r.type === type);
}
