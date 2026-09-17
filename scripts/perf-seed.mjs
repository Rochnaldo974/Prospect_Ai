/**
 * Jeu de charge synthétique, sans API externe.
 *
 *   pnpm perf:seed [--companies 100000] [--opportunities 50000] [--contacts 10000] [--users 100]
 *   pnpm perf:seed --cleanup
 *
 * Tout ce qui est créé porte la marque « perf » (source_name, préfixe de
 * nom, e-mail des comptes) et se retire d'un coup avec --cleanup. À
 * réserver à une base de développement.
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
if (/supabase\.co/.test(process.env.SUPABASE_URL ?? '')) { console.error('Refus : jamais sur une base hébergée.'); process.exit(1); }

const { getServiceClient } = await import('@prospect/core');
const db = getServiceClient();
const args = process.argv.slice(2);
const value = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? Number(args[i + 1]) : d; };
const MARK = 'PERF-';
const TYPES = ['website_creation', 'website_redesign', 'ecommerce', 'seo', 'maintenance'];
const CITIES = [['Angers', 'Pays de la Loire', '49000'], ['Lyon', 'Auvergne-Rhône-Alpes', '69001'], ['Lille', 'Hauts-de-France', '59000'], ['Toulouse', 'Occitanie', '31000'], ['Nantes', 'Pays de la Loire', '44000'], ['Rennes', 'Bretagne', '35000']];
const NAF = ['56.10A', '47.71Z', '96.02A', '43.32A', '68.31Z', '86.21Z', '10.71C', '45.20A'];

async function cleanup() {
  const { data: users } = await db.from('profiles').select('id').eq('company_name', 'PERF');
  const ids = (users ?? []).map((u) => u.id);
  if (ids.length > 0) {
    await db.from('assignments').delete().in('user_id', ids);
    await db.from('daily_batches').delete().in('user_id', ids);
    await db.from('user_preferences').delete().in('user_id', ids);
    for (const id of ids) await db.auth.admin.deleteUser(id);
  }
  let removed = 0;
  for (;;) {
    const { data } = await db.from('companies').select('id').like('legal_name', `${MARK}%`).limit(1000);
    if (!data || data.length === 0) break;
    const cids = data.map((c) => c.id);
    await db.from('company_contacts').delete().in('company_id', cids);
    await db.from('opportunities').delete().in('company_id', cids);
    await db.from('signals').delete().in('company_id', cids);
    await db.from('company_sources').delete().in('company_id', cids);
    await db.from('companies').delete().in('id', cids);
    removed += cids.length;
  }
  console.log(`Nettoyage : ${ids.length} comptes, ${removed} entreprises retirés.`);
}

if (args.includes('--cleanup')) { await cleanup(); process.exit(0); }

const nCompanies = value('companies', 100_000);
const nOpps = value('opportunities', 50_000);
const nContacts = value('contacts', 10_000);
const nUsers = value('users', 100);
const t0 = Date.now();

const companyIds = [];
// Reprise : ce qui a déjà été semé est réutilisé, jamais doublé.
for (let from = 0; ; from += 1000) {
  const { data } = await db.from('companies').select('id').like('legal_name', `${MARK}%`).order('id').range(from, from + 999);
  if (!data || data.length === 0) break;
  companyIds.push(...data.map((r) => r.id));
  if (data.length < 1000) break;
}
if (companyIds.length > 0) console.log(`  entreprises déjà présentes : ${companyIds.length}`);
for (let i = companyIds.length; i < nCompanies; i += 1000) {
  const rows = [];
  for (let k = i; k < Math.min(i + 1000, nCompanies); k += 1) {
    const [city, region, postal] = CITIES[k % CITIES.length];
    rows.push({
      legal_name: `${MARK}Entreprise ${k}`, commercial_name: `${MARK}Enseigne ${k}`, city, region, postal_code: postal,
      industry_code: NAF[k % NAF.length], phone: k % 3 === 0 ? `+3324100${String(k % 10000).padStart(4, '0')}` : null,
      segment: 'local_commerce', identity_confidence: 0.95, prospecting_allowed: true, siren: String(900000000 + k),
    });
  }
  const { data, error } = await db.from('companies').insert(rows).select('id');
  if (error) { console.error('companies', error.message); process.exit(1); }
  companyIds.push(...data.map((r) => r.id));
  if (companyIds.length % 20000 === 0) console.log(`  entreprises : ${companyIds.length}`);
}
await db.from('company_sources').upsert(companyIds.slice(0, 5000).map((id, k) => ({ company_id: id, source_name: 'perf', source_external_id: `perf-${k}`, confidence: 1, raw_payload: {} })), { onConflict: 'source_name,source_external_id', ignoreDuplicates: true });

for (let i = 0; i < nContacts; i += 1000) {
  const rows = [];
  for (let k = i; k < Math.min(i + 1000, nContacts); k += 1) {
    rows.push({ company_id: companyIds[k % companyIds.length], type: 'email', value: `contact${k}@perf${k}.test`, normalized_value: `contact${k}@perf${k}.test`, source: 'website', is_generic: true, is_personal: false, prospecting_allowed: true, confidence: 0.8 });
  }
  const { error } = await db.from('company_contacts').upsert(rows, { onConflict: 'company_id,type,normalized_value', ignoreDuplicates: true });
  if (error) { console.error('contacts', error.message); process.exit(1); }
}

const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
for (let i = 0; i < nOpps; i += 1000) {
  const rows = [];
  for (let k = i; k < Math.min(i + 1000, nOpps); k += 1) {
    const cid = companyIds[k % companyIds.length];
    rows.push({
      company_id: cid, opportunity_type: TYPES[k % TYPES.length], status: 'available', base_score: 40 + (k % 60), confidence_score: 0.7 + (k % 30) / 100,
      need_score: 60, timing_score: 50, freshness_factor: 0.8, expires_at: expires, phone_ready: k % 3 === 0, outreach_ready: k % 4 === 0,
      reason_data: { trigger: k % 2 === 0 ? 'company_recently_created' : null, need_breakdown: [{ signal: 'outdated_stack', points: 30 }] }, algorithm_version: 'perf',
    });
  }
  const { error } = await db.from('opportunities').insert(rows);
  if (error) { console.error('opportunities', error.message); process.exit(1); }
}

const { count: existingUsers } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('company_name', 'PERF');
let users = existingUsers ?? 0;
for (let k = users; k < nUsers; k += 1) {
  const { data, error } = await db.auth.admin.createUser({ email: `perf-${k}@perf.test`, password: `perf-${k}-${Date.now()}`, email_confirm: true });
  if (error || !data.user) { console.error('user', error?.message); continue; }
  const premium = k % 4 !== 0;
  await db.from('profiles').update({ plan: premium ? 'premium' : 'free', daily_opportunity_limit: premium ? 5 : 1, onboarding_completed: true, company_name: 'PERF' }).eq('id', data.user.id);
  await db.from('user_preferences').upsert({ user_id: data.user.id, services: k % 5 === 0 ? [] : [TYPES[k % TYPES.length], TYPES[(k + 1) % TYPES.length]], location_mode: 'france_remote', city: null, region: null, excluded_industries: [], technologies: [] }, { onConflict: 'user_id' });
  users += 1;
}
console.log(`Jeu de charge : ${companyIds.length} entreprises, ${nOpps} opportunités, ${nContacts} contacts, ${users} comptes en ${Math.round((Date.now() - t0) / 1000)} s.`);
