import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { deleteTestUsers } from './helpers';

/**
 * Tests d'intégration de la fondation d'authentification.
 *
 * Exigent une instance Supabase locale (`pnpm db:start`). Ils sont ignorés
 * silencieusement si elle n'est pas joignable, pour ne pas casser un `pnpm test`
 * hors environnement de développement.
 */
const URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
const ANON = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
const SERVICE = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

async function supabaseReachable(): Promise<boolean> {
  if (!ANON || !SERVICE) return false;
  try {
    const res = await fetch(`${URL}/auth/v1/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

const reachable = await supabaseReachable();

describe.skipIf(!reachable)('fondation auth', () => {
  const PASSWORD = 'motdepasse123';
  let admin: SupabaseClient;
  let paulId: string;
  let thomasId: string;
  let asPaul: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

    await deleteTestUsers(admin, 'auth.test');

    const { data: paul, error } = await admin.auth.admin.createUser({
      email: 'paul@auth.test',
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Paul Freelance' },
    });
    if (error) throw error;
    paulId = paul.user.id;

    const { data: thomas } = await admin.auth.admin.createUser({
      email: 'thomas@auth.test',
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Thomas Dev' },
    });
    thomasId = thomas.user!.id;

    asPaul = createClient(URL, ANON, { auth: { persistSession: false } });
    await asPaul.auth.signInWithPassword({ email: 'paul@auth.test', password: PASSWORD });
  });

  afterAll(async () => {
    await deleteTestUsers(admin, 'auth.test');
  });

  it('crée automatiquement le profil à l’inscription', async () => {
    const { data } = await admin.from('profiles').select('*').eq('id', paulId).single();
    expect(data).toMatchObject({
      full_name: 'Paul Freelance',
      role: 'user',
      daily_opportunity_limit: 5,
      onboarding_completed: false,
      country: 'FR',
    });
  });

  it('n’expose que le profil de l’utilisateur courant', async () => {
    const { data } = await asPaul.from('profiles').select('id');
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(paulId);
  });

  it('rend inaccessible le profil d’un autre utilisateur', async () => {
    const { data } = await asPaul.from('profiles').select('*').eq('id', thomasId).maybeSingle();
    expect(data).toBeNull();
  });

  it('empêche un utilisateur de se promouvoir admin', async () => {
    await asPaul.from('profiles').update({ role: 'admin' }).eq('id', paulId);
    const { data } = await admin.from('profiles').select('role').eq('id', paulId).single();
    expect(data?.role).toBe('user');
  });

  it('empêche un utilisateur de relever sa limite quotidienne', async () => {
    await asPaul.from('profiles').update({ daily_opportunity_limit: 500 }).eq('id', paulId);
    const { data } = await admin
      .from('profiles')
      .select('daily_opportunity_limit')
      .eq('id', paulId)
      .single();
    expect(data?.daily_opportunity_limit).toBe(5);
  });

  it('autorise la mise à jour des champs non privilégiés', async () => {
    await asPaul.from('profiles').update({ full_name: 'Paul R.', city: 'Paris' }).eq('id', paulId);
    const { data } = await admin.from('profiles').select('full_name, city').eq('id', paulId).single();
    expect(data).toMatchObject({ full_name: 'Paul R.', city: 'Paris' });
  });

  it('expose is_admin() correctement avant et après promotion', async () => {
    const { data: before } = await asPaul.rpc('is_admin');
    expect(before).toBe(false);

    await admin.from('profiles').update({ role: 'admin' }).eq('id', paulId);

    const { data: after } = await asPaul.rpc('is_admin');
    expect(after).toBe(true);

    const { data: all } = await asPaul.from('profiles').select('id');
    expect(all).toHaveLength(2);

    await admin.from('profiles').update({ role: 'user' }).eq('id', paulId);
  });

  it('supprime le profil en cascade avec le compte auth', async () => {
    await admin.auth.admin.deleteUser(thomasId);
    const { data } = await admin.from('profiles').select('id').eq('id', thomasId).maybeSingle();
    expect(data).toBeNull();
  });
});
