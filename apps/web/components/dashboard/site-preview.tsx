'use client';

import { useState } from 'react';

/**
 * L'aperçu du site du prospect, dans la page du dossier.
 *
 * Un iframe, avec ses limites assumées : beaucoup de sites interdisent
 * l'intégration (X-Frame-Options) et un site en panne n'affiche rien — deux
 * cas indistinguables depuis notre page, le navigateur ne remontant aucune
 * erreur exploitable. La légende le dit, et le vrai geste reste « Ouvrir
 * dans un onglet » : le produit demande de VÉRIFIER sur le site réel, pas
 * de le juger à travers une vignette.
 *
 * sandbox="allow-same-origin" SANS allow-scripts : la page s'affiche, ses
 * scripts ne s'exécutent pas — c'est la combinaison scripts+same-origin
 * qui serait dangereuse, pas chacun séparément. Le sandbox entièrement
 * opaque (sandbox="") rendait un cadre blanc, constaté au banc : Chrome
 * refuse d'y peindre nos pages.
 */
export function SitePreview({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b bg-[var(--mist)]/60 px-5 py-3">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{url.replace(/^https?:\/\//, '')}</span>
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--brand)] underline-offset-4 hover:underline"
        >
          Ouvrir dans un onglet →
        </a>
      </figcaption>

      <div className="relative aspect-[16/9] bg-[var(--mist)]">
        {!loaded ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
            Chargement de l’aperçu…
          </p>
        ) : null}
        <iframe
          src={url}
          title="Aperçu du site du prospect"
          sandbox="allow-same-origin"
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          className="relative size-full"
        />
      </div>

      <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
        Aperçu vide ? Le site bloque l’intégration, ou ne répond pas — c’est parfois le constat
        lui-même. Ouvrez-le dans un onglet pour vérifier.
      </p>
    </figure>
  );
}
