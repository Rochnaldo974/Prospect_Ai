import type { MetadataRoute } from 'next';

/** Ce que les moteurs peuvent lire : la vitrine. Le reste est privé ou adressé à une seule personne. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://127.0.0.1:3000';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/onboarding', '/audit', '/auth', '/demo-sites', '/apercu-dev'] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
