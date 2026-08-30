import Link from 'next/link';
import { Reveal } from '@/components/landing/reveal';

/**
 * Les blocs de la page d'accueil.
 *
 * Densité assumée : une page SaaS qui ne paraît pas vide compte une quinzaine
 * de sections, et chacune doit apporter une information NOUVELLE. Deux blocs
 * qui disent la même chose autrement produisent exactement la sensation de
 * remplissage qu'on cherche à éviter.
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
      {lead ? <p className="reasoning mt-4 text-muted-foreground">{lead}</p> : null}
    </Reveal>
  );
}

/**
 * Les chiffres du parc.
 *
 * Mesurés, pas estimés — c'est ce qui distingue ce bandeau d'un argumentaire.
 * Quatre nombres coûtent quatre lignes et remplacent trois paragraphes
 * d'adjectifs.
 */
export function Numbers() {
  const stats = [
    { n: '4 590 087', label: 'domaines .fr suivis' },
    { n: '18', label: 'points de contrôle par site' },
    { n: '5', label: 'registres publics croisés' },
    { n: '72 h', label: 'd’exclusivité par entreprise' },
  ];

  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 70}>
            <p className="tabular text-3xl font-semibold tracking-[-0.04em]">{stat.n}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * Le mécanisme, en quatre temps numérotés.
 *
 * La numérotation est ici légitime : c'est une vraie séquence, et l'ordre
 * porte une information dont le lecteur a besoin. Un développeur sceptique
 * veut savoir d'où viennent les entreprises avant de croire au reste.
 */
export function Mechanism() {
  const steps = [
    {
      title: 'Tu dis ce que tu fais',
      body: 'Refonte, création, e-commerce, application mobile, maintenance. Trois questions, une minute.',
    },
    {
      title: 'Le moteur balaie la nuit',
      body: 'Il ouvre les sites, lit le certificat, les versions des composants, le CSS, le temps de réponse. Puis il croise avec les registres publics.',
    },
    {
      title: 'Le gate écarte le reste',
      body: 'Pas de contact joignable, pas de fait daté, identité douteuse, entreprise déjà démarchée : l’opportunité n’entre pas en stock.',
    },
    {
      title: 'Cinq dossiers t’attendent',
      body: 'Le défaut, la preuve, ce qu’on ignore encore, et le numéro. Tu dis ce que ça a donné, l’entreprise sort du circuit.',
    },
  ];

  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionTitle eyebrow="Comment ça marche">
          Quatre étapes, dont trois que tu ne fais pas
        </SectionTitle>

        <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <li className="border-t pt-5">
                <span
                  className={`font-mono text-xs ${
                    index === 3 ? 'text-[var(--brand)]' : 'text-muted-foreground'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Une fonctionnalité développée, texte à gauche ou à droite.
 *
 * L'alternance est ce qui donne son rythme à une page dense : quatre sections
 * identiques se lisent comme un tableau, quatre sections alternées se lisent
 * comme un parcours.
 */
export function Feature({
  eyebrow,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16">
      <Reveal>
        <div className={flip ? 'lg:order-2' : ''}>
          <p className="field-label">{eyebrow}</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>

          <ul className="mt-6 space-y-2.5">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-sm">
                <span aria-hidden className="mt-[2px] text-[var(--brand)]">▸</span>
                <span className="leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className={flip ? 'lg:order-1' : ''}>{visual}</div>
      </Reveal>
    </div>
  );
}

/** Un extrait de sortie machine, tel qu'il apparaît dans le produit. */
export function Readout({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; value: string; flag?: boolean }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04)]">
      <p className="field-label border-b px-4 py-3">{title}</p>
      <div className="px-4 py-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline gap-4 border-b py-2.5 last:border-b-0">
            <span
              className={`w-24 shrink-0 font-mono text-[11px] ${
                row.flag ? 'text-[var(--finding)]' : 'text-muted-foreground'
              }`}
            >
              {row.key}
            </span>
            <span className="text-sm leading-snug">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** La grille de rattrapage : tout ce qui ne mérite pas sa propre section. */
export function AlsoGrid() {
  const items = [
    ['Cooldown automatique', 'Une entreprise qui a dit non ne revient pas avant six mois.'],
    ['Groupe témoin', 'Une opportunité sur cinq tirée au hasard, pour mesurer ce que le moteur apporte.'],
    ['Suivi des appels', 'Pas de réponse, intéressé, devis, client — en un clic.'],
    ['Opposition respectée', 'Une entreprise qui demande à ne plus être contactée sort de toute la chaîne.'],
    ['Filtres par secteur', 'Onze familles de métiers à exclure si elles ne t’intéressent pas.'],
    ['Aucune donnée nominative', 'Ni nom, ni e-mail de personne physique. Régime RGPD allégé.'],
    ['Détection de réseaux', 'Les enseignes qui partagent le site de la marque sont écartées.'],
    ['Fraîcheur pondérée', 'Un fait de la semaine pèse plus qu’un fait du trimestre.'],
  ];

  return (
    <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([title, body], i) => (
        <Reveal key={title} delay={i * 50}>
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/**
 * Le journal des versions.
 *
 * Quatre lignes datées, tirées du dépôt. Pour un produit jeune, c'est la
 * preuve la moins chère qu'il est vivant — et la seule qu'on puisse donner
 * quand on n'a pas encore de clients à citer.
 */
export function Changelog() {
  const entries = [
    ['30 août 2026', 'Le tableau de bord explique pourquoi la journée est vide'],
    ['30 août 2026', 'Inscription et paramétrage ramenés à trois questions'],
    ['29 août 2026', 'Contrôle du certificat TLS : expiration, émetteur, validité'],
    ['29 août 2026', 'Datation des composants — jQuery, Bootstrap, WordPress'],
  ];

  return (
    <div className="mt-10 max-w-2xl">
      {entries.map(([date, title]) => (
        <div key={title} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t py-3.5">
          <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{date}</span>
          <span className="text-sm">{title}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Les objections, telles qu'elles se posent vraiment.
 *
 * Un développeur sceptique se demande d'où viennent les données et si c'est
 * légal avant de se demander combien ça coûte. Les questions sont donc
 * formulées comme il se les pose, pas comme un moteur de recherche.
 */
export function Faq() {
  const questions = [
    [
      'D’où viennent les entreprises ?',
      'De registres publics français : SIRENE pour l’identité, BODACC pour les événements datés, AFNIC pour les 4,59 millions de .fr, BOAMP pour les marchés publics. Le contact vient du site de l’entreprise elle-même.',
    ],
    [
      'C’est légal ? Et le RGPD ?',
      'Aucune donnée nominative n’est collectée : ni nom, ni e-mail de personne physique. Le contact est un numéro d’entreprise ou un formulaire public. Une entreprise qui demande à ne plus être contactée sort définitivement de la chaîne.',
    ],
    [
      'C’est du spam automatisé ?',
      'Rien n’est envoyé pour toi. Le service livre des dossiers ; c’est toi qui décides d’appeler. Une entreprise n’est proposée qu’à une seule personne, et pas plus d’une fois par semestre.',
    ],
    [
      'Ça me prend combien de temps par jour ?',
      'Cinq dossiers se lisent en dix minutes. Chaque défaut annoncé se vérifie en ouvrant l’adresse du prospect — c’est le point : tu n’as pas à nous croire sur parole.',
    ],
    [
      'Et si les prospects ne correspondent pas à ma stack ?',
      'Tu choisis tes familles à l’inscription : refonte, création, e-commerce, application mobile, maintenance, SEO. Une opportunité hors de ta liste ne t’est jamais proposée, quel que soit son score.',
    ],
    [
      'Que se passe-t-il si rien ne justifie d’appeler ?',
      'Le service le dit au lieu de l’inventer. Une journée peut être vide, et le tableau de bord explique alors précisément ce qui a bloqué — stock épuisé, filtres trop serrés, ou entreprises déjà attribuées.',
    ],
  ];

  return (
    <div className="mt-12 max-w-3xl">
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
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{a}</p>
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
            La prospection, preuves à l’appui.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-70">
            Cinq dossiers demain matin. Chaque défaut annoncé se vérifie en ouvrant l’adresse.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--white)] px-7 py-3.5 text-sm font-medium text-[var(--ink)] transition-transform duration-200 hover:-translate-y-px"
            >
              Créer mon compte
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
