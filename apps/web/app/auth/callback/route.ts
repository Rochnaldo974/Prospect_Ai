import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Retour d'une connexion par fournisseur externe (Google).
 *
 * Le flux PKCE dépose un code dans l'URL ; on l'échange ici contre une
 * session, côté serveur, et le jeton n'apparaît jamais dans le navigateur.
 *
 * La destination finale dépend de ce qu'on trouve en base : un compte neuf
 * arrive sur le paramétrage, un compte déjà réglé sur ses opportunités.
 * Envoyer tout le monde au tableau de bord accueillerait la moitié des
 * nouveaux venus par une page vide.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const requested = searchParams.get('next');

  // Redirection ouverte : une destination doit être un chemin de ce site.
  const next = requested && requested.startsWith('/') && !requested.startsWith('//')
    ? requested
    : null;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=connexion_interrompue`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=connexion_refusee`);
  }

  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=connexion_refusee`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.redirect(
    `${origin}${profile?.onboarding_completed ? '/dashboard' : '/onboarding'}`,
  );
}
