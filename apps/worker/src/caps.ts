/**
 * Plafonds par type de job, dans un même worker.
 *
 * Certains jobs se partagent une ressource à une seule place : la
 * découverte OSM passe par un client Overpass à une requête à la fois
 * (une ressource bénévole, à ne pas saturer). Réclamer six jobs de
 * découverte d'un coup, c'est en faire attendre cinq dans le pool — six
 * places occupées, une seule qui travaille, et plus aucune pour le scan,
 * la recherche de sites ou le backfill. Ce sont ces attentes qui, passées
 * quinze minutes, faisaient reprendre le job par le balayage et le
 * lançaient une seconde fois.
 *
 * Le plafond se lit avant de réclamer : les types pleins sont exclus de la
 * réclamation, les autres jobs passent devant.
 */
export const TYPE_CAPS: Readonly<Record<string, number>> = {
  discover_osm: 1,
  // Boucles longues sur la base, une entreprise à la fois : deux copies
  // se marcheraient dessus sans rien accélérer.
  resolve_identity_local: 1,
  backfill_contacts: 1,
};

/** Les types encore réclamables, compte tenu de ce qui tourne déjà. Pur. */
export function claimableTypes(
  all: readonly string[],
  inFlight: ReadonlyMap<string, number>,
  caps: Readonly<Record<string, number>> = TYPE_CAPS,
): string[] {
  return all.filter((type) => {
    const cap = caps[type];
    if (cap === undefined) return true;
    return (inFlight.get(type) ?? 0) < cap;
  });
}

export interface ClaimStep {
  types: string[];
  size: number;
}

/**
 * Le plan de réclamation d'un tour de boucle : une réclamation d'un seul
 * job par type plafonné encore libre, puis une réclamation du reste de la
 * capacité pour les types sans plafond. Réclamer les six d'un coup laissait
 * passer six jobs de découverte dans le même lot, le plafond n'étant lu
 * qu'avant la réclamation. Pur.
 */
export function claimPlan(
  capacity: number,
  all: readonly string[],
  inFlight: ReadonlyMap<string, number>,
  caps: Readonly<Record<string, number>> = TYPE_CAPS,
): ClaimStep[] {
  if (capacity <= 0) return [];
  const steps: ClaimStep[] = [];
  let remaining = capacity;
  for (const type of all) {
    const cap = caps[type];
    if (cap === undefined) continue;
    const free = cap - (inFlight.get(type) ?? 0);
    if (free <= 0 || remaining <= 0) continue;
    const size = Math.min(free, remaining);
    steps.push({ types: [type], size });
    remaining -= size;
  }
  const uncapped = all.filter((type) => caps[type] === undefined);
  if (remaining > 0 && uncapped.length > 0) steps.push({ types: uncapped, size: remaining });
  return steps;
}
