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

/**
 * Domaine récemment déposé.
 *
 * Le pont entre les deux moitiés du stock. Une entreprise créée il y a un mois
 * n'a presque jamais de téléphone connu ; une entreprise établie en a un mais
 * ne connaît aucun événement récent. Le dépôt d'un nom de domaine touche les
 * deux : c'est daté, public, et ça concerne des entreprises anciennes.
 *
 * Ce que le fait dit exactement : l'entreprise a réservé une adresse web à
 * cette date. Il ne dit pas qu'elle cherche un prestataire — l'explication
 * livrée au freelance doit s'en tenir là.
 */
export const domainRegisteredDetector: SignalDetector = {
  id: 'domain_recently_registered',
  describes: 'Nom de domaine déposé récemment',

  detect({ company, domain, events }) {
    const event = events.find((e) => e.event_type === 'domain_registered');
    if (!event) return [];

    const age = ageInDays(event.occurred_at);
    if (age === null || age > 90) return [];

    // Un domaine déposé mais qui ne sert encore rien est le cas le plus
    // parlant : l'entreprise a réservé l'adresse sans monter le site.
    const empty = domain === null
      || domain.status === 'placeholder'
      || domain.status === 'unreachable';

    return [{
      signalType: 'domain_recently_registered',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01((1 - age / 90) * (empty ? 1 : 0.7)),
      confidence: 0.85,
      evidence: {
        domain: domain?.domain ?? company.domain,
        registered_at: event.occurred_at,
        site_en_ligne: !empty,
      },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 90 * 86_400_000),
      fingerprint: `domain_recently_registered:${event.id}`,
    }];
  },
};

/**
 * Site constaté hors service.
 *
 * À distinguer strictement d'un site tombé : ici, nous n'avons jamais vu ce
 * site fonctionner, donc nous ignorons depuis quand il est en panne. Ce que
 * nous savons est plus étroit, et suffit : à deux passages espacés, l'adresse
 * que l'entreprise donne pour site ne répond pas.
 *
 * C'est le déclencheur le plus actionnable du produit — un client qui cherche
 * l'entreprise aujourd'hui tombe sur une erreur — et le plus facile à
 * disqualifier si on le formule mal. L'explication doit dire « au moment de
 * notre passage », jamais « depuis le ».
 */
export const websiteFoundDownDetector: SignalDetector = {
  id: 'website_found_down',
  describes: 'Site constaté hors service à plusieurs passages',

  detect({ domain, events }) {
    if (!domain) return [];
    if (domain.status !== 'broken' && domain.status !== 'unreachable') return [];

    const event = events.find((e) => e.event_type === 'website_found_down');
    if (!event) return [];

    // La fenêtre court depuis notre constat, pas depuis la panne : passé ce
    // délai, le fait a été livré et n'a pas à revenir indéfiniment.
    const age = ageInDays(event.occurred_at);
    if (age === null || age > 60) return [];

    return [{
      signalType: 'website_found_down',
      kind: 'trigger',
      category: 'timing',
      // Un site qui renvoie une erreur serveur est un constat plus net qu'un
      // domaine qui ne résout pas — lequel peut n'avoir jamais rien hébergé.
      strength: clamp01((domain.status === 'broken' ? 0.9 : 0.7) * (1 - age / 90)),
      confidence: 0.9,
      evidence: {
        domain: domain.domain,
        status: domain.status,
        http_status: domain.http_status,
        constate_le: event.occurred_at,
      },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 60 * 86_400_000),
      fingerprint: `website_found_down:${event.id}`,
    }];
  },
};

/**
 * Certificat expiré.
 *
 * Le seul défaut technique du produit qui porte sa propre date, à la seconde
 * près et sans rien inférer : le certificat indique lui-même le jour où il a
 * cessé d'être valide. Ni relevé, ni estimation — la date est dans le
 * certificat, et n'importe qui peut la lire.
 */
export const certificateExpiredDetector: SignalDetector = {
  id: 'certificate_expired',
  describes: 'Certificat de sécurité expiré à une date connue',

  detect({ domain, events }) {
    if (!domain || domain.tls_valid !== false) return [];

    const event = events.find((e) => e.event_type === 'certificate_expired');
    if (!event) return [];

    const age = ageInDays(event.occurred_at);
    if (age === null) return [];

    // Une expiration de la semaine dernière est un incident ; une expiration
    // d'il y a trois ans est un abandon, et n'a plus rien d'urgent. La force
    // décroît, le besoin lui reste porté par invalid_certificate.
    if (age > 180) return [];

    return [{
      signalType: 'certificate_expired',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01(1 - age / 180),
      confidence: 0.98,
      evidence: {
        domain: domain.domain,
        expire_le: domain.tls_valid_to,
        issuer: domain.tls_issuer,
      },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 180 * 86_400_000),
      fingerprint: `certificate_expired:${event.id}`,
    }];
  },
};

/**
 * Appel d'offres publié.
 *
 * Le seul déclencheur du produit qui ne déduit rien. Partout ailleurs on
 * observe un fait et on en infère qu'une proposition serait pertinente ; ici
 * l'acheteur a écrit lui-même ce qu'il cherche, avec une date limite.
 *
 * La force suit le temps qui reste pour répondre, pas l'ancienneté de la
 * publication : un avis paru il y a deux mois dont la date limite tombe la
 * semaine prochaine vaut plus qu'un avis d'hier ouvert jusqu'en décembre. Un
 * avis clos ne vaut rien du tout, quelle que soit sa fraîcheur.
 */
export const tenderPublishedDetector: SignalDetector = {
  id: 'tender_published',
  describes: 'Appel d’offres ouvert correspondant à une prestation web',

  detect({ events }) {
    const event = events.find((e) => e.event_type === 'tender_published');
    if (!event) return [];

    const payload = event.payload as { deadline?: string | null } | null;
    const deadline = payload?.deadline ? new Date(payload.deadline).getTime() : null;
    if (deadline === null || Number.isNaN(deadline)) return [];

    const daysLeft = (deadline - Date.now()) / 86_400_000;
    // Passé la date limite, il n'y a plus d'opportunité : c'est le seul
    // déclencheur du moteur dont l'extinction est fixée par un tiers.
    if (daysLeft <= 0) return [];

    // Trop peu de temps pour monter un dossier sérieux : l'annoncer serait
    // faire perdre son temps au freelance.
    if (daysLeft < 3) return [];

    return [{
      signalType: 'tender_published',
      kind: 'trigger',
      category: 'timing',
      // Un mois restant vaut pleinement ; au-delà, rien ne presse encore.
      strength: clamp01(daysLeft <= 30 ? 1 : 30 / daysLeft),
      // L'acheteur a publié son besoin au Journal officiel : il n'y a rien à
      // interpréter.
      confidence: 1,
      evidence: {
        tender_id: (event.payload as { tender_id?: string } | null)?.tender_id ?? null,
        deadline: payload?.deadline ?? null,
        jours_restants: Math.round(daysLeft),
      },
      triggerEventId: event.id,
      expiresAt: new Date(deadline),
      fingerprint: `tender_published:${event.id}`,
    }];
  },
};

/**
 * Site figé qui se remet à bouger.
 *
 * Une entreprise qui touche enfin à un site immobile depuis cinq ans est une
 * entreprise qui vient de décider que sa présence en ligne comptait. C'est le
 * signal d'intention le plus fort que le produit sache lire sans que personne
 * ait rien déclaré — et il est rare, donc précieux.
 *
 * Ce qu'on ne sait pas, et que l'explication doit dire : si elle s'y est mise
 * seule ou si elle a déjà pris quelqu'un.
 */
export const frozenSiteWokeUpDetector: SignalDetector = {
  id: 'frozen_site_woke_up',
  describes: 'Site immobile depuis des années, modifié récemment',

  detect({ domain, events }) {
    if (!domain) return [];

    const event = events.find((e) => e.event_type === 'frozen_site_woke_up');
    if (!event) return [];

    const age = ageInDays(event.occurred_at);
    // Fenêtre courte : l'intérêt est d'arriver pendant que la décision se
    // prend, pas trois mois après qu'elle a été prise.
    if (age === null || age > 45) return [];

    const payload = event.payload as { previous_tech_year?: number | null } | null;

    return [{
      signalType: 'frozen_site_woke_up',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01(1 - age / 60),
      confidence: 0.85,
      evidence: {
        domain: domain.domain,
        fige_depuis: payload?.previous_tech_year ?? null,
        constate_le: event.occurred_at,
      },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 45 * 86_400_000),
      fingerprint: `frozen_site_woke_up:${event.id}`,
    }];
  },
};

export const TRIGGER_DETECTORS: SignalDetector[] = [
  recentCompanyDetector,
  frozenSiteWokeUpDetector,
  tenderPublishedDetector,
  certificateExpiredDetector,
  websiteFoundDownDetector,
  domainRegisteredDetector,
  bodaccEventDetector,
  websiteDownDetector,
  websiteChangedDetector,
];
