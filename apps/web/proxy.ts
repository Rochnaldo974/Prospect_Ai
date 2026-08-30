import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

/**
 * Convention `proxy` de Next 16 (ex-`middleware`).
 *
 * Rafraîchit la session Supabase à chaque requête et protège les routes privées.
 */
export function proxy(request: NextRequest) {
  // Un seul hôte de développement : 127.0.0.1. Les cookies sont attachés à
  // l'hôte, tous ports confondus — la session, créée sur 127.0.0.1, n'existe
  // pas sur localhost, et l'OAuth Google est enregistré sur 127.0.0.1. Qui
  // tape « localhost » est donc ramené au canonique au lieu de découvrir un
  // site déconnecté. Sans objet en production, où cet hôte n'existe pas.
  const host = request.headers.get('host') ?? '';
  if (host.startsWith('localhost')) {
    // Un renvoi HTML plutôt qu'un 308 : Next réécrit tout Location visant
    // ce qu'il juge être la même origine — et localhost vaut 127.0.0.1 à
    // ses yeux — en chemin relatif, qui reboucle sur le même hôte à
    // l'infini. Vérifié au banc : même un Location posé à la main est
    // réécrit. Le HTML, lui, ne passe par aucune normalisation.
    const { pathname, search } = request.nextUrl;
    const target = `http://${host.replace('localhost', '127.0.0.1')}${pathname}${search}`;
    return new NextResponse(
      `<!doctype html><meta http-equiv="refresh" content="0;url=${target}">` +
        `<title>Redirection…</title><a href="${target}">Continuer sur 127.0.0.1</a>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Toutes les routes sauf fichiers statiques, images optimisées et tout
    // chemin portant une extension : un fichier de public/ n'est jamais une
    // page à protéger, et le renvoyer vers /login casse son chargement.
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
