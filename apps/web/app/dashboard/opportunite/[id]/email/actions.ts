'use server';

import { revalidatePath } from 'next/cache';
import { getServiceClient, markContacted } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity, identityReady } from '@/lib/email/identity';
import { renderEmailHtml, renderEmailText } from '@/lib/email/render';
import { sendEmail, type EmailAttachment } from '@/lib/email/send';
import { ensureAuditShare } from '@prospect/core';
import { auditFilename, renderAuditPdf } from '@/lib/audit/pdf';

export interface SendState {
  sent?: boolean;
  problem?: string;
}

/**
 * L'envoi de l'e-mail de prospection.
 *
 * Le DESTINATAIRE est relu depuis l'attribution, côté serveur, quand le
 * site de l'entreprise publie une adresse. Quand il n'en publie aucune,
 * c'est l'adresse que le commerçant a donnée au téléphone, saisie par le
 * freelance — vérifiée, comptée dans son quota du jour, et enregistrée
 * avec l'envoi. Objet et corps appartiennent à l'utilisateur : c'est son
 * message.
 *
 * L'envoi marque l'entreprise comme contactée : écrire EST un contact, et
 * la boucle de suivi démarre là.
 */
export async function sendProspectingEmail(
  _previous: SendState,
  formData: FormData,
): Promise<SendState> {
  const profile = await requireUser();
  if (profile.plan !== 'premium') return { problem: 'L’envoi d’e-mails est réservé au plan Solo.' };

  const assignmentId = String(formData.get('assignmentId') ?? '');
  const subject = String(formData.get('subject') ?? '').trim().slice(0, 200);
  const body = String(formData.get('body') ?? '').trim().slice(0, 5000);
  if (!assignmentId || !subject || !body) {
    return { problem: 'L’objet et le message ne peuvent pas être vides.' };
  }
  if (await overDailyQuota(profile.id)) return { problem: QUOTA_MESSAGE };

  const found = await getMyOpportunity(assignmentId);
  if (!found) return { problem: 'Dossier introuvable.' };
  const to = recipientFor(found.opportunity.company.email, formData);
  if (!to) return { problem: 'Indiquez l’adresse e-mail que l’entreprise vous a donnée.' };

  const identity = await getIdentity(profile.id);
  if (!identityReady(identity)) {
    return { problem: 'Renseignez d’abord votre signature (nom au minimum).' };
  }

  // La pièce jointe : le CV de l'utilisateur, et RIEN d'autre. Le fichier
  // vient de son identité côté serveur — le formulaire ne transporte qu'un
  // booléen, jamais un chemin.
  let attachments: EmailAttachment[] = [];
  if (formData.get('attachCv') === 'true' && identity.cvUrl) {
    const response = await fetch(identity.cvUrl).catch(() => null);
    if (response?.ok) {
      attachments = [{
        filename: `CV - ${identity.fromName}.pdf`,
        content: Buffer.from(await response.arrayBuffer()),
        contentType: 'application/pdf',
      }];
    } else {
      return { problem: 'Votre CV n’a pas pu être récupéré — vérifiez-le dans Signature e-mail.' };
    }
  }

  // L'audit en pièce jointe : le même instantané que la page en ligne,
  // rendu en PDF à l'envoi. Le formulaire ne transporte qu'un booléen.
  if (formData.get('attachAudit') === 'true') {
    const share = await ensureAuditShare(getServiceClient(), {
      assignmentId,
      userId: profile.id,
      opportunity: found.opportunity,
      author: {
        name: identity.fromName, title: identity.title, company: identity.company,
        phone: identity.phone, website: identity.website, email: profile.email, logoUrl: identity.logoUrl,
      },
    });
    attachments = [...attachments, {
      filename: auditFilename(found.opportunity.company.name),
      content: await renderAuditPdf(share.snapshot),
      contentType: 'application/pdf',
    }];
  }

  try {
    await sendEmail({
      to,
      replyTo: profile.email ?? '',
      fromName: identity.fromName,
      subject,
      text: renderEmailText(body, identity),
      html: renderEmailHtml(body, identity),
      attachments,
    });
  } catch {
    // Le serveur d'envoi est injoignable : rien n'est parti, rien n'est
    // tracé — l'utilisateur retrouve son texte intact et réessaie.
    return { problem: 'L’envoi a échoué — le serveur d’e-mail ne répond pas. Votre texte est conservé, réessayez.' };
  }

  const db = getServiceClient();
  await db.from('assignment_emails').insert({
    assignment_id: assignmentId,
    user_id: profile.id,
    to_email: to,
    subject,
    body,
  });
  await markContacted(db, { assignmentId, userId: profile.id });

  revalidatePath(`/dashboard/opportunite/${assignmentId}`);
  revalidatePath('/dashboard');
  return { sent: true };
}

/**
 * L'envoi fait depuis Gmail, déclaré après coup.
 *
 * Sans serveur d'e-mail, le message part depuis la boîte du freelance :
 * on lui ouvre Gmail rempli, il clique « Envoyer » là-bas, puis revient
 * dire qu'il l'a fait. On note ce qui a été envoyé, à qui, et l'entreprise
 * passe en contactée — la même boucle de suivi que pour l'envoi direct.
 */
export async function recordExternalSend(
  _previous: SendState,
  formData: FormData,
): Promise<SendState> {
  const profile = await requireUser();
  if (profile.plan !== 'premium') return { problem: 'L’envoi d’e-mails est réservé au plan Solo.' };
  const assignmentId = String(formData.get('assignmentId') ?? '');
  const subject = String(formData.get('subject') ?? '').trim().slice(0, 200);
  const body = String(formData.get('body') ?? '').trim().slice(0, 5000);
  if (!assignmentId || !subject || !body) return { problem: 'L’objet et le message ne peuvent pas être vides.' };
  if (await overDailyQuota(profile.id)) return { problem: QUOTA_MESSAGE };

  const found = await getMyOpportunity(assignmentId);
  if (!found) return { problem: 'Dossier introuvable.' };
  const to = recipientFor(found.opportunity.company.email, formData);
  if (!to) return { problem: 'Indiquez l’adresse e-mail que l’entreprise vous a donnée.' };

  const db = getServiceClient();
  await db.from('assignment_emails').insert({ assignment_id: assignmentId, user_id: profile.id, to_email: to, subject, body });
  await markContacted(db, { assignmentId, userId: profile.id });

  revalidatePath(`/dashboard/opportunite/${assignmentId}`);
  revalidatePath('/dashboard');
  return { sent: true };
}

/**
 * Cinq dossiers par jour, et quelques relances : au-delà de trente e-mails
 * dans la journée, ce n'est plus de la prospection, c'est une boucle. Le
 * quota protège la réputation d'envoi du freelance autant que la nôtre.
 */
const DAILY_EMAIL_QUOTA = 30;
const QUOTA_MESSAGE = 'Vous avez atteint le nombre d’e-mails pour aujourd’hui. On reprend demain.';

async function overDailyQuota(userId: string): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await getServiceClient()
    .from('assignment_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', since.toISOString());
  return (count ?? 0) >= DAILY_EMAIL_QUOTA;
}

/**
 * Le destinataire : l'adresse publiée par le site quand il y en a une,
 * sinon celle saisie dans le formulaire — un e-mail bien formé, sans quoi
 * rien ne part.
 */
function recipientFor(published: string | null, formData: FormData): string | null {
  if (published) return published;
  const typed = String(formData.get('to') ?? '').trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(typed) ? typed : null;
}
