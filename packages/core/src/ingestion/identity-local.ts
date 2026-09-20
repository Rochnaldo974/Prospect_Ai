import type { Db } from '../db/client';
import type { Logger } from '../logger';

/**
 * L'identité par le référentiel local.
 *
 * Même règle que le rapprochement par API — même clé de nom, même code
 * postal, un seul SIREN — mais servie par une requête sur sirene_reference
 * au lieu d'un appel unité par unité limité à trois par seconde. C'est ce
 * qui permet de traiter les dizaines de milliers d'entreprises OSM sans
 * SIREN qui restaient sous le seuil d'identité, et de rendre leur
 * opportunité recevable au gate.
 */

export interface LocalIdentityReport {
  examined: number;
  matched: number;
  /** Rapprochés par similarité, pas par égalité. */
  fuzzy: number;
  ambiguous: number;
  unmatched: number;
  errors: number;
}

export async function resolveIdentityLocally(
  db: Db,
  options: { limit?: number; dryRun?: boolean; fuzzy?: boolean; logger?: Logger; signal?: AbortSignal } = {},
): Promise<LocalIdentityReport> {
  const report: LocalIdentityReport = { examined: 0, matched: 0, fuzzy: 0, ambiguous: 0, unmatched: 0, errors: 0 };
  const log = options.logger;
  const limit = Math.min(options.limit ?? 1000, 20_000);

  // Sans SIREN, avec un code postal et un nom : ce que le référentiel peut
  // reconnaître. Les plus anciennes tentatives d'abord.
  //
  // Servi par pages de mille — l'API tronque au-delà — jusqu'à la limite
  // demandée. Chaque entreprise traitée reçoit une date de tentative, donc
  // la page suivante ne la rend plus ; les identifiants déjà vus tiennent
  // lieu de garde-fou si une écriture a échoué ou en lecture seule.
  const pageSize = 1000;
  const seen = new Set<string>();
  const page = async (): Promise<{ id: string; legal_name: string; postal_code: string | null }[]> => {
    const { data: targets, error } = await db
      .from('companies')
      .select('id, legal_name, postal_code')
      .is('siren', null)
      .not('postal_code', 'is', null)
      .eq('prospecting_allowed', true)
      .order('identity_lookup_at', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .limit(Math.min(pageSize, limit - report.examined));
    if (error) throw new Error(`resolveIdentityLocally : ${error.message}`);
    return (targets ?? []).filter((t) => !seen.has(t.id));
  };

  let targets = await page();
  while (targets.length > 0) {
  for (const target of targets) {
    if (options.signal?.aborted) break;
    seen.add(target.id);
    report.examined += 1;
    try {
      const { data: found, error: matchError } = await db.rpc('match_company_to_sirene', { p_company_id: target.id });
      if (matchError) throw new Error(matchError.message);
      let hit: { siret: string; siren: string; naf_code: string | null; creation_date: string | null; candidates: number; fuzzy?: boolean } | undefined = found?.[0];
      // Sans égalité stricte : la similarité de trigrammes, au même code
      // postal, un seul SIREN, seuil strict. Identité un cran en dessous.
      if (!hit && options.fuzzy !== false) {
        const { data: near, error: nearError } = await db.rpc('match_company_to_sirene_fuzzy', { p_company_id: target.id, p_min_similarity: 0.72 });
        if (nearError) throw new Error(nearError.message);
        if (near?.[0]) { hit = { ...near[0], fuzzy: true }; report.fuzzy += 1; }
      }
      if (!hit) {
        // Plusieurs SIREN possibles ou aucun : on ne tranche pas, on date.
        report.unmatched += 1;
        if (!options.dryRun) await db.from('companies').update({ identity_lookup_at: new Date().toISOString() }).eq('id', target.id);
        continue;
      }
      if ((hit.candidates ?? 1) > 1) report.ambiguous += 1;
      report.matched += 1;
      if (options.dryRun) continue;

      const { error: updateError } = await db.from('companies').update({
        siren: hit.siren,
        siret: hit.siret,
        ...(hit.naf_code ? { industry_code: hit.naf_code } : {}),
        ...(hit.creation_date ? { creation_date: hit.creation_date } : {}),
        // Une enseigne exacte au même code postal, un seul SIREN : c'est
        // l'identité par nom, au niveau de confiance de l'API.
        identity_confidence: hit.fuzzy ? 0.76 : 0.8,
        identity_lookup_at: new Date().toISOString(),
      }).eq('id', target.id).is('siren', null);
      if (updateError) {
        // Le SIRET est déjà porté par une autre fiche : on garde le SIREN seul.
        if (updateError.code === '23505') {
          await db.from('companies').update({ siren: hit.siren, identity_confidence: 0.8, identity_lookup_at: new Date().toISOString() }).eq('id', target.id).is('siren', null);
        } else throw new Error(updateError.message);
      }
    } catch (cause: unknown) {
      report.errors += 1;
      log?.warn('Identité locale en échec', { company_id: target.id, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  // En lecture seule rien n'est daté : une seule page, sinon la même revient.
  if (options.dryRun || options.signal?.aborted || report.examined >= limit) break;
  targets = await page();
  }

  log?.info('Identité par le référentiel local', { ...report, dry_run: options.dryRun ?? false });
  return report;
}
