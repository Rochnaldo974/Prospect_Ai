import type { TodayOpportunity } from './today';

/**
 * Les brouillons d'e-mail de prospection, générés depuis le dossier.
 *
 * L'utilisateur choisit d'abord son INTENTION — proposer un appel, offrir
 * un audit, se présenter — et le texte suit. Trois intentions, trois
 * registres, une même colonne vertébrale : le constat du dossier en
 * ouverture (la seule chose qu'un inconnu ne peut pas ignorer, parce
 * qu'elle parle de lui et se vérifie), la proposition, une question courte.
 *
 * Parti pris inchangé : l'e-mail part sous le nom du freelance, la
 * signature — nom, métier, logo — est ajoutée au rendu par son identité.
 * Six phrases maximum : un dirigeant ne lit pas une plaquette.
 */

export type EmailIntent = 'call' | 'audit' | 'intro';

export const EMAIL_INTENTS: Array<{ id: EmailIntent; label: string; hint: string }> = [
  { id: 'call', label: 'Proposer un appel', hint: 'Dix minutes cette semaine, sans engagement.' },
  { id: 'audit', label: 'Offrir un audit', hint: 'Trois constats concrets, envoyés gratuitement.' },
  { id: 'intro', label: 'Me présenter', hint: 'Qui vous êtes, avec votre CV en pièce jointe.' },
];

export interface EmailDraft {
  subject: string;
  body: string;
}

const SUBJECTS: Record<string, (city: string | null) => string> = {
  website_redesign: () => 'À propos de votre site web',
  website_creation: (city) => city ? `Votre présence en ligne à ${city}` : 'Votre présence en ligne',
  ecommerce: () => 'Vendre en ligne — une question',
  mobile_application: () => 'Votre application mobile',
  web_application: () => 'Votre outil web',
  seo: () => 'Votre visibilité sur Google',
  maintenance: () => 'La maintenance de votre site',
  ai_automation: () => 'Automatiser une partie de votre quotidien',
  tender_response: () => 'Votre marché public en cours',
  other: () => 'Votre présence en ligne',
};

export function draftProspectingEmail(
  opportunity: Pick<TodayOpportunity, 'type' | 'company' | 'explanation'>,
  intent: EmailIntent = 'call',
  options: { hasCv?: boolean; title?: string } = {},
): EmailDraft {
  const { company, explanation } = opportunity;
  const firstFact = explanation.signals[0];

  // L'ouverture commune : le constat, formulé comme une observation de
  // passage — pas comme un rapport de surveillance.
  const opening = firstFact
    ? `En préparant une étude sur les sites de ${company.city ?? 'votre secteur'}, `
      + `j'ai remarqué un point concernant ${company.name} : `
      + `${firstFact.charAt(0).toLowerCase()}${firstFact.slice(1)}.`
    : `Je me suis penché sur la présence en ligne de ${company.name}, et un point m'a interpellé.`;

  const lines: string[] = ['Bonjour,', '', opening, ''];

  switch (intent) {
    case 'audit':
      // L'offre : un livrable concret et gratuit — la réciprocité avant la
      // vente, et une promesse assez petite pour être crédible.
      lines.push(
        'Si le sujet vous intéresse, je peux vous envoyer un court audit — trois constats '
        + 'concrets et vérifiables sur votre site, avec ce que chacun coûte à vos visiteurs. '
        + 'Gratuit, sans engagement.',
      );
      lines.push('');
      lines.push('Voulez-vous que je vous l’envoie ?');
      break;

    case 'intro': {
      const role = options.title?.trim() || 'développeur web indépendant';
      lines.push(
        `Je suis ${role.charAt(0).toLowerCase()}${role.slice(1)}, et j'accompagne des `
        + `entreprises comme la vôtre sur exactement ce type de sujet`
        + `${options.hasCv ? ' — mon CV est joint à ce message' : ''}.`,
      );
      lines.push('');
      lines.push(explanation.angle);
      lines.push('');
      lines.push('Seriez-vous ouvert à un échange, au moment qui vous arrange ?');
      break;
    }

    default:
      lines.push(explanation.angle);
      lines.push('');
      lines.push('Est-ce un sujet dont vous aimeriez parler dix minutes cette semaine ?');
  }

  lines.push('', 'Bien à vous,');

  return {
    subject: (SUBJECTS[opportunity.type] ?? SUBJECTS.other!)(company.city),
    body: lines.join('\n'),
  };
}
