/**
 * Récupération des contacts déjà connus, sans recrawl.
 *
 *   pnpm backfill:contacts --dry-run --limit 1000
 *   pnpm backfill:contacts --limit 1000 [--cursor <id d'entreprise>] [--all]
 *
 * --all enchaîne les pages jusqu'à la fin de la base ; sinon une seule page.
 * Le curseur imprimé à la fin permet de reprendre exactement là où on s'est
 * arrêté.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
  }
}

const { backfillContacts, getServiceClient, logger } = await import('@prospect/core');
const args = process.argv.slice(2);
const value = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const db = getServiceClient();
const limit = Number(value('limit', 1000));
const dryRun = args.includes('--dry-run');
let cursor = value('cursor', null);
const total = { examined: 0, withCandidates: 0, contactsWritten: 0, newlyContactable: 0, newlyWithEmail: 0, errors: 0 };

console.log(`${dryRun ? '[dry-run] ' : ''}Backfill des contacts, pages de ${limit}${cursor ? `, reprise après ${cursor}` : ''}…`);
const t0 = Date.now();
for (;;) {
  const r = await backfillContacts(db, { limit, cursor, dryRun, logger });
  for (const k of Object.keys(total)) total[k] += r[k];
  cursor = r.nextCursor;
  console.log(`page : ${r.examined} examinées, ${r.withCandidates} avec candidats, ${r.contactsWritten} contacts, ${r.newlyContactable} nouvellement joignables, ${r.newlyWithEmail} avec e-mail — curseur ${cursor}`);
  if (r.done || !args.includes('--all')) break;
}
console.log(`\nTOTAL ${JSON.stringify(total)} en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`Reprise possible : pnpm backfill:contacts --limit ${limit} --cursor ${cursor}${args.includes('--all') ? ' --all' : ''}`);
