import { headers } from 'next/headers';

/**
 * L'origine publique du site, pour fabriquer un lien qu'on colle dans un
 * e-mail. `NEXT_PUBLIC_SITE_URL` quand elle est posée (production), sinon
 * l'hôte de la requête en cours — ce qui marche en développement et sur
 * les aperçus.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  if (configured) return configured.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
