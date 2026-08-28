import type { Db } from '../db/client';
import type { Logger } from '../logger';

/**
 * Matérialisation des faits datés en événements.
 *
 * Le moteur suit une chaîne stricte : fait → événement → signal → opportunité.
 * Un détecteur ne crée jamais d'événement, il en consomme — sans quoi la date
 * d'un déclencheur dépendrait du moment où on l'a regardé plutôt que du moment
 * où le fait s'est produit.
 *
 * La date de création d'une entreprise est un fait daté au même titre qu'une
 * annonce du BODACC : elle doit donc exister comme événement avant qu'un
 * signal puisse s'y adosser.
 */

export interface MaterializeReport {
  created: number;
  skipped: number;
  errors: number;
}

/** Fenêtre au-delà de laquelle une création n'est plus un motif de contact. */
const CREATION_WINDOW_DAYS = 120;

/**
 * Crée les événements de création manquants.
 *
 * Idempotent par clé de déduplication : rejouer la fonction ne produit rien.
 */
export async function materializeCreationEvents(
  db: Db,
  options: { limit?: number; logger?: Logger } = {},
): Promise<MaterializeReport> {
  const report: MaterializeReport = { created: 0, skipped: 0, errors: 0 };
  const since = new Date(Date.now() - CREATION_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: companies, error } = await db
    .from('companies')
    .select('id, siren, creation_date')
    .not('creation_date', 'is', null)
    .gte('creation_date', since)
    .limit(options.limit ?? 2000);

  if (error) throw new Error(`materializeCreationEvents : ${error.message}`);
  if (!companies || companies.length === 0) return report;

  const rows = companies.map((company) => ({
    company_id: company.id,
    event_type: 'company_created',
    payload: { creation_date: company.creation_date },
    importance: 92,
    confidence: 0.95,
    source: 'sirene',
    occurred_at: `${company.creation_date}T00:00:00Z`,
    // La clé porte l'identifiant de l'entreprise et la date : rejouer ne crée
    // rien, mais une correction de la date produit bien un nouvel événement.
    dedupe_key: `created:${company.id}:${company.creation_date}`,
  }));

  // Insertion ligne par ligne : le trigger de déduplication lève une violation
  // d'unicité pour les événements déjà connus, et un lot entier échouerait.
  for (const row of rows) {
    const { error: insertError } = await db.from('company_events').insert(row);
    if (!insertError) {
      report.created += 1;
    } else if (insertError.code === '23505') {
      report.skipped += 1;
    } else {
      report.errors += 1;
      options.logger?.warn('Événement de création non enregistré', {
        company_id: row.company_id,
        error: insertError.message,
      });
    }
  }

  options.logger?.info('Événements de création matérialisés', {
    created: report.created,
    skipped: report.skipped,
  });

  return report;
}
