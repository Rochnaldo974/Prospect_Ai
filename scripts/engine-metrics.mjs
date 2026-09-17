/**
 * Les métriques du moteur, telles que la base les calcule.
 *
 *   pnpm metrics [--day 2026-09-17]
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
const i = args.indexOf('--day');
const db = getServiceClient();
const { data, error } = await db.rpc('engine_metrics', i !== -1 && args[i + 1] ? { p_day: args[i + 1] } : {});
if (error) { console.error(error.message); process.exit(1); }
console.log(JSON.stringify(data, null, 2));
