'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ensureAuditShare, getServiceClient, updateAuditSnapshot } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity } from '@/lib/email/identity';

export interface AuditEditState {
  saved?: boolean;
  problem?: string;
}

/**
 * Enregistre l'audit relu par le freelance.
 *
 * Le titre, les constats (un par ligne, cinq au plus) et la proposition.
 * L'instantané est créé s'il n'existait pas encore, puis modifié pour son
 * propriétaire seulement. La page en ligne et le PDF lisent le même
 * instantané : ce qui est enregistré ici est ce qui part.
 */
export async function saveAudit(_previous: AuditEditState, formData: FormData): Promise<AuditEditState> {
  const profile = await requireUser();
  if (profile.plan !== 'premium') return { problem: 'L’audit est réservé au plan Solo.' };

  const assignmentId = String(formData.get('assignmentId') ?? '');
  const found = await getMyOpportunity(assignmentId);
  if (!found) return { problem: 'Dossier introuvable.' };

  const identity = await getIdentity(profile.id);
  const db = getServiceClient();
  await ensureAuditShare(db, {
    assignmentId,
    userId: profile.id,
    opportunity: found.opportunity,
    author: {
      name: identity.fromName || profile.full_name || 'Votre développeur web',
      title: identity.title, company: identity.company, phone: identity.phone, website: identity.website,
      email: profile.email, logoUrl: identity.logoUrl,
    },
  });

  const headline = String(formData.get('headline') ?? '');
  const proposal = String(formData.get('proposal') ?? '');
  const findings = String(formData.get('findings') ?? '').split('\n');
  if (!headline.trim() || !proposal.trim() || findings.every((f) => !f.trim())) {
    return { problem: 'Le titre, au moins un constat et la proposition sont nécessaires.' };
  }

  const updated = await updateAuditSnapshot(db, { assignmentId, userId: profile.id, edits: { headline, findings, proposal } });
  if (!updated) return { problem: 'Audit introuvable.' };

  revalidatePath(`/dashboard/opportunite/${assignmentId}`);
  revalidatePath(`/dashboard/opportunite/${assignmentId}/audit/modifier`);
  const back = String(formData.get('back') ?? '');
  if (back === 'email') redirect(`/dashboard/opportunite/${assignmentId}/email?intent=audit`);
  return { saved: true };
}
