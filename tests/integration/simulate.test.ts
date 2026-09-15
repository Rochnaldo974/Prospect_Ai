import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAllocation, simulateNextDelivery } from '@prospect/core';
import {
  cleanupEngineTables,
  createCompany,
  createOpportunity,
  createUser,
  deleteTestUsers,
  serviceClient,
  supabaseReachable,
} from './helpers';

/**
 * La simulation du lendemain.
 *
 * Ce qu'elle promet : tout l'historique du compte recule d'un jour, puis la
 * vraie mécanique tourne. On vérifie donc les deux moitiés — le décalage,
 * et le fait qu'un second lot arrive alors que le premier date d'hier.
 */
const reachable = await supabaseReachable();

const DAY_MS = 86_400_000;

async function seedStock(admin: SupabaseClient, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const companyId = await createCompany(admin);
    await createOpportunity(admin, companyId, { base_score: 60 + i });
  }
}

async function prepareUser(
  admin: SupabaseClient,
  email: string,
  plan: 'free' | 'premium',
): Promise<string> {
  const id = await createUser(admin, email, 'Compte Simulation');
  const { error } = await admin
    .from('profiles')
    .update({ onboarding_completed: true, plan, daily_opportunity_limit: 5 })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return id;
}

describe.skipIf(!reachable)('simulation de la prochaine livraison', () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    admin = serviceClient();
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'simulate.test');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'simulate.test');
  });

  it('recule l’historique d’un jour et livre un second lot', async () => {
    const userId = await prepareUser(admin, 'premium@simulate.test', 'premium');
    await seedStock(admin, 12);

    const first = await runAllocation(admin, { userId, random: () => 0.5, verify: false });
    expect(first.assignmentsCreated).toBe(5);

    // Relancer le même jour ne livre rien : c'est l'invariant de rejouabilité.
    const replay = await runAllocation(admin, { userId, random: () => 0.5, verify: false });
    expect(replay.usersAlreadyServed).toBe(1);
    expect(replay.assignmentsCreated).toBe(0);

    const { data: before } = await admin
      .from('assignments')
      .select('id, company_id, assigned_at')
      .eq('user_id', userId);
    const beforeById = new Map((before ?? []).map((r) => [r.id, r]));

    const result = await simulateNextDelivery(admin, userId, { random: () => 0.5, verify: false });

    expect(result.daysShifted).toBe(1);
    expect(result.assignmentsShifted).toBe(5);
    expect(result.batchesShifted).toBe(1);
    expect(result.allocation.assignmentsCreated).toBe(5);

    const { data: after } = await admin
      .from('assignments')
      .select('id, company_id, assigned_at, status')
      .eq('user_id', userId);
    expect(after).toHaveLength(10);

    // Les cinq d'hier ont reculé d'exactement un jour et restent vivants :
    // leur exclusivité de 72 h n'est pas échue.
    for (const row of after ?? []) {
      const previous = beforeById.get(row.id);
      if (!previous) continue;
      const shift = new Date(previous.assigned_at).getTime() - new Date(row.assigned_at).getTime();
      expect(shift).toBe(DAY_MS);
      expect(row.status).toBe('active');
    }

    // Les cinq d'aujourd'hui sont d'autres entreprises : la mémoire par
    // freelance exclut celles vues il y a moins de trente jours.
    const companies = new Set((after ?? []).map((r) => r.company_id));
    expect(companies.size).toBe(10);

    const { data: batches } = await admin
      .from('daily_batches')
      .select('batch_date')
      .eq('user_id', userId)
      .order('batch_date', { ascending: true });
    expect(batches).toHaveLength(2);
    const [yesterday, today] = batches!.map((b) => new Date(`${b.batch_date}T00:00:00Z`).getTime());
    expect(today! - yesterday!).toBe(DAY_MS);
  });

  it('avance de sept jours pour le plan gratuit, dont la fenêtre est la semaine', async () => {
    const userId = await prepareUser(admin, 'free@simulate.test', 'free');
    await seedStock(admin, 4);

    const first = await runAllocation(admin, { userId, random: () => 0.5, verify: false });
    expect(first.assignmentsCreated).toBe(1);

    const result = await simulateNextDelivery(admin, userId, { random: () => 0.5, verify: false });
    expect(result.daysShifted).toBe(7);
    expect(result.allocation.assignmentsCreated).toBe(1);

    // Sept jours plus tard, l'exclusivité de 72 h du premier dossier est
    // échue : la mécanique réelle l'a expiré, et l'entreprise est retournée
    // au stock sans revenir à ce freelance.
    const { data: rows } = await admin
      .from('assignments')
      .select('company_id, status')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: true });
    expect(rows?.map((r) => r.status)).toEqual(['expired', 'active']);
    expect(rows?.[0]?.company_id).not.toBe(rows?.[1]?.company_id);
  });
});
