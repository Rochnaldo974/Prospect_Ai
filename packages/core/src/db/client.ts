import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../config/env';
import type { Database } from './database.types';

export type Db = SupabaseClient<Database>;

let serviceClient: Db | undefined;

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
    },
  );

  return serviceClient;
}
