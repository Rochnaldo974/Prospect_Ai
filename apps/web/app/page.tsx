import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';
import { SiteAudit } from '@/components/landing/audit';
import { WeekComparison } from '@/components/landing/comparison';
import { Pipeline } from '@/components/landing/pipeline';
import { DossierPreview } from '@/components/landing/dossier';
import { Reveal } from '@/components/landing/reveal';
import {
  AlsoGrid, Changelog, Faq, Feature, FinalCall, Mechanism, Numbers, Readout, SectionTitle,
} from '@/components/landing/sections';
import { GoogleButton } from '@/components/google-button';
import { SiteHeader } from '@/components/landing/site-header';

export const metadata: Metadata = {
  title: 'Prospect AI — voyez ce qui cloche avant d’appeler',
  description:
    'Pour développeurs web et mobile freelances : cinq entreprises auditées chaque matin — certificat TLS, adaptation mobile, composants datés, temps de réponse — avec le défaut à corriger et le contact pour en parler.',
};

/**
 * La page d'accueil.
 *
 * Elle s'adresse à des développeurs qui ont déjà essayé la prospection et
 * l'ont détestée. L'argument n'est donc pas « trouvez plus de clients » — ils
 * l'ont entendu — mais « vous saurez quoi dire en décrochant ».
 *
 * La densité est délibérée : une page qui ne paraît pas vide compte une
 * quinzaine de blocs, et chacun doit apporter une information NOUVELLE.
 * Le vouvoiement est tenu partout : c'est la norme des SaaS français, y
 * compris ceux vendus à des développeurs, et il doit être sans exception —
 * la moitié des pages qui l'essaient dérapent au bout de trois sections.
 */
export default async function HomePage() {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-dvh">
      <SiteHeader>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-mono text-sm font-medium tracking-tight">
            prospect<span className="text-[var(--brand)]">.ai</span>
          </span>

          <nav className="flex items-center gap-5 text-sm">
            <Link href="#methode" className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline">
              Méthode
            </Link>
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
      </SiteHeader>

      <main>
        <Hero />
        <Numbers />
        <Delivered />
        <Promise />
        <Mechanism />
        <Features />
        <Sources />
        <TimeCost />
        <Funnel />
        <Pricing />
        <Faq2 />
        <Journal />
        <FinalCall />
      </main>

      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 lg:pt-20">
      <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div className="motion-safe:animate-[revealUp_.7s_cubic-bezier(.16,.84,.44,1)_both]">
          <p className="field-label">Développeurs web et mobile · freelances</p>

          <h1 className="mt-5 max-w-[15ch] text-[clamp(2.375rem,4.4vw,3.625rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
            Voyez ce qui cloche{' '}
            <span className="text-[var(--brand)]">avant d’appeler.</span>
          </h1>

          {/* Le jargon vit ici, jamais dans le titre : c'est un badge
              d'appartenance pour la cible, et un mur pour tous les autres. */}
          <p className="reasoning mt-6 max-w-lg text-muted-foreground">
            Chaque matin, cinq entreprises françaises auditées : certificat TLS, adaptation
            mobile, composants datés, temps de réponse. Avec le défaut à corriger et le numéro
            pour en parler.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="group rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-px"
            >
              Voir mes premiers dossiers
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
 * Ce qui est livré, en taille réelle.
 *
 * La capture produit est le mécanisme de preuve le plus systématique des
 * pages qui convertissent : elle montre ce qu'on achète au lieu de le décrire.
 * Placée haut, avant tout argument, elle répond à la seule question qui
 * compte au premier scroll — à quoi ça ressemble concrètement.
 */
function Delivered() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionTitle
        eyebrow="Ce que vous recevez"
        lead="Un dossier par entreprise, avec le défaut constaté, ce qui le date, ce qu’on ignore encore et le numéro. Les données ci-dessous viennent d’un scan réel."
      >
        Voilà un dossier
      </SectionTitle>

      <div className="mt-12">
        <DossierPreview />
      </div>
    </section>
  );
}

/** Trois cartes de promesse. */
function Promise() {
  const cards = [
    {
      title: 'Un fait daté, ou rien',
      body: 'Un site vieux est un état, pas un événement. Sans fait daté, le service n’invente pas d’urgence : il laisse la case vide et le dit.',
    },
    {
      title: 'Jamais deux fois la même',
      body: 'Une entreprise attribuée l’est à une seule personne, garanti par un index unique en base. Personne n’appelle après vous.',
    },
    {
      title: 'Ce qu’on ignore est écrit',
      body: 'Chaque dossier porte ses réserves. Un service qui annonce ce qu’il ne sait pas est un service dont on peut croire ce qu’il affirme.',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
        {cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 80}>
            <article className="border-t pt-5">
              <h2 className="text-lg font-semibold tracking-tight">{card.title}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Quatre fonctionnalités développées, en alternance texte/visuel. */
function Features() {
  return (
    <section id="methode" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
      <SectionTitle
        eyebrow="Ce que le moteur regarde"
        lead="Chaque contrôle produit un fait vérifiable en une minute. Un adjectif se conteste ; une version lue dans le code source, non."
      >
        Quatre familles de preuves
      </SectionTitle>

      <Feature
        eyebrow="Certificat"
        title="Le site que personne ne peut ouvrir"
        body="Un certificat expiré ou auto-signé fait afficher un avertissement pleine page. Le propriétaire a cliqué « continuer » une fois pour toutes et ne voit plus rien ; ses clients, si."
        points={[
          'Validité, émetteur et date d’expiration lus directement',
          'Distinction entre certificat refusé et absence de HTTPS',
          'La date d’expiration est un fait daté : elle date l’opportunité',
        ]}
        visual={
          <Readout
            title="Sortie du contrôle TLS"
            rows={[
              { key: 'valid', value: 'false', flag: true },
              { key: 'reason', value: 'CERT_HAS_EXPIRED', flag: true },
              { key: 'valid_to', value: '2025-10-25' },
              { key: 'issuer', value: "Let's Encrypt" },
            ]}
          />
        }
      />

      <Feature
        flip
        eyebrow="Composants"
        title="La version est écrite dans le code"
        body="« Site vieux » est un jugement. « jQuery 1.7.2, sorti en 2011 » se lit dans le code source de la page et ne se discute pas."
        points={[
          'Versions extraites des URL de scripts et de feuilles de style',
          'L’âge retenu est celui du composant le plus récent, jamais du plus ancien',
          'Une version absente de la table n’est pas devinée',
        ]}
        visual={
          <Readout
            title="Composants datés"
            rows={[
              { key: 'jquery', value: '1.7.2 — 2011', flag: true },
              { key: 'bootstrap', value: '3.3.7 — 2015', flag: true },
              { key: 'wordpress', value: '5.x — 2018' },
              { key: 'tech_year', value: '2018' },
            ]}
          />
        }
      />

      <Feature
        eyebrow="Mobile"
        title="Mesuré dans le CSS, pas deviné"
        body="Chercher des media queries dans le HTML annonçait 53 sites inadaptés sur 123. En lisant les feuilles de style du site, il en reste 2. Les 51 autres auraient été des accusations fausses."
        points={[
          'Les feuilles du site passent avant les polices et les jeux d’icônes',
          'Aucune conclusion sans CSS effectivement lu',
          'En 2026, c’est un angle rare — et le produit le dit',
        ]}
        visual={
          <Readout
            title="Adaptation mobile"
            rows={[
              { key: 'inline', value: 'aucune media query dans le HTML' },
              { key: 'sheet 1', value: 'polices — ignorée' },
              { key: 'sheet 2', value: 'site.css — 14 règles trouvées' },
              { key: 'responsive', value: 'true' },
            ]}
          />
        }
      />

      <Feature
        flip
        eyebrow="Registres"
        title="Le SIREN relie le site à l’entreprise"
        body="Un site professionnel français doit afficher son SIREN dans ses mentions légales. C’est le seul rattachement déterministe qui existe — tout le reste n’est qu’une correspondance de nom."
        points={[
          'SIREN présent sur plus de deux domaines : c’est une agence, pas l’exploitant',
          'Plusieurs SIREN sur une page : propriété ambiguë, rien n’est créé',
          'BODACC date les créations, cessions et procédures collectives',
        ]}
        visual={
          <Readout
            title="Rattachement légal"
            rows={[
              { key: 'siren', value: '493 118 274' },
              { key: 'source', value: 'mentions légales' },
              { key: 'domaines', value: '1 — exploitant probable' },
              { key: 'confiance', value: '0.99' },
            ]}
          />
        }
      />

      <SectionTitle eyebrow="Et aussi">Ce qui ne mérite pas sa propre section</SectionTitle>
      <AlsoGrid />
    </section>
  );
}

function Sources() {
  const groups = [
    {
      title: 'Le site lui-même',
      items: [
        'Certificat TLS : validité, émetteur, expiration',
        'Composants datés — jQuery, Bootstrap, WordPress',
        'Temps de réponse au premier octet, poids de la page',
        'Adaptation mobile, lue dans les feuilles de style',
        'Formulaire de contact, e-commerce, réservation',
      ],
    },
    {
      title: 'Les registres publics',
      items: [
        'SIRENE — identité, activité, effectif, création',
        'BODACC — créations, cessions, procédures collectives',
        'AFNIC — 4,59 millions de .fr et leur date de dépôt',
        'BOAMP — marchés publics ouverts et leur date limite',
        'Mentions légales — le SIREN qui relie site et exploitant',
      ],
    },
  ];

  return (
    <section id="sources" className="scroll-mt-20 border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionTitle
          eyebrow="Sur quoi reposent les analyses"
          lead="Chaque affirmation vient d’une mesure ou d’un registre officiel, et porte sa date. Quand un fait manque, il est écrit qu’il manque."
        >
          Rien d’inventé. Tout se recoupe.
        </SectionTitle>

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
      </div>
    </section>
  );
}

function TimeCost() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionTitle
        lead="Trouver dix mille entreprises prend cinq minutes. Savoir lesquelles valent un appel prend des heures — et c’est cette partie-là qu’on vous retire."
      >
        Prospecter, ce n’est pas trouver.
        <span className="block text-muted-foreground">C’est trier.</span>
      </SectionTitle>

      <div className="mt-12">
        <WeekComparison />
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Exemple d’une semaine type, donné à titre d’illustration. Le seul chiffre garanti est
        l’exclusivité : une entreprise attribuée ne l’est qu’à une personne, et la base l’impose.
      </p>
    </section>
  );
}

function Funnel() {
  return (
    <section className="border-y bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionTitle eyebrow="Du parc entier à vos cinq dossiers">
          Quatre millions d’adresses. Cinq qui vous concernent.
        </SectionTitle>
        <div className="mt-12">
          <Pipeline />
        </div>
      </div>
    </section>
  );
}

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
        'Toutes les familles, toute la France',
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
        'Exclusivité à l’échelle du studio',
        'Export des dossiers',
      ],
      cta: 'Nous écrire',
      featured: false,
    },
  ];

  return (
    <section id="tarifs" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <SectionTitle
        eyebrow="Tarifs"
        lead="Le nombre de places est limité pour une raison mécanique : une entreprise n’est proposée qu’à une seule personne, et le stock se renouvelle à un rythme fini."
      >
        Un prix, pas de palier caché
      </SectionTitle>

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
                <span className="tabular text-5xl font-semibold tracking-[-0.045em]">
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
                  plan.featured ? 'bg-[var(--brand)] text-white' : 'border'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Tarifs indicatifs pendant le lancement. Sans engagement, sans carte bancaire à
        l’inscription.
      </p>
    </section>
  );
}

function Faq2() {
  return (
    <section className="border-t bg-[var(--mist)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionTitle eyebrow="Questions">Ce qu’on nous demande</SectionTitle>
        <Faq />
      </div>
    </section>
  );
}

/**
 * Le journal.
 *
 * Deux colonnes : le titre tient à gauche pendant qu'on lit les entrées à
 * droite. En une seule colonne étroite, la moitié droite de la section
 * restait blanche — le défaut exact qu'on nous reprochait sur cette page.
 */
function Journal() {
  return (
    <section id="journal" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionTitle
            eyebrow="Journal"
            lead="Le produit bouge chaque semaine. Les entrées ci-dessous sont tirées du dépôt."
          >
            Dernières livraisons
          </SectionTitle>
        </div>

        <Reveal>
          <Changelog />
        </Reveal>
      </div>
    </section>
  );
}


/**
 * Le pied de page.
 *
 * Il ne portait qu'une ligne. Un pied de page sert à deux choses : montrer
 * qu'il existe une suite au produit, et loger ce que la loi française exige
 * d'un service en ligne — le régime de données en fait partie, et il se
 * trouve qu'ici c'est aussi un argument de vente.
 */
function SiteFooter() {
  const columns: Array<[string, Array<[string, string]>]> = [
    ['Produit', [
      ['Méthode', '#methode'],
      ['Sources', '#sources'],
      ['Tarifs', '#tarifs'],
      ['Journal', '#journal'],
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
            <span className="font-mono text-sm font-medium tracking-tight">
              prospect<span className="text-[var(--brand)]">.ai</span>
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Cinq entreprises françaises auditées chaque matin, avec le défaut constaté et
              de quoi le vérifier.
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
          <span>SIRENE · BODACC · AFNIC · BOAMP — données publiques françaises</span>
          <span>Aucune donnée nominative collectée</span>
        </div>
      </div>
    </footer>
  );
}
