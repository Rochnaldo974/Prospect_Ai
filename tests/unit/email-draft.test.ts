import { describe, expect, it } from 'vitest';
import { draftProspectingEmail } from '../../packages/core/src/allocation/email-draft';

/**
 * Le brouillon d'e-mail.
 *
 * C'est un texte envoyé sous le nom du CLIENT à un inconnu : chaque défaut
 * ici est un défaut qu'un freelance paye de sa réputation. Les tests
 * vérifient la matière (les faits du dossier), la brièveté, et la tenue
 * quand les données manquent.
 */
const base = {
  type: 'website_redesign' as const,
  company: {
    name: 'Le Vieux Pressoir', city: 'Angers', industry: 'Restaurant',
    phone: '+33241887702', email: 'contact@pressoir.fr',
    address: null, contactFormUrl: null, websiteUrl: 'https://demo-pressoir.fr',
  },
  explanation: {
    why: 'Le site ne répond pas.',
    whyNow: 'Constaté à deux passages.',
    angle: 'Proposer un audit court centré sur la remise en ligne du site.',
    signals: ['Le site ne répond pas (erreur HTTP 503)'],
    caveats: [],
  },
};

describe('brouillon de prospection', () => {
  it('ancre le message dans le premier constat du dossier', () => {
    const draft = draftProspectingEmail(base, 'Eliott');
    expect(draft.body).toContain('Le Vieux Pressoir');
    expect(draft.body).toContain('le site ne répond pas (erreur HTTP 503)');
    expect(draft.body).toContain(base.explanation.angle);
    expect(draft.body).toContain('Eliott');
  });

  it('reste court : un dirigeant ne lit pas une plaquette', () => {
    const draft = draftProspectingEmail(base, 'Eliott');
    expect(draft.body.split('\n').length).toBeLessThanOrEqual(12);
    expect(draft.body.length).toBeLessThan(700);
  });

  it('tient sans constat, sans ville et sans prénom', () => {
    const draft = draftProspectingEmail({
      ...base,
      company: { ...base.company, city: null },
      explanation: { ...base.explanation, signals: [] },
    }, '');
    expect(draft.body).toContain('Le Vieux Pressoir');
    expect(draft.body).not.toContain('undefined');
    expect(draft.body).not.toContain('null');
    expect(draft.subject.length).toBeGreaterThan(0);
  });

  it('n’écrit jamais un objet racoleur', () => {
    // Un objet en majuscules ou à point d'exclamation part en spam et y
    // emmène la réputation de l'expéditeur.
    for (const type of ['website_redesign', 'website_creation', 'ecommerce', 'seo'] as const) {
      const draft = draftProspectingEmail({ ...base, type }, 'E');
      expect(draft.subject).not.toMatch(/!|GRATUIT|OFFRE|URGENT/i);
    }
  });
});
