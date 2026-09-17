/**
 * Mesure, sur le jeu de charge : sélection des candidats, attribution,
 * dédoublonnage, mémoire d'exclusion. Sans API externe, sans rédaction.
 *
 *   pnpm perf:run
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
const { getServiceClient, runAllocation, createLogger } = await import('@prospect/core');
const db = getServiceClient();
const logger = createLogger({ level: 'warn' });
const timings = [];
const time = async (label, fn) => { const t = Date.now(); const out = await fn(); timings.push([label, Date.now() - t]); return out; };

const { data: users } = await db.from('profiles').select('id, plan').eq('company_name', 'PERF').limit(100);
if (!users || users.length === 0) { console.error('Aucun compte de charge : lancer pnpm perf:seed.'); process.exit(1); }

await time('sélection des candidats (1 profil, 300)', () => db.rpc('select_allocation_candidates', { p_user_id: users[0].id, p_services: [], p_location_mode: 'france_remote', p_city: null, p_region: null, p_excluded_industries: [], p_require_phone: false, p_limit: 300 }));
await time('sélection des candidats (10 profils)', () => Promise.all(users.slice(0, 10).map((u) => db.rpc('select_allocation_candidates', { p_user_id: u.id, p_services: [], p_location_mode: 'france_remote', p_city: null, p_region: null, p_excluded_industries: [], p_require_phone: u.plan === 'free', p_limit: 300 }))));
const report = await time(`attribution complète (${users.length} comptes, sans vérification)`, () => runAllocation(db, { verify: false, logger }));
await time('mémoire d’exclusion (assignations d’un profil)', () => db.from('assignments').select('company_id, outcome, assigned_at').eq('user_id', users[0].id));
await time('dédoublonnage (find_duplicate_candidates ×20)', async () => {
  const { data } = await db.from('companies').select('id').like('legal_name', 'PERF-%').limit(20);
  for (const c of data ?? []) await db.rpc('find_duplicate_candidates', { target_id: c.id });
});
await time('métriques moteur', () => db.rpc('engine_metrics', { p_day: new Date().toISOString().slice(0, 10) }));
await time('critères de succès', () => db.rpc('success_metrics'));

console.log('\nAttribution :', JSON.stringify(report));
console.log('\nTemps mesurés :');
for (const [label, ms] of timings) console.log(`  ${String(ms).padStart(7)} ms  ${label}`);
