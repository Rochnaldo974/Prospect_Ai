/**
 * L'exclusivité, dite une fois et en grand.
 *
 * C'est la promesse la plus facile à ne pas croire, donc celle qui a le plus
 * besoin d'être isolée. Une seule phrase au centre, un cadran, rien d'autre :
 * une section qui ne dit qu'une chose se retient mieux qu'une carte parmi
 * trois.
 */
export function Exclusive() {
  return (
    <div className="grid items-center gap-14 lg:grid-cols-[1fr_auto] lg:gap-20">
      <div>
        <p className="field-label">Une entreprise, une personne</p>
        <p className="mt-6 text-[clamp(1.5rem,2.9vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
          Quand une entreprise vous est proposée, elle n’est proposée
          <span className="text-[var(--brand)]"> à personne d’autre</span>.
        </p>
        <p className="reasoning mt-6 max-w-lg text-muted-foreground">
          Pendant 72 heures, elle est à vous seul. Passé ce délai, si vous n’en avez rien fait,
          elle repart dans le circuit. Vous n’arrivez jamais quatrième sur un dirigeant déjà
          sollicité trois fois le même mois.
        </p>
      </div>

      <Window />
    </div>
  );
}

/**
 * Les trois jours, puis la remise en circulation.
 *
 * Un cadran rempli à 72 % aurait été joli et faux : il aurait laissé croire
 * à une proportion, alors que 72 est un nombre d'heures. Quatre colonnes
 * disent la vraie chose — trois jours à vous, et ce qui se passe après.
 */
function Window() {
  const days = [
    ['Jour 1', true],
    ['Jour 2', true],
    ['Jour 3', true],
    ['Ensuite', false],
  ] as const;

  return (
    <div className="w-full max-w-xs shrink-0 lg:w-72">
      <div className="flex gap-1.5">
        {days.map(([label, mine]) => (
          <div key={label} className="flex-1">
            <div
              className={`h-20 rounded-lg ${
                mine
                  ? 'bg-[var(--brand)]'
                  : 'border border-dashed bg-[var(--mist)]'
              }`}
            />
            <p
              className={`mt-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] ${
                mine ? 'text-[var(--brand)]' : 'text-muted-foreground'
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        Trois jours pendant lesquels vous êtes seul à l’avoir.
        <br />
        Ensuite, elle repart dans le circuit.
      </p>
    </div>
  );
}
