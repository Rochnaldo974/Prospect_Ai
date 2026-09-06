import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Nettoyage global, une fois, avant toute la suite.
 *
 * Les tests d'intégration partagent la base de développement, que les
 * seeds remplissent entre deux exécutions. Trois fois, une suite verte a
 * viré au rouge parce qu'un jeu de démonstration traînait dans les tables
 * du moteur : dix échecs, une relance, tout vert — du temps perdu à
 * diagnostiquer un fantôme. La suite part désormais d'une base propre,
 * TOUJOURS, et le re-seed après les tests est le geste normal.
 *
 * Ne touche qu'aux tables du moteur : les comptes, les domaines et les
 * identités d'e-mail survivent.
 */
export default async function globalClean(): Promise<void> {
  const envPath = resolve(import.meta.dirname, '../../.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/127\.0\.0\.1|localhost/.test(url)) return; // jamais ailleurs qu'en local

  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { persistSession: false },
  });

  const nil = '00000000-0000-0000-0000-000000000000';
  for (const table of [
    'assignment_emails', 'assignments', 'daily_batches', 'company_cooldowns',
    'opportunities', 'signals', 'company_events', 'companies',
  ]) {
    await db.from(table).delete().neq('id', nil);
  }
}
