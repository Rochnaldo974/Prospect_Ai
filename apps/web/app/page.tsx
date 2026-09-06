import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';
import { EngineShow } from '@/components/landing/engine-show';
import { EmailShow } from '@/components/landing/email-show';
import { Feed } from '@/components/landing/feed';
import { TimeGain } from '@/components/landing/time-gain';
import { Reveal } from '@/components/landing/reveal';
import { SiteHeader } from '@/components/landing/site-header';
import { HeroBackdrop } from '@/components/landing/backdrop';

export const metadata: Metadata = {
  title: 'Prospect AI — l’outil indispensable des freelances du web',
  description:
    'Pour les développeurs web et mobile freelances : chaque matin, cinq entreprises françaises dont le site est à refaire ou à créer, avec ce qui cloche et le numéro pour en parler.',
};

/**
 * La page d'accueil.
 *
 * Les sections ne sont plus des boîtes. Un fond plat posé entre deux filets
 * découpe la page en rectangles empilés — c'est lisible, c'est partout, et
 * ça se voit. Les fonds teintés se fondent donc en dégradé sur leurs quinze
 * premiers pour cent, de sorte qu'aucune arête ne marque la frontière : le
 * lecteur sent un changement de sujet sans voir de trait.
 *
 * Quatre sections, et c'est une contrainte, pas un budget. La version
 * précédente en comptait onze et disait onze choses vraies — l'effet obtenu
 * n'était pas la richesse mais la fatigue : à la troisième section, le
 * lecteur avait déjà décidé, et les huit suivantes ne servaient qu'à lui
 * donner des occasions de partir.
 *
 * Un freelance décide sur trois questions, dans cet ordre :
 *
 *   reste-t-il du marché ?   → 53 % des sites analysés ont un défaut visible
 *   qu'est-ce que je reçois ? → un dossier, montré en taille réelle
 *   combien ça coûte ?        → 39 €
 *
 * Tout ce qui ne répond pas à l'une de ces trois questions est sorti :
 * la semaine de prospection en blocs de temps, le bandeau de quatre nombres,
 * le paramétrage, l'exclusivité en section propre, la FAQ. Ce qui comptait
 * là-dedans tient en une ligne, à l'endroit où la question se pose.
 */
export default async function HomePage() {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-dvh">
      <SiteHeader>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-semibold tracking-[-0.03em]">
            prospect<span className="text-[var(--brand)]">.ai</span>
          </Link>

          <nav className="flex items-center gap-4 text-sm sm:gap-6">
            {profile ? (
              <Link href="/dashboard" className="font-medium transition-opacity hover:opacity-70">
                Mes opportunités
              </Link>
            ) : (
              <>
                <Link href="/login" className="font-medium transition-opacity hover:opacity-70">
                  Connexion
                </Link>
                <Link
                  href="/signup"
                  className="whitespace-nowrap rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--white)] shadow-[0_6px_18px_-8px_rgba(11,13,20,.5)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_10px_24px_-8px_rgba(11,13,20,.55)] sm:px-5"
                >
                  {/* « gratuitement » n'apparaît qu'à partir de 640 px : en
                      dessous, le bouton passait sur deux lignes et cassait
                      toute la barre. */}
                  Essayer<span className="hidden sm:inline"> gratuitement</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </SiteHeader>

      <main>
        <Hero />
        <Audiences />
        <Engine />
        <TimeSaved />
        <EmailFeature />
        <Market />
        <Pricing />
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Le héros : la revendication, et le moteur qui la prouve à côté.
 *
 * Le titre revendique — « l'outil indispensable » — et tout ce qui suit le
 * gagne : le moteur tourne sous les yeux à droite, les chiffres mesurés en
 * dessous, et le reste de la page argumente. Une revendication qu'on prouve
 * dans la seconde n'est plus un slogan.
 */
function Hero() {
  const stagger = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <section className="relative">
      <HeroBackdrop />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 lg:pt-24">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p
              className="inline-flex items-center gap-2 rounded-full border bg-[var(--white)]/80 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur motion-safe:animate-[heroIn_.7s_cubic-bezier(.16,.84,.44,1)_both]"
            >
              Prospection pour freelances du web
            </p>

            <h1
              className="mt-6 max-w-[17ch] text-[clamp(2.5rem,5.2vw,4.25rem)] font-semibold leading-[0.99] tracking-[-0.05em] motion-safe:animate-[heroIn_.7s_cubic-bezier(.16,.84,.44,1)_both]"
              style={stagger(80)}
            >
              L’outil{' '}
              <span className="text-[var(--brand)]">indispensable</span>{' '}
              des freelances du web.
            </h1>

            <p
              className="reasoning mt-6 max-w-lg text-muted-foreground motion-safe:animate-[heroIn_.7s_cubic-bezier(.16,.84,.44,1)_both]"
              style={stagger(160)}
            >
              Notre moteur analyse des milliers de sites d’entreprises chaque nuit. Au matin,
              il vous livre cinq prospects approuvés, choisis pour vous — avec l’e-mail
              personnalisé prêt à envoyer.
            </p>

            <div
              className="mt-9 flex flex-wrap items-center gap-3 motion-safe:animate-[heroIn_.7s_cubic-bezier(.16,.84,.44,1)_both]"
              style={stagger(240)}
            >
              <Link
                href="/signup"
                className="group rounded-full bg-[var(--brand)] px-7 py-3.5 text-sm font-medium text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgba(44,75,255,.6)] active:translate-y-0 active:scale-[.98]"
              >
                Essayer gratuitement
                <span className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <Link
                href="#tarifs"
                className="rounded-full border bg-[var(--white)]/70 px-7 py-3.5 text-sm font-medium backdrop-blur transition-colors hover:bg-[var(--mist)]"
              >
                Voir les tarifs
              </Link>
            </div>

            <p
              className="mt-4 text-xs text-muted-foreground motion-safe:animate-[heroIn_.7s_cubic-bezier(.16,.84,.44,1)_both]"
              style={stagger(300)}
            >
              Dix minutes le matin, pas une journée par semaine. Sans carte bancaire.
            </p>

            {/* Le relevé du moteur. Chiffres mesurés en base, jamais arrondis
                vers le haut : leur précision EST l'argument. */}
            <div
              className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] text-muted-foreground motion-safe:animate-[heroIn_.7s_cubic-bezier(.16,.84,.44,1)_both]"
              style={stagger(380)}
            >
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full rounded-full bg-[var(--brand)] opacity-60 motion-safe:animate-ping [animation-duration:2.2s]" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--brand)]" />
              </span>
              <span>moteur en ligne</span>
              <span aria-hidden className="text-[var(--line)]">|</span>
              <span className="tabular">4 590 194 sites suivis</span>
              <span aria-hidden className="text-[var(--line)]">|</span>
              <span className="tabular">828 défauts détectés</span>
            </div>
          </div>

          <div className="motion-safe:animate-[heroCard_.9s_cubic-bezier(.16,.84,.44,1)_both]" style={stagger(200)}>
            <EngineShow />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Pour qui : les métiers du web, nommés. Un freelance doit se reconnaître
 * en une seconde — c'est une liste de miroirs, pas une liste de features.
 */
function Audiences() {
  const audiences = [
    ['Sites vitrine & refonte', 'Le plus grand marché : un site d’entreprise sur deux a un défaut visible.'],
    ['E-commerce', 'Les commerces qui vendent en boutique et pas encore en ligne.'],
    ['Applications web & mobile', 'Les entreprises qui mûrissent un outil ou une app.'],
    ['SEO & visibilité', 'Les sites invisibles sur Google, mesurablement.'],
    ['Automatisation & IA', 'Les process manuels qui attendent d’être outillés.'],
  ];

  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="field-label">Fait pour vous</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Quel que soit votre terrain de jeu
          </h2>
          <p className="reasoning mt-4 max-w-xl text-muted-foreground">
            À l’inscription, vous dites ce que vous faites. Le moteur ne vous propose que ça.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map(([title, body], i) => (
            <Reveal key={title} delay={i * 70}>
              <article className="h-full rounded-2xl border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(11,13,20,.25)]">
                <h3 className="font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            </Reveal>
          ))}
          <Reveal delay={350}>
            <Link
              href="/signup"
              className="grid h-full place-items-center rounded-2xl border border-dashed border-[var(--brand)]/40 bg-[var(--brand-wash)]/50 p-6 text-center transition-all duration-200 hover:-translate-y-1"
            >
              <span>
                <span className="block font-semibold tracking-tight text-[var(--brand)]">
                  Votre spécialité →
                </span>
                <span className="mt-1.5 block text-sm text-[var(--brand)]/75">
                  Trois questions à l’inscription, et le moteur travaille pour vous.
                </span>
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * Le moteur : la force du produit, argumentée en trois temps. C'est la
 * seule section « comment ça marche » — et chaque affirmation porte son
 * chiffre, parce que le lecteur est développeur.
 */
function Engine() {
  const arguments_ = [
    {
      title: 'Il analyse, chaque nuit',
      body: 'Dix-huit contrôles par site — réponse, sécurité, âge des composants, lisibilité mobile, vitesse — croisés avec les registres publics français.',
      figure: '18',
      caption: 'contrôles par site',
    },
    {
      title: 'Il n’approuve que le vérifiable',
      body: 'Pas de « site vieillissant » au jugé : un défaut daté, constaté, que vous pouvez vérifier en une minute avant d’appeler. Ce qu’il ignore, il l’écrit.',
      figure: '1 min',
      caption: 'pour vérifier chaque constat',
    },
    {
      title: 'Il choisit pour vous',
      body: 'Vos prestations, votre zone, vos exclusions : chaque dossier livré est un dossier que vous pouvez signer. Et il n’est livré qu’à vous — 72 h d’exclusivité.',
      figure: '5',
      caption: 'prospects approuvés par matin',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="field-label">Notre force</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
          Un moteur qui prospecte pendant que vous dormez
        </h2>
        <p className="reasoning mt-4 max-w-xl text-muted-foreground">
          La prospection n’est pas un carnet d’adresses, c’est un tri. Le moteur le fait en
          continu, à une échelle qu’aucun humain ne tient.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-x-8 gap-y-10 md:grid-cols-3">
        {arguments_.map((argument, i) => (
          <Reveal key={argument.title} delay={i * 90}>
            <article className="border-t pt-6">
              <p className="tabular font-mono text-4xl font-semibold tracking-tight text-[var(--brand)]">
                {argument.figure}
              </p>
              <p className="field-label mt-1">{argument.caption}</p>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{argument.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{argument.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * L'e-mail personnalisé : la moitié du travail d'approche, faite.
 */
function EmailFeature() {
  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <Reveal>
            <p className="field-label">Inclus dans le plan Solo</p>
            <h2 className="mt-4 max-w-xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
              L’e-mail personnalisé, prêt à envoyer
            </h2>
            <p className="reasoning mt-4 max-w-lg text-muted-foreground">
              Choisissez ce que vous proposez — un appel, un audit gratuit, une présentation —
              et le message s’écrit depuis les constats du dossier. Votre nom, votre logo,
              votre CV en pièce jointe. Un clic, c’est envoyé, et la réponse arrive dans
              votre boîte.
            </p>
            <ul className="mt-7 space-y-2.5">
              {[
                'Rédigé depuis les faits du dossier — jamais générique',
                'Signé à votre nom, avec votre logo',
                'Envoyé directement, réponses dans votre boîte mail',
              ].map((line) => (
                <li key={line} className="flex gap-3 text-sm">
                  <span aria-hidden className="text-[var(--brand)]">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100}>
            <EmailShow />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * Ce que le service livre, puis le temps que ça reprend.
 *
 * La marchandise d'abord, le bénéfice ensuite : un lecteur à qui l'on parle
 * d'heures gagnées avant de lui avoir montré ce qu'il achète n'a encore
 * aucune raison d'y croire.
 *
 * La liste dit COMBIEN il y en a ; le dossier de la section suivante dit à
 * quoi ressemble L'UN d'eux.
 */
function Market() {
  return (
    <section className="bg-[linear-gradient(180deg,var(--white)_0%,var(--mist)_14%,var(--mist)_86%,var(--white)_100%)]">
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-24">
        <Reveal>
          <p className="field-label">Concrètement</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Votre matinée type, en vrai
          </h2>
          <p className="reasoning mt-4 max-w-xl text-muted-foreground">
            Le travail de recherche est déjà fait quand vous vous levez. Il ne vous reste que la
            partie qui rapporte.
          </p>
        </Reveal>

        <Reveal>
          <Feed />
        </Reveal>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Cas réels, identités retirées, scores conformes au barème du moteur. 828 des 1 572
          sites d’entreprises françaises déjà analysés présentent au moins un défaut visible.
        </p>
      </div>
    </section>
  );
}

/**
 * Le temps repris.
 *
 * Cette place revenait au dossier grand format. Il montrait bien ce qu'on
 * achète, mais la liste juste au-dessus le montrait déjà — cinq fois, en
 * plus court. Deux sections pour dire « voilà une entreprise et son
 * problème » en faisaient une de trop.
 *
 * Ce qui manquait, à l'inverse, c'était la raison d'acheter : ce que le
 * lecteur récupère. Elle occupe donc la section entière plutôt qu'une carte
 * coincée sous la liste.
 */
function TimeSaved() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-24">
      <Reveal>
        <p className="field-label">Le temps que ça vous prend</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
          Récupérez une journée par semaine
        </h2>
        <p className="reasoning mt-4 max-w-xl text-muted-foreground">
          Chercher, trier, vérifier, rédiger : c’est la partie qui ne rapporte rien, et elle
          est déjà faite quand vous vous levez. Il vous reste les appels — et les réponses.
        </p>

        <TimeGain />
      </Reveal>
    </section>
  );
}

/**
 * Combien ça coûte, et les trois objections en une ligne chacune.
 *
 * Deux formules, parce qu'un studio ne s'inscrit pas sur une offre qui parle
 * de « développeur seul » — et parce qu'une seule ligne de prix laisse le
 * lecteur se demander ce qu'elle cache.
 */
function Pricing() {
  const plans = [
    {
      name: 'Solo',
      tag: 'Le plus pris',
      audience: 'Pour un développeur seul.',
      price: '39',
      features: [
        '5 entreprises par jour, choisies selon ce que vous savez faire',
        'Exclusives 72 h : personne d’autre ne les reçoit',
        'Suivi de vos appels, de vos devis et de vos clients',
        'Toute la France, tous les secteurs',
      ],
      featured: true,
    },
    {
      name: 'Atelier',
      audience: 'Pour un studio de deux à cinq personnes.',
      price: '89',
      features: [
        '12 entreprises par jour, réparties entre les membres',
        'Exclusivité à l’échelle du studio',
        'Suivi partagé et export des dossiers',
        'Toute la France, tous les secteurs',
      ],
      featured: false,
    },
  ];

  const answers = [
    ['C’est légal ?', 'Aucune donnée personnelle n’est collectée. Le numéro est celui que l’entreprise publie.'],
    ['C’est du démarchage automatique ?', 'Rien n’est envoyé à votre place. Vous décidez d’appeler, et quoi dire.'],
    ['Et si ça ne me correspond pas ?', 'Vous choisissez vos prestations. Le reste ne vous est jamais proposé.'],
  ];

  return (
    <section
      id="tarifs"
      className="scroll-mt-24 bg-[linear-gradient(180deg,var(--white)_0%,var(--mist)_12%,var(--mist)_100%)]"
    >
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        <Reveal>
          <p className="field-label">Tarifs</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Sans engagement, sans palier caché.
          </h2>
          <p className="reasoning mt-4 max-w-xl text-muted-foreground">
            Le nombre de places est limité : une entreprise n’est proposée qu’à une seule
            personne, et il en sort un nombre fini chaque jour.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 90}>
              <article
                className={`flex h-full flex-col rounded-2xl border bg-card p-8 ${
                  plan.featured
                    ? 'border-[var(--brand)] shadow-[0_1px_2px_rgba(11,13,20,.04),0_28px_64px_-32px_rgba(44,75,255,.32)]'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                  {plan.tag ? (
                    <span className="rounded-full bg-[var(--brand-wash)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brand)]">
                      {plan.tag}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.audience}</p>

                <p className="mt-7 flex items-baseline gap-1.5">
                  <span className="tabular text-5xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">€ / mois</span>
                </p>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm">
                      <span aria-hidden className="text-[var(--brand)]">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-9 rounded-full px-6 py-3.5 text-center text-sm font-medium transition-transform duration-200 hover:-translate-y-px ${
                    plan.featured
                      ? 'bg-[var(--brand)] text-white shadow-[0_10px_28px_-10px_rgba(44,75,255,.55)] hover:shadow-[0_14px_34px_-10px_rgba(44,75,255,.6)]'
                      : 'border hover:bg-[var(--white)]'
                  }`}
                >
                  Essayer gratuitement
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        {/* La marche d'entrée : le gratuit dit « jugez sur pièce » — un vrai
            dossier par semaine, le même que celui des payants. Une offre
            d'essai qui n'expire pas vaut mieux qu'un essai de 14 jours :
            elle laisse le produit faire ses preuves à son rythme. */}
        <Reveal>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-5">
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Gratuit — un dossier par semaine
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Le même dossier complet que les plans payants. Pour juger sur pièce, sans
                carte et sans limite de durée.
              </p>
            </div>
            <Link
              href="/signup"
              className="rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
            >
              Commencer gratuitement
            </Link>
          </div>
        </Reveal>

        <p className="mt-6 text-xs text-muted-foreground">
          Sans carte bancaire à l’inscription. Trois questions, une minute. Tarifs indicatifs
          pendant le lancement.
        </p>

        <div className="mt-16 grid gap-x-12 gap-y-0 border-t pt-4 md:grid-cols-3">
          {answers.map(([question, answer]) => (
            <div key={question} className="py-5">
              <p className="text-sm font-medium">{question}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
            </div>
          ))}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Le détail du traitement des données est sur la{' '}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
            page Confidentialité
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/** Le pied de page. */
function SiteFooter() {
  return (
    <footer className="border-t bg-[var(--mist)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-10">
        <span className="text-lg font-semibold tracking-[-0.03em]">
          prospect<span className="text-[var(--brand)]">.ai</span>
        </span>

        <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <Link href="/confidentialite" className="transition-colors hover:text-foreground">
            Confidentialité
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Connexion
          </Link>
          <span className="text-xs">Aucune donnée nominative collectée</span>
        </div>
      </div>
    </footer>
  );
}
