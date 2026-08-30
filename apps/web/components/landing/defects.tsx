/**
 * Ce qu’un site en fin de vie donne à voir.
 *
 * La version précédente de ce bloc s’appelait « quatre familles de preuves »
 * et parlait de certificats, de feuilles de style et de SIREN. C’était exact
 * et illisible : le lecteur n’achète pas une méthode de détection, il achète
 * un client à rappeler. Chaque défaut est donc MONTRÉ — une petite fenêtre
 * qui reproduit ce que voit le visiteur — puis nommé en français courant.
 *
 * Le vocabulaire technique reste dans le produit, où il sert à vérifier.
 * Ici il ne servirait qu’à impressionner.
 */
export function Defects() {
  return (
    <div className="mt-14 grid gap-5 md:grid-cols-2">
      <Card
        title="Le site ne s’ouvre plus"
        body="Une erreur, une page blanche, ou un avertissement rouge avant même d’entrer. Le dirigeant l’ignore presque toujours : il ne visite jamais son propre site."
        visual={<Broken />}
      />
      <Card
        title="Illisible sur un téléphone"
        body="Il faut pincer et faire glisser pour lire une ligne. C’est pourtant depuis un téléphone que la plupart de ses clients le découvrent."
        visual={<Tiny />}
      />
      <Card
        title="Un site qui a dix ans, et ça se voit"
        body="La date des outils employés est inscrite dans la page. Un site monté en 2011 le dit lui-même — inutile d’en juger au goût."
        visual={<Old />}
      />
      <Card
        title="Quatre secondes avant d’afficher"
        body="Chaque seconde d’attente fait partir des visiteurs. Le temps de réponse se mesure, il ne s’estime pas."
        visual={<Slow />}
      />
    </div>
  );
}

function Card({
  title, body, visual,
}: {
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      {/* Hauteur fixe : sans elle, quatre vignettes de tailles différentes
          décalent les quatre titres, et la grille se lit de travers. */}
      <div className="grid h-44 place-items-center border-b bg-[var(--mist)] px-6">{visual}</div>
      <div className="px-6 pb-7 pt-6">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}

/** Le châssis de navigateur, commun aux quatre vignettes. */
function Frame({ children, width = 'w-full' }: { children: React.ReactNode; width?: string }) {
  return (
    <div className={`${width} overflow-hidden rounded-lg border bg-card shadow-sm`}>
      <div className="flex items-center gap-1.5 border-b bg-[var(--white)] px-3 py-2">
        <span className="size-1.5 rounded-full bg-[var(--line)]" />
        <span className="size-1.5 rounded-full bg-[var(--line)]" />
        <span className="size-1.5 rounded-full bg-[var(--line)]" />
      </div>
      {children}
    </div>
  );
}

function Broken() {
  return (
    <Frame width="w-full max-w-xs">
      <div className="grid place-items-center gap-2 px-5 py-8 text-center">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-[var(--finding-wash)] text-sm text-[var(--finding)]"
        >
          !
        </span>
        <p className="text-xs font-medium">Ce site est inaccessible</p>
        <p className="font-mono text-[10px] text-muted-foreground">erreur 503</p>
      </div>
    </Frame>
  );
}

function Tiny() {
  return (
    <div className="flex w-full max-w-xs items-end justify-center gap-4">
      <div className="w-[74px] overflow-hidden rounded-[14px] border-4 border-[var(--ink)] bg-card">
        {/* Le texte déborde du cadre : c’est exactement ce que le visiteur
            voit, et aucune légende ne l’explique mieux. */}
        <div className="space-y-1 p-1.5">
          <div className="h-1 w-[140%] rounded-full bg-[var(--ink)]/70" />
          <div className="h-1 w-[130%] rounded-full bg-[var(--line)]" />
          <div className="h-1 w-[145%] rounded-full bg-[var(--line)]" />
          <div className="h-1 w-[125%] rounded-full bg-[var(--line)]" />
          <div className="mt-2 h-4 w-[135%] rounded bg-[var(--line)]" />
        </div>
      </div>
      <p className="pb-2 text-xs leading-snug text-muted-foreground">
        La page dépasse
        <br />
        de l’écran
      </p>
    </div>
  );
}

function Old() {
  const rows = [
    ['Menu déroulant en Flash', '2009'],
    ['Bibliothèque jQuery 1.7', '2011'],
    ['Thème installé', '2013'],
  ];

  return (
    <div className="w-full max-w-xs space-y-1.5">
      {rows.map(([label, year]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 rounded-md border bg-card px-3 py-2"
        >
          <span className="truncate text-[11px]">{label}</span>
          <span className="tabular shrink-0 font-mono text-[11px] text-[var(--finding)]">
            {year}
          </span>
        </div>
      ))}
    </div>
  );
}

function Slow() {
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-baseline justify-between">
        <span className="field-label">Temps d’affichage</span>
        <span className="tabular font-mono text-sm font-medium text-[var(--finding)]">4,2 s</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full w-[84%] rounded-full bg-[var(--finding)]" />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0 s</span>
        <span>confortable : 1,5 s</span>
      </div>
    </div>
  );
}
