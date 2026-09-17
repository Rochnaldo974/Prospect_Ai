import { RateLimitedHttpClient, DEFAULT_USER_AGENT } from './client';

/**
 * La politique d'accès à chaque service externe, en un seul endroit.
 *
 * Chaque source déclare son débit, sa concurrence, son délai, ses relances
 * et son recul. Aucun `fetch()` externe ne part sans ces cinq réglages :
 * un service public gratuit qu'on interroge trop vite finit par nous
 * bloquer, et un appel payant sans délai peut coûter deux fois.
 */

export interface SourcePolicy {
  requestsPerSecond: number;
  concurrency: number;
  timeoutMs: number;
  maxRetries: number;
  /** Recul initial après un 429 ou un 5xx, doublé à chaque relance. */
  backoffMs: number;
  userAgent?: string;
}

export type SourceName =
  | 'osm' | 'bodacc' | 'boamp' | 'joafe' | 'sitadel' | 'afnic' | 'sirene_api' | 'ban'
  | 'google_places' | 'website_scan' | 'performance_audit' | 'data_gouv';

export const SOURCE_POLICIES: Record<SourceName, SourcePolicy> = {
  // Overpass rejette les clients pressés : une requête à la fois, lente.
  osm: { requestsPerSecond: 0.5, concurrency: 1, timeoutMs: 180_000, maxRetries: 3, backoffMs: 5_000 },
  bodacc: { requestsPerSecond: 2, concurrency: 2, timeoutMs: 60_000, maxRetries: 3, backoffMs: 1_000 },
  boamp: { requestsPerSecond: 2, concurrency: 2, timeoutMs: 60_000, maxRetries: 3, backoffMs: 1_000 },
  joafe: { requestsPerSecond: 2, concurrency: 2, timeoutMs: 60_000, maxRetries: 3, backoffMs: 1_000 },
  sitadel: { requestsPerSecond: 1, concurrency: 1, timeoutMs: 90_000, maxRetries: 3, backoffMs: 2_000 },
  afnic: { requestsPerSecond: 1, concurrency: 1, timeoutMs: 60_000, maxRetries: 2, backoffMs: 2_000 },
  // L'API SIRENE limite à trente appels par minute : on reste dessous.
  sirene_api: { requestsPerSecond: 0.4, concurrency: 1, timeoutMs: 30_000, maxRetries: 2, backoffMs: 3_000 },
  ban: { requestsPerSecond: 10, concurrency: 4, timeoutMs: 15_000, maxRetries: 2, backoffMs: 500 },
  // Payant : une relance au plus, jamais de rafale.
  google_places: { requestsPerSecond: 5, concurrency: 2, timeoutMs: 10_000, maxRetries: 1, backoffMs: 1_000 },
  // Les sites des commerçants : le scanner impose déjà un délai par hôte.
  website_scan: { requestsPerSecond: 20, concurrency: 6, timeoutMs: 15_000, maxRetries: 0, backoffMs: 0 },
  performance_audit: { requestsPerSecond: 10, concurrency: 4, timeoutMs: 8_000, maxRetries: 0, backoffMs: 0 },
  data_gouv: { requestsPerSecond: 2, concurrency: 2, timeoutMs: 60_000, maxRetries: 3, backoffMs: 1_000 },
};

const clients = new Map<SourceName, RateLimitedHttpClient>();

/** Un client par source, partagé dans le processus : le débit se compte une fois. */
export function httpClientFor(source: SourceName): RateLimitedHttpClient {
  let client = clients.get(source);
  if (!client) {
    const policy = SOURCE_POLICIES[source];
    client = new RateLimitedHttpClient({
      requestsPerSecond: policy.requestsPerSecond,
      concurrency: policy.concurrency,
      userAgent: policy.userAgent ?? DEFAULT_USER_AGENT,
      timeoutMs: policy.timeoutMs,
      maxRetries: policy.maxRetries,
      backoffMs: policy.backoffMs,
    });
    clients.set(source, client);
  }
  return client;
}

/** Pour les tests : repartir de clients neufs. */
export function resetHttpClients(): void {
  clients.clear();
}
