import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Charge .env.local dans process.env pour les tests d'intégration.
 * Les variables déjà définies (CI) ne sont jamais écrasées.
 */
const envPath = resolve(import.meta.dirname, '../../.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
