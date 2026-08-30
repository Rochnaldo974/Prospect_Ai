import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';
import { SiteAudit } from '@/components/landing/audit';
import { Examples } from '@/components/landing/examples';
import { DossierPreview } from '@/components/landing/dossier';
import { Reveal } from '@/components/landing/reveal';
import { SiteHeader } from '@/components/landing/site-header';

export const metadata: Metadata = {
  title: 'Prospect AI — la prospection client, simple et rapide',
  description:
    'Pour les développeurs web et mobile freelances : chaque matin, cinq entreprises françaises dont le site a besoin d’être refait, avec ce qui cloche et le numéro pour en parler.',
};

/**
 * La page d'accueil.
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

          <nav className="flex items-center gap-6 text-sm">
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
                <Link href="/login" className="font-medium transition-opacity hover:opacity-70">
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
        <Market />
        <Delivered />
        <Pricing />
      </main>

      <SiteFooter />
    </div>
  );
}

/** Ce que le service fait, et l'audit qui le fait sous les yeux. */
function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-14 lg:pt-20">
      <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div className="motion-safe:animate-[revealUp_.7s_cubic-bezier(.16,.84,.44,1)_both]">
          <p className="field-label">Pour les développeurs web et mobile freelances</p>

          <h1 className="mt-5 max-w-[16ch] text-[clamp(2.375rem,4.6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
            La prospection client,{' '}
            <span className="text-[var(--brand)]">simple et rapide.</span>
          </h1>

          <p className="reasoning mt-6 max-w-lg text-muted-foreground">
            Notre moteur analyse des sites d’entreprises françaises en continu. Chaque matin,
            il vous en propose cinq dont le site a besoin d’être refait — avec ce qui cloche et
            le numéro pour en parler.
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
              href="#tarifs"
              className="rounded-full border px-6 py-3.5 text-sm font-medium transition-colors hover:bg-[var(--mist)]"
            >
              Voir les tarifs
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Une heure par semaine au lieu d’une journée. Sans carte bancaire.
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
 * Reste-t-il du marché ? Quatre cas plutôt qu'un pourcentage.
 *
 * « 53 % des sites ont un défaut » demande au lecteur un effort de
 * projection ; « ce restaurant n'a pas de site du tout » est immédiatement
 * une facture qu'il sait établir. Le chiffre reste, mais en note, à sa
 * place — il sert à dire que les quatre cas ne sont pas des exceptions.
 */
function Market() {
  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="field-label">Ce que le moteur trouve</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Quatre entreprises trouvées cette semaine
          </h2>
          <p className="reasoning mt-4 max-w-xl text-muted-foreground">
            Chacune a un problème que ses clients voient et qu’elle ne voit pas. C’est le
            genre de dossier qui vous arrive le matin.
          </p>
        </Reveal>

        <Examples />

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Cas réels, identités retirées. Sur les 1 572 sites d’entreprises françaises analysés
          à ce jour, 828 présentent au moins un de ces défauts — plus d’un sur deux.
        </p>
      </div>
    </section>
  );
}

/** Qu'est-ce que je reçois ? Un dossier, montré en taille réelle. */
function Delivered() {
  const beats = [
    ['1', 'Vous dites ce que vous faites', 'Trois questions, une minute.'],
    ['2', 'Le moteur cherche sans vous', 'Il tourne pendant que vous travaillez.'],
    ['3', 'Cinq dossiers vous attendent', 'Chaque matin, prêts à appeler.'],
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="field-label">Ce que vous recevez</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
          Un dossier par entreprise, prêt à appeler
        </h2>
        <p className="reasoning mt-4 max-w-xl text-muted-foreground">
          Voici le quatrième cas ci-dessus, en entier — tel qu’il vous arriverait demain matin.
        </p>
      </Reveal>

      {/* Les trois temps tiennent sur une ligne. Ils n'ont jamais mérité une
          section : ce sont trois phrases, et deux d'entre elles disent
          seulement « vous n'avez rien à faire ». */}
      <ol className="mt-10 grid gap-6 border-y py-6 sm:grid-cols-3">
        {beats.map(([n, title, detail]) => (
          <li key={n} className="flex gap-3.5">
            <span className="tabular shrink-0 font-mono text-xs text-[var(--brand)]">{n}</span>
            <span>
              <span className="block text-sm font-medium leading-snug">{title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-12">
        <DossierPreview />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Dossier réel, produit par le moteur. Chaque constat se vérifie en ouvrant l’adresse du
        site.
      </p>
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
    <section id="tarifs" className="scroll-mt-24 bg-[var(--ink)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="field-label text-white/45">Tarifs</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.875rem,3.4vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Sans engagement, sans palier caché.
          </h2>
          <p className="reasoning mt-4 max-w-xl text-white/60">
            Le nombre de places est limité : une entreprise n’est proposée qu’à une seule
            personne, et il en sort un nombre fini chaque jour.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 90}>
              <article
                className={`flex h-full flex-col rounded-2xl p-8 ${
                  plan.featured
                    ? 'bg-[var(--brand)]'
                    : 'border border-white/12 bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                  {plan.tag ? (
                    <span className="rounded-full bg-white/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]">
                      {plan.tag}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-1.5 text-sm ${plan.featured ? 'text-white/75' : 'text-white/50'}`}>
                  {plan.audience}
                </p>

                <p className="mt-7 flex items-baseline gap-1.5">
                  <span className="tabular text-5xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.featured ? 'text-white/75' : 'text-white/50'}`}>
                    € / mois
                  </span>
                </p>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm">
                      <span aria-hidden className={plan.featured ? 'text-white' : 'text-[var(--brand)]'}>
                        ✓
                      </span>
                      <span className={plan.featured ? 'text-white/90' : 'text-white/80'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-9 rounded-full px-6 py-3.5 text-center text-sm font-medium transition-transform duration-200 hover:-translate-y-px ${
                    plan.featured
                      ? 'bg-[var(--white)] text-[var(--ink)]'
                      : 'border border-white/25 hover:bg-white/10'
                  }`}
                >
                  Essayer gratuitement
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-xs text-white/40">
          Sans carte bancaire à l’inscription. Trois questions, une minute. Tarifs indicatifs
          pendant le lancement.
        </p>

        <div className="mt-16 grid gap-x-12 gap-y-0 border-t border-white/12 pt-4 md:grid-cols-3">
          {answers.map(([question, answer]) => (
            <div key={question} className="py-5">
              <p className="text-sm font-medium">{question}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{answer}</p>
            </div>
          ))}
        </div>

        <p className="mt-2 text-xs text-white/40">
          Le détail du traitement des données est sur la{' '}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:text-white/70">
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
