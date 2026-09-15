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

describe('ce qui donne envie d’appeler', () => {
  const refonte = (needSignals: ExplanationInput['needSignals'], facts: ExplanationInput['facts']) =>
    explainOpportunity(input({
      opportunityType: 'website_redesign', triggerType: null, triggerOccurredAt: null,
      needSignals, facts,
    }));

  it('ne parle jamais de l’âge du nom de domaine', () => {
    // « Déposé il y a 9 ans » n'est pas un défaut : c'est un a priori du
    // scoring, et le dire au freelance affaiblit la fiche.
    const e = refonte(
      [{ signal: 'aged_domain', points: 12 }, { signal: 'no_contact_form', points: 7 }],
      { domainAgeYears: 9 },
    );
    expect(e.why).not.toMatch(/il y a 9 ans/);
    expect(e.signals.join(' ')).not.toMatch(/déposé il y a/);
  });

  it('ouvre par le défaut le plus visible, pas par le plus pesant', () => {
    // Le formulaire absent pèse peu et se voit peu ; un site figé en 2011 se
    // montre en une capture d'écran. C'est lui qui ouvre.
    const e = refonte(
      [
        { signal: 'no_contact_form', points: 7.5 },
        { signal: 'aged_domain', points: 12 },
        { signal: 'stale_content', points: 24 },
      ],
      { copyrightYear: 2011 },
    );
    expect(e.why).toMatch(/^BOULANGERIE MOREAU.*Site figé à 2011/);
    expect(e.why).toMatch(/ans sans mise à jour visible/);
  });

  it('dit l’époque des technologies, pas seulement leur nom', () => {
    const e = refonte(
      [{ signal: 'outdated_stack', points: 45 }, { signal: 'slow_website', points: 20 }],
      { datedComponents: [{ name: 'jQuery', version: '1.7.2', year: 2012 }], techYear: 2012, ttfbMs: 2100 },
    );
    expect(e.why).toMatch(/jQuery 1\.7\.2 \(2012\)/);
    expect(e.why).toMatch(/technologies de 2012/);
  });
});

describe('présente sur les réseaux, sans site', () => {
  it('nomme les réseaux et ouvre la fiche avec', () => {
    const e = explainOpportunity(input({
      opportunityType: 'website_creation', triggerType: null, triggerOccurredAt: null,
      needSignals: [{ signal: 'active_business', points: 10 }, { signal: 'social_without_website', points: 60 }],
      facts: { socialLinks: { instagram: 'https://www.instagram.com/moreau', facebook: 'https://www.facebook.com/moreau' }, phone: '+33241222479' },
    }));
    expect(e.why).toMatch(/^BOULANGERIE MOREAU.*Présente sur Instagram et Facebook, sans aucun site web/);
    expect(e.angle).toMatch(/page sociale/);
  });
});

describe('le titre', () => {
  it('dit le verdict, la preuve et la proposition en une ligne', () => {
    const e = explainOpportunity(input({
      opportunityType: 'website_redesign', triggerType: null, triggerOccurredAt: null,
      needSignals: [{ signal: 'stale_content', points: 24 }, { signal: 'not_responsive', points: 50 }],
      facts: { copyrightYear: 2015 },
    }));
    expect(e.headline).toBe('Site trop vieux — figé en 2015, illisible sur téléphone : proposer une refonte moderne');
  });

  it('nomme la page sociale quand c’est elle qui porte la création', () => {
    const e = explainOpportunity(input({
      opportunityType: 'website_creation', triggerType: null, triggerOccurredAt: null,
      needSignals: [{ signal: 'social_without_website', points: 60 }, { signal: 'active_business', points: 10 }],
      facts: { socialLinks: { instagram: 'x' } },
    }));
    expect(e.headline).toBe('Pas de site, mais une page Instagram active — proposer un site vitrine simple');
  });

  it('ne prête aucune intention, même dans le titre', () => {
    const e = explainOpportunity(input({ facts: { creationDate: '2026-08-09' } }));
    expect(e.headline).toMatch(/^Entreprise créée le 9 août 2026, sans site — proposer un premier site$/);
    expect(e.headline).not.toMatch(/cherche|a besoin|veut/);
  });
});
