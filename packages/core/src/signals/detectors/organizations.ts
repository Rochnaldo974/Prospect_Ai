import type { SignalDetector } from '../types';

/**
 * Les faits datés venus des nouvelles sources.
 *
 * Une association créée ou modifiée au Journal officiel est dans le même
 * moment qu'une entreprise nouvelle. Un permis créant un local commercial,
 * un hôtel ou des bureaux dit qu'une entreprise investit : ce n'est pas un
 * lead seul, c'est un renfort d'intention — sa force reste modérée.
 */

const ageInDays = (iso: string): number => (Date.now() - new Date(iso).getTime()) / 86_400_000;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const associationNoticeDetector: SignalDetector = {
  id: 'association_created',
  describes: 'Association créée ou modifiée récemment au Journal officiel',

  detect({ company, events }) {
    if ((company as { organization_type?: string }).organization_type !== 'association') return [];
    const event = events.find((e) => e.event_type === 'association_created' || e.event_type === 'association_modified');
    if (!event) return [];
    const age = ageInDays(event.occurred_at);
    if (!Number.isFinite(age) || age < 0 || age > 120) return [];
    const creation = event.event_type === 'association_created';
    return [{
      signalType: creation ? 'association_created' : 'association_modified',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01((creation ? 0.9 : 0.6) * (1 - age / 120)),
      confidence: 0.95,
      evidence: { published_at: event.occurred_at, age_days: Math.round(age) },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 120 * 86_400_000),
      fingerprint: `${event.event_type}:${event.id}`,
    }];
  },
};

const PREMISES_STRENGTH: Record<string, number> = { commercial: 0.7, hotel: 0.7, office: 0.55, industrial: 0.4, warehouse: 0.35, public: 0.3, other: 0.3 };

export const newPremisesDetector: SignalDetector = {
  id: 'new_business_premises',
  describes: 'Permis de construire créant un local pour l’entreprise',

  detect({ events }) {
    const event = events.find((e) => e.event_type === 'new_business_premises');
    if (!event) return [];
    const age = ageInDays(event.occurred_at);
    if (!Number.isFinite(age) || age < 0 || age > 180) return [];
    const kind = ((event.payload as { premises_kind?: string } | null)?.premises_kind) ?? 'other';
    return [{
      signalType: 'new_business_premises',
      kind: 'trigger',
      category: 'timing',
      strength: clamp01((PREMISES_STRENGTH[kind] ?? 0.3) * (1 - age / 180)),
      confidence: 0.9,
      evidence: { premises_kind: kind, authorized_at: event.occurred_at, age_days: Math.round(age) },
      triggerEventId: event.id,
      expiresAt: new Date(new Date(event.occurred_at).getTime() + 180 * 86_400_000),
      fingerprint: `new_business_premises:${event.id}`,
    }];
  },
};

export const ORGANIZATION_DETECTORS: SignalDetector[] = [associationNoticeDetector, newPremisesDetector];
