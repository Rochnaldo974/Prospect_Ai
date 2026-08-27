/**
 * Découverte depuis les sources externes.
 *
 *   pnpm discover osm <ville> [ville…]   [--limit n] [--dry-run]
 *   pnpm discover bodacc [--days n] [--dept 75,69] [--limit n]
 *
 * Les sources interrogées sont des services publics gratuits. Le client HTTP
 * limite son débit : une découverte sur plusieurs villes prend du temps, c'est
 * volontaire.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
  }
}

const {
  OsmCompanySource, BodaccSource, ingestFromSource, syncBodacc,
  getServiceClient, logger,
} = await import('@prospect/core');

const args = process.argv.slice(2);
const command = args[0];
const flag = (n) => args.includes(`--${n}`);
const value = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};

const db = getServiceClient();

if (command === 'osm') {
  const cities = args.slice(1).filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
  if (cities.length === 0) {
    console.error('Usage : pnpm discover osm <ville> [ville…] [--limit n] [--dry-run]');
    process.exit(1);
  }

  console.log(`Découverte OpenStreetMap : ${cities.join(', ')}`);
  const source = new OsmCompanySource({ cities });
  const report = await ingestFromSource(db, source, {
    logger,
    dryRun: flag('dry-run'),
    limit: Number(value('limit', 2000)),
  });

  console.log(flag('dry-run') ? '\nSIMULATION' : '\nDécouverte terminée');
  console.log(`  lues        ${report.read}`);
  console.log(`  créées      ${report.created}`);
  console.log(`  fusionnées  ${report.merged}`);
  console.log(`  écartées    ${report.rejected}`);
  console.log(`  erreurs     ${report.errors}`);

  const rejections = Object.entries(report.fieldRejections).sort((a, b) => b[1] - a[1]);
  if (rejections.length) {
    console.log('\nChamps écartés :');
    for (const [reason, count] of rejections.slice(0, 10)) {
      console.log(`  ${String(count).padStart(6)}  ${reason}`);
    }
  }
} else if (command === 'bodacc') {
  const days = Number(value('days', 7));
  const departments = value('dept', null)?.split(',').map((d) => d.trim());
  const since = new Date(Date.now() - days * 86_400_000);

  const source = new BodaccSource();
  const total = await source.count({ since, ...(departments ? { departments } : {}) });
  console.log(`Annonces BODACC depuis ${days} jours${departments ? ` (dép. ${departments.join(', ')})` : ''} : ${total}`);

  const report = await syncBodacc(db, {
    since,
    limit: Number(value('limit', 2000)),
    logger,
    ...(departments ? { departments } : {}),
  });

  console.log('\nSynchronisation terminée');
  console.log(`  parcourues   ${report.fetched}`);
  console.log(`  rapprochées  ${report.matched}`);
  console.log(`  événements   ${report.eventsCreated}`);
  console.log(`  exclusions   ${report.excluded}`);
  console.log(`  déjà vues    ${report.duplicates}`);
  console.log(`  erreurs      ${report.errors}`);
  if (Object.keys(report.byFamily).length) {
    console.log('\nPar famille :');
    for (const [family, count] of Object.entries(report.byFamily).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(6)}  ${family}`);
    }
  }
} else {
  console.error('Usage : pnpm discover <osm|bodacc> …');
  process.exit(1);
}
