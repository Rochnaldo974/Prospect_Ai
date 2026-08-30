/**
 * Le temps que ça prend, avant et après.
 *
 * Trois versions pour arriver ici. La première détaillait la semaine tâche
 * par tâche : six lignes, des durées à la minute, un lecteur noyé. La
 * deuxième mettait deux gros blocs pleins côte à côte — plus court, mais
 * bruyant, et surtout les deux barres vivaient chacune dans sa carte, donc
 * ne se comparaient pas.
 *
 * Deux barres sur le MÊME axe suffisent, et c'est la seule disposition où le
 * rapport se voit sans être calculé. Le reste — cadres, aplats, couleurs de
 * fond — n'ajoutait rien à cette lecture.
 *
 * Les durées sont annoncées pour ce qu'elles sont : un ordre de grandeur,
 * pas une mesure. Ce produit vend le fait qu'on peut le vérifier.
 */

const BEFORE = 8;
const AFTER = 1;

export function TimeGain() {
  const rows = [
    { label: 'Aujourd’hui', hours: BEFORE, color: 'var(--finding)' },
    { label: 'Avec Prospect AI', hours: AFTER, color: 'var(--brand)' },
  ];

  return (
    <div className="rounded-2xl border bg-card p-7 sm:p-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <p className="field-label">Le temps que ça vous prend</p>
        <p className="text-sm text-muted-foreground">
          <span className="tabular font-medium text-foreground">{BEFORE - AFTER} h</span> reprises
          chaque semaine
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4 sm:gap-6">
            <span className="w-32 shrink-0 text-sm sm:w-44">{row.label}</span>

            {/* Les deux barres partagent l'axe : c'est le rapport entre elles
                qui porte l'argument, pas leur longueur absolue. */}
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
              <span
                className="block h-full rounded-full"
                style={{ width: `${(row.hours / BEFORE) * 100}%`, backgroundColor: row.color }}
              />
            </span>

            <span className="tabular w-24 shrink-0 text-right text-sm">
              <span className="font-medium">{row.hours} h</span>
              <span className="text-muted-foreground"> / sem.</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-7 border-t pt-5 text-sm leading-relaxed text-muted-foreground">
        Chercher qui appeler, ouvrir les sites un par un, retrouver un numéro : c’est cette
        partie-là qui disparaît. Il vous reste cinq dossiers à lire le matin, et des appels à
        passer.
      </p>
    </div>
  );
}
