/**
 * Le dossier, ouvert.
 *
 * La version précédente reproduisait fidèlement la sortie du moteur : trois
 * paragraphes de prose, une liste de constats, une réserve, un numéro. Fidèle
 * et illisible en vitrine — cent cinquante mots gris là où le lecteur veut
 * savoir en trois secondes ce qu'il aurait à dire en décrochant.
 *
 * Le dossier complet reste dans le produit. Ici il est réduit à ses quatre
 * temps, et chacun porte sa couleur : le problème en corail, la preuve en
 * corail aussi puisqu'elle le constate, la réserve en ambre parce qu'elle
 * suspend le jugement, et l'angle d'appel en bleu — c'est la seule ligne qui
 * dit quoi FAIRE.
 *
 * Les constats sont ceux d'un scan réel. L'identité, elle, est masquée :
 * cette entreprise existe, n'a rien demandé, et publier « son site est en
 * panne » avec son numéro sur une page commerciale lui nuirait sans rien
 * ajouter. Le masque est d'ailleurs conforme au produit, où le numéro
 * n'apparaît qu'une fois l'entreprise attribuée.
 */

const EVIDENCE = [
  'Le site ne répond pas — erreur 503',
  'Alerte de sécurité affichée aux visiteurs',
  'Adresse du site déposée il y a 14 ans',
];

const OUTCOMES = ['Pas de réponse', 'Pas intéressé', 'Intéressé', 'Rendez-vous', 'Devis', 'Client'];

export function DossierPreview() {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04),0_32px_80px_-32px_rgba(11,13,20,.28)]">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-[var(--brand)] px-6 py-5 text-white sm:px-8">
        <div>
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">Restaurant · Angers</h3>
          <p className="mt-0.5 text-sm text-white/70">Nom et coordonnées masqués sur cette page</p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="field-label rounded-full bg-white/15 px-3 py-1.5 text-white">
            Refonte de site
          </span>
          <span className="tabular rounded-full bg-white px-3 py-1.5 font-mono text-[13px] font-medium text-[var(--brand)]">
            89/100
          </span>
        </div>
      </header>

      <div className="grid gap-x-10 gap-y-9 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <p className="field-label" style={{ color: 'var(--finding)' }}>
            Le problème
          </p>
          <p className="mt-3 text-lg font-medium leading-snug">
            Son site ne s’ouvre plus.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Ni carte, ni horaires, ni réservation, pour qui le cherche aujourd’hui.
          </p>

          <div className="mt-6">
            <BrokenSite />
          </div>
        </section>

        <div className="space-y-6">
          <section>
            <p className="field-label">Ce qui le prouve</p>
            <ul className="mt-3 space-y-2.5">
              {EVIDENCE.map((fact) => (
                <li key={fact} className="flex items-start gap-3 text-sm leading-snug">
                  <span
                    aria-hidden
                    className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--finding)]"
                  />
                  {fact}
                </li>
              ))}
            </ul>
          </section>

          {/* La réserve porte sa propre couleur : un dossier qui annonce ce
              qu'il ignore est un dossier dont on peut croire le reste. */}
          <section
            className="rounded-xl border px-4 py-3.5"
            style={{ borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--warning) 8%, transparent)' }}
          >
            <p className="field-label" style={{ color: 'var(--warning)' }}>
              À vérifier avant d’appeler
            </p>
            <p className="mt-1.5 text-sm leading-snug" style={{ color: 'var(--warning)' }}>
              Nous ignorons depuis quand le site est en panne.
            </p>
          </section>

          <section className="rounded-xl bg-[var(--brand-wash)] px-4 py-3.5">
            <p className="field-label" style={{ color: 'var(--brand)' }}>
              Par quoi commencer
            </p>
            <p className="mt-1.5 text-sm leading-snug text-[var(--brand)]">
              Proposer un audit court centré sur la remise en ligne.
            </p>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t bg-[var(--mist)] px-6 py-5 sm:px-8">
        <div>
          <p className="font-mono text-base tracking-tight text-muted-foreground">
            02 •• •• •• ••
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Exclusif 72 h · numéro visible dans votre tableau de bord
          </p>
        </div>

        {/* La boucle de retour fait partie du produit : la montrer dit que le
            service ne s'arrête pas à la livraison du contact. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="field-label mr-1">Après l’appel</span>
          {OUTCOMES.map((label) => (
            <span
              key={label}
              className="rounded-full border bg-card px-3 py-1.5 text-[13px] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </footer>
    </figure>
  );
}

/** Ce que voit un client qui cherche l’adresse du restaurant. */
function BrokenSite() {
  return (
    <div className="overflow-hidden rounded-lg border bg-[var(--mist)]" aria-hidden>
      <div className="flex items-center gap-1.5 border-b bg-card px-3 py-2">
        <span className="size-1.5 rounded-full bg-[var(--line)]" />
        <span className="size-1.5 rounded-full bg-[var(--line)]" />
        <span className="size-1.5 rounded-full bg-[var(--line)]" />
      </div>
      <div className="grid place-items-center gap-2 px-5 py-8 text-center">
        <span className="grid size-9 place-items-center rounded-full bg-[var(--finding-wash)] text-base text-[var(--finding)]">
          !
        </span>
        <p className="text-sm font-medium">Ce site est inaccessible</p>
        <p className="font-mono text-[11px] text-muted-foreground">erreur 503</p>
      </div>
    </div>
  );
}
