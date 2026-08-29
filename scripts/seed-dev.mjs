/**
 * Crée les comptes de développement sur l'instance Supabase locale.
 *
 *   pnpm seed:dev
 *
 * Sans effet sur une base distante : le script refuse de tourner ailleurs qu'en local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`Refus : ce script ne s'exécute que sur une instance locale (URL reçue : ${url}).`);
  process.exit(1);
}
if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY manquante. Lance `pnpm db:start` puis réessaie.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const ACCOUNTS = [
  { email: 'admin@prospect.local', password: 'admin123456', fullName: 'Admin', role: 'admin' },
  { email: 'paul@prospect.local', password: 'paul123456', fullName: 'Paul Freelance', role: 'user' },
];

for (const account of ACCOUNTS) {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === account.email);
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });
  if (error) {
    console.error(`✗ ${account.email} : ${error.message}`);
    process.exitCode = 1;
    continue;
  }

  // Paramétrage terminé et périmètre large : sans cela le moteur
  // d'attribution écarte le compte — il ne sert personne dont il ignore où il
  // travaille — et le tableau de bord reste vide, ce qui donne à croire que
  // la chaîne ne fonctionne pas.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      ...(account.role !== 'user' ? { role: account.role } : {}),
      onboarding_completed: true,
      city: 'Angers',
      region: 'Pays de la Loire',
    })
    .eq('id', data.user.id);
  if (profileError) {
    console.error(`✗ profil de ${account.email} : ${profileError.message}`);
    process.exitCode = 1;
    continue;
  }

  const { error: prefError } = await admin
    .from('user_preferences')
    .upsert({
      user_id: data.user.id,
      // France entière : un compte de développement ne doit pas être privé de
      // stock par un périmètre trop étroit.
      location_mode: 'france',
      city: 'Angers',
      region: 'Pays de la Loire',
      services: [],
      preferred_industries: [],
      excluded_industries: [],
    }, { onConflict: 'user_id' });
  if (prefError) {
    console.error(`✗ préférences de ${account.email} : ${prefError.message}`);
    process.exitCode = 1;
    continue;
  }

  console.log(`✓ ${account.email} (${account.role})  —  mot de passe : ${account.password}`);
}
