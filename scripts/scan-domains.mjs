/**
 * Scan des sites web.
 *
 *   pnpm scan:domains [--limit n] [--all]
 *
 * Le récupérateur respecte robots.txt et n'envoie qu'une requête par seconde
 * et par hôte : un scan de plusieurs centaines de domaines prend du temps,
 * c'est volontaire.
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

const { scanDueDomains, getServiceClient, logger } = await import('@prospect/core');
const args = process.argv.slice(2);
const value = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const db = getServiceClient();
const limit = Number(value('limit', 50));
console.log(`Scan de ${limit} domaines…`);

const t0 = Date.now();
const report = await scanDueDomains(db, {
  limit,
  onlyDue: !args.includes('--all'),
  logger,
});
const seconds = (Date.now() - t0) / 1000;

console.log(`\nScan terminé en ${seconds.toFixed(0)} s (${(report.scanned / seconds).toFixed(1)} domaines/s)`);
console.log(`  joignables            ${report.reachable}`);
console.log(`  pages d'attente       ${report.placeholders}`);
console.log(`  en erreur HTTP        ${report.broken}`);
console.log(`  injoignables          ${report.unreachable}`);
console.log(`  exclus par robots.txt ${report.excluded}`);
console.log(`  erreurs               ${report.errors}`);
console.log(`\n  SIREN trouvés dans les mentions légales : ${report.sirensFound}`);
console.log(`  sites rattachés à une entreprise        : ${report.companiesAttached}`);
console.log(`  attributions confirmées légalement      : ${report.companiesConfirmed}`);
console.log(`  SIREN d'agence écartés                  : ${report.sharedSirensSkipped}`);
