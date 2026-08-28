import type { DetectedSignal, SignalDetector } from '../types';
import { ageInDays, clamp01 } from '../types';

/**
 * Détecteurs de déclencheurs.
 *
 * Un déclencheur porte une DATE. C'est ce qui permet au produit de répondre
 * « pourquoi maintenant », et c'est la seule chose qui autorise la création
 * d'une opportunité. Un site mal fichu depuis trois ans n'est pas un
 * déclencheur : c'est un état, vrai en permanence pour une grande partie du
 * parc, et prospecter dessus revient à prospecter au hasard.
 */

/** Fenêtre pendant laquelle une création reste un motif de contact. */
const RECENT_COMPANY_MAX_DAYS = 120;
const RECENT_COMPANY_MIN_DAYS = 7;

/**
 * Entreprise récemment créée.
 *
 * Le meilleur signal du produit : gratuit, daté, et il correspond au moment où
 * un commerçant construit sa présence en ligne. Les sept premiers jours sont
 * écartés — l'immatriculation précède souvent l'ouverture, et démarcher une
 * entreprise qui n'a pas encore ouvert ses portes ne sert à rien.
 */
export const recentCompanyDetector: SignalDetector = {
  id: 'company_recently_created',
  describes: 'Entreprise immatriculée récemment',

  detect({ company, events }) {
    const age = ageInDays(company.creation_date);
    if (age === null || age < RECENT_COMPANY_MIN_DAYS || age > RECENT_COMPANY_MAX_DAYS) return [];

    // Le fait doit exister comme événement daté : c'est lui qui fixe le
    // « quand », pas le moment où le détecteur regarde. L'événement du BODACC
    // date mieux que celui dérivé du répertoire, on le préfère.
    const bodacc = events.find(
      (e) => e.event_type === 'bodacc_creation' || e.event_type === 'bodacc_immatriculation',
    );
    const anchor = bodacc ?? events.find((e) => e.event_type === 'company_created');
    if (!anchor) return [];

    return [{
      signalType: 'company_recently_created',
      kind: 'trigger',
      category: 'timing',
      // Décroît sur la fenêtre : à 15 jours c'est brûlant, à 110 c'est tiède.
      strength: clamp01(1 - (age - RECENT_COMPANY_MIN_DAYS) / RECENT_COMPANY_MAX_DAYS),
      confidence: bodacc ? 0.99 : 0.95,
      evidence: { creation_date: company.creation_date, age_days: Math.round(age) },
      triggerEventId: anchor.id,
      expiresAt: new Date(
        new Date(company.creation_date!).getTime() + RECENT_COMPANY_MAX_DAYS * 86_400_000,
      ),
      fingerprint: `company_recently_created:${company.creation_date}`,
    }];
  },
};

/** Correspondance entre un événement BODACC et le signal qu'il produit. */
const BODACC_TRIGGERS: Record<string, { category: 'timing'; strength: number; days: number }> = {
  // Une cession de fonds est le meilleur motif de contact qui existe : le
  // repreneur refait l'enseigne, la carte, et souvent le site.
  bodacc_cession: { category: 'timing', strength: 0.95, days: 120 },
  bodacc_creation: { category: 'timing', strength: 0.9, days: 120 },
  bodacc_immatriculation: { category: 'timing', strength: 0.85, days: 120 },
  bodacc_modification: { category: 'timing', strength: 0.55, days: 60 },
};

/**
 * Événements du BODACC.
 *
 * Les procédures collectives et radiations ne produisent PAS de signal : elles
 * retirent l'entreprise de la prospection en amont. On ne démarche pas une
 * entreprise en redressement.
 */
export const bodaccEventDetector: SignalDetector = {
  id: 'bodacc_events',
  describes: 'Annonces légales : création, cession, modification',

  detect({ events }) {
    const signals: DetectedSignal[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      const rule = BODACC_TRIGGERS[event.event_type];
      if (!rule || seen.has(event.event_type)) continue;

      const age = ageInDays(event.occurred_at);
      if (age === null || age > rule.days) continue;

      seen.add(event.event_type);
      signals.push({
        signalType: event.event_type,
        kind: 'trigger',
        category: rule.category,
        strength: clamp01(rule.strength * (1 - age / rule.days)),
        confidence: event.confidence,
        evidence: { occurred_at: event.occurred_at, importance: event.importance },
        triggerEventId: event.id,
        expiresAt: new Date(new Date(event.occurred_at).getTime() + rule.days * 86_400_000),
        fingerprint: `${event.event_type}:${event.id}`,
      });
    }

    return signals;
  },
};

/**
 * Site tombé.
 *
 * Un site qui répondait et ne répond plus est visible par tous les clients de
 * l'entreprise. C'est un motif de contact immédiat et incontestable, à la
 * différence d'un jugement esthétique sur la qualité du site.
 */
export const websiteDownDetector: SignalDetector = {
  id: 'website_went_down',
  describes: 'Site devenu inaccessible',

  detect({ company, domain, events }) {
    if (!domain) return [];
    if (domain.status !== 'broken' && domain.status !== 'unreachable') return [];

    const event = events.find((e) => e.event_type === 'website_went_down');
    // Sans événement daté, on ne sait pas QUAND le site est tombé : ce n'est
    // alors qu'un état, pas un déclencheur.
    if (!event) return [];

    const age = ageInDays(event.occurred_at);
    if (age === null || age > 45) return [];

    return [{
      signalType: 'website_went_down',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01(1 - age / 45),
      confidence: 0.95,
      evidence: {
        domain: domain.domain,
        status: domain.status,
        http_status: domain.http_status,
        company_id: company.id,
      },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 45 * 86_400_000),
      fingerprint: `website_went_down:${event.id}`,
    }];
  },
};

/**
 * Site modifié.
 *
 * Une entreprise qui touche à son site est une entreprise qui s'en préoccupe.
 * Signal faible pris seul, mais il distingue un commerçant actif d'un site
 * abandonné depuis des années.
 */
export const websiteChangedDetector: SignalDetector = {
  id: 'website_changed',
  describes: 'Contenu du site modifié depuis le dernier passage',

  detect({ domain, events }) {
    if (!domain) return [];

    const event = events.find((e) => e.event_type === 'website_changed');
    if (!event) return [];

    const age = ageInDays(event.occurred_at);
    if (age === null || age > 30) return [];

    return [{
      signalType: 'website_changed',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01(0.6 * (1 - age / 30)),
      confidence: 0.85,
      evidence: { domain: domain.domain, occurred_at: event.occurred_at },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 30 * 86_400_000),
      fingerprint: `website_changed:${event.id}`,
    }];
  },
};

export const TRIGGER_DETECTORS: SignalDetector[] = [
  recentCompanyDetector,
  bodaccEventDetector,
  websiteDownDetector,
  websiteChangedDetector,
];
