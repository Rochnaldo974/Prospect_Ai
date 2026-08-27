'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@prospect/core';

/** Client Supabase navigateur — clé anonyme, RLS appliquée. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  );
}
