import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Connexion' };

/**
 * La lecture de l'URL reste côté serveur : le formulaire client n'a pas besoin
 * du routeur, ce qui évite d'avoir à l'envelopper dans un Suspense pour le
 * rendu statique.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
