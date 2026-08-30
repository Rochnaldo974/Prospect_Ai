import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('='); if (eq === -1) continue;
  const k = t.slice(0, eq).trim(); if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
}
const c = await import('@prospect/core');
const db = c.getServiceClient();

// Les domaines des entreprises d'Angers d'abord : c'est là qu'est le stock
// local, et beaucoup ont déjà été analysés lors des passages précédents.
await db.rpc('exec', {}).catch(() => {});
for (let i = 0; i < 4; i += 1) await c.enrichFromSirene(db, { limit: 300 });
const r = await c.scanDueDomains(db, { limit: 400, concurrency: 14 });
console.log(`SCAN ${r.scanned} · ${r.reachable} en service · ${r.broken} cassés · ${r.blocked} refusés`);
