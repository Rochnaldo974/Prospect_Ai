import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';
import { MorningShow } from '@/components/landing/morning-show';
import { EmailShow } from '@/components/landing/email-show';
import { Feed } from '@/components/landing/feed';
import { TimeGain } from '@/components/landing/time-gain';
import { Reveal } from '@/components/landing/reveal';
import { SiteHeader } from '@/components/landing/site-header';
import { HeroBackdrop } from '@/components/landing/backdrop';
import { Glow } from '@/components/landing/glow';

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
            <Link href="#moteur" className="hidden text-muted-foreground transition-colors hover:text-foreground lg:inline">
              Le moteur
            </Link>
            <Link href="#temps" className="hidden text-muted-foreground transition-colors hover:text-foreground lg:inline">
              Le temps gagné
            </Link>
            <Link href="#tarifs" className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline">
              Tarifs
            </Link>
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
        <Engine />
        <TimeSaved />
        <EmailFeature />
        <Market />
        <Pricing />
        <FinalCall />
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
              Quinze minutes le matin, pas trois heures. Sans carte bancaire.
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
            <MorningShow />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Le moteur : deux colonnes — la revendication reste en vue à gauche
 * pendant que les étapes défilent à droite. La version précédente calait
 * tout dans une colonne étroite : la moitié droite de l'écran restait
 * déserte, et la section semblait inachevée.
 */
function Engine() {
  const steps = [
    {
      title: 'Chaque nuit, il analyse',
      body: 'Le moteur parcourt les sites d’entreprises françaises pendant que vous dormez : est-ce que le site répond, est-il sûr, lisible sur téléphone, à jour, rapide.',
    },
    {
      title: 'Il ne garde que le prouvable',
      body: 'Pas de « site vieillissant » au jugé. Un défaut daté, constaté, que vous pouvez vérifier vous-même avant d’appeler — et ce que le moteur ignore, il l’écrit.',
    },
    {
      title: 'Il choisit selon votre métier',
      body: 'Vos prestations, votre zone, vos exclusions : chaque dossier livré est un dossier que vous pouvez signer. Et il n’est livré qu’à vous.',
      trades: ['Sites vitrine & refonte', 'E-commerce', 'Apps web & mobile', 'SEO & visibilité', 'Automatisation & IA'],
    },
  ];

  return (
    <section id="moteur" className="relative scroll-mt-20 overflow-hidden">
      <Glow className="-right-40 -top-32 size-[34rem]" />
      <Glow tint="finding" className="-bottom-40 -left-48 size-[28rem]" />
      <div className="relative mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="field-label">Notre force</p>
            <h2 className="mt-4 text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
              Un moteur qui prospecte pendant que vous dormez
            </h2>
            <p className="reasoning mt-5 max-w-md text-muted-foreground">
              La prospection n’est pas un carnet d’adresses, c’est un tri. Le moteur le fait en
              continu, à une échelle qu’aucun humain ne tient — et il vous en rend compte.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
            >
              Le voir travailler pour vous →
            </Link>
          </Reveal>
        </div>

        <ol className="relative space-y-10">
          <span aria-hidden className="absolute bottom-6 left-[1.3125rem] top-6 w-px bg-[var(--line)]" />
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              <li className="relative flex gap-6">
                <span className="tabular relative z-10 grid size-11 shrink-0 place-items-center rounded-full border bg-card font-mono text-sm font-medium text-[var(--brand)]">
                  {i + 1}
                </span>
                <div className="pt-1.5">
                  <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                  {step.trades ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {step.trades.map((trade, j) => (
                        <Reveal key={trade} delay={200 + j * 80}>
                          <span className="inline-block rounded-full border bg-card px-3.5 py-1.5 text-[13px] transition-colors hover:border-[var(--brand)]/40 hover:bg-[var(--brand-wash)] hover:text-[var(--brand)]">
                            {trade}
                          </span>
                        </Reveal>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * L'e-mail personnalisé : la moitié du travail d'approche, faite.
 */
function EmailFeature() {
  return (
    <section className="relative overflow-hidden border-y bg-[var(--mist)]">
      <Glow className="-right-32 top-1/2 size-[32rem] -translate-y-1/2" />
      <div className="relative mx-auto max-w-6xl px-6 py-24">
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
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,var(--white)_0%,var(--mist)_14%,var(--mist)_86%,var(--white)_100%)]">
      <Glow className="-top-24 right-1/4 size-[26rem]" />
      <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-24">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <Reveal>
            <p className="field-label">Concrètement</p>
            <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
              Votre matinée type, en vrai
            </h2>
            <p className="reasoning mt-4 max-w-xl text-muted-foreground">
              Le travail de recherche est déjà fait quand vous vous levez. Il ne vous reste que
              la partie qui rapporte.
            </p>
          </Reveal>

          {/* Les trois règles du lot, en repères : elles occupaient l'air. */}
          <Reveal delay={100}>
            <div className="flex flex-wrap gap-2.5">
              {[['5', 'par matin'], ['72 h', 'd’exclusivité'], ['8 h 00', 'heure de livraison']].map(([n, label]) => (
                <span key={label} className="rounded-full border bg-card px-4 py-2 text-[13px]">
                  <span className="tabular font-mono font-semibold text-[var(--brand)]">{n}</span>{' '}
                  <span className="text-muted-foreground">{label}</span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>

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
 * Le temps repris. Le reçu du calcul occupe la droite de l'en-tête — le
 * détail honnête, posé là où il se vérifie d'un œil, au lieu d'une moitié
 * d'écran vide au-dessus du tableau.
 */
function TimeSaved() {
  const manual: Array<[string, string]> = [
    ['Chercher des candidates', '45 min'],
    ['Évaluer leurs sites', '1 h 00'],
    ['Retrouver les contacts', '25 min'],
    ['Rédiger cinq e-mails', '1 h 15'],
  ];
  const withTool: Array<[string, string]> = [
    ['Lire cinq dossiers prêts', '10 min'],
    ['Envoyer les e-mails prêts', '5 min'],
  ];

  return (
    <section id="temps" className="relative scroll-mt-20 overflow-hidden">
      <Glow tint="finding" className="-left-40 top-10 size-[26rem]" />
      <Glow className="-right-44 bottom-0 size-[30rem]" />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24">
        <div className="grid items-end gap-x-16 gap-y-10 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <p className="field-label">Le temps que ça vous prend</p>
            <h2 className="mt-4 max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
              Cinq entreprises prospectées en 15 minutes
            </h2>
            <p className="reasoning mt-4 max-w-xl text-muted-foreground">
              À la main, prospecter cinq entreprises prend l’après-midi. Ici, tout est prêt au
              réveil — il reste un quart d’heure, et c’est la partie qui rapporte.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(11,13,20,.04)]">
              <p className="field-label">Le compte, pour 5 entreprises</p>

              <div className="mt-4 flex items-baseline justify-between gap-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--finding)' }}>À la main</p>
                <p className="tabular font-mono text-sm font-semibold" style={{ color: 'var(--finding)' }}>3 h 30</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {manual.map(([label, time]) => (
                  <p key={label} className="flex items-baseline gap-2 text-[13px] text-muted-foreground">
                    <span>{label}</span>
                    <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-[var(--line)]" />
                    <span className="tabular font-mono">{time}</span>
                  </p>
                ))}
              </div>

              <div className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
                <p className="text-sm font-semibold text-[var(--brand)]">Avec Prospect AI</p>
                <p className="tabular font-mono text-sm font-semibold text-[var(--brand)]">15 min</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {withTool.map(([label, time]) => (
                  <p key={label} className="flex items-baseline gap-2 text-[13px] text-muted-foreground">
                    <span>{label}</span>
                    <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-[var(--line)]" />
                    <span className="tabular font-mono">{time}</span>
                  </p>
                ))}
              </div>

              <p className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Ordres de grandeur honnêtes, pas un chronomètre.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <TimeGain />
        </Reveal>
      </div>
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


  return (
    <section
      id="tarifs"
      className="scroll-mt-24 bg-[linear-gradient(180deg,var(--white)_0%,var(--mist)_12%,var(--mist)_100%)]"
    >
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        <div className="grid items-end gap-x-16 gap-y-8 lg:grid-cols-[1.05fr_0.95fr]">
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

          {/* Les objections, à côté du prix — c'est là qu'elles se posent. */}
          <Reveal delay={100}>
            <div className="divide-y rounded-2xl border bg-card px-5">
              {[
                ['C’est légal ?', 'Aucune donnée personnelle collectée. Le numéro est celui que l’entreprise publie.'],
                ['C’est du démarchage automatique ?', 'Rien ne part sans vous. Vous décidez d’appeler ou d’envoyer, et quoi dire.'],
                ['Et si ça ne me correspond pas ?', 'Vous choisissez vos prestations. Le reste ne vous est jamais proposé.'],
              ].map(([q, a]) => (
                <div key={q} className="py-3.5">
                  <p className="text-sm font-medium">{q}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

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
          pendant le lancement. Le détail du traitement des données est sur la{' '}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
            page Confidentialité
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/**
 * L'appel final : la page se terminait sur une note de bas de tarif — un
 * anticlimax. Une bande sombre referme le récit sur la promesse du matin.
 */
function FinalCall() {
  return (
    <section className="relative overflow-hidden bg-[var(--ink)] text-[var(--white)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(44, 75, 255, 0.35)' }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Demain matin, cinq entreprises vous attendent.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-70">
            Trois questions pour commencer, et le moteur travaille pour vous cette nuit.
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
          <p className="mt-5 text-xs opacity-55">Sans carte bancaire. Un dossier par semaine en gratuit.</p>
        </Reveal>
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
