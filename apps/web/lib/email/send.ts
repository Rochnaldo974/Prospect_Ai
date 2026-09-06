import 'server-only';
import nodemailer from 'nodemailer';

/**
 * L'envoi, par SMTP.
 *
 * En développement, tout part vers le Mailpit de Supabase (127.0.0.1:54325)
 * et se lit sur http://127.0.0.1:54324 — de vrais envois, inspectables,
 * sans qu'un octet ne sorte de la machine.
 *
 * En production, les variables SMTP_* désignent le fournisseur (Resend,
 * Postmark, OVH…). Le « De » est l'adresse d'envoi du service avec le NOM
 * de l'utilisateur en étiquette, et le « Répondre à » est SON adresse :
 * les réponses vont au freelance, jamais à nous. C'est le compromis
 * délivrabilité/propriété tant que l'envoi via la messagerie de
 * l'utilisateur (OAuth Gmail) n'est pas branché.
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface OutgoingEmail {
  to: string;
  replyTo: string;
  fromName: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const host = process.env.SMTP_HOST ?? '127.0.0.1';
  const port = Number(process.env.SMTP_PORT ?? 54325);
  const user = process.env.SMTP_USER;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user ? { auth: { user, pass: process.env.SMTP_PASS ?? '' } } : {}),
  });

  await transport.sendMail({
    from: { name: message.fromName, address: process.env.EMAIL_FROM ?? 'prospection@prospect-ai.local' },
    replyTo: message.replyTo,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments ?? [],
  });
}
