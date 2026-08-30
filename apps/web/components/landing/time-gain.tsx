/**
 * Le temps que ça prend, avant et après.
 *
 * Quatre versions pour arriver ici. Six lignes de tâches minutées d'abord —
 * précis, illisible. Deux blocs pleins ensuite — plus court, mais bruyant,
 * et surtout les deux barres vivaient chacune dans sa carte, donc ne se
 * comparaient pas. Elles partagent maintenant le même axe : c'est la seule
 * disposition où le rapport se voit sans être calculé.
 *
 * Les durées sont annoncées pour ce qu'elles sont : un ordre de grandeur,
 * pas une mesure. Ce produit vend le fait qu'on peut le vérifier — un
 * chiffre inventé et présenté comme mesuré coûterait plus qu'il ne rapporte.
 */

const BEFORE = 8;
const AFTER = 1;

const ROWS = [
  {
    label: 'Aujourd’hui',
    hours: BEFORE,
    detail: 'Chercher, ouvrir chaque site, retrouver un numéro, écrire.',
    color: 'var(--finding)',
  },
  {
    label: 'Avec Prospect AI',
    hours: AFTER,
    detail: 'Lire cinq dossiers le matin, et passer les appels.',
    color: 'var(--brand)',
  },
];

export function TimeGain() {
  return (
    <div className="mt-14">
      {ROWS.map((row) => (
        <div key={row.label} className="border-t py-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
            <p className="text-lg font-semibold tracking-tight">{row.label}</p>
            <p className="tabular text-3xl font-semibold tracking-tight" style={{ color: row.color }}>
              {row.hours} h
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">par semaine</span>
            </p>
          </div>

          {/* Les deux barres partagent l'axe : c'est le rapport entre elles
              qui porte l'argument, pas leur longueur absolue. */}
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${(row.hours / BEFORE) * 100}%`, backgroundColor: row.color }}
            />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{row.detail}</p>
        </div>
      ))}

      <p className="border-t pt-8 text-sm leading-relaxed text-muted-foreground">
        Une heure contre huit : ordre de grandeur pour une prospection menée sérieusement, pas
        une mesure.
      </p>
    </div>
  );
}
