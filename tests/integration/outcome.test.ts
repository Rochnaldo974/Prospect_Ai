import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupEngineTables, createCompany, createOpportunity, createUser,
  deleteTestUsers, serviceClient, supabaseReachable,
} from './helpers';
import { markContacted, recordOptOut, recordOutcome } from '../../packages/core/src/allocation/outcome';

/**
 * Boucle de retour.
 *
 * Ce que le freelance déclare après son appel décide de trois choses : si le
 * groupe contrôle mesure quelque chose, si le moteur peut apprendre, et
 * surtout si l'on rappellera un commerçant qui a déjà dit non. Ce dernier
 * point n'est pas une politesse — une entreprise démarchée trois fois en
 * trois mois se plaint, et elle a raison.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('boucle de retour', () => {
  const admin = serviceClient();
  let userId: string;

  beforeAll(async () => {
    // Un compte laissé par une exécution interrompue ferait échouer la suite
    // entière avant le premier test.
    await deleteTestUsers(admin, 'outcome.test');
    userId = await createUser(admin, 'outcome@outcome.test', 'Test Retour');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'outcome.test');
  });

  beforeEach(async () => {
    await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('company_cooldowns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  const attribuer = async (): Promise<{ assignmentId: string; companyId: string }> => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);
    const { data, error } = await admin.from('assignments').insert({
      user_id: userId, company_id: companyId, opportunity_id: opportunityId,
      rank: 1, match_score: 80,
      exclusive_until: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    }).select('id').single();
    if (error) throw new Error(error.message);
    return { assignmentId: data.id as string, companyId };
  };

  it('met l’entreprise hors circuit après un refus', async () => {
    // Revenir dans deux mois sur quelqu'un qui a dit non, c'est ne pas avoir
    // écouté. Le cooldown est ce qui rend le produit tenable dans la durée.
    const { assignmentId, companyId } = await attribuer();

    await recordOutcome(admin, { assignmentId, userId, outcome: 'not_interested' });

    const { data } = await admin.rpc('company_in_cooldown', { target_company: companyId });
    expect(data).toBe(true);
  });

  it('exige un contact avant de rendre compte, comme la base l’impose', async () => {
    // La contrainte est en base : on ne peut pas déclarer l'issue d'un appel
    // qu'on n'a pas passé. Le moteur date donc le contact lui-même.
    const { assignmentId } = await attribuer();

    await recordOutcome(admin, { assignmentId, userId, outcome: 'no_response' });

    const { data } = await admin.from('assignments')
      .select('status, outcome, contacted_at, outcome_at').eq('id', assignmentId).single();
    expect(data!.status).toBe('completed');
    expect(data!.contacted_at).not.toBeNull();
    expect(data!.outcome_at).not.toBeNull();
  });

  it('ne fait pas revenir un client gagné dans le stock', async () => {
    const { assignmentId, companyId } = await attribuer();

    const report = await recordOutcome(admin, { assignmentId, userId, outcome: 'client' });

    expect(report.permanent).toBe(true);
    const { data } = await admin.from('company_cooldowns')
      .select('permanent').eq('company_id', companyId).single();
    expect(data!.permanent).toBe(true);
  });

  it('sépare une opposition d’un simple refus commercial', async () => {
    // « Ne me recontactez plus » est une demande faite au service, pas à la
    // personne qui a appelé : elle coupe l'entreprise de toute la chaîne.
    const { assignmentId, companyId } = await attribuer();

    await recordOptOut(admin, { assignmentId, userId });

    const { data } = await admin.from('companies')
      .select('suppression_global, prospecting_allowed').eq('id', companyId).single();
    expect(data!.suppression_global).toBe(true);
    expect(data!.prospecting_allowed).toBe(false);
  });

  it('refuse de clore l’attribution d’un autre', async () => {
    const { assignmentId } = await attribuer();

    await expect(recordOutcome(admin, {
      assignmentId, userId: '00000000-0000-0000-0000-000000000001', outcome: 'client',
    })).rejects.toThrow(/autre utilisateur/i);
  });

  it('ne réécrit pas la date du premier contact', async () => {
    // Marquer deux fois « j'ai contacté » ne doit pas effacer l'heure du
    // premier appel : c'est elle qui mesure le délai de réaction.
    const { assignmentId } = await attribuer();

    await markContacted(admin, { assignmentId, userId });
    const { data: premier } = await admin.from('assignments')
      .select('contacted_at').eq('id', assignmentId).single();

    await markContacted(admin, { assignmentId, userId });
    const { data: second } = await admin.from('assignments')
      .select('contacted_at').eq('id', assignmentId).single();

    expect(second!.contacted_at).toBe(premier!.contacted_at);
  });
});
