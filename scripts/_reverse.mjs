import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('='); if (eq === -1) continue;
  const k = t.slice(0, eq).trim(); if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
}
const { createCompaniesFromDomains, getServiceClient, logger } = await import('@prospect/core');
const db = getServiceClient();
const before = (await db.from('companies').select('id', { count: 'exact', head: true })).count;
const rev = await createCompaniesFromDomains(db, { limit: 100, logger });
const after = (await db.from('companies').select('id', { count: 'exact', head: true })).count;
console.log(`\nentreprises : ${before} → ${after}`);
console.log(`  domaines examinés     ${rev.domainsExamined}`);
console.log(`  SIREN rencontrés      ${rev.sirensSeen}`);
console.log(`  déjà connus           ${rev.alreadyKnown}`);
console.log(`  ENTREPRISES CRÉÉES    ${rev.companiesCreated}`);
console.log(`  SIREN d'agence écartés ${rev.sharedSkipped}`);
console.log(`  absents du répertoire ${rev.notFoundInRegistry}`);
const { data } = await db.from('companies')
  .select('legal_name, domain, phone, city, creation_date')
  .eq('website_confidence', 0.99).not('phone', 'is', null)
  .order('created_at', { ascending: false }).limit(6);
if (data?.length) {
  console.log('\n--- créées depuis leur site, avec téléphone ---');
  for (const c of data) console.log(`  ${c.legal_name} | ${c.domain} | ${c.phone} | ${c.city ?? '?'}`);
}
