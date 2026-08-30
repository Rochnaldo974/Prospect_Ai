import Link from 'next/link';
import { Reveal } from '@/components/landing/reveal';

/**
 * Les blocs communs de la page d'accueil.
 *
 * Ce fichier a maigri : il portait neuf composants, dont six n'étaient que
 * des variantes de « titre suivi d'une grille de cartes ». C'est précisément
 * ce qui donnait à la page son air de formulaire. Chaque section a désormais
 * sa forme propre, dans son propre fichier ; ne restent ici que les trois
 * pièces réellement partagées.
 *
 * Trois interdits tenus partout : aucun paragraphe au-delà de quarante-cinq
 * mots, aucun superlatif sans chiffre, aucun point d'exclamation.
 */

/** Titre de section. Toujours court, toujours déclaratif. */
export function SectionTitle({
  eyebrow,
  children,
  lead,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  lead?: string;
}) {
  return (
    <Reveal>
      {eyebrow ? <p className="field-label">{eyebrow}</p> : null}
      <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
        {children}
      </h2>
      {lead ? <p className="reasoning mt-4 max-w-xl text-muted-foreground">{lead}</p> : null}
    </Reveal>
  );
}

/**
 * Les objections, telles qu'elles se posent vraiment.
 *
 * Les réponses ne citent plus aucun registre par son sigle. Le lecteur ne
 * demande pas d'où vient la donnée au sens technique : il demande si c'est
 * du sérieux, si c'est légal, et si ça va lui coûter du temps.
 */
export function Faq() {
  const questions = [
    [
      'D’où viennent ces entreprises ?',
      'Ce sont des entreprises françaises réelles, repérées à partir d’informations publiques et de leur propre site. Le numéro affiché est celui qu’elles publient elles-mêmes.',
    ],
    [
      'C’est légal ?',
      'Oui. Aucune donnée personnelle n’est collectée : ni nom, ni prénom, ni adresse e-mail de personne. Le contact est un numéro d’entreprise ou un formulaire public. Une entreprise qui demande à ne plus être contactée est retirée définitivement.',
    ],
    [
      'C’est du démarchage automatique ?',
      'Non. Rien n’est envoyé à votre place. Le service prépare le travail ; c’est vous qui décidez d’appeler, et vous qui choisissez quoi dire.',
    ],
    [
      'Ça me prend combien de temps par jour ?',
      'Dix minutes le matin. Chaque problème annoncé se vérifie en ouvrant l’adresse du site : vous n’avez pas à nous croire sur parole.',
    ],
    [
      'Et si ça ne correspond pas à ce que je fais ?',
      'Vous choisissez vos prestations à l’inscription — refonte, création, e-commerce, application mobile, maintenance, référencement. Une entreprise en dehors de vos choix ne vous est jamais proposée.',
    ],
    [
      'Et si vous n’avez rien à me proposer un jour ?',
      'On vous le dit au lieu d’inventer une urgence. Le tableau de bord explique alors ce qui a manqué, et comment y remédier — élargir une zone, rouvrir une prestation.',
    ],
  ];

  return (
    <div className="mt-12 grid gap-x-14 md:grid-cols-2">
      {questions.map(([q, a]) => (
        <details key={q} className="group border-t py-4">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 text-sm font-medium">
            {q}
            <span
              aria-hidden
              className="shrink-0 font-mono text-muted-foreground transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}

/** L'appel final : écho du héros, mêmes boutons, aucune information nouvelle. */
export function FinalCall() {
  return (
    <section className="border-t bg-[var(--ink)] text-[var(--white)]">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Demain matin, cinq entreprises vous attendent.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-70">
            Trois questions pour commencer. Vous verrez vos premiers dossiers dans la foulée.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--white)] px-7 py-3.5 text-sm font-medium text-[var(--ink)] transition-transform duration-200 hover:-translate-y-px"
            >
              Essayer gratuitement
            </Link>
            <Link
              href="#tarifs"
              className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>
          <p className="mt-5 text-xs opacity-55">
            Sans carte bancaire. Paramétrage en trois questions.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
