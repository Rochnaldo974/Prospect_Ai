/**
 * Attribue les opportunités du jour.
 *
 *   pnpm allocate            tous les utilisateurs ayant terminé leur onboarding
 *   pnpm allocate <user_id>  un seul, pour tester ou rattraper
 *
 * Rejouable : relancer dans la même journée ne double pas les lots.
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

const { runAllocation, getServiceClient, logger } = await import('@prospect/core');
const userId = process.argv[2];
const report = await runAllocation(getServiceClient(), {
  logger,
  ...(userId ? { userId } : {}),
});

console.log(`\n  utilisateurs examinés   ${report.usersExamined}`);
console.log(`  servis                  ${report.usersServed}`);
console.log(`  déjà servis aujourd'hui ${report.usersAlreadyServed}`);
console.log(`  opportunités attribuées ${report.assignmentsCreated}`);
console.log(`  dont groupe contrôle    ${report.controlsPlaced}`);
console.log(`  servis sous le plafond  ${report.usersUnderserved}`);
console.log(`  refusées par les gardes ${report.rejectedByGuards}`);
console.log(`  erreurs                 ${report.errors}`);
