import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupEngineTables, createCompany, createOpportunity, createUser,
  deleteTestUsers, serviceClient, supabaseReachable,
} from './helpers';
import { diagnoseEmptyDay } from '../../packages/core/src/allocation/diagnose';

/**
 * Pourquoi la journée est vide.
 *
 * Trois causes très différentes produisent le même écran, et l'utilisateur ne
 * peut agir que s'il sait laquelle. La plus fréquente au démarrage est aussi
 * la plus corrigible : une case décochée à l'inscription écarte tout le stock,
 * et sans explication c'est le produit qu'on accuse.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('diagnostic de journée vide', () => {
  const admin = serviceClient();
  let userId: string;

  beforeAll(async () => {
    await deleteTestUsers(admin, 'diagnose.test');
    userId = await createUser(admin, 'vide@diagnose.test', 'Test Vide');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'diagnose.test');
  });

  beforeEach(async () => {
    await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  const setServices = async (services: string[]) => {
    await admin.from('user_preferences')
      .upsert({ user_id: userId, services, location_mode: 'france_remote' }, { onConflict: 'user_id' });
  };

  it('dit que le stock est vide quand il l’est vraiment', async () => {
    await setServices([]);
    const result = await diagnoseEmptyDay(admin, userId);
    expect(result.reason).toBe('stock-vide');
    expect(result.inStock).toBe(0);
  });

  it('désigne la famille non retenue quand elle contient tout le stock', async () => {
    // Le cas le plus fréquent au démarrage, et le seul que l'utilisateur
    // attribuerait au produit s'il n'était pas expliqué.
    const companyId = await createCompany(admin);
    await createOpportunity(admin, companyId, { opportunity_type: 'tender_response' });
    await setServices(['website_redesign']);

    const result = await diagnoseEmptyDay(admin, userId);

    expect(result.reason).toBe('services-non-retenus');
    expect(result.inStock).toBe(1);
    expect(result.missedTypes).toEqual(['tender_response']);
  });

  it('ne blâme pas le paramétrage quand du stock passe le filtre', async () => {
    // Ici le vide vient d'ailleurs — cooldown, entreprise déjà attribuée,
    // score sous le seuil. Accuser les préférences enverrait l'utilisateur
    // modifier des réglages qui n'y sont pour rien.
    const companyId = await createCompany(admin);
    await createOpportunity(admin, companyId, { opportunity_type: 'website_redesign' });
    await setServices(['website_redesign']);

    const result = await diagnoseEmptyDay(admin, userId);
    expect(result.reason).toBe('inconnu');
  });

  it('reconnaît un utilisateur déjà servi aujourd’hui', async () => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);
    await admin.from('assignments').insert({
      user_id: userId, company_id: companyId, opportunity_id: opportunityId,
      rank: 1, match_score: 80,
      exclusive_until: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });

    const result = await diagnoseEmptyDay(admin, userId);
    expect(result.reason).toBe('servi');
  });

  it('ne restreint rien quand aucun service n’est déclaré', async () => {
    // Un paramétrage vide accepte tout : il ne peut donc jamais être la cause
    // d'une journée vide, et le dire serait faux.
    const companyId = await createCompany(admin);
    await createOpportunity(admin, companyId, { opportunity_type: 'tender_response' });
    await setServices([]);

    const result = await diagnoseEmptyDay(admin, userId);
    expect(result.reason).not.toBe('services-non-retenus');
  });
});
