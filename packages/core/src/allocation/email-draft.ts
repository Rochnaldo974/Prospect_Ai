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

/** L'accroche de secours : sans fiche rédigée, le premier fait, poliment, en une phrase. */
function fallbackHook(opportunity: Pick<TodayOpportunity, 'company' | 'explanation'>): string {
  const { company, explanation } = opportunity;
  const fact = explanation.signals[0];
  return fact
    ? `En regardant le site de ${company.name}, j’ai remarqué que ${sentence(lower(fact))}`
    : `En regardant la présence de ${company.name} sur internet, un point m’a semblé mériter un échange.`;
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

  // Le problème, la proposition, la demande : trois phrases, pas plus. Ce
  // qui suit change seulement la demande, selon ce que le freelance veut.
  switch (intent) {
    case 'audit':
      if (options.auditUrl) {
        // L'audit existe déjà : on le donne, on ne le promet pas.
        lines.push(`${proposal} J’ai résumé ce que j’ai vu sur cette page, à lire en deux minutes :`, '', options.auditUrl);
      } else {
        lines.push(`${proposal} Je peux d’abord vous envoyer un court état des lieux de votre site, sans engagement.`, '', 'Souhaitez-vous que je vous l’envoie ?');
      }
      break;

    case 'intro':
      lines.push(hasCv ? `${proposal} Mon CV est joint à ce message.` : proposal);
      lines.push('', 'Si le sujet vous parle, je suis joignable au moment qui vous arrange.');
      break;

    default:
      lines.push(proposal, '', 'Auriez-vous dix minutes cette semaine pour en parler ?');
  }

  lines.push('', 'Bien à vous,');

  return {
    subject: written?.subject ?? (SUBJECTS[opportunity.type] ?? SUBJECTS.other!)(opportunity.company.city),
    body: lines.join('\n'),
  };
}
