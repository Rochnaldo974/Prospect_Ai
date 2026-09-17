import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../config/env';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

let serviceClient: Db | undefined;

/**
 * Un appel réseau qui échoue avant d'atteindre le serveur — connexion
 * refusée, DNS qui bafouille, socket coupée — est rejoué, trois fois, en
 * attendant un peu plus à chaque fois. Sur le worker, une nuit de scan
 * fait des dizaines de milliers d'appels ; sans cela, un accroc réseau
 * d'une seconde faisait échouer un job de deux heures. Une réponse HTTP,
 * même en erreur, n'est jamais rejouée : le serveur l'a vue.
 */
const RETRY_DELAYS_MS = [400, 1500, 4000];

export async function resilientFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error: unknown) {
      lastError = error;
      if (init?.signal?.aborted || attempt === RETRY_DELAYS_MS.length) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  const cause = (lastError as { cause?: { code?: string; message?: string } } | undefined)?.cause;
  const detail = cause?.code ?? cause?.message;
  throw new TypeError(`fetch failed après ${RETRY_DELAYS_MS.length + 1} tentatives${detail ? ` (${detail})` : ''}`, { cause: lastError });
}

/**
 * Client Supabase en service_role : contourne RLS.
 *
 * Réservé au worker et aux route handlers admin côté serveur.
 * Ne doit JAMAIS être importé depuis un composant client.
 */
export function getServiceClient(): Db {
  if (serviceClient) return serviceClient;

  const env = getServerEnv();
  serviceClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
      global: { fetch: resilientFetch },
    },
  );

  return serviceClient;
}
