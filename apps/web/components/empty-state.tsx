import Link from 'next/link';

/**
 * Un écran vide est une invitation à agir, jamais un constat d'échec.
 *
 * Trois règles, qui valent aussi pour les erreurs :
 *
 *   dire ce qui manque, pas ce qui a raté — « aucune opportunité en stock »
 *   plutôt que « erreur de chargement » ;
 *
 *   dire pourquoi, quand on le sait — un vide qui s'explique n'inquiète pas ;
 *
 *   proposer la suite. Un cul-de-sac laisse l'utilisateur chercher où cliquer,
 *   et c'est à ce moment-là qu'il conclut que le produit est cassé.
 */
export function EmptyState({
  title,
  explanation,
  action,
}: {
  title: string;
  explanation: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p className="text-base font-medium tracking-tight">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {explanation}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-block rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
