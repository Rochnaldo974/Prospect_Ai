import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SessionProfile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin';
  onboarding_completed: boolean;
  daily_opportunity_limit: number;
  email: string;
}

/**
 * Récupère l'utilisateur courant et son profil, ou null.
 *
 * Utilise toujours getUser() (qui valide le JWT auprès du serveur Auth) et
 * jamais getSession() côté serveur, dont le contenu provient d'un cookie non vérifié.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, onboarding_completed, daily_opportunity_limit')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    ...(profile as Omit<SessionProfile, 'email'>),
    email: user.email ?? '',
  };
}

/** Exige une session valide. Redirige vers /login sinon. */
export async function requireUser(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Exige un compte paramétré.
 *
 * Le moteur d'attribution écarte les comptes dont l'onboarding n'est pas
 * terminé : sans cette redirection, l'utilisateur verrait un tableau de bord
 * vide sans comprendre qu'il lui manque trois réponses.
 *
 * À n'utiliser que sur les pages qui livrent des opportunités — pas sur la
 * page de paramétrage elle-même, qui bouclerait.
 */
export async function requireOnboardedUser(): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!profile.onboarding_completed) redirect('/onboarding');
  return profile;
}

/**
 * Exige le rôle admin, vérifié côté serveur contre la base.
 *
 * Ne jamais se fier à une information de rôle venue du client ou d'un cookie :
 * c'est la seule porte d'entrée de tout l'espace /admin.
 */
export async function requireAdmin(): Promise<SessionProfile> {
  const profile = await requireUser();
  if (profile.role !== 'admin') redirect('/dashboard');
  return profile;
}
