import { describe, expect, it } from 'vitest';
import { draftProspectingEmail } from '../../packages/core/src/allocation/email-draft';

/**
 * Le brouillon d'e-mail.
 *
 * C'est un texte envoyé sous le nom du CLIENT à un inconnu : chaque défaut
 * ici est un défaut qu'un freelance paye de sa réputation. Les tests
 * vérifient la colonne vertébrale (qui écrit, ce qu'un client voit, ce
 * qu'on propose), l'absence de jargon, la brièveté, et la tenue quand les
 * données manquent.
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
    evidence: [],
  },
};

const sender = {
  name: 'Eliott Roche',
  title: 'Développeur web indépendant',
  city: 'Angers',
  presentation: 'Je crée des sites pour des commerces et des artisans, simples et lisibles sur téléphone',
};

const written = {
  subject: 'Votre site vu depuis un téléphone',
  hook: 'En regardant votre site, j’ai remarqué qu’il ne s’ouvre plus en ce moment.',
  proposal: 'Je vous propose de le remettre en ligne rapidement, et de faire en sorte qu’il s’ouvre bien sur téléphone.',
};

describe('brouillon de prospection', () => {
  it('commence par dire qui écrit, avec la présentation de la signature', () => {
    const draft = draftProspectingEmail(base, 'call', { sender });
    const lines = draft.body.split('\n');
    expect(lines[0]).toBe('Bonjour,');
    expect(lines[2]).toBe('Je suis Eliott Roche, développeur web indépendant à Angers. Je crée des sites pour des commerces et des artisans, simples et lisibles sur téléphone.');
  });

  it('reprend l’accroche et la proposition rédigées quand elles existent', () => {
    const draft = draftProspectingEmail({ ...base, explanation: { ...base.explanation, email: written } }, 'call', { sender });
    expect(draft.subject).toBe(written.subject);
    expect(draft.body).toContain(written.hook);
    expect(draft.body).toContain(written.proposal);
    // Le relevé du moteur, écrit pour le freelance, ne part jamais au commerçant.
    expect(draft.body).not.toContain(base.explanation.angle);
  });

  it('sans fiche rédigée, dit le fait poliment en une phrase, sans le relevé du moteur', () => {
    const draft = draftProspectingEmail(base, 'call', { sender });
    expect(draft.body).toContain('En regardant le site de Le Vieux Pressoir, j’ai remarqué que le site ne répond pas (erreur HTTP 503).');
    expect(draft.body).not.toMatch(/je cherchais|je suis tombé/i);
    expect(draft.body).not.toContain(base.explanation.angle);
    expect(draft.body).not.toMatch(/audit centré|jugement esthétique/);
    // La signature n'est PAS dans le brouillon : l'identité d'expéditeur
    // l'ajoute au rendu — un seul endroit fait foi.
    expect(draft.body.trim().endsWith('Bien à vous,')).toBe(true);
  });

  it('reste court : un dirigeant ne lit pas une plaquette', () => {
    const draft = draftProspectingEmail(base, 'call', { sender });
    expect(draft.body.split('\n').length).toBeLessThanOrEqual(11);
    expect(draft.body.length).toBeLessThan(700);
  });

  it('tient sans constat, sans ville, sans nom et sans présentation', () => {
    const draft = draftProspectingEmail({
      ...base,
      company: { ...base.company, city: null, industry: null },
      explanation: { ...base.explanation, signals: [] },
    });
    expect(draft.body).toContain('Le Vieux Pressoir');
    expect(draft.body).toContain('Je suis développeur web indépendant.');
    expect(draft.body).not.toContain('undefined');
    expect(draft.body).not.toContain('null');
    expect(draft.subject.length).toBeGreaterThan(0);
  });

  it('chaque intention a son registre, sur la même colonne vertébrale', () => {
    const call = draftProspectingEmail(base, 'call', { sender });
    const audit = draftProspectingEmail(base, 'audit', { sender });
    const intro = draftProspectingEmail(base, 'intro', { sender, hasCv: true });

    for (const draft of [call, audit, intro]) {
      expect(draft.body).toContain('Je suis Eliott Roche');
      expect(draft.body).toContain('le site ne répond pas (erreur HTTP 503)');
    }

    expect(call.body).toContain('dix minutes');
    expect(audit.body).toContain('état des lieux');
    expect(audit.body).toContain('sans engagement');
    expect(intro.body).toContain('Mon CV est joint');
    // Le remplissage a disparu : ni promesse d'envoi en plusieurs lignes, ni « vous décidez ».
    for (const draft of [call, audit, intro]) expect(draft.body).not.toMatch(/quelques lignes|vous décidez|de vive voix/);
  });

  it('ne promet pas de CV joint quand il n’y en a pas', () => {
    const intro = draftProspectingEmail(base, 'intro', { hasCv: false });
    expect(intro.body).not.toContain('CV');
  });

  it('ne parle jamais la langue des informaticiens', () => {
    for (const intent of ['call', 'audit', 'intro'] as const) {
      const draft = draftProspectingEmail({ ...base, explanation: { ...base.explanation, email: written } }, intent, { sender, hasCv: true });
      expect(`${draft.subject} ${draft.body}`).not.toMatch(/HTTPS|SSL|certificat|responsive|SEO|CMS|refonte/i);
    }
  });

  it('n’écrit jamais un objet racoleur', () => {
    // Un objet en majuscules ou à point d'exclamation part en spam et y
    // emmène la réputation de l'expéditeur.
    for (const type of ['website_redesign', 'website_creation', 'ecommerce', 'seo'] as const) {
      const draft = draftProspectingEmail({ ...base, type }, 'call');
      expect(draft.subject).not.toMatch(/!|GRATUIT|OFFRE|URGENT/i);
    }
  });
});

describe('le lien de l’audit', () => {
  it('donne l’audit quand il existe, au lieu de le promettre', () => {
    const draft = draftProspectingEmail(base, 'audit', { auditUrl: 'https://prospect.ai/audit/abc' });
    expect(draft.body).toContain('https://prospect.ai/audit/abc');
    expect(draft.body).not.toMatch(/Souhaitez-vous que je vous l’envoie/);
  });

  it('promet l’audit quand aucun lien n’est prêt', () => {
    const draft = draftProspectingEmail(base, 'audit');
    expect(draft.body).toMatch(/Souhaitez-vous que je vous l’envoie/);
  });
});
