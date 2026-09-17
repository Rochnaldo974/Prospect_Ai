import type { OpportunityType } from '../domain/types';

/**
 * Explication d'une opportunité.
 *
 * C'est ce qui fait la valeur du produit. Une liste d'entreprises n'a aucun
 * intérêt : le freelance a besoin de savoir POURQUOI celle-ci, POURQUOI
 * maintenant, et PAR QUOI commencer.
 *
 * Deux règles absolues :
 *
 *   1. Ne jamais affirmer ce qu'on ne sait pas. On n'écrit pas « cette
 *      entreprise cherche un développeur » — on ne l'a jamais constaté. On
 *      écrit ce qu'on a observé, et ce que cela rend pertinent.
 *
 *   2. Aucune formule applicable à n'importe quelle entreprise. « Améliorer sa
 *      présence numérique » ne veut rien dire et ne se vérifie pas. Chaque
 *      phrase doit s'appuyer sur un fait précis, daté ou mesuré.
 *
 * La génération est déterministe : elle ne peut donc rien inventer. Un modèle
 * de langage viendra plus tard affiner la formulation, jamais produire le fond.
 */

export interface ExplanationInput {
  opportunityType: OpportunityType;
  companyName: string;
  city: string | null;
  industryLabel: string | null;
  triggerType: string | null;
  triggerOccurredAt: string | null;
  /** Signaux ayant contribué au besoin, du plus contributif au moins. */
  needSignals: { signal: string; points: number }[];
  /** Faits observés, pour citer des valeurs plutôt que des adjectifs. */
  facts: {
    domain?: string | null;
    cms?: string | null;
    copyrightYear?: number | null;
    ttfbMs?: number | null;
    hasSsl?: boolean | null;
    httpStatus?: number | null;
    creationDate?: string | null;
    employeeMin?: number | null;
    ecommerceDetected?: boolean | null;
    tlsReason?: string | null;
    tlsValidTo?: string | null;
    datedComponents?: { name: string; version: string; year: number }[] | null;
    techYear?: number | null;
    domainAgeYears?: number | null;
    tenderSubject?: string | null;
    tenderDeadline?: string | null;
    tenderUrl?: string | null;
    tenderCpvLabel?: string | null;
    phone?: string | null;
    domainRegisteredAt?: string | null;
    websiteStatus?: string | null;
    /** Réseaux sociaux connus, {réseau: url}. */
    socialLinks?: Record<string, string> | null;
    /** Ce que ses clients en disent sur Google, quand on l'a relevé. */
    googleRating?: number | null;
    googleReviews?: number | null;
    /** Quand le site a été observé pour la dernière fois. */
    observedAt?: string | null;
    performance?: { ttfbMs?: number | null; htmlBytes?: number | null; renderBlockingScripts?: number; scriptCount?: number } | null;
    performanceAudit?: { totalBytes?: number; jsBytes?: number; largestImageBytes?: number; largestImageUrl?: string | null } | null;
  };
  confidenceScore: number;
}

/** Une preuve : le fait, sa valeur, où et quand on l'a vu. */
export interface Evidence {
  fact: string;
  value: string;
  observedAt: string | null;
  sourceUrl: string | null;
}

export interface Explanation {
  /** Ce qui a été observé, et ce que cela rend pertinent. */
  why: string;
  /** Ce qui date le contact — vide si rien ne le date vraiment. */
  whyNow: string;
  /** Par quoi commencer, formulé comme une proposition concrète. */
  angle: string;
  /** Faits détectés, lisibles tels quels par le freelance. */
  signals: string[];
  /** Ce qu'on ne sait pas, dit explicitement. */
  caveats: string[];
  /** Les faits bruts derrière chaque phrase : valeur, date, adresse. Jamais inventés. */
  evidence: Evidence[];
  /** Titre rédigé, quand une fiche a été écrite pour ce dossier. */
  headline?: string;
  /** Première phrase à prononcer au téléphone, quand une fiche a été écrite. */
  opener?: string;
  /** Vrai quand pourquoi, pourquoi maintenant et angle viennent de la fiche rédigée. */
  written?: boolean;
  /** La part de l'e-mail rédigée pour le commerçant, sans un mot technique. */
  email?: { subject: string; hook: string; proposal: string };
}

/**
 * Ce qu'un certificat refusé provoque, formulé pour être vérifié en une
 * minute par le freelance comme par le commerçant.
 */
/**
 * Deux situations que le freelance doit distinguer avant d'appeler : un site
 * qui s'ouvre en http avec un certificat cassé à côté n'affiche qu'un
 * « Non sécurisé » discret ; un site qui envoie en https sur ce certificat
 * met une page pleine d'avertissement devant chaque visiteur. Exagérer le
 * premier cas se paie au premier appel.
 */
function describeCertificate(reason: string | null, servedOverHttps: boolean | null): string {
  const blocking = servedOverHttps !== false;
  const effect = blocking
    ? 'les navigateurs affichent une page d’avertissement avant le site'
    : 'le site s’ouvre en http, sans avertissement bloquant, mais « Non sécurisé » dans la barre d’adresse';
  switch (reason) {
    case 'CERT_HAS_EXPIRED':
      return `Certificat de sécurité expiré : ${effect}`;
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return `Certificat auto-signé : ${effect}`;
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return `Certificat émis pour un autre nom de domaine : ${effect}`;
    default:
      return `Certificat de sécurité refusé par les navigateurs : ${effect}`;
  }
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Nombre à la française : la virgule décimale, pas le point. */
function fr(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

/** Formulation de l'ancienneté, sans fausse précision. */
function agePhrase(days: number): string {
  if (days <= 1) return "aujourd'hui";
  if (days <= 7) return `il y a ${days} jours`;

  if (days <= 45) {
    const weeks = Math.round(days / 7);
    return weeks <= 1 ? 'il y a une semaine' : `il y a ${weeks} semaines`;
  }

  const months = Math.round(days / 30);
  return months <= 1 ? 'il y a environ un mois' : `il y a environ ${months} mois`;
}

/**
 * Rend un signal en fait lisible, avec sa valeur quand on l'a mesurée.
 *
 * Citer « TTFB 2,4 s » plutôt que « site lent » : le freelance peut vérifier,
 * et il a de quoi ouvrir la conversation.
 */
function describeSignal(signal: string, facts: ExplanationInput['facts']): string | null {
  switch (signal) {
    case 'social_without_website': {
      const names: Record<string, string> = {
        instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn',
      };
      const networks = Object.keys(facts.socialLinks ?? {}).map((n) => names[n] ?? n);
      return networks.length > 0
        ? `Présente sur ${networks.join(' et ')}, sans aucun site web à elle`
        : 'Présente sur les réseaux sociaux, sans aucun site web à elle';
    }
    case 'no_website_proven':
      return "Aucun site web trouvé, alors que l'entreprise est joignable et référencée";
    case 'website_placeholder':
      return facts.domain
        ? `Le domaine ${facts.domain} est réservé mais n'affiche qu'une page d'attente`
        : "Le domaine est réservé mais n'affiche qu'une page d'attente";
    case 'website_broken':
      return facts.httpStatus
        // « ne répond pas », jamais « ne répond plus » : nous ne l'avons pas
        // vu fonctionner, donc nous ignorons s'il a fonctionné.
        ? `Le site ne répond pas (erreur HTTP ${facts.httpStatus})`
        : 'Le site ne répond pas';
    case 'dated_platform':
      return facts.cms
        ? `Site construit sous ${facts.cms}, une solution de mise en ligne rapide`
        : 'Site construit sur une solution de mise en ligne rapide';
    case 'stale_content': {
      if (!facts.copyrightYear) return 'Contenu du site apparemment figé depuis plusieurs années';
      const age = new Date().getFullYear() - facts.copyrightYear;
      return age >= 2
        ? `Site figé à ${facts.copyrightYear} d'après sa mention de copyright — ${age} ans sans mise à jour visible`
        : `Mention de copyright figée à ${facts.copyrightYear}`;
    }
    case 'slow_website':
      return facts.ttfbMs
        ? `Temps de réponse du serveur mesuré à ${fr(facts.ttfbMs / 1000)} s`
        : 'Temps de réponse du serveur élevé';
    case 'no_ssl':
      return 'Site servi sans HTTPS : « Non sécurisé » dans la barre d’adresse, et Google le pénalise';
    case 'no_contact_form':
      return 'Aucun formulaire ni page de contact trouvé sur le site';
    case 'retail_without_ecommerce':
      return 'Commerce de détail dont le site ne propose pas de vente en ligne';
    case 'company_recently_created':
    case 'bodacc_creation':
    case 'bodacc_immatriculation':
      return facts.creationDate
        ? `Entreprise immatriculée le ${formatDate(`${facts.creationDate}T00:00:00Z`) ?? facts.creationDate}`
        : 'Entreprise récemment immatriculée';
    case 'bodacc_cession':
      return 'Cession de fonds publiée au BODACC — changement de propriétaire';
    case 'bodacc_modification':
      return 'Modification déclarée au BODACC';
    case 'website_went_down':
      return 'Le site répondait lors du passage précédent, plus maintenant';
    case 'website_found_down':
      // Le constat brut est déjà porté par website_broken : le répéter ici
      // remplirait la liste de deux lignes disant la même chose.
      return null;
    case 'tender_published':
      // On cite l'acheteur mot pour mot. Reformuler un besoin déclaré ne
      // pourrait que le déformer.
      return facts.tenderSubject
        ? `Objet du marché, dans les termes de l'acheteur : « ${facts.tenderSubject} »`
        : null;
    case 'outdated_stack': {
      // On cite les composants et leur année. C'est le seul constat du
      // produit que l'interlocuteur peut vérifier lui-même, en ouvrant le
      // code source de sa propre page.
      const parts = (facts.datedComponents ?? [])
        .slice(0, 3)
        .map((c) => `${c.name} ${c.version} (${c.year})`);
      if (parts.length === 0) {
        return facts.techYear
          ? `Composants du site datant de ${facts.techYear} au plus récent`
          : null;
      }
      return `Site bâti sur ${parts.join(', ')}`
        + `${facts.techYear ? ` — des technologies de ${facts.techYear}, rien de plus récent` : ''}`;
    }
    case 'not_responsive':
      return 'Le site ne s’adapte pas aux écrans de téléphone — vérifiable en l’ouvrant sur mobile';
    case 'aged_domain':
      // Un domaine ancien n'est pas un défaut, et « déposé il y a 9 ans »
      // ne donne envie à personne d'appeler. Le fait reste un a priori
      // interne du scoring ; il ne se dit pas au freelance.
      return null;
    case 'frozen_site_woke_up':
      return null; // porté par « pourquoi maintenant »
    case 'invalid_certificate':
      return describeCertificate(facts.tlsReason ?? null, facts.hasSsl ?? null);
    case 'certificate_expired':
      return facts.tlsValidTo
        ? `Certificat expiré le ${formatDate(`${facts.tlsValidTo}T00:00:00Z`) ?? facts.tlsValidTo}`
        : null;
    case 'website_changed':
      return 'Le contenu du site a changé depuis le dernier passage';
    case 'domain_recently_registered':
      return facts.domainRegisteredAt
        ? `Nom de domaine déposé le ${formatDate(`${facts.domainRegisteredAt}T00:00:00Z`) ?? facts.domainRegisteredAt}`
        : 'Nom de domaine déposé récemment';
    case 'active_business':
      return null; // vrai de presque toutes : n'apporte rien au freelance
    case 'reachable':
      return null;
    default:
      return null;
  }
}

/** Ce que le type d'opportunité rend pertinent, sans jamais l'affirmer du client. */
const RELEVANCE: Record<OpportunityType, string> = {
  website_creation: 'une proposition de création de site',
  website_redesign: 'une proposition de refonte',
  ecommerce: 'une proposition de vente en ligne',
  web_application: 'une proposition d’application métier',
  mobile_application: 'une proposition d’application mobile',
  ai_automation: 'une proposition d’automatisation',
  seo: 'une proposition de travail sur la visibilité',
  maintenance: 'une proposition de maintenance et d’optimisation',
  other: 'une prise de contact',
  tender_response: 'une candidature',
};

const ANGLES: Record<OpportunityType, (facts: ExplanationInput['facts'], signals: string[]) => string> = {
  website_creation: (facts, signals) =>
    facts.domain
      ? `Le domaine ${facts.domain} est déjà réservé : le projet est engagé mais pas abouti. `
        + `Proposer de le concrétiser rapidement, avec une première version en ligne sous quelques semaines.`
      : signals.includes('social_without_website')
        ? `Partir de sa page sociale, qui vit déjà : proposer la vitrine qui la prolonge — `
          + `horaires, carte, prise de contact — plutôt qu'un projet complet. Le lien est dans la fiche.`
        : `Appeler en partant de ce que ses clients trouvent aujourd'hui en cherchant l'entreprise. `
          + `Proposer une première version simple plutôt qu'un projet complet.`,

  website_redesign: (facts, signals) => {
    const levers: string[] = [];
    if (signals.includes('no_ssl')) levers.push("le passage en HTTPS, visible immédiatement par ses visiteurs");
    if (signals.includes('slow_website') && facts.ttfbMs) {
      levers.push(`le temps de chargement, mesuré à ${fr(facts.ttfbMs / 1000)} s`);
    }
    if (signals.includes('website_broken')) levers.push('la remise en ligne du site');
    if (signals.includes('stale_content') && facts.copyrightYear) {
      levers.push(`la mise à jour du contenu, figé depuis ${facts.copyrightYear}`);
    }
    if (signals.includes('dated_platform') && facts.cms) {
      levers.push(`la sortie de ${facts.cms}, qui limite ce qu'on peut faire évoluer`);
    }
    if (signals.includes('not_responsive')) {
      levers.push("l'affichage sur téléphone, d'où vient l'essentiel de ses visiteurs");
    }
    if (signals.includes('outdated_stack') && facts.techYear) {
      // On chiffre l'écart plutôt que de le qualifier : « quatorze ans » se
      // discute moins que « obsolète ».
      levers.push(
        `la reprise de composants qui n'ont pas bougé depuis ${facts.techYear}`
        + `, soit ${new Date().getFullYear() - facts.techYear} ans`,
      );
    }

    const opening = levers.length > 0
      ? `Proposer un audit court centré sur ${levers.slice(0, 2).join(' et ')}.`
      : `Proposer un audit court du site existant.`;

    return `${opening} Un constat vérifiable ouvre mieux la conversation qu'un jugement esthétique.`;
  },

  ecommerce: (facts) =>
    `L'entreprise a déjà un site${facts.domain ? ` (${facts.domain})` : ''} mais rien pour vendre en ligne. `
    + `Partir de son catalogue existant et proposer un premier périmètre restreint, `
    + `plutôt qu'une refonte complète.`,

  maintenance: (_facts, signals) => {
    const points: string[] = [];
    if (signals.includes('no_ssl')) points.push('le certificat HTTPS');
    if (signals.includes('slow_website')) points.push('les performances');
    if (signals.includes('no_contact_form')) points.push("l'ajout d'un moyen de contact");
    return points.length > 0
      ? `Proposer une intervention courte et chiffrée sur ${points.join(', ')}. `
        + `Un petit périmètre se décide plus vite qu'un projet.`
      : `Proposer une intervention courte et chiffrée sur le site existant.`;
  },

  web_application: () => 'Prendre contact pour comprendre les processus actuels avant toute proposition.',
  mobile_application: () => 'Prendre contact pour comprendre les usages avant toute proposition.',
  ai_automation: () => 'Prendre contact pour identifier les tâches répétitives avant toute proposition.',
  seo: () => 'Proposer un audit de visibilité sur les requêtes de son secteur et de sa ville.',
  other: () => 'Prendre contact pour qualifier le besoin.',

  tender_response: () =>
    `Télécharger le dossier de consultation sur la plateforme et vérifier d'abord les critères `
    + `d'attribution et les capacités exigées : c'est ce qui décide si la candidature vaut le temps `
    // La date limite est déjà donnée par « pourquoi maintenant » : la répéter
    // ici volerait la place du seul conseil que cette section doit porter.
    + `qu'elle demande.`,
};

/** Ce qui date le contact. Vide si rien ne le date vraiment. */
function buildWhyNow(input: ExplanationInput): string {
  const days = daysSince(input.triggerOccurredAt);
  const when = days !== null ? agePhrase(days) : null;

  switch (input.triggerType) {
    case 'tender_published': {
      const limite = formatDate(input.facts.tenderDeadline ?? null);
      const restant = daysSince(input.facts.tenderDeadline ?? null);
      const jours = restant === null ? null : Math.max(0, Math.round(-restant));
      return `L'avis a été publié au Journal officiel ${when ?? 'récemment'}`
        + `${limite ? `, et les réponses sont reçues jusqu'au ${limite}` : ''}`
        + `${jours !== null && jours <= 30 ? ` — ${jours} jour${jours > 1 ? 's' : ''}` : ''}. `
        + `Le délai n'est pas une estimation : il est fixé par l'acheteur, et passé cette date `
        + `l'opportunité n'existe plus.`;
    }

    case 'company_recently_created':
    case 'bodacc_creation':
    case 'bodacc_immatriculation': {
      const date = input.facts.creationDate
        ? formatDate(`${input.facts.creationDate}T00:00:00Z`)
        : null;
      return `L'entreprise a été immatriculée ${date ? `le ${date}` : when ?? 'récemment'}. `
        + `C'est la période où une activité met en place ses outils, et où les décisions `
        + `se prennent vite parce que rien n'est encore installé.`;
    }

    case 'bodacc_cession':
      return `Une cession de fonds a été publiée au BODACC ${when ?? 'récemment'}. `
        + `Un repreneur reprend généralement l'enseigne, la communication et le site à son compte `
        + `dans les mois qui suivent.`;

    case 'website_went_down':
      return `Le site répondait lors d'un passage précédent et ne répond plus depuis ${when ?? 'peu'}. `
        + `C'est visible par tous ses clients, et c'est le genre de problème qu'on veut voir réglé vite.`;

    case 'website_found_down':
      // Formulation imposée : nous n'avons jamais vu ce site fonctionner, donc
      // nous ignorons depuis quand il est en panne. Dire « depuis le … » serait
      // faux, et se retournerait contre le freelance au téléphone.
      return `À deux passages successifs, dont le dernier ${when ?? 'récemment'}, l'adresse que l'entreprise `
        + `donne pour site n'a pas répondu. Nous ne savons pas depuis quand, et le problème peut être `
        + `ancien comme récent. Ce que ses clients rencontrent aujourd'hui en la cherchant, en revanche, `
        + `se vérifie en une minute.`;

    case 'website_changed':
      return `Le contenu du site a été modifié ${when ?? 'récemment'}. `
        + `L'entreprise s'occupe de sa présence en ligne en ce moment.`;

    case 'domain_recently_registered':
      // Deux situations très différentes derrière le même fait : l'adresse est
      // vide, ou elle sert déjà. L'explication doit les distinguer, sinon elle
      // décrit une entreprise qu'on n'a pas regardée.
      return input.facts.websiteStatus === null
          || input.facts.websiteStatus === undefined
          || input.facts.websiteStatus === 'placeholder'
          || input.facts.websiteStatus === 'unreachable'
        ? `L'entreprise a déposé son nom de domaine ${when ?? 'récemment'}, et rien n'est encore en ligne `
          + `à cette adresse. La décision de se lancer est prise ; la réalisation ne l'est pas.`
        : `L'entreprise a déposé un nouveau nom de domaine ${when ?? 'récemment'}. `
          + `On ne dépose pas une adresse sans projet derrière.`;

    case 'bodacc_modification':
      return `Une modification a été déclarée au BODACC ${when ?? 'récemment'} — `
        + `changement d'activité, d'adresse ou de dirigeant.`;

    default:
      // Sans fait daté, on ne fabrique pas d'urgence.
      return '';
  }
}

/**
 * Construit l'explication.
 *
 * Le ton est celui d'un constat, jamais d'une certitude sur l'intention du
 * prospect. On dit ce qu'on a vu ; c'est au freelance de juger.
 */
/**
 * Ce qui ouvre une fiche est ce qui donne envie d'appeler : un défaut que le
 * freelance peut montrer en une capture d'écran. Le scoring pèse les faits
 * par leur poids commercial ; la fiche les ordonne par ce qu'ils font voir.
 * Un site illisible sur téléphone ou figé en 2011 vaut une conversation ;
 * un formulaire absent, à peine une remarque.
 */
const SELLING_ORDER: string[] = [
  'tender_published',
  'social_without_website',
  'website_broken', 'website_went_down',
  'not_responsive', 'stale_content', 'outdated_stack', 'dated_platform',
  'no_website_proven', 'website_placeholder',
  'invalid_certificate', 'certificate_expired', 'no_ssl',
  'slow_website', 'retail_without_ecommerce',
  'company_recently_created', 'bodacc_creation', 'bodacc_immatriculation',
  'domain_recently_registered', 'bodacc_cession', 'bodacc_modification',
  'no_contact_form',
];

function sellingRank(signal: string): number {
  const at = SELLING_ORDER.indexOf(signal);
  return at === -1 ? SELLING_ORDER.length : at;
}

/**
 * Le titre : le verdict, la preuve, la proposition — en une ligne.
 *
 * « Site trop vieux — figé en 2011, illisible sur téléphone : proposer une
 * refonte moderne ». C'est la ligne qu'on lit avant d'ouvrir le dossier, et
 * retour du propriétaire, c'est elle qui donne ou non envie de cliquer. Le
 * relevé détaillé reste dessous, prudent et complet ; le titre, lui, parle
 * comme on parlerait au commerçant. Il ne dit jamais ce que l'entreprise
 * veut : il dit ce qu'on a vu et ce qu'on peut proposer.
 */
function buildHeadline(input: ExplanationInput, signals: string[]): string {
  const f = input.facts;
  const has = (k: string) => signals.includes(k);
  const year = new Date().getFullYear();

  if (input.opportunityType === 'tender_response') {
    return f.tenderSubject ? `Appel d'offres publié : ${f.tenderSubject}` : 'Appel d’offres publié — dossier à examiner';
  }

  if (input.opportunityType === 'website_creation') {
    if (has('social_without_website')) {
      const names: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn' };
      const networks = Object.keys(f.socialLinks ?? {}).map((n) => names[n] ?? n);
      const where = networks.length > 0 ? networks.join(' et ') : 'les réseaux';
      return `Pas de site, mais une page ${where} active — proposer un site vitrine simple`;
    }
    if (has('website_placeholder')) return 'Domaine réservé, site jamais mis en ligne — proposer de le concrétiser';
    if (f.creationDate) {
      const when = formatDate(`${f.creationDate}T00:00:00Z`) ?? f.creationDate;
      return `Entreprise créée le ${when}, sans site — proposer un premier site`;
    }
    return 'Entreprise joignable, sans site — proposer un premier site simple';
  }

  if (input.opportunityType === 'ecommerce') {
    return 'Commerce de détail sans vente en ligne — proposer une boutique';
  }

  // Refonte et maintenance : le défaut le plus visible ouvre.
  if (has('website_broken') || has('website_found_down') || has('website_went_down')) {
    return f.httpStatus
      ? `Site en panne (erreur ${f.httpStatus}) — proposer une remise en ligne rapide`
      : 'Site en panne — proposer une remise en ligne rapide';
  }
  if (has('certificate_expired') || has('invalid_certificate')) {
    return f.hasSsl === false
      ? 'Site « Non sécurisé » et certificat cassé — proposer la remise en conformité, rapide'
      : 'Avertissement de sécurité à chaque visite — proposer la remise en conformité, rapide';
  }

  const proofs: string[] = [];
  if (has('stale_content') && f.copyrightYear) proofs.push(`figé en ${f.copyrightYear}`);
  if (has('outdated_stack') && f.techYear) proofs.push(`technologies de ${f.techYear}`);
  if (has('dated_platform') && f.cms) proofs.push(`fait sous ${f.cms}`);
  if (has('not_responsive')) proofs.push('illisible sur téléphone');
  if (has('slow_website') && f.ttfbMs) proofs.push(`${fr(f.ttfbMs / 1000)} s à répondre`);
  if (has('no_ssl')) proofs.push('sans HTTPS');
  const age = f.copyrightYear ? year - f.copyrightYear : f.techYear ? year - f.techYear : null;
  const verdict = age !== null && age >= 5 ? 'Site trop vieux' : proofs.length > 0 ? 'Site à reprendre' : 'Site à moderniser';
  const proposal = input.opportunityType === 'maintenance'
    ? 'proposer une remise à niveau'
    : 'proposer une refonte moderne';
  return proofs.length > 0
    ? `${verdict} — ${proofs.slice(0, 3).join(', ')} : ${proposal}`
    : `${verdict} : ${proposal}`;
}

export function explainOpportunity(input: ExplanationInput): Explanation {
  const signalKeys = input.needSignals
    .map((s) => s.signal)
    .sort((a, b) => sellingRank(a) - sellingRank(b));

  const described = signalKeys
    .map((key) => describeSignal(key, input.facts))
    .filter((line): line is string => line !== null);

  // Le fait déclencheur a sa propre section : le répéter dans « pourquoi »
  // alourdit sans rien apporter.
  const observations = signalKeys
    .filter((key) => key !== input.triggerType)
    .map((key) => describeSignal(key, input.facts))
    .filter((line): line is string => line !== null);

  // Le trait le plus contributif ouvre l'explication : c'est lui qui justifie
  // le type d'opportunité.
  const lead = observations[0] ?? described[0] ?? null;

  // La liste reste complète, même si sa première ligne ouvre aussi le
  // paragraphe : c'est le relevé vérifiable, et un relevé amputé de son
  // élément principal ne se relit pas. Ce qu'il ne faut pas, c'est deux
  // lignes disant la même chose — traité à la source, dans describeSignal.
  const signals = described;
  const others = (observations.length > 0 ? observations : described).slice(1, 3);

  // La note Google ouvre la situation quand elle est bonne : c'est la
  // preuve que le commerce marche, et donc que le défaut du site lui coûte.
  const acclaim = input.facts.googleRating && input.facts.googleReviews && input.facts.googleReviews >= 20
    ? `, ${fr(input.facts.googleRating)} sur Google avec ${input.facts.googleReviews} avis`
    : '';
  const situation = (input.city
    ? `${input.companyName}, ${input.industryLabel ? `${input.industryLabel.toLowerCase()} ` : ''}à ${input.city}`
    : input.companyName) + acclaim;

  const body = lead
    ? others.length > 0
      ? `${lead}. ${others.join('. ')}.`
      : `${lead}.`
    : '';

  // La réserve d'usage — « ces éléments ne disent pas que l'entreprise a
  // formulé ce besoin » — protège le freelance partout où le besoin est
  // déduit. Sur un appel d'offres elle serait fausse : l'acheteur a publié sa
  // demande lui-même. La servir quand même reviendrait à faire douter le
  // freelance du seul cas où il peut être certain.
  const declared = input.opportunityType === 'tender_response';

  const why = body
    ? declared
      ? `${situation}. ${body} L'acheteur a publié ce besoin lui-même : il n'y a rien à supposer `
        + `sur son intention, seulement un dossier à examiner.`
      : `${situation}. ${body} `
        // Formulation prudente, imposée : on ne prétend jamais savoir que
        // l'entreprise cherche un prestataire.
        + `Ces éléments rendent ${RELEVANCE[input.opportunityType]} pertinente. `
        // Formulation imposée : on ne prétend jamais savoir ce que le prospect veut.
        + `Ils ne disent pas que l'entreprise a formulé ce besoin.`
    : `${situation}.`;

  const caveats: string[] = [];
  if (input.confidenceScore < 0.75) {
    caveats.push('Informations partielles : à vérifier avant de contacter.');
  }
  // Sur un marché public, on dépose son offre sur la plateforme : l'absence de
  // téléphone n'est pas une lacune, c'est la procédure.
  if (!input.facts.phone && input.opportunityType !== 'tender_response') {
    caveats.push('Pas de téléphone connu : le contact devra passer par le formulaire du site.');
  }
  if (input.triggerType === 'bodacc_creation' && !input.facts.domain) {
    caveats.push("Entreprise très récente : il est possible qu'un site soit déjà en préparation.");
  }

  return {
    why,
    whyNow: buildWhyNow(input),
    angle: ANGLES[input.opportunityType](input.facts, signalKeys),
    signals,
    caveats,
    evidence: buildEvidence(input, signalKeys),
    headline: buildHeadline(input, signalKeys),
  };
}

const kb = (bytes: number): string => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.round(bytes / 1000)} Ko`;

/**
 * Les preuves, une par fait mesuré qui compte dans le dossier. Chaque ligne
 * se vérifie en ouvrant l'adresse indiquée ; la date est celle du scan.
 */
export function buildEvidence(input: ExplanationInput, keys: Iterable<string>): Evidence[] {
  const signalKeys = new Set(keys);
  const f = input.facts;
  const url = f.domain ? `https://${f.domain}/` : null;
  const at = f.observedAt ?? null;
  const out: Evidence[] = [];
  const add = (fact: string, value: string) => out.push({ fact, value, observedAt: at, sourceUrl: url });

  if (signalKeys.has('slow_ttfb') && f.performance?.ttfbMs != null) add('Temps avant la première réponse du serveur', `${(f.performance.ttfbMs / 1000).toFixed(1).replace('.', ',')} s`);
  if (signalKeys.has('slow_website') && f.ttfbMs != null) add('Temps de réponse du serveur', `${(f.ttfbMs / 1000).toFixed(1).replace('.', ',')} s`);
  if (signalKeys.has('render_blocking_scripts') && f.performance?.renderBlockingScripts != null) add('Scripts qui bloquent l’affichage', String(f.performance.renderBlockingScripts));
  if (signalKeys.has('heavy_scripts') && f.performance?.scriptCount != null) add('Scripts chargés par la page d’accueil', String(f.performance.scriptCount));
  if (signalKeys.has('heavy_page') && (f.performanceAudit?.totalBytes || f.performance?.htmlBytes)) add('Poids de la page d’accueil', kb(f.performanceAudit?.totalBytes || f.performance?.htmlBytes || 0));
  if (signalKeys.has('large_images') && f.performanceAudit?.largestImageBytes) out.push({ fact: 'Image la plus lourde', value: kb(f.performanceAudit.largestImageBytes), observedAt: at, sourceUrl: f.performanceAudit.largestImageUrl ?? url });
  if ((signalKeys.has('not_responsive')) ) add('Adaptation au mobile', 'aucune règle d’affichage mobile détectée');
  if (signalKeys.has('no_ssl') || signalKeys.has('invalid_certificate') || signalKeys.has('certificate_expired')) {
    add('Certificat de sécurité', f.tlsReason ? `${f.tlsReason}${f.tlsValidTo ? ` (valide jusqu’au ${f.tlsValidTo.slice(0, 10)})` : ''}` : f.hasSsl === false ? 'site servi sans HTTPS' : 'invalide');
  }
  if ((signalKeys.has('outdated_stack') || signalKeys.has('dated_platform')) && f.datedComponents?.length) {
    const oldest = [...f.datedComponents].sort((a, b) => a.year - b.year)[0]!;
    add('Composant le plus ancien', `${oldest.name} ${oldest.version} (${oldest.year})`);
  }
  if (signalKeys.has('stale_content') && f.copyrightYear) add('Année affichée en bas de page', String(f.copyrightYear));
  if (f.cms && (signalKeys.has('dated_platform') || signalKeys.has('obsolete_ecommerce_stack'))) add('Plateforme du site', f.cms);
  if ((signalKeys.has('website_broken') || signalKeys.has('website_found_down') || signalKeys.has('website_went_down')) && f.httpStatus != null) add('Réponse du serveur', `code ${f.httpStatus}`);
  if (signalKeys.has('website_placeholder')) add('Contenu du site', 'page d’attente ou domaine parké');
  if (signalKeys.has('domain_recently_registered') && f.domainRegisteredAt) add('Dépôt du nom de domaine', f.domainRegisteredAt.slice(0, 10));
  if (signalKeys.has('company_recently_created') && f.creationDate) add('Création de l’entreprise', f.creationDate.slice(0, 10));
  if (signalKeys.has('catalog_without_cart')) add('Vente en ligne', 'catalogue avec prix, sans panier ni paiement');
  return out;
}
