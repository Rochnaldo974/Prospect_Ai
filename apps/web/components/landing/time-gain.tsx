'use client';

import { useInView } from '@/lib/hooks/use-in-view';

/**
 * Ce que la prospection coûte, et ce que le service en retire.
 *
 * Deux colonnes en vis-à-vis, une ligne par grief. La disposition n'est pas
 * décorative : chaque plainte a sa réponse EN FACE, sur la même ligne, et
 * c'est la seule mise en page où l'on n'a pas à se souvenir de la gauche en
 * lisant la droite. Deux listes empilées auraient dit la même chose et
 * n'auraient rien démontré.
 *
 * Les durées sont annoncées pour ce qu'elles sont : un ordre de grandeur,
 * pas une mesure. Ce produit vend le fait qu'on peut le vérifier — un
 * chiffre inventé et présenté comme mesuré coûterait plus qu'il ne rapporte.
 */

const BEFORE = 8;
const AFTER = 1;

/** Chaque grief avec sa réponse. L'ordre suit celui d'une journée de travail. */
const PAIRS: Array<[string, string]> = [
  [
    'Chercher des entreprises au hasard, sans savoir si l’une d’elles a le moindre besoin.',
    'Cinq entreprises par matin, dont le problème est déjà constaté et daté.',
  ],
  [
    'Ouvrir vingt sites à la main pour en trouver un seul qui cloche.',
    'Le site est analysé avant vous. Le défaut est nommé, et vérifiable en une minute.',
  ],
  [
    'Retrouver le bon numéro, le bon formulaire, la bonne personne.',
    'Le numéro que l’entreprise publie elle-même est dans le dossier.',
  ],
  [
    'Ne pas savoir quoi dire, et se rabattre sur un message générique.',
    'Un angle d’appel écrit pour ce dossier : par quoi commencer, et pourquoi maintenant.',
  ],
  [
    'Appeler un dirigeant que trois autres ont déjà démarché cette semaine.',
    'Exclusif 72 heures. Personne d’autre ne reçoit cette entreprise.',
  ],
  [
    'Perdre le fil de qui a été appelé, relancé, oublié.',
    'Vous notez l’issue en un clic ; l’entreprise sort du circuit ou y revient.',
  ],
];

export function TimeGain() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className="mt-16">
      <div className="grid border-b md:grid-cols-2">
        <Column
          side="before"
          eyebrow="Aujourd’hui"
          hours={BEFORE}
          width="100%"
          color="var(--finding)"
          grown={inView}
        />
        <Column
          side="after"
          eyebrow="Avec Prospect AI"
          hours={AFTER}
          width={`${(AFTER / BEFORE) * 100}%`}
          color="var(--brand)"
          grown={inView}
        />

        {PAIRS.map(([pain, answer]) => (
          <Fragment key={pain} pain={pain} answer={answer} />
        ))}
      </div>

      <p className="mt-10 text-sm leading-relaxed text-muted-foreground">
        Une heure contre huit : ordre de grandeur pour une prospection menée sérieusement, pas
        une mesure.
      </p>
    </div>
  );
}

function Column({
  side, eyebrow, hours, width, color, grown,
}: {
  side: 'before' | 'after';
  eyebrow: string;
  hours: number;
  width: string;
  color: string;
  grown: boolean;
}) {
  return (
    <div className={`pb-7 ${side === 'after' ? 'pt-10 md:border-l md:pl-10 md:pt-0' : 'md:pr-10'}`}>
      <p className="field-label" style={{ color }}>
        {eyebrow}
      </p>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-4xl font-semibold tracking-tight" style={{ color }}>
          {hours} h
        </span>
        <span className="text-sm text-muted-foreground">par semaine</span>
      </p>

      {/* Les deux barres partagent l'échelle et poussent ensemble à l'entrée
          dans le champ : voir la petite s'arrêter tôt pendant que la grande
          continue, c'est l'argument joué plutôt qu'affiché. */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
        <div
          className="h-full origin-left rounded-full transition-transform duration-[1100ms] ease-[cubic-bezier(.22,.9,.32,1)]"
          style={{ width, backgroundColor: color, transform: grown ? 'scaleX(1)' : 'scaleX(0)' }}
        />
      </div>
    </div>
  );
}

/**
 * Une ligne, deux cellules.
 *
 * Les deux cellules sont émises dans la même grille plutôt que dans deux
 * colonnes séparées : c'est ce qui garantit que la réponse reste alignée sur
 * son grief quelle que soit la longueur des textes.
 */
function Fragment({ pain, answer }: { pain: string; answer: string }) {
  return (
    <>
      <div className="flex gap-3.5 border-t py-5 md:pr-10">
        <span aria-hidden className="shrink-0 text-sm text-[var(--finding)]">
          ✕
        </span>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{pain}</p>
      </div>

      <div className="flex gap-3.5 border-t py-5 md:border-l md:pl-10">
        <span aria-hidden className="shrink-0 text-sm text-[var(--brand)]">
          ✓
        </span>
        <p className="text-[15px] leading-relaxed">{answer}</p>
      </div>
    </>
  );
}
