import type { JobHandler } from './types';
import {
  ensurePartitionsHandler,
  expireAssignmentsHandler,
  expireOpportunitiesHandler,
  pruneEventKeysHandler,
  reclaimStalledHandler,
  refreshAdminStatsHandler,
  refreshFilterOptionsHandler,
} from './handlers/maintenance';
import { detectDuplicatesHandler, discoverOsmHandler, syncBodaccHandler } from './handlers/sources';
import { resolveWebsitesHandler, scanDomainsHandler } from './handlers/websites';

const HANDLERS: JobHandler<never>[] = [
  expireOpportunitiesHandler,
  expireAssignmentsHandler,
  ensurePartitionsHandler,
  reclaimStalledHandler,
  pruneEventKeysHandler,
  refreshFilterOptionsHandler,
  refreshAdminStatsHandler,
  discoverOsmHandler,
  syncBodaccHandler,
  detectDuplicatesHandler,
  scanDomainsHandler,
  resolveWebsitesHandler,
] as JobHandler<never>[];

const byType = new Map<string, JobHandler<never>>(HANDLERS.map((h) => [h.type, h]));

export function getHandler(type: string): JobHandler<never> | undefined {
  return byType.get(type);
}

export function registeredJobTypes(): string[] {
  return [...byType.keys()].sort();
}

/**
 * Détecte les collisions de type à l'import plutôt qu'au premier job traité
 * par le mauvais handler.
 */
if (byType.size !== HANDLERS.length) {
  const seen = new Set<string>();
  const duplicates = HANDLERS.map((h) => h.type).filter((t) => !seen.add(t));
  throw new Error(`Types de job en double dans le registre : ${duplicates.join(', ')}`);
}

export { HANDLERS };
