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
  /**
   * Nombre minimum de constats mesurés exigés en l'absence d'événement daté.
   *
   * Une opportunité sans « pourquoi maintenant » ne se justifie que par la
   * densité de son diagnostic. Un seul constat — « le site est vieux » — n'est
   * pas une opportunité, c'est une opinion ; trois constats vérifiables
   * — composants de 2011, pas de HTTPS valide, 4,2 s de chargement — forment
   * un dossier qu'un freelance peut ouvrir devant son interlocuteur.
   *
   * Absent : la règle exige un déclencheur daté, sans exception.
   */
  diagnosticMinFacts?: number;
  /**
   * Plancher de besoin propre au diagnostic, plus haut que celui d'une
   * opportunité datée : sans « pourquoi maintenant », seule la densité du
   * constat justifie de déranger un commerçant.
   */
  diagnosticMinNeed?: number;
  /**
   * Faits dont AU MOINS UN doit être présent pour qu'un diagnostic se
   * propose. Pour une création de site : une preuve montrable que le site
   * manque — présence sociale sans site, absence constatée après recherche,
   * domaine parké — et pas seulement le silence d'un annuaire.
   */
  diagnosticRequires?: string[];
  /**
   * Gravité des constats pour un diagnostic : au moins un critique, ou deux
   * majeurs. Les autres signaux ne comptent que dans le besoin.
   */
  diagnosticSeverity?: { critical: string[]; major: string[] };
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
    // Sans fait daté, une création ne se propose que sur un dossier dense :
    // une présence sociale prouvée, plus un second fait. Le seul « pas de
    // site » resterait une opinion d'annuaire.
    diagnosticMinFacts: 2,
    diagnosticMinNeed: 60,
    // Plusieurs chemins indépendants vers le même dossier : réseaux sans
    // site (chemin C), absence prouvée après recherche (chemin A), domaine
    // parké d'une entreprise identifiée (chemin E). Les chemins B et D
    // passent par un déclencheur daté (création, immatriculation).
    diagnosticRequires: ['social_without_website', 'no_website_proven', 'website_placeholder'],
    needWeights: {
      // La preuve la plus parlante : l'entreprise existe en ligne, sans
      // vitrine à elle.
      social_without_website: 60,
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
    // La seule famille livrable sans événement daté. C'est le marché le plus
    // vaste — presque toutes les entreprises ont un site — et le seul où
    // l'absence d'urgence se compense par la précision du constat.
    diagnosticMinFacts: 3,
    diagnosticMinNeed: 60,
    // Une seule anomalie mineure n'est pas une opportunité. Sans fait daté,
    // il faut un défaut critique, ou deux défauts majeurs, en plus du
    // plancher de besoin : c'est ce qu'un freelance peut montrer sans
    // discussion.
    diagnosticSeverity: {
      critical: ['website_broken', 'not_responsive', 'invalid_certificate', 'no_ssl'],
      major: ['outdated_stack', 'dated_platform', 'website_found_down', 'stale_content', 'slow_website', 'website_placeholder'],
    },
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
      // Le constat le plus vérifiable du produit : une version lisible dans
      // le code source, dont l'année de publication n'est pas discutable.
      outdated_stack: 50,
      // Un commerce dont le site est illisible sur téléphone perd l'essentiel
      // de ses visiteurs : c'est le défaut le plus coûteux, et le plus simple
      // à montrer.
      not_responsive: 55,
      frozen_site_woke_up: 30,
      // Ne pèse presque rien seul : n'appuie qu'un diagnostic déjà établi.
      aged_domain: 12,
    },
    // Le site appartient au réseau : le gérant d'un point de vente n'a aucune
    // prise dessus. Constaté sur des enseignes partageant un même domaine.
    blockedBy: ['shared_domain'],
  },
  {
    type: 'ecommerce',
    label: 'E-commerce',
    requiresWebsite: true,
    minNeed: 50,
    // Sans fait daté : un catalogue affiché sans panier, un commerce de
    // détail sans vente en ligne, ou une boutique sur une plateforme datée.
    // Jamais un restaurant ou un service sur la seule foi de son NAF.
    diagnosticMinFacts: 2,
    diagnosticMinNeed: 55,
    diagnosticRequires: ['catalog_without_cart', 'retail_without_ecommerce', 'obsolete_ecommerce_stack'],
    needWeights: {
      catalog_without_cart: 55,
      retail_without_ecommerce: 45,
      obsolete_ecommerce_stack: 50,
      dated_platform: 20,
      not_responsive: 20,
      active_business: 10,
      bodacc_cession: 15,
    },
    blockedBy: ['shared_domain'],
  },
  {
    type: 'seo',
    label: 'SEO / visibilité',
    requiresWebsite: true,
    minNeed: 45,
    // Pas de lead SEO pour une description absente : au moins deux
    // manques indépendants, dont un qui compte, et un besoin net.
    diagnosticMinFacts: 2,
    diagnosticMinNeed: 55,
    diagnosticSeverity: {
      critical: ['missing_title', 'not_responsive', 'thin_content'],
      major: ['missing_meta_description', 'missing_h1', 'no_structured_data', 'images_without_alt', 'slow_website', 'no_ssl'],
    },
    needWeights: {
      missing_title: 40,
      missing_meta_description: 25,
      missing_h1: 25,
      no_structured_data: 15,
      images_without_alt: 15,
      thin_content: 25,
      not_responsive: 25,
      slow_website: 20,
      no_ssl: 15,
      no_canonical: 5,
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
      not_responsive: 40,
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
  // Une entreprise qui se remet à toucher son site décide vite : la fenêtre
  // utile est celle de la décision, pas celle du chantier.
  frozen_site_woke_up: 20,
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
