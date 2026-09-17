import type { Db } from '../db/client';
import type { Json } from '../db/database.types';
import type { Logger } from '../logger';
import { normalizePhone } from '../normalization/phone';
import { classifyEmail } from '../normalization/email';
import { normalizeContactUrl, socialNetworkOf } from '../normalization/contact-url';
import { SOURCE_CONFIDENCE, type ContactCandidate, type PreparedContact } from './types';

/**
 * Ingestion des contacts : de ce qu'une source propose à ce qu'on écrit.
 *
 * Idempotent par construction : la clé (entreprise, type, valeur normalisée)
 * est unique en base. Revoir le même téléphone sur OSM puis sur le site ne
 * fait qu'une ligne ; la première source reste, `last_seen_at` avance, et la
 * confiance ne peut que monter.
 */

/** Normalise et classe un candidat ; null si la valeur ne vaut rien. */
export function prepareContact(candidate: ContactCandidate): PreparedContact | null {
  const base = {
    source: candidate.source,
    sourceUrl: candidate.sourceUrl ?? null,
    personName: candidate.personName ?? null,
    role: candidate.role ?? null,
    confidence: clamp(candidate.confidence ?? SOURCE_CONFIDENCE[candidate.source]),
    metadata: candidate.metadata ?? {},
  };

  switch (candidate.type) {
    case 'phone': {
      const normalized = normalizePhone(candidate.value);
      if (!normalized) return null;
      return { ...base, type: 'phone', value: candidate.value.trim(), normalizedValue: normalized, isGeneric: true, isPersonal: false };
    }
    case 'email': {
      const c = classifyEmail(candidate.value);
      if (!c.email || c.category === 'NOREPLY' || c.category === 'INVALID') return null;
      return {
        ...base,
        type: 'email',
        value: candidate.value.trim(),
        normalizedValue: c.email,
        isGeneric: c.isGeneric,
        isPersonal: c.isPersonal,
        metadata: { ...base.metadata, category: c.category, quality: c.quality },
      };
    }
    case 'contact_form': {
      const normalized = normalizeContactUrl(candidate.value);
      if (!normalized) return null;
      return { ...base, type: 'contact_form', value: candidate.value.trim(), normalizedValue: normalized, isGeneric: true, isPersonal: false };
    }
    case 'linkedin':
    case 'instagram':
    case 'facebook':
    case 'whatsapp':
    case 'other': {
      const normalized = normalizeContactUrl(candidate.value);
      if (!normalized) return null;
      // Une page LinkedIn de personne est nominative ; une page d'entreprise ne l'est pas.
      const personal = candidate.type === 'linkedin' && /linkedin\.com\/in\//.test(normalized);
      const type = candidate.type === 'other' ? (socialNetworkOf(normalized) ?? 'other') : candidate.type;
      return { ...base, type, value: candidate.value.trim(), normalizedValue: normalized, isGeneric: !personal, isPersonal: personal };
    }
    default:
      return null;
  }
}

/**
 * Dédoublonne une liste de candidats sur (type, valeur normalisée) : la
 * source la plus sûre gagne, les autres sont notées dans les métadonnées.
 */
export function dedupeContactCandidates(candidates: ContactCandidate[]): PreparedContact[] {
  const byKey = new Map<string, PreparedContact>();
  for (const candidate of candidates) {
    const prepared = prepareContact(candidate);
    if (!prepared) continue;
    const key = `${prepared.type}:${prepared.normalizedValue}`;
    const current = byKey.get(key);
    if (!current) { byKey.set(key, prepared); continue; }
    const alsoSeen = new Set([...(current.metadata['also_seen_in'] as string[] | undefined ?? []), prepared.source, current.source]);
    const winner = prepared.confidence > current.confidence ? prepared : current;
    byKey.set(key, { ...winner, confidence: Math.max(prepared.confidence, current.confidence), metadata: { ...winner.metadata, also_seen_in: [...alsoSeen].filter((s) => s !== winner.source) } });
  }
  return [...byKey.values()];
}

export interface UpsertContactsReport {
  written: number;
  skipped: number;
}

/**
 * Écrit les contacts d'une entreprise. Une ligne existante garde sa source
 * d'origine et sa date de première vue ; sa confiance monte si la nouvelle
 * source est plus sûre, et `last_seen_at` avance.
 */
export async function upsertContacts(
  db: Db,
  companyId: string,
  candidates: ContactCandidate[],
  options: { dryRun?: boolean; logger?: Logger } = {},
): Promise<UpsertContactsReport> {
  const prepared = dedupeContactCandidates(candidates);
  const report: UpsertContactsReport = { written: 0, skipped: candidates.length - prepared.length };
  if (prepared.length === 0 || options.dryRun) { report.written = prepared.length; return report; }

  const now = new Date().toISOString();
  const rows = prepared.map((c) => ({
    company_id: companyId,
    type: c.type,
    value: c.value.slice(0, 500),
    normalized_value: c.normalizedValue,
    source: c.source,
    source_url: c.sourceUrl,
    is_generic: c.isGeneric,
    is_personal: c.isPersonal,
    person_name: c.personName,
    role: c.role,
    confidence: c.confidence,
    last_seen_at: now,
    metadata: c.metadata as Json,
  }));

  // Un upsert « ignore duplicates » garde la première ligne intacte ; les
  // doublons sont ensuite rafraîchis par une mise à jour ciblée. Deux
  // requêtes, jamais d'écrasement de provenance.
  const { error } = await db.from('company_contacts').upsert(rows, {
    onConflict: 'company_id,type,normalized_value',
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`upsertContacts : ${error.message}`);

  for (const c of prepared) {
    await db.from('company_contacts')
      .update({ last_seen_at: now })
      .eq('company_id', companyId).eq('type', c.type).eq('normalized_value', c.normalizedValue)
      .lt('last_seen_at', now);
  }
  report.written = prepared.length;
  return report;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
