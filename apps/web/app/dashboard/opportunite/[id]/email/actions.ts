'use server';

import { revalidatePath } from 'next/cache';
import { getServiceClient, markContacted } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { getMyOpportunity } from '@/lib/opportunities/mine';
import { getIdentity, identityReady } from '@/lib/email/identity';
import { renderEmailHtml, renderEmailText } from '@/lib/email/render';
import { sendEmail, type EmailAttachment } from '@/lib/email/send';

export interface SendState {
  sent?: boolean;
  problem?: string;
}

/**
 * L'envoi de l'e-mail de prospection.
 *
 * Le DESTINATAIRE ne vient jamais du formulaire : il est relu depuis
 * l'attribution, côté serveur. Un champ caché se modifie dans l'inspecteur
 * en trois secondes, et ce serveur enverrait alors n'importe quoi à
 * n'importe qui sous notre adresse. Objet et corps, eux, appartiennent à
 * l'utilisateur — c'est son message.
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

  const found = await getMyOpportunity(assignmentId);
  if (!found) return { problem: 'Dossier introuvable.' };
  const to = found.opportunity.company.email;
  if (!to) return { problem: 'Aucune adresse générique n’a été relevée pour cette entreprise.' };

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
