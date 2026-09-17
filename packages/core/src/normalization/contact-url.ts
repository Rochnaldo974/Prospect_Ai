/**
 * URL de contact : formulaire, page LinkedIn, Instagram, Facebook.
 *
 * Normalisée pour dédupliquer (même page avec ou sans www, avec ou sans
 * paramètres de suivi) et pour ne jamais stocker autre chose qu'une URL
 * http(s) valide.
 */

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref$|source$)/;

export function normalizeContactUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw.replace(/^\/\//, '')}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  let out = url.toString();
  if (url.pathname === '/' && !url.search) out = out.replace(/\/$/, '');
  return out.length > 2048 ? null : out;
}

/** Le réseau social d'une URL, quand on le reconnaît. */
export function socialNetworkOf(url: string): 'linkedin' | 'instagram' | 'facebook' | 'whatsapp' | null {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  if (host.endsWith('linkedin.com')) return 'linkedin';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) return 'facebook';
  if (host === 'wa.me' || host.endsWith('whatsapp.com')) return 'whatsapp';
  return null;
}
