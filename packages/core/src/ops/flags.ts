import type { Db } from '../db/client';

/**
 * Les drapeaux d'activation.
 *
 * Même table que les réglages : une clé, une valeur, lue par la base. Ce
 * qui a été déployé lot après lot peut être coupé sans redéploiement —
 * une source qui dérape, une règle qui inonde le stock. Lus au plus une
 * fois par minute par processus : un drapeau n'a pas à coûter une requête
 * par entreprise.
 */

export type EngineFlag =
  | 'enable_osm_scheduler' | 'enable_afnic_daily' | 'enable_bodacc_contact_resolution'
  | 'enable_seo_opportunities' | 'enable_performance_opportunities' | 'enable_performance_audit'
  | 'enable_ecommerce_v2' | 'enable_joafe' | 'enable_sitadel' | 'enable_commercial_enrichment';

export const FLAG_DEFAULTS: Record<EngineFlag, boolean> = {
  enable_osm_scheduler: true,
  enable_afnic_daily: true,
  enable_bodacc_contact_resolution: true,
  enable_seo_opportunities: true,
  enable_performance_opportunities: true,
  enable_performance_audit: true,
  enable_ecommerce_v2: true,
  enable_joafe: true,
  enable_sitadel: true,
  enable_commercial_enrichment: false,
};

const TTL_MS = 60_000;
const cache = new Map<string, { value: boolean; until: number }>();

export async function isEnabled(db: Db, flag: EngineFlag, now = Date.now()): Promise<boolean> {
  const cached = cache.get(flag);
  if (cached && cached.until > now) return cached.value;
  const { data, error } = await db.rpc('engine_flag', { p_key: flag, p_default: FLAG_DEFAULTS[flag] });
  const value = error || data === null || data === undefined ? FLAG_DEFAULTS[flag] : Boolean(data);
  cache.set(flag, { value, until: now + TTL_MS });
  return value;
}

/** Pour les tests, ou après un changement qu'on veut immédiat. */
export function resetFlagCache(): void {
  cache.clear();
}

/** Ce qu'un job rend quand son drapeau est baissé : rien fait, rien cassé. */
export const SKIPPED_BY_FLAG = (flag: EngineFlag) => ({ processed: 0, succeeded: 0, failed: 0, metadata: { skipped: true, flag } });
