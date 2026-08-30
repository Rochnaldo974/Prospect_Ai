'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const credentialsSchema = z.object({
  email: z.email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
});

/**
 * Destination après connexion.
 *
 * N'accepte qu'un chemin interne : un `next` contrôlé par l'URL est une
 * redirection ouverte si on ne vérifie pas qu'il reste sur le site. `//evil.com`
 * est un chemin absolu de protocole, d'où le double contrôle.
 */
function safeRedirect(next: FormDataEntryValue | null): string {
  if (typeof next !== 'string') return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, 'Le nom est requis').max(120),
});

export interface AuthActionState {
  error?: string;
  notice?: string;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides';
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Message volontairement indifférencié : ne pas révéler l'existence d'un compte.
    return { error: 'Identifiants incorrects.' };
  }

  revalidatePath('/', 'layout');
  redirect(safeRedirect(formData.get('next')));
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { error: error.message };

  // Si la confirmation e-mail est active, aucune session n'est ouverte ici.
  if (!data.session) {
    return { notice: 'Vérifie ta boîte mail pour confirmer ton adresse.' };
  }

  revalidatePath('/', 'layout');
  // Un compte neuf n'a pas de préférences : l'envoyer au tableau de bord
  // l'accueillerait par une page vide, alors qu'il lui manque trois réponses.
  redirect('/onboarding');
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
