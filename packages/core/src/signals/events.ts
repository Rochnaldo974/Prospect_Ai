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

/** Fenêtre au-delà de laquelle un dépôt de domaine n'est plus un motif de contact. */
const DOMAIN_REGISTRATION_WINDOW_DAYS = 90;

/**
 * Crée les événements de dépôt de domaine manquants.
 *
 * Une entreprise établie ne « vient pas d'être créée », mais elle peut venir
 * de déposer un nom de domaine — et c'est un fait daté, public, vérifiable.
 * Il dit quelque chose de précis : cette entreprise investit son site en ce
 * moment. C'est le seul événement récent qui touche des entreprises anciennes,
 * donc joignables, là où la création d'entreprise ne touche que des structures
 * neuves dont on n'a aucun contact.
 *
 * On ne date pas le fait à notre découverte : registered_at vient du fichier
 * AFNIC et vaudrait la même chose si on l'avait lu six mois plus tard.
 */
export async function materializeDomainRegistrationEvents(
  db: Db,
  options: { limit?: number; logger?: Logger } = {},
): Promise<MaterializeReport> {
  const report: MaterializeReport = { created: 0, skipped: 0, errors: 0 };
  const since = new Date(Date.now() - DOMAIN_REGISTRATION_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Pas de jointure côté PostgREST : companies.domain n'est pas une clé
  // étrangère vers domains, et ne peut pas l'être — plusieurs entreprises d'un
  // même réseau partagent le site de la marque. On rapproche en deux temps.
  //
  // Le sens de la jointure compte : partir des domaines ferait balayer les
  // millions de .fr du fichier AFNIC pour n'en retenir qu'une poignée, et la
  // limite de lignes de l'API tronquerait le résultat en silence. On part donc
  // des entreprises, qui sont trois ordres de grandeur moins nombreuses.
  const { data: companies, error } = await db
    .from('companies')
    .select('id, domain')
    .not('domain', 'is', null)
    .limit(options.limit ?? 2000);

  if (error) throw new Error(`materializeDomainRegistrationEvents : ${error.message}`);
  if (!companies || companies.length === 0) return report;

  const rows = companies.filter((c): c is { id: string; domain: string } => c.domain !== null);
  const names = [...new Set(rows.map((c) => c.domain))];

  // Découpage volontairement court : une liste d'identifiants trop longue
  // dépasse la taille d'URL acceptée et fait échouer la requête entière.
  const registeredAt = new Map<string, string>();
  for (let i = 0; i < names.length; i += 100) {
    const { data: recent, error: domainError } = await db
      .from('domains')
      .select('domain, registered_at')
      .in('domain', names.slice(i, i + 100))
      .not('registered_at', 'is', null)
      .gte('registered_at', since);

    if (domainError) throw new Error(`materializeDomainRegistrationEvents : ${domainError.message}`);
    for (const d of recent ?? []) {
      if (d.registered_at) registeredAt.set(d.domain, d.registered_at);
    }
  }

  if (registeredAt.size === 0) return report;

  for (const row of rows) {
    const date = registeredAt.get(row.domain);
    if (!date) continue;

    const { error: insertError } = await db.from('company_events').insert({
      company_id: row.id,
      event_type: 'domain_registered',
      payload: { domain: row.domain, registered_at: date },
      importance: 78,
      // Le dépôt est certain ; ce qu'il signifie l'est moins qu'une création
      // d'entreprise, d'où une confiance en retrait.
      confidence: 0.85,
      source: 'afnic',
      occurred_at: `${date}T00:00:00Z`,
      dedupe_key: `domain_registered:${row.id}:${date}`,
    });

    if (!insertError) report.created += 1;
    else if (insertError.code === '23505') report.skipped += 1;
    else {
      report.errors += 1;
      options.logger?.warn('Événement de dépôt non enregistré', {
        company_id: row.id, error: insertError.message,
      });
    }
  }

  options.logger?.info('Événements de dépôt de domaine matérialisés', {
    created: report.created, skipped: report.skipped,
  });

  return report;
}
