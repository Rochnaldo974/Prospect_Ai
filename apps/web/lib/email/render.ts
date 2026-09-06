import type { EmailIdentity } from './identity';

/**
 * Le rendu HTML de l'e-mail : le texte du freelance, puis sa signature.
 *
 * Volontairement sobre — table unique, largeur bornée, polices système,
 * aucune image hormis le logo. Un e-mail de prospection qui ressemble à une
 * newsletter part à la corbeille ; celui-ci doit ressembler à ce qu'il
 * est : un message écrit par une personne, avec une signature soignée.
 *
 * Tout ce qui vient de l'utilisateur ou du dossier est échappé : ce HTML
 * part chez un tiers, il n'a pas le droit d'emporter autre chose que du
 * texte.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function renderEmailHtml(body: string, identity: EmailIdentity): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) =>
      `<p style="margin:0 0 14px 0;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  const meta = [
    identity.title,
    identity.company,
  ].filter(Boolean).map(escapeHtml).join(' · ');

  const contact = [
    identity.phone ? escapeHtml(identity.phone) : null,
    identity.website
      ? `<a href="${escapeHtml(withProtocol(identity.website))}" style="color:#2c4bff;text-decoration:none;">${escapeHtml(stripProtocol(identity.website))}</a>`
      : null,
  ].filter(Boolean).join(' · ');

  const logo = identity.logoUrl
    ? `<img src="${escapeHtml(identity.logoUrl)}" alt="" height="40" style="height:40px;max-width:160px;object-fit:contain;display:block;margin-bottom:10px;">`
    : '';

  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0;">
    <tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1d26;padding:8px 4px;">
${paragraphs}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid #e7e9f2;padding-top:0;">
        <tr><td style="padding-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          ${logo}
          <p style="margin:0;font-size:14px;font-weight:600;color:#1a1d26;">${escapeHtml(identity.fromName)}</p>
          ${meta ? `<p style="margin:2px 0 0 0;font-size:13px;color:#5b6274;">${meta}</p>` : ''}
          ${contact ? `<p style="margin:6px 0 0 0;font-size:13px;color:#5b6274;">${contact}</p>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** La version texte : même contenu, pour les clients qui n'affichent pas le HTML. */
export function renderEmailText(body: string, identity: EmailIdentity): string {
  const signature = [
    identity.fromName,
    [identity.title, identity.company].filter(Boolean).join(' · '),
    [identity.phone, identity.website].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n');

  return `${body.trim()}\n\n--\n${signature}`;
}

const withProtocol = (url: string): string =>
  /^https?:\/\//.test(url) ? url : `https://${url}`;
const stripProtocol = (url: string): string => url.replace(/^https?:\/\//, '');
