import { NextResponse } from 'next/server';
import { ensureAuditShare, getServiceClient } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity } from '@/lib/email/identity';
import { auditFilename, renderAuditPdf } from '@/lib/audit/pdf';

export const dynamic = 'force-dynamic';

/**
 * Télécharger l'audit d'un dossier, en PDF.
 *
 * Le fichier se prépare tout seul au premier appel : la page en ligne et le
 * PDF partagent le même instantané, si bien que ce qu'on télécharge est
 * exactement ce que le lien montre. Réservé au plan Solo, comme l'audit.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireUser();
  if (profile.plan !== 'premium') return NextResponse.redirect(new URL('/dashboard/abonnement', _request.url));

  const found = await getMyOpportunity(id);
  if (!found) return new NextResponse('Dossier introuvable', { status: 404 });

  const identity = await getIdentity(profile.id);
  const share = await ensureAuditShare(getServiceClient(), {
    assignmentId: found.opportunity.assignmentId,
    userId: profile.id,
    opportunity: found.opportunity,
    author: {
      name: identity.fromName || profile.full_name || 'Votre développeur web',
      title: identity.title, company: identity.company, phone: identity.phone, website: identity.website,
      email: profile.email, logoUrl: identity.logoUrl,
    },
  });

  const pdf = await renderAuditPdf(share.snapshot);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${auditFilename(found.opportunity.company.name)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
