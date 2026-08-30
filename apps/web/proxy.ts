import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

/**
 * Convention `proxy` de Next 16 (ex-`middleware`).
 *
 * Rafraîchit la session Supabase à chaque requête et protège les routes privées.
 */
export function proxy(request: NextRequest) {
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
