import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
export const ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
export const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

export async function supabaseReachable(): Promise<boolean> {
  if (!ANON_KEY || !SERVICE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

export async function createUser(
  admin: SupabaseClient,
  email: string,
  fullName: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'motdepasse123',
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser(${email}) : ${error.message}`);
  return data.user.id;
}

export async function signInAs(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: 'motdepasse123' });
  if (error) throw new Error(`signIn(${email}) : ${error.message}`);
  return client;
}

/**
 * Supprime les comptes de test d'un domaine donné.
 *
 * Volontairement filtré : un `deleteAllUsers` global effacerait les comptes
 * créés par un autre fichier de tests et les comptes de développement.
 */
export async function deleteTestUsers(admin: SupabaseClient, domain: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data.users) {
    if (user.email?.endsWith(`@${domain}`)) await admin.auth.admin.deleteUser(user.id);
  }
}

let companyCounter = 0;

export async function createCompany(
  admin: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  companyCounter += 1;
  const suffix = `${Date.now()}${companyCounter}`;
  const { data, error } = await admin
    .from('companies')
    .insert({
      legal_name: `Entreprise Test ${suffix}`,
      city: 'Paris',
      postal_code: '75011',
      segment: 'local_commerce',
      company_status: 'active',
      phone: `+3312345${String(companyCounter).padStart(4, '0')}`,
      identity_confidence: 0.9,
      ...overrides,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createCompany : ${error.message}`);
  return data.id as string;
}

export async function createOpportunity(
  admin: SupabaseClient,
  companyId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await admin
    .from('opportunities')
    .insert({
      company_id: companyId,
      opportunity_type: 'website_redesign',
      need_score: 80,
      timing_score: 70,
      freshness_factor: 0.9,
      confidence_score: 0.85,
      base_score: 72,
      algorithm_version: 'v0',
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      ...overrides,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createOpportunity : ${error.message}`);
  return data.id as string;
}

export function assignmentPayload(
  companyId: string,
  opportunityId: string,
  userId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    company_id: companyId,
    opportunity_id: opportunityId,
    user_id: userId,
    rank: 1,
    match_score: 80,
    exclusive_until: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    ...overrides,
  };
}

export async function cleanupEngineTables(admin: SupabaseClient): Promise<void> {
  await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('daily_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('company_cooldowns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('job_queue').delete().neq('id', 0);
}
