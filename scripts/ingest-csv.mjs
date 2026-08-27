/**
 * Ingestion d'un fichier CSV depuis le disque.
 *
 *   pnpm ingest:csv <fichier> [options]
 *
 *   --source <nom>     nom de la source (défaut : le nom du fichier)
 *   --sirene           applique les conventions du répertoire SIRENE
 *   --local-commerce   n'ingère que le segment commerce et artisanat
 *   --limit <n>        plafonne le nombre de lignes
 *   --dry-run          mesure sans écrire
 *
 * Cette voie existe parce que le fichier SIRENE complet fait plusieurs Go :
 * il ne peut pas transiter par une server action, et l'API de l'INSEE est trop
 * limitée en débit pour constituer un socle.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
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

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));

if (!filePath) {
  console.error('Usage : pnpm ingest:csv <fichier> [--source nom] [--sirene] [--local-commerce] [--limit n] [--dry-run]');
  process.exit(1);
}
if (!existsSync(filePath)) {
  console.error(`Fichier introuvable : ${filePath}`);
  process.exit(1);
}

const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const { CsvCompanySource, ingestFromSource, getServiceClient, logger, SIRENE_ETABLISSEMENT_MAPPING } =
  await import('@prospect/core');

const size = statSync(filePath).size;
console.log(`Lecture de ${filePath} (${(size / 1024 / 1024).toFixed(1)} Mo)…`);

const content = readFileSync(filePath, 'utf8');
const useSirene = flag('sirene');

const source = new CsvCompanySource({
  sourceName: value('source', basename(filePath).replace(/\.[^.]+$/, '')),
  content,
  ...(useSirene ? { mapping: SIRENE_ETABLISSEMENT_MAPPING } : {}),
  sireneConventions: useSirene,
  localCommerceOnly: flag('local-commerce'),
  confidence: useSirene ? 0.99 : 0.8,
});

const limitArg = value('limit', null);
const report = await ingestFromSource(getServiceClient(), source, {
  dryRun: flag('dry-run'),
  logger,
  ...(limitArg ? { limit: Number(limitArg) } : {}),
});

console.log('\n' + (flag('dry-run') ? 'SIMULATION — rien écrit' : 'Import terminé'));
console.log(`  lues        ${report.read}`);
console.log(`  créées      ${report.created}`);
console.log(`  fusionnées  ${report.merged}`);
console.log(`  écartées    ${report.rejected}`);
console.log(`  erreurs     ${report.errors}`);

const rejections = Object.entries(report.fieldRejections).sort((a, b) => b[1] - a[1]);
if (rejections.length > 0) {
  console.log('\nChamps écartés :');
  for (const [reason, count] of rejections.slice(0, 15)) {
    console.log(`  ${String(count).padStart(8)}  ${reason}`);
  }
}

if (report.sample.length > 0) {
  console.log('\nPremières erreurs :');
  for (const entry of report.sample.slice(0, 10)) {
    console.log(`  ${entry.line} — ${entry.reason}`);
  }
}

process.exit(report.errors > 0 && report.created === 0 ? 1 : 0);
