import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assignmentPayload,
  cleanupEngineTables,
  createCompany,
  createOpportunity,
  createUser,
  deleteTestUsers,
  serviceClient,
  signInAs,
  supabaseReachable,
} from './helpers';

/**
 * Invariants d'attribution.
 *
 * Ce sont les garanties qui ne doivent JAMAIS dépendre du code applicatif :
 * exclusivité, plafond quotidien, suppression et cooldown sont vérifiés
 * directement contre la base, avec le moteur hors circuit.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('invariants d’attribution', () => {
  let admin: SupabaseClient;
  let paulId: string;
  let thomasId: string;

  beforeAll(async () => {
    admin = serviceClient();
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'alloc.test');
    paulId = await createUser(admin, 'paul@alloc.test', 'Paul Freelance');
    thomasId = await createUser(admin, 'thomas@alloc.test', 'Thomas Dev');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'alloc.test');
  });

  beforeEach(async () => {
    await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('company_cooldowns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  it('n’attribue jamais la même entreprise à deux utilisateurs', async () => {
    const companyId = await createCompany(admin);
    const oppA = await createOpportunity(admin, companyId);

    const first = await admin.from('assignments').insert(assignmentPayload(companyId, oppA, paulId));
    expect(first.error).toBeNull();

    const second = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, oppA, thomasId));
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23505'); // violation d'unicité
  });

  it('résiste à deux attributions concurrentes de la même entreprise', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    // Deux clients distincts → deux connexions distinctes → vraie concurrence.
    const workerA = serviceClient();
    const workerB = serviceClient();

    const [resA, resB] = await Promise.all([
      workerA.from('assignments').insert(assignmentPayload(companyId, opportunityId, paulId)),
      workerB.from('assignments').insert(assignmentPayload(companyId, opportunityId, thomasId)),
    ]);

    const succeeded = [resA, resB].filter((r) => r.error === null);
    expect(succeeded).toHaveLength(1);

    const { count } = await admin
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    expect(count).toBe(1);
  });

  it('libère l’entreprise quand l’attribution expire', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    const { data: first } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId))
      .select('id')
      .single();

    await admin.from('assignments').update({ status: 'expired' }).eq('id', first!.id);

    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, thomasId));
    expect(error).toBeNull();
  });

  it('refuse d’attribuer une entreprise en liste de suppression', async () => {
    const companyId = await createCompany(admin, {
      suppression_global: true,
      suppression_reason: 'opposition explicite',
    });
    const opportunityId = await createOpportunity(admin, companyId);

    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId));
    expect(error?.message).toMatch(/liste de suppression/);
  });

  it('refuse d’attribuer une entreprise non prospectable', async () => {
    const companyId = await createCompany(admin, { prospecting_allowed: false });
    const opportunityId = await createOpportunity(admin, companyId);

    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId));
    expect(error?.message).toMatch(/non prospectable/);
  });

  it('refuse d’attribuer une entreprise en cooldown actif', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    await admin.from('company_cooldowns').insert({
      company_id: companyId,
      reason: 'not_interested',
      ends_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    });

    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId));
    expect(error?.message).toMatch(/cooldown actif/);
  });

  it('autorise à nouveau l’attribution une fois le cooldown terminé', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    await admin.from('company_cooldowns').insert({
      company_id: companyId,
      reason: 'no_response',
      starts_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      ends_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    });

    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId));
    expect(error).toBeNull();
  });

  it('bloque définitivement une entreprise en cooldown permanent', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);

    await admin.from('company_cooldowns').insert({
      company_id: companyId,
      reason: 'opt_out',
      permanent: true,
    });

    const { error } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId));
    expect(error?.message).toMatch(/cooldown actif/);
  });

  it('applique le plafond quotidien de l’utilisateur', async () => {
    const errors: (string | undefined)[] = [];

    for (let i = 0; i < 6; i += 1) {
      const companyId = await createCompany(admin);
      const opportunityId = await createOpportunity(admin, companyId);
      const { error } = await admin
        .from('assignments')
        .insert(assignmentPayload(companyId, opportunityId, paulId, { rank: Math.min(i + 1, 20) }));
      errors.push(error?.message);
    }

    expect(errors.slice(0, 5).every((e) => e === undefined)).toBe(true);
    expect(errors[5]).toMatch(/Plafond quotidien/);
  });

  it('n’expose pas les attributions d’un autre utilisateur', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);
    const { data: assignment } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, thomasId))
      .select('id')
      .single();

    await admin.from('assignment_cards').insert({
      assignment_id: assignment!.id,
      user_id: thomasId,
      card: { legal_name: 'Secret de Thomas' },
    });

    const asPaul = await signInAs('paul@alloc.test');
    const { data: assignments } = await asPaul.from('assignments').select('id');
    const { data: cards } = await asPaul.from('assignment_cards').select('assignment_id');

    expect(assignments).toHaveLength(0);
    expect(cards).toHaveLength(0);
  });

  it('empêche un utilisateur de modifier le score ou le marqueur témoin', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);
    const { data: assignment } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId, { is_control: true }))
      .select('id')
      .single();

    const asPaul = await signInAs('paul@alloc.test');
    await asPaul
      .from('assignments')
      .update({ is_control: false, match_score: 100, rank: 20 })
      .eq('id', assignment!.id);

    const { data: after } = await admin
      .from('assignments')
      .select('is_control, match_score, rank')
      .eq('id', assignment!.id)
      .single();

    expect(after).toMatchObject({ is_control: true, match_score: 80, rank: 1 });
  });

  it('laisse l’utilisateur déclarer son propre suivi de contact', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);
    const { data: assignment } = await admin
      .from('assignments')
      .insert(assignmentPayload(companyId, opportunityId, paulId))
      .select('id')
      .single();

    const asPaul = await signInAs('paul@alloc.test');
    const contactedAt = new Date().toISOString();
    const { error } = await asPaul
      .from('assignments')
      .update({ status: 'contacted', contacted_at: contactedAt })
      .eq('id', assignment!.id);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('assignments')
      .select('status')
      .eq('id', assignment!.id)
      .single();
    expect(after?.status).toBe('contacted');
  });
});
