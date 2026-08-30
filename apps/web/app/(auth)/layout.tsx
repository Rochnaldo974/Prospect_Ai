import Link from 'next/link';

/**
 * L'écran d'entrée.
 *
 * Deux colonnes sur grand écran : le formulaire à gauche, et à droite un
 * extrait de ce que le produit livre réellement. Montrer une opportunité
 * plutôt qu'une promesse — c'est la seule chose qui distingue ce service d'un
 * annuaire, autant la mettre sous les yeux avant l'inscription.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <Link
          href="/"
          className="field-label mb-10 inline-block w-fit underline-offset-4 hover:underline"
        >
          Prospect AI
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <aside className="hidden border-l bg-[var(--mist)] lg:flex lg:flex-col lg:justify-center lg:px-16">
        <Specimen />
      </aside>
    </div>
  );
}

/**
 * Un vrai constat, pas un argumentaire.
 *
 * Les faits cités sont ceux qu'un scan a réellement produits — un certificat
 * expiré et l'absence de HTTPS sur un commerce d'Angers. Une capture inventée
 * serait plus jolie et vaudrait moins : tout le produit repose sur le fait que
 * ces lignes se vérifient.
 */
function Specimen() {
  return (
    <figure className="max-w-md">
      <figcaption className="field-label">Ce qu’un abonné a reçu ce matin</figcaption>

      <blockquote className="reasoning mt-4">
        « L’INSOLENT, prêt-à-porter à Angers. Certificat de sécurité expiré : les navigateurs
        affichent un avertissement avant le site. Ces éléments rendent une proposition de refonte
        pertinente. Ils ne disent pas que l’entreprise a formulé ce besoin. »
      </blockquote>

      <div className="mt-8">
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

      <p className="mt-8 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Chaque affirmation porte sa source et sa date. Quand rien ne justifie d’appeler
        aujourd’hui plutôt que dans six mois, le service le dit au lieu de l’inventer.
      </p>
    </figure>
  );
}
