import { describe, expect, it } from 'vitest';
import { explainOpportunity } from '../../packages/core/src/opportunities/explain';
import type { ExplanationInput } from '../../packages/core/src/opportunities/explain';

/**
 * Génération de l'explication.
 *
 * C'est ici que se joue la valeur du produit. Livrer une liste d'entreprises
 * n'apprend rien à un freelance : il en trouve autant dans un annuaire. Ce
 * qu'il ne peut pas produire seul, c'est la raison — datée, vérifiable, propre
 * à cette entreprise — pour laquelle celle-ci vaut un appel aujourd'hui.
 *
 * Deux règles absolues, que ces tests protègent :
 *   1. ne jamais affirmer ce qu'on ne sait pas ;
 *   2. aucune phrase qui s'appliquerait aussi bien à n'importe quelle autre
 *      entreprise.
 */

const input = (over: Partial<ExplanationInput> = {}): ExplanationInput => ({
  opportunityType: 'website_creation',
  companyName: 'BOULANGERIE MOREAU',
  city: 'Angers',
  industryLabel: 'Boulangerie et boulangerie-pâtisserie',
  triggerType: 'company_recently_created',
  triggerOccurredAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  needSignals: [{ signal: 'no_website_proven', points: 70 }],
  facts: {},
  confidenceScore: 0.8,
  ...over,
});

describe('ce que l’explication n’a pas le droit de dire', () => {
  const interdits = [
    /cherche un (développeur|prestataire|freelance)/i,
    /a besoin d(e |')/i,
    /veut (refaire|créer)/i,
    /est prête à/i,
  ];

  it('ne prête jamais d’intention à l’entreprise', () => {
    // Aucun de nos faits ne dit ce que l'entreprise veut. Le prétendre serait
    // le seul moyen sûr de faire perdre sa crédibilité au freelance dès le
    // premier appel.
    const e = explainOpportunity(input());
    const texte = [e.why, e.whyNow, e.angle, ...e.signals].join(' ');
    for (const motif of interdits) expect(texte).not.toMatch(motif);
  });

  it('dit explicitement que les signaux ne valent pas demande', () => {
    expect(explainOpportunity(input()).why).toMatch(/ne (disent|dit) pas/i);
  });

  it('ne fabrique aucune urgence quand rien ne date le contact', () => {
    const e = explainOpportunity(input({ triggerType: null, triggerOccurredAt: null }));
    expect(e.whyNow).toBe('');
  });
});

describe('ce que l’explication doit dire', () => {
  it('cite la valeur mesurée plutôt qu’un adjectif', () => {
    // « site lent » ne se vérifie pas ; « 2,4 s » se vérifie.
    const e = explainOpportunity(input({
      opportunityType: 'maintenance',
      needSignals: [{ signal: 'slow_website', points: 45 }],
      facts: { ttfbMs: 2400 },
    }));
    expect(e.signals.join(' ')).toContain('2,4 s');
  });

  it('écrit les décimales à la française', () => {
    const e = explainOpportunity(input({
      opportunityType: 'maintenance',
      needSignals: [{ signal: 'slow_website', points: 45 }],
      facts: { ttfbMs: 3100 },
    }));
    expect(e.signals.join(' ')).not.toMatch(/\d\.\d/);
  });

  it('ne répète pas le fait déclencheur entre le pourquoi et le pourquoi maintenant', () => {
    const e = explainOpportunity(input({ facts: { creationDate: '2026-08-09' } }));
    expect(e.whyNow).not.toBe('');
    expect(e.why).not.toContain('immatricul');
  });

  it('nomme l’entreprise, sa ville et son métier', () => {
    const e = explainOpportunity(input());
    expect(e.why).toContain('BOULANGERIE MOREAU');
    expect(e.why).toContain('Angers');
    expect(e.why.toLowerCase()).toContain('boulangerie et boulangerie-pâtisserie');
  });

  it('signale ce qu’on ne sait pas', () => {
    // Une entreprise créée il y a trois semaines a peut-être déjà un site en
    // préparation : le taire ferait perdre un appel sans prévenir.
    const e = explainOpportunity(input({
      triggerOccurredAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    }));
    expect(e.caveats.length).toBeGreaterThan(0);
  });
});

describe('dépôt de nom de domaine', () => {
  const depot = (over: Partial<ExplanationInput['facts']> = {}) =>
    explainOpportunity(input({
      triggerType: 'domain_recently_registered',
      triggerOccurredAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
      needSignals: [
        { signal: 'no_website_proven', points: 70 },
        { signal: 'domain_recently_registered', points: 25 },
      ],
      facts: { domain: 'moreau-angers.fr', domainRegisteredAt: '2026-08-17', ...over },
    }));

  it('distingue une adresse vide d’une adresse déjà servie', () => {
    // Le même fait daté recouvre deux situations opposées. Les confondre
    // reviendrait à décrire une entreprise qu'on n'a pas regardée.
    const vide = depot({ websiteStatus: 'placeholder' }).whyNow;
    const servie = depot({ websiteStatus: 'reachable' }).whyNow;
    expect(vide).not.toBe(servie);
    expect(vide).toMatch(/rien n'est encore en ligne/i);
  });

  it('donne la date du dépôt dans les signaux', () => {
    expect(depot().signals.join(' ')).toContain('17 août 2026');
  });

  it('ne répète pas le dépôt dans le pourquoi, qui a sa section', () => {
    expect(depot().why).not.toMatch(/déposé/i);
  });
});

describe('robustesse', () => {
  it('reste lisible sans aucun fait annexe', () => {
    const e = explainOpportunity(input({
      city: null, industryLabel: null, facts: {},
    }));
    expect(e.why.length).toBeGreaterThan(30);
    expect(e.angle.length).toBeGreaterThan(30);
    // Pas de trou de gabarit laissé dans le texte livré.
    expect(e.why + e.angle).not.toMatch(/undefined|null|\[object/);
  });

  it('ne produit jamais de double espace ni d’espace avant ponctuation', () => {
    const e = explainOpportunity(input({ facts: { ttfbMs: 2400, cms: 'Wix' } }));
    const texte = [e.why, e.whyNow, e.angle].join(' ');
    expect(texte).not.toMatch(/ {2}/);
    expect(texte).not.toMatch(/ [,.]/);
  });
});

describe('appel d’offres : le besoin est déclaré, pas déduit', () => {
  const avis = (over: Partial<ExplanationInput> = {}) => explainOpportunity(input({
    opportunityType: 'tender_response',
    companyName: 'CENTRALE LILLE INSTITUT',
    city: "Villeneuve d'Ascq",
    industryLabel: null,
    triggerType: 'tender_published',
    triggerOccurredAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    needSignals: [{ signal: 'tender_published', points: 95 }],
    facts: {
      tenderSubject: 'Refonte du site internet et tierce maintenance applicative',
      tenderDeadline: new Date(Date.now() + 17 * 86_400_000).toISOString(),
    },
    confidenceScore: 1,
    ...over,
  }));

  it('ne sert pas la réserve d’usage, qui serait fausse ici', () => {
    // « Ces éléments ne disent pas que l'entreprise a formulé ce besoin »
    // protège le freelance partout où le besoin est déduit. Sur un avis publié
    // par l'acheteur, elle le ferait douter du seul cas certain.
    expect(avis().why).not.toMatch(/ne disent pas/i);
    expect(avis().why).toMatch(/publié ce besoin lui-même/i);
  });

  it('cite l’acheteur mot pour mot', () => {
    // Reformuler un besoin déclaré ne peut que le déformer.
    expect(avis().signals.join(' ')).toContain('Refonte du site internet et tierce maintenance');
  });

  it('donne la date limite, qui est ce qui date l’opportunité', () => {
    const whyNow = avis().whyNow;
    expect(whyNow).toMatch(/jusqu'au/);
    expect(whyNow).toMatch(/fixé par l'acheteur/);
  });

  it('ne reproche pas l’absence de téléphone : on répond sur la plateforme', () => {
    expect(avis().caveats.join(' ')).not.toMatch(/téléphone/i);
  });
});

describe('accords en français', () => {
  it('écrit « une semaine » et non « 1 semaines »', () => {
    const e = explainOpportunity(input({
      triggerType: 'bodacc_cession',
      triggerOccurredAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    }));
    expect(e.whyNow).not.toMatch(/\b1 semaines\b/);
  });

  it('écrit « environ un mois » et non « environ 1 mois »', () => {
    const e = explainOpportunity(input({
      triggerType: 'bodacc_cession',
      triggerOccurredAt: new Date(Date.now() - 33 * 86_400_000).toISOString(),
    }));
    expect(e.whyNow).not.toMatch(/environ 1 mois/);
  });
});
