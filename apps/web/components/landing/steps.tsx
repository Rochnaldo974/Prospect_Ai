/**
 * Les trois temps du service.
 *
 * Un rail continu plutôt que trois cartes côte à côte : l'ordre compte ici,
 * et deux de ces trois étapes se passent sans vous. C'est tout l'argument —
 * autant que la forme le dise avant le texte.
 */
export function Steps() {
  const steps = [
    {
      n: '1',
      title: 'Vous dites ce que vous faites',
      body: 'Refonte, création, e-commerce, application mobile. Trois questions, une minute, et c’est modifiable à tout moment.',
      by: 'Vous',
    },
    {
      n: '2',
      title: 'Le moteur cherche pendant que vous travaillez',
      body: 'Il analyse des sites d’entreprises françaises en continu et ne retient que ceux dont le problème est visible et récent.',
      by: 'Nous',
    },
    {
      n: '3',
      title: 'Cinq dossiers vous attendent le matin',
      body: 'Avec ce qui cloche, depuis quand, ce qu’il reste à vérifier, et le numéro pour en parler.',
      by: 'Nous',
    },
  ];

  return (
    <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
      {/* Le fil qui relie les trois temps. Décoratif, donc masqué en étroit
          où les étapes s'empilent et où il ne relierait plus rien. */}
      <span
        aria-hidden
        className="absolute left-0 right-0 top-6 hidden h-px bg-[var(--line)] md:block"
      />

      {steps.map((step) => (
        <li key={step.n} className="relative">
          <div className="flex items-center gap-3">
            <span className="tabular relative z-10 grid size-12 place-items-center rounded-full border bg-card font-mono text-sm font-medium">
              {step.n}
            </span>
            <span
              className={`relative z-10 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                step.by === 'Vous'
                  ? 'bg-[var(--brand-wash)] text-[var(--brand)]'
                  : 'bg-[var(--mist)] text-muted-foreground'
              }`}
            >
              {step.by}
            </span>
          </div>

          <h3 className="mt-6 text-lg font-semibold leading-snug tracking-tight">{step.title}</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
