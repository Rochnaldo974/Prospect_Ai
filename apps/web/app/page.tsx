import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';
import { SiteAudit } from '@/components/landing/audit';
import { DossierPreview } from '@/components/landing/dossier';
import { WeekCost } from '@/components/landing/week-cost';
import { Defects } from '@/components/landing/defects';
import { Steps } from '@/components/landing/steps';
import { Filters } from '@/components/landing/filters';
import { Exclusive } from '@/components/landing/exclusive';
import { Reveal } from '@/components/landing/reveal';
import { Faq, FinalCall, SectionTitle } from '@/components/landing/sections';
import { SiteHeader } from '@/components/landing/site-header';

export const metadata: Metadata = {
  title: 'Prospect AI — la prospection client, simple et rapide',
  description:
    'Pour les développeurs web et mobile freelances : chaque matin, cinq entreprises françaises dont le site a besoin d’être refait, avec ce qui cloche et le numéro pour en parler.',
};

/**
 * La page d'accueil.
 *
 * Trois règles tenues d'un bout à l'autre.
 *
 * Le vocabulaire d'abord. Le lecteur est développeur, mais il lit cette page
 * en client : il n'achète pas une méthode de détection, il achète un
 * carnet d'appels. Tout le vocabulaire d'ingénierie — certificats, feuilles
 * de style, registres, seuils — est donc sorti de la page. Il reste dans le
 * produit, où il sert à vérifier ; ici, il ne servirait qu'à impressionner.
 *
 * La forme ensuite. Onze sections, et onze structures différentes : une
 * page dont chaque bloc est un titre suivi d'une grille de trois cartes se
 * lit comme un formulaire, quelle que soit la qualité du texte.
 *
 * L'audace enfin, dépensée à un seul endroit — la semaine de prospection
 * dessinée en blocs de temps. Le reste reste sobre pour que ce bloc porte.
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

          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="#methode"
              className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline"
            >
              Comment ça marche
            </Link>
            <Link
              href="#tarifs"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Tarifs
            </Link>

            {profile ? (
              <Link href="/dashboard" className="font-medium transition-opacity hover:opacity-70">
                Mes opportunités
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-medium transition-opacity hover:opacity-70"
                >
                  Connexion
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--white)] transition-transform duration-200 hover:-translate-y-px"
                >
                  Essayer gratuitement
                </Link>
              </>
            )}
          </nav>
        </div>
      </SiteHeader>

      <main>
        <Hero />
        <Advantages />
        <Cost />
        <HowItWorks />
        <WhatWeFind />
        <Delivered />
        <YourChoice />
        <Exclusivity />
        <Pricing />
        <Questions />
        <FinalCall />
      </main>

      <SiteFooter />
    </div>
  );
}

/** Le héros : ce que le service fait, et l'audit qui le fait sous les yeux. */
function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 lg:pt-20">
      <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div className="motion-safe:animate-[revealUp_.7s_cubic-bezier(.16,.84,.44,1)_both]">
          <p className="field-label">Pour les développeurs web et mobile freelances</p>

          <h1 className="mt-5 max-w-[16ch] text-[clamp(2.375rem,4.6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
            La prospection client,{' '}
            <span className="text-[var(--brand)]">simple et rapide.</span>
          </h1>

          <p className="reasoning mt-6 max-w-lg text-muted-foreground">
            Notre moteur analyse des sites d’entreprises françaises en continu. Chaque matin, il
            vous propose cinq entreprises dont le site a besoin d’être refait — celles avec
            lesquelles vous avez le plus de chances de signer.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="group rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
            >
              Essayer gratuitement
              <span className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="#methode"
              className="rounded-full border px-6 py-3.5 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
            >
              Comment ça marche
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Sans carte bancaire. Trois questions, une minute.
          </p>
        </div>

        <div className="motion-safe:animate-[revealUp_.7s_cubic-bezier(.16,.84,.44,1)_both] [animation-delay:150ms]">
          <SiteAudit />
        </div>
      </div>
    </section>
  );
}

/**
 * Les avantages, chiffrés, juste après le héros.
 *
 * Chaque ligne porte un nombre ET la phrase qui le rend utile. Un bandeau de
 * quatre nombres sous quatre étiquettes de trois mots — « 5 registres publics
 * croisés » — se regarde sans se comprendre : le lecteur n'a aucune raison de
 * savoir ce qu'est un registre, ni pourquoi il devrait s'en réjouir.
 */
function Advantages() {
  const rows = [
    ['5', 'entreprises à rappeler chaque matin, choisies selon ce que vous savez faire.'],
    ['1 h', 'de prospection par semaine au lieu d’une journée entière — la recherche est faite.'],
    ['72 h', 'pendant lesquelles vous êtes seul à l’avoir. Vous n’appelez jamais après un autre.'],
    ['4,6 M', 'de sites français passés au crible en continu pour ne vous en sortir que cinq.'],
  ];

  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {rows.map(([value, text], i) => (
          <Reveal key={value} delay={i * 70}>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 border-b py-5 last:border-b-0">
              <span className="tabular w-24 shrink-0 text-3xl font-semibold tracking-tight sm:text-4xl">
                {value}
              </span>
              <span className="max-w-xl flex-1 text-[15px] leading-relaxed text-muted-foreground">
                {text}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** La section signature : une semaine de prospection, dessinée. */
function Cost() {
  return (
    <section className="bg-[var(--ink)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="field-label text-white/45">Ce que ça vous coûte aujourd’hui</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Prospecter vous prend une journée par semaine.
          </h2>
          <p className="reasoning mt-4 max-w-xl text-white/60">
            Pas la partie qui rapporte — la partie qui prépare. Chercher, ouvrir, vérifier,
            retrouver un numéro. Voici la même semaine, avant et après.
          </p>
        </Reveal>

        <div className="mt-14">
          <WeekCost />
        </div>

        <p className="mt-8 text-xs text-white/40">
          Semaine type pour une prospection menée sérieusement, à raison d’une heure et demie
          par jour ouvré. Ce sont des ordres de grandeur, pas une mesure.
        </p>
      </div>
    </section>
  );
}

/** Trois étapes, dont deux se passent sans vous. */
function HowItWorks() {
  return (
    <section id="methode" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <SectionTitle
        eyebrow="Comment ça marche"
        lead="Vous répondez à trois questions une fois. Le reste tourne sans vous, tous les jours."
      >
        Trois étapes, dont deux que vous ne faites pas
      </SectionTitle>
      <Steps />
    </section>
  );
}

/** Ce qu'un site en fin de vie donne à voir — montré, pas nommé. */
function WhatWeFind() {
  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionTitle
          eyebrow="Ce que le moteur repère"
          lead="Un site à refaire, ça se voit. Le moteur ne cherche pas les sites qu’il trouve laids : il cherche ceux qui font perdre des clients à leur propriétaire, et il peut le montrer."
        >
          Quand un site coûte des clients
        </SectionTitle>

        <Defects />

        <Reveal>
          <p className="mt-12 max-w-2xl border-t pt-8 text-sm leading-relaxed text-muted-foreground">
            À cela s’ajoute ce que les entreprises annoncent elles-mêmes au journal officiel :
            une ouverture, un rachat, un déménagement. Une entreprise qui vient de changer de
            main refait son site dans l’année.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** Ce que vous recevez, en taille réelle. */
function Delivered() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionTitle
        eyebrow="Ce que vous recevez"
        lead="Un dossier par entreprise : le problème, ce qui le date, ce qu’il reste à vérifier, et le numéro. Vous savez quoi dire avant même de décrocher."
      >
        Voilà à quoi ressemble un dossier
      </SectionTitle>

      <div className="mt-14">
        <DossierPreview />
      </div>
    </section>
  );
}

/** Le paramétrage, montré comme il se présente. */
function YourChoice() {
  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
          <div>
            <SectionTitle
              eyebrow="Vos critères"
              lead="Vous ne recevez que ce que vous savez faire et ce que vous acceptez de faire. Le reste ne vous est même pas montré."
            >
              Cinq dossiers, mais les vôtres
            </SectionTitle>
          </div>

          <Reveal delay={80}>
            <Filters />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** L'exclusivité, isolée pour être crue. */
function Exclusivity() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <Exclusive />
      </Reveal>
    </section>
  );
}

/** Les tarifs. */
function Pricing() {
  const plans = [
    {
      name: 'Solo',
      tag: 'Le plus pris',
      for: 'Pour un développeur seul.',
      price: '39',
      features: [
        '5 entreprises par jour',
        'Exclusives pendant 72 h',
        'Suivi de vos appels et de vos devis',
        'Tous les métiers, toute la France',
      ],
      cta: 'Commencer',
      href: '/signup',
      featured: true,
    },
    {
      name: 'Atelier',
      for: 'Pour un studio de deux à cinq personnes.',
      price: '89',
      features: [
        '12 entreprises par jour',
        'Répartition entre les membres',
        'Exclusivité à l’échelle du studio',
        'Export des dossiers',
      ],
      cta: 'Commencer',
      href: '/signup',
      featured: false,
    },
  ];

  return (
    <section id="tarifs" className="scroll-mt-24 border-t bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionTitle
          eyebrow="Tarifs"
          lead="Le nombre de places est limité pour une raison simple : une entreprise n’est proposée qu’à une seule personne, et il en sort un nombre fini chaque jour."
        >
          Un prix, pas de palier caché
        </SectionTitle>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 90}>
              <article
                className={`flex h-full flex-col rounded-2xl border bg-card p-8 ${
                  plan.featured
                    ? 'border-[var(--brand)] shadow-[0_1px_2px_rgba(11,13,20,.04),0_28px_64px_-32px_rgba(44,75,255,.35)]'
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
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.for}</p>

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
                  href={plan.href}
                  className={`mt-9 rounded-full px-6 py-3.5 text-center text-sm font-medium transition-transform duration-200 hover:-translate-y-px ${
                    plan.featured
                      ? 'bg-[var(--brand)] text-white'
                      : 'border hover:bg-[var(--mist)]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Tarifs indicatifs pendant le lancement. Sans engagement, sans carte bancaire à
          l’inscription.
        </p>
      </div>
    </section>
  );
}

/** Les objections. */
function Questions() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionTitle eyebrow="Questions">Ce qu’on nous demande</SectionTitle>
      <Faq />
    </section>
  );
}

/** Le pied de page. */
function SiteFooter() {
  const columns: Array<[string, Array<[string, string]>]> = [
    ['Produit', [
      ['Comment ça marche', '#methode'],
      ['Tarifs', '#tarifs'],
    ]],
    ['Compte', [
      ['Créer un compte', '/signup'],
      ['Connexion', '/login'],
    ]],
    ['Données', [
      ['Confidentialité', '/confidentialite'],
    ]],
  ];

  return (
    <footer className="border-t bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <span className="text-lg font-semibold tracking-[-0.03em]">
              prospect<span className="text-[var(--brand)]">.ai</span>
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Cinq entreprises à rappeler chaque matin, avec ce qui cloche sur leur site et de
              quoi le vérifier en une minute.
            </p>
          </div>

          {columns.map(([heading, links]) => (
            <div key={heading}>
              <p className="field-label">{heading}</p>
              <ul className="mt-4 space-y-2.5">
                {links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-xs text-muted-foreground">
          <span>Données publiques françaises</span>
          <span>Aucune donnée nominative collectée</span>
        </div>
      </div>
    </footer>
  );
}
