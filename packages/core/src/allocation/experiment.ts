import type { Db } from '../db/client';

/**
 * Mesure du groupe contrôle.
 *
 * Une opportunité sur cinq est tirée au hasard parmi les candidates éligibles
 * au lieu d'être choisie par le score. Le freelance ne peut pas les
 * distinguer. Comparer ce qu'elles donnent à ce que donnent les autres est la
 * SEULE façon de savoir si le moteur vaut mieux qu'un tirage — tout le reste
 * n'est qu'une intuition sur des chiffres qu'on a soi-même produits.
 *
 * Ce module refuse de conclure tant que l'échantillon ne le permet pas. Une
 * différence de trente points sur cinq attributions ne veut rien dire, et
 * l'afficher comme un résultat serait pire que ne rien afficher : on
 * prendrait des décisions produit sur du bruit.
 */

export interface GroupResult {
  /** Attributions closes, seules interprétables. */
  completed: number;
  contacted: number;
  /** A donné lieu à une suite : intéressé, rendez-vous, devis ou client. */
  positive: number;
  clients: number;
  contactRate: number | null;
  positiveRate: number | null;
}

export interface ExperimentReport {
  engine: GroupResult;
  control: GroupResult;
  /** Écart de taux de suite, en points. Null tant qu'il n'est pas lisible. */
  lift: number | null;
  /** Ce qu'on peut honnêtement dire de ces chiffres. */
  verdict: 'échantillon insuffisant' | 'aucun écart net' | 'moteur devant' | 'moteur derrière';
  /** Attributions closes nécessaires avant de pouvoir conclure. */
  minimumPerGroup: number;
}

/**
 * Seuil en dessous duquel on ne dit rien.
 *
 * Trente attributions closes par groupe : ce n'est pas une exigence
 * statistique rigoureuse, c'est le minimum en dessous duquel un écart de
 * quelques points s'explique entièrement par le hasard. Le dire clairement
 * vaut mieux qu'un pourcentage qui a l'air d'un résultat.
 */
const MINIMUM_PER_GROUP = 30;

/** Écart en dessous duquel on ne tranche pas, même avec assez de données. */
const NOISE_FLOOR_POINTS = 5;

export async function measureControlGroup(db: Db): Promise<ExperimentReport> {
  const { data, error } = await db
    .from('assignments')
    .select('is_control, status, contacted_at, outcome')
    .eq('status', 'completed');

  if (error) throw new Error(`measureControlGroup : ${error.message}`);

  const engine = summarise((data ?? []).filter((a) => !a.is_control));
  const control = summarise((data ?? []).filter((a) => a.is_control));

  const readable = engine.completed >= MINIMUM_PER_GROUP
    && control.completed >= MINIMUM_PER_GROUP
    && engine.positiveRate !== null
    && control.positiveRate !== null;

  const lift = readable
    ? Number((engine.positiveRate! - control.positiveRate!).toFixed(1))
    : null;

  return {
    engine,
    control,
    lift,
    verdict: lift === null
      ? 'échantillon insuffisant'
      : Math.abs(lift) < NOISE_FLOOR_POINTS
        ? 'aucun écart net'
        : lift > 0 ? 'moteur devant' : 'moteur derrière',
    minimumPerGroup: MINIMUM_PER_GROUP,
  };
}

/** Ce qui compte comme une suite : la conversation ne s'est pas arrêtée là. */
const POSITIVE = new Set(['interested', 'meeting', 'proposal', 'client']);

function summarise(
  rows: { contacted_at: string | null; outcome: string | null }[],
): GroupResult {
  const completed = rows.length;
  const contacted = rows.filter((r) => r.contacted_at !== null).length;
  const positive = rows.filter((r) => r.outcome !== null && POSITIVE.has(r.outcome)).length;
  const clients = rows.filter((r) => r.outcome === 'client').length;

  const rate = (part: number): number | null =>
    completed === 0 ? null : Number(((100 * part) / completed).toFixed(1));

  return {
    completed,
    contacted,
    positive,
    clients,
    contactRate: rate(contacted),
    positiveRate: rate(positive),
  };
}
