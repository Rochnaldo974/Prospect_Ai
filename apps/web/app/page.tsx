import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';
import { SiteAudit } from '@/components/landing/audit';
import { WeekComparison } from '@/components/landing/comparison';
import { Pipeline } from '@/components/landing/pipeline';
import { Reveal } from '@/components/landing/reveal';
import { GoogleButton } from '@/components/google-button';

export const metadata: Metadata = {
  title: 'Prospect AI — sache ce qui cloche avant d’appeler',
  description:
    'Pour développeurs web et mobile freelances : chaque entreprise proposée est auditée — score du site, certificat, mobile, performances — et tu reçois le défaut à corriger avec de quoi le prouver.',
};

/**
 * La page d'accueil.
 *
 * Elle s'adresse à des développeurs web et mobile qui ont déjà essayé la
 * prospection et l'ont détestée. L'argument n'est donc pas « trouve plus de
 * clients » — ils l'ont entendu — mais « ne perds plus tes soirées à trier ».
 *
 * Le héros ne décrit pas le produit, il le MONTRE en train de travailler : un
 * relevé qui se remplit sous les yeux du visiteur, avec des données réelles.
 * C'est la seule chose qui distingue ce service d'un fichier de contacts, et
 * elle se démontre mieux qu'elle ne s'explique.
 */
export default async function HomePage() {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-transparent bg-white/80 backdrop-blur-md transition-colors dark:bg-[var(--white)]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-mono text-sm font-medium tracking-tight">
            prospect<span className="text-[var(--brand)]">.ai</span>
          </span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="#tarifs" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Tarifs
            </Link>
            {profile ? (
              <Link href="/dashboard" className="font-medium transition-opacity hover:opacity-70">
                Mes opportunités
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
                  Connexion
                </Link>
                {/* Google dans la barre : c'est le chemin le plus court vers
                    un compte, et le seul où aucun mot de passe ne transite. */}
                <div className="hidden md:block">
                  <GoogleButton label="Continuer avec Google" compact />
                </div>
                <Link
                  href="/signup"
                  className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--white)] transition-transform duration-200 hover:-translate-y-px"
                >
                  Essayer
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Hero />
        <TimeSaved />
        <Funnel />
        <Sources />
        <HowItWorks />
        <Pricing />
        <FinalCall />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-xs text-muted-foreground">
          <span className="font-mono">prospect.ai</span>
          <span>Données publiques françaises · aucune donnée nominative collectée</span>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-14 lg:pt-20">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
        <div className="max-w-xl motion-safe:animate-[revealUp_.7s_cubic-bezier(.16,.84,.44,1)_both]">
          <p className="field-label">Développeurs web et mobile · freelances</p>

          {/* Le passage à la ligne est imposé, pas laissé au hasard : la
              coupure porte le sens — ce qui cloche / avant d'appeler. */}
          <h1 className="mt-5 max-w-[16ch] text-[clamp(2.25rem,4.2vw,3.5rem)] font-semibold leading-[1.03] tracking-[-0.04em]">
            Sache ce qui cloche sur leur site{' '}
            <span className="text-[var(--brand)]">avant de décrocher.</span>
          </h1>

          <p className="reasoning mt-6 max-w-lg text-muted-foreground">
            Le moteur audite le site de chaque entreprise — mobile, certificat, performances,
            technologies — et ne te la propose que si le défaut est réel et l’entreprise
            joignable. Tu ouvres l’adresse, tu vois le problème, tu appelles.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="group rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
            >
              Voir mes premiers dossiers
              <span className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <span className="text-sm text-muted-foreground">
              Trois questions, une minute.
            </span>
          </div>
        </div>

        <div className="motion-safe:animate-[revealUp_.7s_cubic-bezier(.16,.84,.44,1)_both] [animation-delay:150ms]">
          <SiteAudit />
        </div>
      </div>
    </section>
  );
}

/**
 * Ce que la prospection coûte, et ce qu'elle rapporte.
 *
 * Un développeur freelance ne manque pas de contacts : il manque de temps, et
 * il a déjà constaté qu'envoyer soixante e-mails à froid ne rapporte presque
 * rien. L'argument porte donc sur les heures, pas sur le volume.
 */
function TimeSaved() {
  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <h2 className="max-w-2xl text-[clamp(1.875rem,3.2vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
            Prospecter, ce n’est pas trouver.
            <span className="block text-muted-foreground">C’est trier.</span>
          </h2>
          <p className="reasoning mt-5 text-muted-foreground">
            Trouver dix mille entreprises prend cinq minutes. Savoir lesquelles valent un appel
            prend des heures — et c’est cette partie-là qu’on te retire.
          </p>
        </Reveal>

        <div className="mt-12">
          <WeekComparison />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Exemple d’une semaine type, donné à titre d’illustration. Le seul chiffre garanti est
          l’exclusivité : une entreprise attribuée ne l’est qu’à une personne, et la base de
          données l’impose.
        </p>
      </div>
    </section>
  );
}

/**
 * Le tri, en chiffres réels.
 *
 * Ce que la section précédente affirme en heures, celle-ci le montre en
 * volumes : quatre maillons, chacun élimine, et ce qui arrive au bout a
 * survécu à tout le reste.
 */
function Funnel() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="field-label">Du parc entier à tes cinq dossiers</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.875rem,3.2vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
          Quatre millions d’adresses. Cinq qui te concernent.
        </h2>
      </Reveal>

      <div className="mt-12">
        <Pipeline />
      </div>
    </section>
  );
}

/**
 * Sur quoi reposent les analyses.
 *
 * La section qui décide de la confiance. Un développeur qui lit « intelligence
 * artificielle » sans savoir ce qui est mesuré part ; celui qui reconnaît
 * AFNIC, BODACC et un contrôle TLS sait exactement ce qu'il achète.
 */
function Sources() {
  const groups = [
    {
      title: 'Le site lui-même',
      items: [
        'Certificat TLS : validité, émetteur, date d’expiration',
        'Composants datés — jQuery, Bootstrap, WordPress et leur version',
        'Temps de réponse mesuré, poids de la page',
        'Adaptation mobile, lue dans les feuilles de style',
        'Formulaire de contact, e-commerce, réservation',
      ],
    },
    {
      title: 'Les registres publics',
      items: [
        'SIRENE — identité, activité, effectif, date de création',
        'BODACC — créations, cessions, procédures collectives',
        'AFNIC — les 4,59 millions de .fr et leur date de dépôt',
        'BOAMP — marchés publics ouverts, avec leur date limite',
        'Mentions légales — le SIREN qui relie un site à son exploitant',
      ],
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="field-label">Sur quoi reposent les analyses</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">
          Rien d’inventé. Tout se recoupe.
        </h2>
        <p className="reasoning mt-4 text-muted-foreground">
          Chaque affirmation vient d’une mesure ou d’un registre officiel, et porte sa date.
          Quand un fait manque, il est écrit qu’il manque — le produit ne comble pas les trous.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
        {groups.map((group, i) => (
          <Reveal key={group.title} delay={i * 100}>
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="mt-4">
              {group.items.map((item, index) => (
                <li key={item} className="evidence">
                  <span className="evidence__mark" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="evidence__fact">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: 'Tu dis ce que tu fais',
      body: 'Refonte, création, e-commerce, application mobile, maintenance. Trois questions, une minute.',
    },
    {
      title: 'Le moteur travaille la nuit',
      body: 'Il scanne, croise les registres, écarte les entreprises déjà démarchées et note ce qu’il trouve.',
    },
    {
      title: 'Cinq dossiers t’attendent',
      body: 'Avec le contact, la raison d’appeler et ce qu’on ignore encore. Tu dis ce que ça a donné, l’entreprise sort du circuit.',
    },
  ];

  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <h2 className="max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">
            Comment ça se passe
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 90}>
              <li className="border-t pt-5">
                <span className="font-mono text-xs text-[var(--brand)]">
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
 * Les tarifs.
 *
 * Le nombre de places est réellement limité : l'exclusivité fait qu'une
 * entreprise attribuée ne l'est qu'une fois, et le stock se renouvelle à un
 * rythme mesurable. Le dire est plus honnête qu'une fausse rareté marketing,
 * et c'est aussi le seul argument qui justifie de s'inscrire maintenant.
 */
function Pricing() {
  const plans = [
    {
      name: 'Solo',
      price: '39',
      lead: 'Pour un développeur seul.',
      features: [
        '5 opportunités par jour',
        'Exclusivité 72 h sur chaque entreprise',
        'Suivi des appels et des issues',
        'Tous les secteurs, toute la France',
      ],
      cta: 'Commencer',
      featured: true,
    },
    {
      name: 'Atelier',
      price: '89',
      lead: 'Pour un studio de deux à cinq personnes.',
      features: [
        '12 opportunités par jour',
        'Répartition entre les membres',
        'Exclusivité partagée à l’échelle du studio',
        'Export des dossiers',
      ],
      cta: 'Nous écrire',
      featured: false,
    },
  ];

  return (
    <section id="tarifs" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <Reveal>
        <p className="field-label">Tarifs</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em]">
          Un prix, pas de palier caché
        </h2>
        <p className="reasoning mt-4 text-muted-foreground">
          Le nombre de places est limité pour une raison mécanique : une entreprise n’est
          proposée qu’à une seule personne, et le stock se renouvelle à un rythme fini.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {plans.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 90}>
            <div
              className={`flex h-full flex-col rounded-2xl border p-7 transition-shadow duration-300 ${
                plan.featured
                  ? 'border-[var(--brand)] shadow-[0_16px_48px_-20px_rgba(44,75,255,.35)]'
                  : 'hover:shadow-[0_12px_36px_-18px_rgba(11,13,20,.18)]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                {plan.featured ? (
                  <span className="field-label rounded-full bg-[var(--brand-wash)] px-2.5 py-1 text-[var(--brand)]">
                    Le plus pris
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">{plan.lead}</p>

              <p className="mt-6">
                <span className="tabular text-5xl font-semibold tracking-[-0.04em]">
                  {plan.price}
                </span>
                <span className="ml-1 text-muted-foreground">€ / mois</span>
              </p>

              <ul className="mt-7 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span aria-hidden className="mt-[3px] text-[var(--brand)]">▸</span>
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 rounded-full px-5 py-3 text-center text-sm font-medium transition-transform duration-200 hover:-translate-y-px ${
                  plan.featured
                    ? 'bg-[var(--brand)] text-white'
                    : 'border bg-transparent'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Tarifs indicatifs pendant la phase de lancement. Sans engagement.
      </p>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="border-t bg-[var(--ink)] text-[var(--white)]">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-[clamp(1.875rem,3.5vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em]">
            Demain matin, cinq raisons d’appeler.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed opacity-70">
            Pas cinq cents contacts à trier. Cinq dossiers instruits, à traiter avant midi.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-block rounded-full bg-[var(--white)] px-7 py-3.5 text-sm font-medium text-[var(--ink)] transition-transform duration-200 hover:-translate-y-px"
          >
            Créer mon compte
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
