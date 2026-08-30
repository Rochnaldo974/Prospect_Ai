import type { Db } from '../db/client';
import type { OpportunityType } from '../domain/types';

/**
 * Ce que le stock contient réellement, par famille.
 *
 * Sert à l'écran de paramétrage : cocher « application mobile » sans savoir
 * qu'il n'y a rien derrière, c'est réserver une place de sa journée à du vide.
 * Autant le dire au moment du choix.
 *
 * Ces nombres sont un ÉTAT, pas une promesse. Le stock se renouvelle chaque
 * nuit et se consomme dans la journée ; l'exclusivité fait qu'une opportunité
 * prise ne revient pas. L'interface doit donc les présenter comme « en ce
 * moment », jamais comme « vous recevrez ».
 */

export interface TypeAvailability {
  type: OpportunityType;
  /** Opportunités en stock, non attribuées. */
  available: number;
  /** Attribuées ces sept derniers jours : à quelle vitesse le stock part. */
  consumedPerWeek: number;
}

export async function availabilityByType(db: Db): Promise<TypeAvailability[]> {
  const { data, error } = await db
    .from('admin_inventory')
    .select('opportunity_type, available, consumed_per_day');

  if (error) throw new Error(`availabilityByType : ${error.message}`);

  return (data ?? [])
    .filter((row): row is typeof row & { opportunity_type: OpportunityType } =>
      row.opportunity_type !== null)
    .map((row) => ({
      type: row.opportunity_type,
      available: Number(row.available ?? 0),
      consumedPerWeek: Math.round(Number(row.consumed_per_day ?? 0) * 7),
    }));
}

/**
 * Formule le stock d'une famille en une ligne lisible.
 *
 * Trois régimes, parce que trois situations différentes appellent trois
 * phrases différentes — et qu'un « 0 » brut ferait croire à une panne alors
 * que c'est une information utile.
 */
export function describeAvailability(available: number): {
  label: string;
  tone: 'none' | 'thin' | 'healthy';
} {
  if (available === 0) {
    return { label: 'rien en stock pour l’instant', tone: 'none' };
  }

  if (available < 10) {
    return {
      label: available === 1 ? '1 opportunité en stock' : `${available} opportunités en stock`,
      tone: 'thin',
    };
  }

  // Au-delà de la dizaine, le chiffre exact n'aide plus à décider et donne une
  // fausse précision : le stock aura changé demain matin.
  const rounded = available < 100
    ? Math.floor(available / 10) * 10
    : Math.floor(available / 50) * 50;

  return { label: `plus de ${rounded} opportunités en stock`, tone: 'healthy' };
}
