import type { TodayOpportunity } from './today';

/**
 * Le brouillon d'e-mail de prospection, généré depuis le dossier.
 *
 * Parti pris : l'e-mail part de la MESSAGERIE DU FREELANCE, jamais de nos
 * serveurs. Trois raisons, chacune suffisante. La délivrabilité — un
 * message envoyé depuis sa vraie adresse, avec son historique, passe ;
 * le même envoyé par un domaine mutualisé de SaaS finit en spam. Le
 * droit — c'est SA prospection, sous son nom, vers une adresse générique
 * d'entreprise : le régime B2B français l'autorise, et nous n'avons rien
 * à détenir. L'infrastructure — rien à héberger, rien à réchauffer.
 *
 * Le texte suit la règle du produit : des faits, pas des adjectifs. Le
 * constat vient du dossier, la proposition de l'angle calculé, et le tout
 * tient en six phrases — un dirigeant ne lit pas plus, et un e-mail court
 * qui pose une question obtient plus de réponses qu'une plaquette.
 */

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
): EmailDraft {
  const { company, explanation } = opportunity;
  const firstFact = explanation.signals[0];

  const lines: string[] = [];
  lines.push('Bonjour,');
  lines.push('');

  // Le constat d'abord : c'est la seule chose qu'un inconnu ne peut pas
  // ignorer, parce qu'elle parle de LUI et qu'elle se vérifie.
  if (firstFact) {
    lines.push(
      `En préparant une étude sur les sites de ${company.city ?? 'votre secteur'}, `
      + `j'ai remarqué un point concernant ${company.name} : `
      + `${firstFact.charAt(0).toLowerCase()}${firstFact.slice(1)}.`,
    );
  } else {
    lines.push(
      `Je me suis penché sur la présence en ligne de ${company.name}, et un point m'a interpellé.`,
    );
  }
  lines.push('');

  // La proposition, depuis l'angle du moteur — une phrase, pas une plaquette.
  lines.push(explanation.angle);
  lines.push('');

  // La question ouverte : elle appelle une réponse courte, pas un engagement.
  lines.push('Est-ce un sujet dont vous aimeriez parler dix minutes cette semaine ?');
  lines.push('');
  // La formule seule : la signature — nom, métier, logo, coordonnées — est
  // ajoutée par l'identité d'expéditeur au rendu, pas par le brouillon.
  lines.push('Bien à vous,');

  return {
    subject: (SUBJECTS[opportunity.type] ?? SUBJECTS.other!)(company.city),
    body: lines.join('\n'),
  };
}
