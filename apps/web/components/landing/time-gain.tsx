'use client';

import { useInView } from '@/lib/hooks/use-in-view';

/**
 * Ce que la prospection coûte, et ce que le service en retire.
 *
 * Deux niveaux de lecture, et c'est la correction demandée : la version
 * précédente exigeait de lire douze phrases complètes pour comprendre la
 * section. Chaque cellule commence maintenant par un verdict en gras de
 * deux à quatre mots — « Chercher au hasard. » / « Cinq dossiers prêts. » —
 * et l'œil peut ne lire que ces paires. La phrase qui suit ne sert qu'à qui
 * veut vérifier.
 *
 * La colonne de droite est posée sur un voile bleu continu : le camp
 * gagnant se voit avant de se lire. Les marques ✕/✓ passent en pastilles
 * pleines pour ancrer chaque ligne.
 *
 * Les durées restent annoncées pour ce qu'elles sont : un ordre de
 * grandeur, pas une mesure.
 */

const BEFORE = 8;
const AFTER = 1;

/** Chaque grief avec sa réponse. L'ordre suit celui d'une journée. */
/**
 * Chaque grief avec sa réponse, une ligne chacun.
 *
 * Les preuves tiennent en une demi-phrase : la section doit entrer dans un
 * écran de portable, et c'est le verdict en gras qui porte — le reste ne
 * fait que confirmer.
 */
const PAIRS: Array<{
  pain: [string, string];
  answer: [string, string];
}> = [
  {
    pain: ['Chercher au hasard.', 'Des heures pour zéro besoin trouvé.'],
    answer: ['Cinq dossiers prêts.', 'Besoin constaté, daté, dans vos cordes.'],
  },
  {
    pain: ['Vingt sites à ouvrir.', 'Pour un seul qui cloche.'],
    answer: ['Déjà analysés.', 'Défaut nommé, vérifiable en une minute.'],
  },
  {
    pain: ['Le contact introuvable.', ''],
    answer: ['Le numéro est dans le dossier.', ''],
  },
  {
    pain: ['Quoi dire ?', 'Le message générique reste sans réponse.'],
    answer: ['L’angle est écrit.', 'Et pourquoi appeler maintenant.'],
  },
  {
    pain: ['Quatrième à appeler.', 'Déjà démarché trois fois.'],
    answer: ['Seul pendant 72 h.', 'Personne d’autre ne la reçoit.'],
  },
  {
    pain: ['Le fil se perd.', ''],
    answer: ['Suivi en un clic.', ''],
  },
];

export function TimeGain() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className="mt-10">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04),0_24px_60px_-32px_rgba(11,13,20,.2)]">
        <div className="grid md:grid-cols-2">
          <ColumnHead
            eyebrow="Aujourd’hui"
            hours={BEFORE}
            width="100%"
            color="var(--finding)"
            grown={inView}
          />
          <ColumnHead
            eyebrow="Avec Prospect AI"
            hours={AFTER}
            width={`${(AFTER / BEFORE) * 100}%`}
            color="var(--brand)"
            grown={inView}
            highlighted
          />

          {PAIRS.map(({ pain, answer }) => (
            <Pair key={pain[0]} pain={pain} answer={answer} />
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Une heure contre huit : ordre de grandeur pour une prospection menée sérieusement, pas
        une mesure.
      </p>
    </div>
  );
}

function ColumnHead({
  eyebrow, hours, width, color, grown, highlighted = false,
}: {
  eyebrow: string;
  hours: number;
  width: string;
  color: string;
  grown: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className="border-b px-6 py-4.5 sm:px-7"
      style={{ backgroundColor: highlighted ? 'color-mix(in srgb, var(--brand) 5%, var(--white))' : undefined }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="field-label" style={{ color }}>
          {eyebrow}
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className="tabular text-2xl font-semibold tracking-tight" style={{ color }}>
            {hours} h
          </span>
          <span className="text-xs text-muted-foreground">/ semaine</span>
        </p>
      </div>

      {/* Les deux barres partagent l'échelle et poussent ensemble à l'entrée
          dans le champ : voir la petite s'arrêter tôt pendant que la grande
          continue, c'est l'argument joué plutôt qu'affiché. */}
      <div
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
        aria-hidden
      >
        <div
          className="h-full origin-left rounded-full transition-transform duration-[1100ms] ease-[cubic-bezier(.22,.9,.32,1)]"
          style={{ width, backgroundColor: color, transform: grown ? 'scaleX(1)' : 'scaleX(0)' }}
        />
      </div>
      {/* Réserve le vide à droite de la petite barre : sans piste visible,
          1/8 ressemble à une barre pleine plus courte, pas à un ratio. */}
    </div>
  );
}

/**
 * Une ligne, deux cellules émises dans la même grille : la réponse reste
 * alignée sur son grief quelle que soit la longueur des textes.
 */
function Pair({ pain, answer }: { pain: [string, string]; answer: [string, string] }) {
  return (
    <>
      <Cell mark="✕" color="var(--finding)" wash="var(--finding-wash)" lead={pain[0]} rest={pain[1]} />
      <Cell mark="✓" color="var(--brand)" wash="var(--brand-wash)" lead={answer[0]} rest={answer[1]} highlighted />
    </>
  );
}

function Cell({
  mark, color, wash, lead, rest, highlighted = false,
}: {
  mark: string;
  color: string;
  wash: string;
  lead: string;
  rest: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="flex gap-3.5 border-b px-6 py-3.5 last:border-b-0 sm:px-7 md:[&:nth-last-child(2)]:border-b-0"
      style={{ backgroundColor: highlighted ? 'color-mix(in srgb, var(--brand) 5%, var(--white))' : undefined }}
    >
      <span
        aria-hidden
        className="grid size-5.5 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
        style={{ color, backgroundColor: wash }}
      >
        {mark}
      </span>
      <p className="text-[15px] leading-snug">
        <span className="font-semibold">{lead}</span>
        {rest ? <span className="text-muted-foreground"> {rest}</span> : null}
      </p>
    </div>
  );
}
