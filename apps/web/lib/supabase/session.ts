import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@prospect/core';

/** Routes accessibles sans session. */
const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth', '/confidentialite', '/demo-sites'];

// Les aperçus de développement ne demandent pas de session : la page fait
// elle-même son 404 en production, le proxy n'a rien à leur ajouter.
const DEV_PATHS = ['/apercu-dev'];

function isPublic(pathname: string): boolean {
  const paths = process.env.NODE_ENV === 'production'
    ? PUBLIC_PATHS
    : [...PUBLIC_PATHS, ...DEV_PATHS];
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes privées.
 *
 * Important : ne jamais insérer de logique entre la création du client et
 * l'appel à getUser() — c'est ce qui garantit la rotation correcte des cookies.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
