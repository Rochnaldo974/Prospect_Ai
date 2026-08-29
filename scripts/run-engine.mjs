/**
 * Enchaîne le moteur de bout en bout, sur des données réelles.
 *
 *   pnpm engine                  appels d'offres → signaux → opportunités → attribution
 *   pnpm engine --scan           ajoute l'enrichissement et le scan des sites (lent)
 *   pnpm engine --scan --limit 300
 *
 * Sert à voir le produit fonctionner sans attendre la nuit. Le worker et
 * pg_cron font la même chose, à leur rythme et dans le même ordre.
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

const args = process.argv.slice(2);
const withScan = args.includes('--scan');
const limit = Number(args[args.indexOf('--limit') + 1]) || 400;

const c = await import('@prospect/core');
const db = c.getServiceClient();

const step = (n, label) => console.log(`\n─── ${n}. ${label} ───`);

step(1, "Appels d'offres");
const tenders = await c.ingestTenders(db, { limit: 100 });
console.log(`  ${tenders.eventsCreated} avis retenus · ${tenders.companiesCreated} acheteurs créés`
  + ` · ${tenders.withoutIdentity} écartés faute de SIRET`);

if (withScan) {
  step(2, 'Enrichissement depuis le répertoire');
  let enriched = 0;
  for (let i = 0; i < 4; i += 1) {
    const r = await c.enrichFromSirene(db, { limit: 300 });
    enriched += r.enriched;
    if (r.examined === 0) break;
  }
  console.log(`  ${enriched} entreprises enrichies`);

  step(3, 'Scan des sites');
  const scan = await c.scanDueDomains(db, { limit, concurrency: 12 });
  console.log(`  ${scan.scanned} scannés · ${scan.reachable} en service · ${scan.broken} cassés`
    + ` · ${scan.blocked} accès refusé · ${scan.placeholders} pages d'attente`);
  console.log('  (une panne se confirme au second passage : relancer demain, ou forcer le rescan)');
}

step(withScan ? 4 : 2, 'Signaux');
const signals = await c.runSignalEngine(db, { limit: 3000 });
console.log(`  ${signals.created} créés · ${signals.deactivated} désactivés`
  + ` · ${signals.companiesWithTrigger} entreprises déclenchées`);

step(withScan ? 5 : 3, 'Opportunités');
const opportunities = await c.runOpportunityEngine(db, { limit: 3000 });
console.log(`  ${opportunities.created} créées · ${JSON.stringify(opportunities.byType)}`);
if (opportunities.rejected > 0) {
  console.log(`  ${opportunities.rejected} refusées par le gate : ${JSON.stringify(opportunities.rejectionReasons)}`);
}

step(withScan ? 6 : 4, 'Attribution');
const allocation = await c.runAllocation(db, { logger: c.logger });
console.log(`  ${allocation.assignmentsCreated} attribuées à ${allocation.usersServed} utilisateur(s)`
  + ` · ${allocation.controlsPlaced} en groupe contrôle`);
if (allocation.errors > 0 || allocation.rejectedByGuards > 0) {
  console.log(`  ${allocation.errors} erreur(s) · ${allocation.rejectedByGuards} refusée(s) par les garde-fous`);
}
if (allocation.usersAlreadyServed > 0) {
  console.log(`  ${allocation.usersAlreadyServed} déjà servi(s) aujourd'hui — l'attribution ne double pas les lots`);
}

console.log('\n  → http://127.0.0.1:3000/dashboard');
