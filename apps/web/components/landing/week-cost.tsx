'use client';

import { useInView } from '@/lib/hooks/use-in-view';

/**
 * Une semaine de prospection, dessinée.
 *
 * C'est le seul endroit de la page où l'on force le trait, et c'est
 * volontaire : le développeur qui lit cette page a déjà prospecté, il a
 * détesté ça, et ce qu'il veut récupérer n'est pas « plus de clients » mais
 * ses soirées. Le reste de la page reste sobre pour que ce bloc porte.
 *
 * Les durées sont présentées pour ce qu'elles sont — une semaine type, pas
 * une mesure. Un chiffre inventé et présenté comme mesuré ruinerait la seule
 * chose que ce produit vend : qu'on peut le croire sur parole.
 */

/** Un demi-quart d'heure par segment. Trente minutes, une case. */
const SLOT = 30;

const WITHOUT = [
  { task: 'Chercher des entreprises à contacter', minutes: 180 },
  { task: 'Ouvrir les sites un par un pour voir s’il y a un besoin', minutes: 120 },
  { task: 'Retrouver le bon numéro ou le bon formulaire', minutes: 90 },
  { task: 'Écrire des messages qui restent sans réponse', minutes: 90 },
];

const WITH = [
  { task: 'Lire cinq dossiers, le matin, café à la main', minutes: 50 },
  { task: 'Appeler les deux ou trois qui vous parlent', minutes: 40 },
];

function hours(list: Array<{ minutes: number }>) {
  const total = list.reduce((sum, row) => sum + row.minutes, 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export function WeekCost() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <Panel
        kind="before"
        heading="Comme d’habitude"
        total={hours(WITHOUT)}
        rows={WITHOUT}
        inView={inView}
        note="Et le pire : la plupart de ces entreprises n’avaient aucun besoin. Vous l’avez découvert après avoir écrit."
      />
      <Panel
        kind="after"
        heading="Avec Prospect AI"
        total={hours(WITH)}
        rows={WITH}
        inView={inView}
        note="La recherche est déjà faite quand vous vous levez. Il ne vous reste que la partie qui rapporte."
      />
    </div>
  );
}

function Panel({
  kind, heading, total, rows, note, inView,
}: {
  kind: 'before' | 'after';
  heading: string;
  total: string;
  rows: Array<{ task: string; minutes: number }>;
  note: string;
  inView: boolean;
}) {
  const after = kind === 'after';

  return (
    <div
      className={`flex flex-col rounded-2xl p-7 sm:p-9 ${
        after
          ? 'bg-[var(--brand)] text-white'
          : 'border border-white/12 bg-white/[0.04] text-white'
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className={`field-label ${after ? 'text-white/70' : 'text-white/45'}`}>{heading}</p>
        <p className="tabular text-3xl font-semibold tracking-tight">
          {total}
          <span className={`ml-1.5 text-xs font-normal ${after ? 'text-white/70' : 'text-white/45'}`}>
            / semaine
          </span>
        </p>
      </div>

      <div className="mt-8 space-y-5">
        {rows.map((row, i) => (
          <div key={row.task}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm leading-snug">{row.task}</span>
              <span
                className={`tabular shrink-0 font-mono text-[11px] ${
                  after ? 'text-white/70' : 'text-white/45'
                }`}
              >
                {row.minutes} min
              </span>
            </div>

            {/* Une case par demi-heure. Le rapport entre les deux colonnes se
                lit sans avoir à comparer deux nombres. */}
            <div className="mt-2.5 flex gap-1" aria-hidden>
              {Array.from({ length: Math.ceil(row.minutes / SLOT) }).map((_, slot) => (
                <span
                  key={slot}
                  className={`h-2 flex-1 origin-left rounded-[2px] transition-transform duration-500 ease-out ${
                    after ? 'bg-white/85' : 'bg-[var(--finding)]'
                  } ${inView ? 'scale-x-100' : 'scale-x-0'}`}
                  style={{ transitionDelay: `${i * 120 + slot * 45}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p
        className={`mt-auto pt-8 text-sm leading-relaxed ${
          after ? 'text-white/80' : 'text-white/55'
        }`}
      >
        {note}
      </p>
    </div>
  );
}
