/**
 * Le paramétrage, montré comme il se présente à l'inscription.
 *
 * L'objection du freelance n'est pas « y aura-t-il des prospects » mais
 * « seront-ils pour moi ». Reproduire l'écran de choix répond mieux qu'une
 * phrase : il voit sa propre configuration avant même de créer un compte.
 */
export function Filters() {
  const services = [
    ['Refonte de site', true],
    ['Création de site', true],
    ['E-commerce', true],
    ['Application mobile', false],
    ['Maintenance', false],
    ['Référencement', false],
  ] as const;

  const excluded = ['Immobilier', 'Assurance', 'Nuit'];

  return (
    <div className="rounded-2xl border bg-card p-7 shadow-[0_1px_2px_rgba(11,13,20,.04),0_28px_64px_-32px_rgba(11,13,20,.18)] sm:p-9">
      <p className="field-label">Ce que vous savez faire</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {services.map(([label, on]) => (
          <span
            key={label}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              on
                ? 'border-[var(--brand)] bg-[var(--brand-wash)] font-medium text-[var(--brand)]'
                : 'text-muted-foreground'
            }`}
          >
            {on ? '✓ ' : ''}
            {label}
          </span>
        ))}
      </div>

      <p className="field-label mt-9">Les secteurs que vous ne voulez pas</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {excluded.map((label) => (
          <span
            key={label}
            className="rounded-full border border-dashed px-3.5 py-1.5 text-sm text-muted-foreground line-through decoration-[var(--finding)]/60"
          >
            {label}
          </span>
        ))}
      </div>

      <p className="mt-9 border-t pt-6 text-sm leading-relaxed text-muted-foreground">
        Une entreprise qui sort de cette configuration ne vous est jamais proposée, même si
        c’est la meilleure opportunité de la journée. Elle ira à quelqu’un dont c’est le métier.
      </p>
    </div>
  );
}
