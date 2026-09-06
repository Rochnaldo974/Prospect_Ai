import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupEngineTables, createCompany, createOpportunity, createUser,
  deleteTestUsers, serviceClient, supabaseReachable,
} from './helpers';
import { runAllocation } from '../../packages/core/src/allocation/engine';

/**
 * La règle du plan gratuit : UN dossier par SEMAINE.
 *
 * C'est la frontière commerciale du produit — la seule règle dont dépend
 * directement ce que les gens paient. Un gratuit servi comme un payant
 * détruit la raison de payer ; un payant fenêtré comme un gratuit détruit
 * la raison de rester.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('plan gratuit', () => {
  const admin = serviceClient();
  let userId: string;

  beforeAll(async () => {
    await deleteTestUsers(admin, 'plan.test');
    userId = await createUser(admin, 'libre@plan.test', 'Test Plan');
    // L'attribution ne sert que les profils paramétrés : sans ce drapeau, la
    // requête du moteur ne voit même pas l'utilisateur.
    await admin.from('profiles')
      .update({ plan: 'free', onboarding_completed: true })
      .eq('id', userId);
    await admin.from('user_preferences').insert({ user_id: userId, services: [], location_mode: 'france_remote' });
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'plan.test');
  });

  beforeEach(async () => {
    await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Le lot du jour est unique par utilisateur et par date : celui du test
    // précédent ferait échouer l'attribution suivante en silence.
    await admin.from('daily_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  const stock = async (n: number): Promise<void> => {
    for (let i = 0; i < n; i += 1) {
      const companyId = await createCompany(admin);
      await createOpportunity(admin, companyId);
    }
  };

  it('sert UN dossier, pas cinq, même avec du stock', async () => {
    await stock(6);
    await runAllocation(admin, { userId });

    const { count } = await admin.from('assignments')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    expect(count).toBe(1);
  });

  it('ne ressert pas pendant la semaine, ressert après', async () => {
    await stock(3);
    await runAllocation(admin, { userId });

    // Trois jours plus tard : rien. La semaine n'est pas finie.
    await admin.from('assignments')
      .update({ assigned_at: new Date(Date.now() - 3 * 86_400_000).toISOString() })
      .eq('user_id', userId);
    await runAllocation(admin, { userId });
    const { count: midWeek } = await admin.from('assignments')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    expect(midWeek).toBe(1);

    // Huit jours après l'attribution : un nouveau dossier. Le lot du jour
    // est antidaté aussi — simuler le temps qui passe, c'est le simuler
    // partout, et le moteur refuse à raison deux lots le même jour.
    await admin.from('assignments')
      .update({ assigned_at: new Date(Date.now() - 8 * 86_400_000).toISOString() })
      .eq('user_id', userId);
    await admin.from('daily_batches').delete().eq('user_id', userId);
    await runAllocation(admin, { userId });
    const { count: nextWeek } = await admin.from('assignments')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    expect(nextWeek).toBe(2);
  });

  it('un passage en premium rouvre la journée', async () => {
    await stock(6);
    await runAllocation(admin, { userId });

    await admin.from('profiles').update({ plan: 'premium' }).eq('id', userId);
    // Hier en gratuit ; aujourd'hui premium : la fenêtre redevient le jour.
    await admin.from('assignments')
      .update({ assigned_at: new Date(Date.now() - 86_400_000 - 3_600_000).toISOString() })
      .eq('user_id', userId);
    await admin.from('daily_batches').delete().eq('user_id', userId);
    await runAllocation(admin, { userId });

    const { count } = await admin.from('assignments')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    expect(count).toBeGreaterThan(1);

    await admin.from('profiles').update({ plan: 'free' }).eq('id', userId);
  });
});
