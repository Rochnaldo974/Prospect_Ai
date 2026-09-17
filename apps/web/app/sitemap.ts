import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://127.0.0.1:3000';
  return [
    { url: `${site}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/signup`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${site}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
