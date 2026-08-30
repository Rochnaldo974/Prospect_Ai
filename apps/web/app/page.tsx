import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Prospect AI — cinq raisons d’appeler, chaque matin',
  description:
    'Cinq opportunités par jour pour freelances web, avec la preuve datée qui justifie l’appel. Jamais deux fois la même entreprise.',
};

/**
 * La page d'accueil.
 *
 * Elle n'ouvre pas sur une promesse mais sur une PIÈCE : le dossier tel qu'il
 * est livré, avec ses constats sourcés et sa réserve. C'est la chose la plus
 * caractéristique du produit, et la seule qui le distingue d'un annuaire —
 * autant la mettre en premier plutôt que de la décrire.
 *
 * La réserve affichée dans le dossier n'est pas un aveu de faiblesse mise là
 * par honnêteté décorative : c'est l'argument. Un service qui dit ce qu'il ne
 * sait pas est un service dont on peut croire ce qu'il affirme.
 */
export default async function HomePage() {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="field-label">Prospect AI</span>
        <nav className="flex items-center gap-5 text-sm">
          {profile ? (
            <Link href="/dashboard" className="underline-offset-4 hover:underline">
              Mes opportunités
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16 lg:pt-16">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
              Une liste d’entreprises ne vaut rien.
              <span className="block text-[var(--verified)]">Une raison, si.</span>
            </h1>

            <p className="reasoning mt-6">
              Chaque matin, cinq entreprises françaises et, pour chacune, le fait daté qui
              justifie de décrocher son téléphone aujourd’hui plutôt que dans six mois. Un
              certificat expiré, un site qui ne répond plus, un marché public ouvert.
            </p>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Tout se vérifie en une minute. Et quand rien ne justifie d’appeler maintenant, le
              service le dit au lieu de l’inventer.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Recevoir mes cinq du matin
              </Link>
              <span className="text-sm text-muted-foreground">
                Paramétrage en trois questions.
              </span>
            </div>
          </div>

          {/* Le dossier, tel qu'il est livré. */}
          <Dossier />
        </section>

        <section className="border-y bg-[var(--paper-raised)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
            {[
              {
                rule: 'Un fait daté, ou rien',
                body: 'Un site vieux est un état, pas un événement — il l’était l’an dernier et le sera l’an prochain. Sans fait daté, le service n’invente pas d’urgence : il laisse la case vide.',
              },
              {
                rule: 'Jamais deux fois la même',
                body: 'Une entreprise attribuée l’est à un seul abonné, garanti par la base et non par du code. Personne n’appelle après vous, et vous n’appelez après personne.',
              },
              {
                rule: 'Ce qu’on ignore est écrit',
                body: 'Chaque dossier porte ses réserves. Un service qui annonce ce qu’il ne sait pas est un service dont on peut croire ce qu’il affirme.',
              },
            ].map((item) => (
              <article key={item.rule}>
                <h2 className="text-lg tracking-tight">{item.rule}</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl tracking-tight">Cinq par jour, pas cinq cents</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Un fichier de dix mille contacts ne se travaille pas. Cinq dossiers instruits se
            traitent avant midi.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Créer un compte
          </Link>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground">
          <span>Prospect AI · données publiques françaises</span>
          <span>Aucune donnée nominative collectée.</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Une pièce réelle.
 *
 * Les faits cités viennent d'un scan effectif sur un commerce d'Angers. Une
 * capture inventée serait plus flatteuse et vaudrait moins : tout le produit
 * repose sur le fait que ces lignes se vérifient.
 */
function Dossier() {
  return (
    <figure className="rounded-xl border bg-card p-6 shadow-[0_1px_3px_rgba(22,29,26,.05)] motion-safe:animate-[rise_.6s_cubic-bezier(.2,.7,.3,1)_both]">
      <figcaption className="flex items-baseline justify-between gap-4 border-b pb-4">
        <span className="text-lg tracking-tight">L’INSOLENT</span>
        <span className="field-label">Prêt-à-porter · Angers</span>
      </figcaption>

      <div className="mt-5">
        <p className="field-label">Pourquoi cette entreprise</p>
        <p className="reasoning mt-2 text-base">
          Certificat de sécurité expiré : les navigateurs affichent un avertissement avant le
          site. Ces éléments rendent une proposition de refonte pertinente. Ils ne disent pas que
          l’entreprise a formulé ce besoin.
        </p>
      </div>

      <div className="mt-6">
        <p className="field-label">Ce qui a été constaté</p>
        <div className="mt-2">
          {[
            'Certificat expiré le 25 octobre 2025',
            'Site servi sans HTTPS — avertissement affiché aux visiteurs',
            'Aucun formulaire ni page de contact trouvé',
          ].map((fact, index) => (
            <p key={fact} className="evidence">
              <span className="evidence__mark" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
              <span className="evidence__fact">{fact}</span>
            </p>
          ))}
        </div>
      </div>

      <p className="mt-6 rounded-lg bg-[var(--caution-wash)] p-3 text-xs leading-relaxed text-[var(--caution)]">
        Pas de téléphone connu : le contact devra passer par le formulaire du site.
      </p>
    </figure>
  );
}
