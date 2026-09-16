import type { TodayOpportunity } from './today';

/**
 * Les brouillons d'e-mail de prospection, générés depuis le dossier.
 *
 * Retour du propriétaire sur les premiers e-mails réels : un commerçant ne
 * comprend pas « audit centré sur le passage en HTTPS », et un message qui
 * ne dit pas qui écrit part à la corbeille. Chaque brouillon a donc la même
 * colonne vertébrale, dans cet ordre :
 *
 *   Bonjour,
 *   Je suis <nom>, <métier> à <ville>. <sa courte présentation>
 *   <comment on est tombé sur le commerce, ce qu'un client voit>
 *   <ce qu'on propose, selon l'intention>
 *   Bien à vous,
 *
 * Le milieu — l'accroche et la proposition — vient de la fiche rédigée par
 * Claude quand elle existe : c'est elle qui sait parler à un boulanger de
 * son site sans un mot technique. Sans fiche, un texte de secours prend le
 * relais, sobre et sans jargon lui aussi.
 *
 * Parti pris inchangé : l'e-mail part sous le nom du freelance, la
 * signature — nom, métier, logo — est ajoutée au rendu par son identité.
 */

export type EmailIntent = 'call' | 'audit' | 'intro';

export const EMAIL_INTENTS: Array<{ id: EmailIntent; label: string; hint: string }> = [
  { id: 'call', label: 'Proposer un appel', hint: 'Dix minutes cette semaine, sans engagement.' },
  { id: 'audit', label: 'Offrir un audit', hint: 'Ce qu’un client voit sur son site, en quelques points simples.' },
  { id: 'intro', label: 'Me présenter', hint: 'Qui vous êtes, avec votre CV en pièce jointe.' },
];

export interface EmailDraft {
  subject: string;
  body: string;
}

/** Qui écrit : ce que le freelance a mis dans sa signature, et sa ville. */
export interface DraftSender {
  name: string;
  title: string;
  city?: string | null;
  presentation?: string;
}

export interface DraftOptions {
  hasCv?: boolean;
  /** Le métier seul — l'ancien chemin. `sender` le remplace quand il est fourni. */
  title?: string;
  auditUrl?: string | null;
  sender?: DraftSender;
}

const SUBJECTS: Record<string, (city: string | null) => string> = {
  website_redesign: () => 'À propos de votre site',
  website_creation: (city) => city ? `Vous trouver sur internet à ${city}` : 'Vous trouver sur internet',
  ecommerce: () => 'Vendre en ligne, une question',
  mobile_application: () => 'Votre application mobile',
  web_application: () => 'Votre outil de travail en ligne',
  seo: () => 'Être trouvé sur Google',
  maintenance: () => 'Votre site au quotidien',
  ai_automation: () => 'Vous faire gagner du temps',
  tender_response: () => 'Votre marché public en cours',
  other: () => 'Votre présence sur internet',
};

/** Ce qu'on propose, dit sans un mot technique, quand aucune fiche n'a été rédigée. */
const PROPOSALS: Record<string, string> = {
  website_redesign: 'Je peux remettre votre site au niveau de ce que vos clients attendent aujourd’hui : lisible sur téléphone, rapide à ouvrir, et rassurant dès la première seconde.',
  website_creation: 'Je peux vous faire un site simple, qui dit qui vous êtes, où vous êtes et comment vous joindre — et qui s’affiche bien sur téléphone, là où vos clients vous cherchent.',
  ecommerce: 'Je peux vous aider à vendre en ligne sans que ça devienne une usine à gaz : une boutique simple, que vous mettez à jour vous-même.',
  mobile_application: 'Je peux vous faire une application simple pour vos clients, pensée pour ce qu’ils font vraiment avec vous.',
  web_application: 'Je peux vous faire un outil sur mesure pour votre quotidien, qui remplace les fichiers et les papiers que vous refaites à la main.',
  seo: 'Je peux faire en sorte que vos clients vous trouvent quand ils cherchent ce que vous faites, dans votre ville.',
  maintenance: 'Je peux m’occuper de votre site au quotidien : les petites mises à jour, les pannes, ce qui vous fait perdre du temps.',
  ai_automation: 'Je peux vous faire gagner du temps sur ce que vous refaites chaque jour : devis, relances, prises de rendez-vous.',
  tender_response: 'Je peux vous accompagner sur ce marché, du dossier à la mise en ligne.',
  other: 'Je peux vous aider à mettre votre présence en ligne au niveau de ce que vos clients attendent.',
};

const lower = (text: string): string => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const sentence = (text: string): string => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** « Je suis Eliott Roche, développeur web indépendant à Angers. » puis sa présentation. */
function introduction(options: DraftOptions): string {
  const sender = options.sender;
  const title = (sender?.title ?? options.title ?? '').trim() || 'développeur web indépendant';
  const who = sender?.name?.trim() ? `Je suis ${sender.name.trim()}, ${lower(title)}` : `Je suis ${lower(title)}`;
  const where = sender?.city?.trim() ? ` à ${sender.city.trim()}` : '';
  const presentation = sender?.presentation?.trim();
  return presentation ? `${who}${where}. ${sentence(presentation)}` : `${who}${where}.`;
}

/** L'accroche de secours : sans fiche rédigée, on situe la rencontre et on cite le fait. */
function fallbackHook(opportunity: Pick<TodayOpportunity, 'company' | 'explanation'>): string {
  const { company, explanation } = opportunity;
  const trade = company.industry?.trim() ? lower(company.industry.trim()) : null;
  const where = company.city ? ` à ${company.city}` : '';
  const met = trade
    ? `En regardant les ${trade}s${where} présents sur internet, je suis arrivé sur ${company.name}.`
    : `En regardant les commerces${where} présents sur internet, je suis arrivé sur ${company.name}.`;
  const fact = explanation.signals[0];
  return fact ? `${met} Une chose m’a frappé : ${sentence(lower(fact))}` : `${met} Une chose m’a frappé en ouvrant votre site.`;
}

export function draftProspectingEmail(
  opportunity: Pick<TodayOpportunity, 'type' | 'company' | 'explanation'>,
  intent: EmailIntent = 'call',
  options: DraftOptions = {},
): EmailDraft {
  const { explanation } = opportunity;
  const written = explanation.email;
  const hook = written?.hook ?? fallbackHook(opportunity);
  const proposal = written?.proposal ?? PROPOSALS[opportunity.type] ?? PROPOSALS.other!;
  const hasCv = options.hasCv === true;

  const lines: string[] = ['Bonjour,', '', introduction(options), '', hook, ''];

  switch (intent) {
    case 'audit':
      if (options.auditUrl) {
        // L'audit existe déjà : on le donne, on ne le promet pas. Un lien
        // qu'on peut ouvrir vaut mieux qu'une offre à accepter.
        lines.push(
          'J’ai regardé votre site comme le ferait un client, et j’ai noté ce qu’il voit, '
          + 'en quelques points simples, sur cette page :',
          '',
          options.auditUrl,
          '',
          'Ça se lit en deux minutes, et vous pouvez tout vérifier vous-même. Si une question vous vient en le lisant, je suis joignable.',
        );
      } else {
        lines.push(
          'Si vous le souhaitez, je vous envoie ce que j’ai noté en regardant votre site comme le ferait un client : '
          + 'trois points simples, que vous pourrez vérifier vous-même. C’est offert, sans engagement.',
          '',
          'Voulez-vous que je vous l’envoie ?',
        );
      }
      break;

    case 'intro':
      lines.push(proposal);
      if (hasCv) lines.push('', 'Mon CV est joint à ce message, si vous voulez voir ce que j’ai déjà fait.');
      lines.push('', 'Si le sujet vous parle, on en discute au moment qui vous arrange.');
      break;

    default:
      lines.push(
        proposal,
        '',
        'Si vous avez dix minutes cette semaine, je vous explique ça de vive voix, sans engagement. Quel moment vous arrangerait ?',
      );
  }

  lines.push('', 'Bien à vous,');

  return {
    subject: written?.subject ?? (SUBJECTS[opportunity.type] ?? SUBJECTS.other!)(opportunity.company.city),
    body: lines.join('\n'),
  };
}
