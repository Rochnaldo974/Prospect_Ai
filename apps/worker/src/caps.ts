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

export interface ClaimPlan {
  /** Les types plafonnés encore libres : un job chacun, l'un après l'autre. */
  capped: string[];
  /** Les types sans plafond : le reste de la capacité, une fois les plafonnés servis. */
  uncapped: string[];
}

/**
 * Le plan de réclamation d'un tour de boucle. Les types plafonnés encore
 * libres se réclament un par un ; le reste de la capacité — celle qui
 * reste RÉELLEMENT, après ce que ces réclamations ont rendu — va aux
 * autres. Compter d'avance une place par type plafonné, même quand la
 * file n'en a aucun, laissait les autres jobs en attente dès que deux
 * places se libéraient. Pur.
 */
export function claimPlan(
  all: readonly string[],
  inFlight: ReadonlyMap<string, number>,
  caps: Readonly<Record<string, number>> = TYPE_CAPS,
): ClaimPlan {
  const capped: string[] = [];
  const uncapped: string[] = [];
  for (const type of all) {
    const cap = caps[type];
    if (cap === undefined) uncapped.push(type);
    else if ((inFlight.get(type) ?? 0) < cap) capped.push(type);
  }
  return { capped, uncapped };
}
