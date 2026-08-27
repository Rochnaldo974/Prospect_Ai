import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // packages/core est consommé directement depuis ses sources TypeScript
  transpilePackages: ['@prospect/core'],
  // Next 16 ne lance plus ESLint pendant le build : le lint est une étape de CI dédiée.
  typedRoutes: true,
};

export default nextConfig;
