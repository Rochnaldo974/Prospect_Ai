import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
