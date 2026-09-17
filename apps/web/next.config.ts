import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Les en-têtes que tout site public doit poser. Pas de CSP stricte pour
  // l'instant : les captures d'écran et les logos viennent du Storage
  // Supabase, et une CSP mal calibrée casse en silence.
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },

  // En développement, Next bloque le chargement de ses propres chunks quand
  // l'origine du navigateur diffère de celle qu'il attend. Sans cette ligne,
  // ouvrir l'app sur 127.0.0.1 plutôt que localhost empêche l'hydratation :
  // les pages s'affichent mais aucun formulaire ne se soumet.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // packages/core est consommé directement depuis ses sources TypeScript
  transpilePackages: ['@prospect/core'],
  // Next 16 ne lance plus ESLint pendant le build : le lint est une étape de CI dédiée.
  typedRoutes: true,
  experimental: {
    // L'import CSV interactif envoie le fichier dans une server action.
    // Au-delà, on passe par `pnpm ingest:csv`, qui lit depuis le disque.
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
