/**
 * Les zones de découverte : toutes les communes françaises d'au moins
 * N habitants (défaut 20 000), depuis l'API Géo publique.
 *
 *   pnpm seed:discovery [--min-population 20000]
 *
 * Idempotent : une commune déjà connue n'est pas retouchée.
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

const { getServiceClient } = await import('@prospect/core');
const args = process.argv.slice(2);
const value = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const minPopulation = Number(value('min-population', 20000));

const response = await fetch('https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,population&format=json');
if (!response.ok) { console.error(`API Géo : HTTP ${response.status}`); process.exit(1); }
const communes = (await response.json()).filter((c) => (c.population ?? 0) >= minPopulation);

const db = getServiceClient();
const rows = communes.map((c) => ({
  source: 'openstreetmap', area_type: 'commune', area_id: c.code, name: c.nom, department: c.codeDepartement,
  population: c.population,
  // Les grandes villes d'abord : plus de commerces, plus de tags de contact.
  priority: c.population >= 200000 ? 90 : c.population >= 100000 ? 80 : c.population >= 50000 ? 65 : 50,
}));
let inserted = 0;
for (let i = 0; i < rows.length; i += 200) {
  const { data, error } = await db.from('discovery_areas').upsert(rows.slice(i, i + 200), { onConflict: 'source,area_type,area_id', ignoreDuplicates: true }).select('id');
  if (error) { console.error(error.message); process.exit(1); }
  inserted += data?.length ?? 0;
}
console.log(`${communes.length} communes ≥ ${minPopulation} habitants, ${inserted} nouvelles zones.`);
