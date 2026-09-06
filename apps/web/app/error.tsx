'use client';

import { useEffect } from 'react';

/**
 * Quelque chose a cassé pendant le rendu.
 *
 * On propose de réessayer avant tout : la plupart de ces erreurs sont
 * passagères, et un rechargement les efface. Le détail technique reste dans la
 * console du navigateur — l'afficher n'aiderait personne et inquiéterait tout
 * le monde.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisé côté navigateur : le serveur a déjà sa propre trace.
    console.error('[prospect] rendu interrompu', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-6">
      <div className="w-full">
        <p className="field-label">Interruption</p>
        <div className="mt-3 rounded-lg border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-base font-medium tracking-tight">
            Cette page n&apos;a pas pu s&apos;afficher
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            La plupart de ces interruptions sont passagères. Réessayez — si elle revient, c&apos;est
            que le problème est de notre côté.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Réessayer
          </button>
          {error.digest ? (
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">
              référence {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
