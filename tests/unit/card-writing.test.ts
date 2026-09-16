import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { createClaudeWriter } from '../../packages/core/src/allocation/writing';
import type { TodayOpportunity } from '../../packages/core/src/allocation/today';

/**
 * La rédaction ne peut rien inventer : elle reçoit les faits du moteur et
 * renvoie une fiche validée. On vérifie ici ce qui part vers le modèle et
 * ce qu'on accepte en retour — sans réseau, avec un client factice.
 */
const opportunity = (): TodayOpportunity => ({
  assignmentId: 'a1', rank: 1, type: 'website_redesign', matchScore: 80,
  exclusiveUntil: new Date().toISOString(), assignedAt: new Date().toISOString(), viewedAt: null, contactedAt: null, snoozedAt: null,
  company: {
    name: 'Boulangerie Moreau', city: 'Angers', industry: 'Boulangerie', industryIcon: '🥖', phone: '+33241222479',
    email: null, address: null, contactFormUrl: null, websiteUrl: 'https://moreau.fr',
  },
  explanation: {
    why: 'Boulangerie Moreau, boulangerie à Angers. Site figé à 2011.',
    whyNow: '',
    angle: 'Proposer une refonte.',
    signals: ['Site figé à 2011 d\'après sa mention de copyright — 15 ans sans mise à jour visible', 'Le site ne s’adapte pas aux écrans de téléphone'],
    caveats: [],
  },
});

const fakeClient = (parsed: unknown, stop = 'end_turn') => {
  const calls: unknown[] = [];
  const client = {
    messages: {
      parse: async (params: unknown) => { calls.push(params); return { stop_reason: stop, parsed_output: parsed }; },
    },
  } as unknown as Anthropic;
  return { client, calls };
};

const card = {
  headline: 'Un site figé en 2011, illisible sur téléphone',
  why: 'Le site affiche une mention de copyright 2011 et ne s’adapte pas aux écrans de téléphone. Quinze ans sans mise à jour visible.',
  whyNow: '',
  angle: 'Proposer une refonte légère, mobile d’abord, en gardant le contenu existant.',
  opener: 'Bonjour, je suis développeur web à Angers ; j’ai vu que votre site date de 2011 et ne s’ouvre pas bien sur téléphone. Est-ce quelque chose que vous avez prévu de revoir ?',
  email: {
    subject: 'Votre site vu depuis un téléphone',
    hook: 'En regardant votre site, j’ai remarqué qu’il date de 2011 et qu’il s’affiche difficilement sur téléphone.',
    proposal: 'Je vous propose de le remettre au goût du jour, lisible sur téléphone, avec vos horaires et votre adresse bien en vue.',
  },
};

describe('rédaction des fiches', () => {
  it('envoie les faits du moteur, et seulement eux, avec les règles', async () => {
    const { client, calls } = fakeClient(card);
    const write = createClaudeWriter({ client });
    const result = await write({ opportunity: opportunity(), services: ['website_redesign'] });
    expect(result.headline).toBe(card.headline);

    const params = calls[0] as { system: string; messages: { content: string }[]; model: string };
    expect(params.model).toBe('claude-opus-5');
    expect(params.system).toMatch(/QUE les faits fournis/);
    expect(params.messages[0]!.content).toMatch(/Site figé à 2011/);
    expect(params.messages[0]!.content).toMatch(/Services du freelance : website_redesign/);
    expect(params.messages[0]!.content).toMatch(/Ville du freelance : non fournie — ne pas le situer/);
    expect(params.system).toMatch(/ni sa ville/);
  });

  it('écarte la part e-mail qui parle en informaticien, et garde la fiche', async () => {
    const jargon = { ...card, email: { ...card.email, hook: 'En regardant votre site, votre certificat HTTPS est expiré et le site n’est pas responsive.' } };
    const { client } = fakeClient(jargon);
    const write = createClaudeWriter({ client });
    const result = await write({ opportunity: opportunity(), services: [] });
    expect(result.headline).toBe(card.headline);
    expect(result.email).toBeUndefined();
  });

  it('demande un e-mail sans mot technique, qui situe la rencontre dans le métier', async () => {
    const { client, calls } = fakeClient(card);
    const write = createClaudeWriter({ client });
    const result = await write({ opportunity: opportunity(), services: [] });
    expect(result.email?.subject).toBe(card.email.subject);
    const params = calls[0] as { system: string };
    expect(params.system).toMatch(/AUCUN mot technique/);
    expect(params.system).toMatch(/Pas de mise en scène/);
    expect(params.system).toMatch(/ne salue pas et ne présente pas le freelance/);
  });

  it('refuse une fiche qui ne respecte pas le schéma', async () => {
    const { client } = fakeClient({ ...card, opener: 'trop court' });
    await expect(createClaudeWriter({ client })({ opportunity: opportunity(), services: [] }))
      .rejects.toThrow();
  });

  it('refuse une sortie absente ou un refus du modèle', async () => {
    await expect(createClaudeWriter({ client: fakeClient(null).client })({ opportunity: opportunity(), services: [] }))
      .rejects.toThrow(/illisible/);
    await expect(createClaudeWriter({ client: fakeClient(card, 'refusal').client })({ opportunity: opportunity(), services: [] }))
      .rejects.toThrow(/refusée/);
  });
});
