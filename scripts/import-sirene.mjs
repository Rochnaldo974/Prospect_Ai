/**
 * Référentiel SIRENE local, depuis le fichier public de l'INSEE.
 *
 *   unzip -p StockEtablissement.zip | pnpm import:sirene [--limit n] [--prod]
 *   unzip -p StockUniteLegale.zip | pnpm import:sirene --units [--limit n] [--prod]
 *   pnpm import:sirene fichier.csv [--limit n] [--prod] [--batch 250]
 *
 * Sur la base hébergée, des lots plus petits (250) passent sous le délai
 * d'exécution de l'API ; l'import est idempotent, on peut le rejouer pour
 * combler les lots refusés.
 *
 * Ne garde que les établissements actifs, diffusibles, des métiers ciblés.
 * Sans licence à négocier : licence ouverte, fichier mensuel.
 */
import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const envPath = resolve(root, args.includes('--prod') ? '.env.production' : '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
  }
}

const { importSireneReference, importSireneUnits, getServiceClient, logger } = await import('@prospect/core');
const value = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const file = args.find((a) => !a.startsWith('--') && a !== value('limit', null));
const input = file ? createReadStream(resolve(file), 'utf8') : process.stdin;
const lines = createInterface({ input, crlfDelay: Infinity });

const t0 = Date.now();
const report = await (args.includes('--units') ? importSireneUnits : importSireneReference)(getServiceClient(), lines, {
  logger,
  batchSize: Number(value('batch', args.includes('--prod') ? 250 : 1000)),
  ...(value('limit', null) ? { limit: Number(value('limit', null)) } : {}),
});
console.log(`SIRENE : ${report.read} lignes lues, ${report.selected} retenues, ${report.written} écrites, ${report.errors} erreurs, en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
