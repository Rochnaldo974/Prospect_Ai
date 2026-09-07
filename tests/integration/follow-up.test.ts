import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanupEngineTables, createCompany, createOpportunity, createUser,
  deleteTestUsers, serviceClient, supabaseReachable,
} from './helpers';
import { markContacted, markDayViewed, recordOutcome } from '../../packages/core/src/allocation/outcome';
import { getActivitySeries, getFollowUps, getOutcomeStats } from '../../packages/core/src/allocation/follow-up';

/**
 * Le suivi après l'appel.
 *
 * C'est la moitié du produit que la première version n'avait pas : un
 * « rappelez-moi en octobre » doit se retrouver quelque part, sinon l'outil
 * fait perdre les affaires qu'il a lui-même apportées. Ces tests vérifient
 * la boucle entière — déclarer, retrouver, relire sa note, faire avancer —
 * et surtout ses exclusions : un refus n'est pas une relance.
 */
const reachable = await supabaseReachable();

describe.skipIf(!reachable)('suivi des relances', () => {
  const admin = serviceClient();
  let userId: string;

  beforeAll(async () => {
    await deleteTestUsers(admin, 'follow-up.test');
    userId = await createUser(admin, 'suivi@follow-up.test', 'Test Suivi');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'follow-up.test');
  });

  beforeEach(async () => {
    await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('company_cooldowns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  const attribuer = async (): Promise<string> => {
    const companyId = await createCompany(admin);
    const opportunityId = await createOpportunity(admin, companyId);
    const { data, error } = await admin.from('assignments').insert({
      user_id: userId, company_id: companyId, opportunity_id: opportunityId,
      rank: 1, match_score: 80,
      exclusive_until: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    }).select('id').single();
    if (error) throw new Error(error.message);
    return data.id as string;
  };

  it('une issue ouverte crée une relance, avec la note du freelance', async () => {
    const assignmentId = await attribuer();
    await markContacted(admin, { assignmentId, userId });
    await recordOutcome(admin, {
      assignmentId, userId, outcome: 'interested',
      notes: 'Rappeler jeudi, demander le gérant.',
    });

    const followUps = await getFollowUps(admin, userId);
    expect(followUps).toHaveLength(1);
    expect(followUps[0]?.outcome).toBe('interested');
    // La note est la mémoire du freelance : la perdre rendrait la relance
    // muette au moment précis où elle sert.
    expect(followUps[0]?.notes).toBe('Rappeler jeudi, demander le gérant.');
    expect(followUps[0]?.daysSince).toBe(0);
  });

  it('un refus et une absence de réponse ne sont pas des relances', async () => {
    const refus = await attribuer();
    await recordOutcome(admin, { assignmentId: refus, userId, outcome: 'not_interested' });

    const silence = await attribuer();
    await recordOutcome(admin, { assignmentId: silence, userId, outcome: 'no_response' });

    expect(await getFollowUps(admin, userId)).toHaveLength(0);
  });

  it('faire avancer une relance remplace son état et sa note', async () => {
    const assignmentId = await attribuer();
    await recordOutcome(admin, {
      assignmentId, userId, outcome: 'interested', notes: 'Premier contact chaleureux.',
    });
    await recordOutcome(admin, {
      assignmentId, userId, outcome: 'meeting', notes: 'RDV mardi 10 h.',
    });

    const followUps = await getFollowUps(admin, userId);
    expect(followUps).toHaveLength(1);
    expect(followUps[0]?.outcome).toBe('meeting');
    expect(followUps[0]?.notes).toBe('RDV mardi 10 h.');
  });

  it('un client signé sort du suivi et entre dans les statistiques', async () => {
    const assignmentId = await attribuer();
    await recordOutcome(admin, { assignmentId, userId, outcome: 'interested' });
    await recordOutcome(admin, { assignmentId, userId, outcome: 'client' });

    expect(await getFollowUps(admin, userId)).toHaveLength(0);

    const stats = await getOutcomeStats(admin, userId);
    expect(stats.contacted).toBe(1);
    expect(stats.client).toBe(1);
    // L'issue est un état, pas un journal : « intéressé » puis « client »
    // compte un client, pas un intéressé de plus.
    expect(stats.interested).toBe(0);
  });

  it('les relances sont classées de la plus ancienne à la plus récente', async () => {
    const ancien = await attribuer();
    await recordOutcome(admin, { assignmentId: ancien, userId, outcome: 'proposal' });
    await admin.from('assignments')
      .update({ outcome_at: new Date(Date.now() - 25 * 86_400_000).toISOString() })
      .eq('id', ancien);

    const recent = await attribuer();
    await recordOutcome(admin, { assignmentId: recent, userId, outcome: 'interested' });

    const followUps = await getFollowUps(admin, userId);
    expect(followUps.map((f) => f.assignmentId)).toEqual([ancien, recent]);
    expect(followUps[0]?.daysSince).toBe(25);
  });

  it('marquer la journée vue ne touche que les attributions non vues', async () => {
    const assignmentId = await attribuer();
    await markDayViewed(admin, userId);

    const { data: first } = await admin.from('assignments')
      .select('viewed_at').eq('id', assignmentId).single();
    expect(first?.viewed_at).not.toBeNull();

    // Un second passage ne réécrit pas la date : « vu » date de la première
    // fois, c'est ce que mesure l'expérience.
    const seen = first?.viewed_at;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await markDayViewed(admin, userId);
    const { data: second } = await admin.from('assignments')
      .select('viewed_at').eq('id', assignmentId).single();
    expect(second?.viewed_at).toBe(seen);
  });
});

describe.skipIf(!reachable)('série d’activité', () => {
  const admin = serviceClient();
  let userId: string;

  beforeAll(async () => {
    await deleteTestUsers(admin, 'activite.test');
    userId = await createUser(admin, 'serie@activite.test', 'Test Activité');
  });

  afterAll(async () => {
    await cleanupEngineTables(admin);
    await deleteTestUsers(admin, 'activite.test');
  });

  it('grille complète, appels et réponses comptés le bon jour', async () => {
    await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('company_cooldowns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await admin.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Trois moments : un appel-réponse il y a 5 jours, un simple appel il y a
    // 2 jours, un refus il y a 40 jours — hors fenêtre, il ne compte pas.
    const insertAt = async (daysAgo: number, outcome: string | null) => {
      const companyId = await createCompany(admin);
      const opportunityId = await createOpportunity(admin, companyId);
      const when = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
      const { error } = await admin.from('assignments').insert({
        user_id: userId, company_id: companyId, opportunity_id: opportunityId,
        rank: 1, match_score: 80,
        status: outcome ? 'completed' : 'contacted',
        exclusive_until: when, assigned_at: when, contacted_at: when,
        outcome, outcome_at: outcome ? when : null,
      });
      if (error) throw new Error(error.message);
    };
    await insertAt(5, 'interested');
    await insertAt(2, null);
    await insertAt(40, 'not_interested');

    const series = await getActivitySeries(admin, userId);

    expect(series).toHaveLength(30);
    const day = (offset: number) => series[series.length - 1 - offset]!;
    expect(day(5)).toMatchObject({ contacted: 1, responses: 1 });
    expect(day(2)).toMatchObject({ contacted: 1, responses: 0 });
    // Le refus d'il y a 40 jours est hors fenêtre : le total reste à deux.
    expect(series.reduce((sum, d) => sum + d.contacted, 0)).toBe(2);
    expect(series.reduce((sum, d) => sum + d.responses, 0)).toBe(1);
  });
});
