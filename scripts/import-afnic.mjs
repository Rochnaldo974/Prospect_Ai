/**
 * Import des noms de domaine .fr depuis l'open data AFNIC.
 *
 *   unzip -p AFNIC.zip | pnpm import:afnic [--max-age 90] [--limit 50000]
 *   pnpm import:afnic fichier.csv [--max-age 90]
 *
 * Le fichier fait 700 Mo décompressé et 10 millions de lignes : il est lu en
 * flux, jamais chargé en mémoire. Le passer par `unzip -p` évite d'écrire la
 * version décompressée sur le disque.
 *
 * Les domaines entrent dans la file de scan. C'est le scanner qui visitera
 * chacun, et le SIREN de ses mentions légales qui fera — ou non — le
 * rattachement à une entreprise.
 */
import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
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

const { importAfnicDomains, getServiceClient, logger } = await import('@prospect/core');

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
const value = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const source = filePath && existsSync(filePath)
  ? createReadStream(filePath, { encoding: 'utf8' })
  : process.stdin;

if (source === process.stdin && process.stdin.isTTY) {
  console.error('Usage : unzip -p AFNIC.zip | pnpm import:afnic   ou   pnpm import:afnic fichier.csv');
  process.exit(1);
}

console.log(`Lecture ${filePath ? `de ${filePath}` : 'de l’entrée standard'}…`);

const maxAgeDays = Number(value('max-age', 90));
const limit = Number(value('limit', 100000));
const t0 = Date.now();

const report = await importAfnicDomains(
  getServiceClient(),
  createInterface({ input: source, crlfDelay: Infinity }),
  { maxAgeDays, limit, logger },
);

const seconds = (Date.now() - t0) / 1000;
console.log(`\nImport terminé en ${seconds.toFixed(0)} s`);
console.log(`  lignes lues        ${report.read.toLocaleString('fr-FR')}`);
console.log(`  retenues (< ${maxAgeDays} j) ${report.selected.toLocaleString('fr-FR')}`);
console.log(`  mises en file      ${report.queued.toLocaleString('fr-FR')}`);
console.log(`  déjà connues       ${report.alreadyKnown.toLocaleString('fr-FR')}`);
console.log(`  lignes illisibles  ${report.malformed.toLocaleString('fr-FR')}`);
console.log(`  erreurs            ${report.errors.toLocaleString('fr-FR')}`);
