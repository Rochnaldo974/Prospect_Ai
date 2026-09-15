import { describe, expect, it } from 'vitest';
import { scoreSite, type SiteMeasures } from '../../packages/core/src/enrichment/audit';

/**
 * La note du site doit se lire comme on la dirait au commerçant : chaque
 * point perdu a une mesure derrière, et le constat le plus grave ouvre.
 */
const sain: SiteMeasures = {
  url: 'https://moreau.fr', https: true, domContentLoadedMs: 800, loadMs: 1500, loadTimedOut: false,
  requests: 30, transferBytes: 1_200_000, imageBytes: 600_000, mixedContent: 0,
  title: 'Boulangerie Moreau — Angers', metaDescription: 'Pain au levain, viennoiseries.', h1Count: 1,
  imagesTotal: 8, imagesWithAlt: 8, lang: 'fr', viewportMeta: true, mobileOverflow: false, mobileBodyFontPx: 16,
  hasTelLink: true, hasMailLink: false, hasForm: true, copyrightYear: 2026, tlsValid: true,
};

describe('note du site', () => {
  it('donne une note haute et aucun constat à un site sain', () => {
    const audit = scoreSite(sain, new Date('2026-09-15'));
    expect(audit.score).toBeGreaterThanOrEqual(95);
    expect(audit.findings).toEqual([]);
  });

  it('chiffre chaque défaut et ouvre par le plus grave', () => {
    const audit = scoreSite({
      ...sain, loadMs: 6200, transferBytes: 7_000_000, viewportMeta: false, mobileOverflow: true,
      title: null, https: false, copyrightYear: 2015,
    }, new Date('2026-09-15'));
    expect(audit.score).toBeLessThan(40);
    expect(audit.scores.mobile).toBeLessThan(30);
    expect(audit.findings[0]).toMatch(/Servi sans HTTPS/);
    expect(audit.findings).toContain("Déborde de l'écran sur téléphone : il faut faire défiler de côté");
    expect(audit.findings).toContain('6,2 s pour s\'afficher complètement');
    expect(audit.findings).toContain('Mention « © 2015 » : 11 ans sans mise à jour visible');
  });

  it('traite un chargement interrompu comme le pire cas de vitesse', () => {
    const audit = scoreSite({ ...sain, loadTimedOut: true, loadMs: null }, new Date('2026-09-15'));
    expect(audit.scores.speed).toBeLessThanOrEqual(10);
    expect(audit.findings[0]).toMatch(/25 secondes/);
  });

  it('ne laisse pas la moyenne masquer un défaut grave', () => {
    // Rapide, lisible, bien balisé, mais « non sécurisé » et sans contact :
    // la note globale reste sous 70, parce que c'est ce que voit le visiteur.
    const audit = scoreSite({ ...sain, https: false, hasTelLink: false, hasForm: false }, new Date('2026-09-15'));
    expect(audit.scores.trust).toBe(30);
    expect(audit.score).toBeLessThanOrEqual(70);
  });

  it('ne perd rien en confiance quand le contact est cliquable', () => {
    const audit = scoreSite({ ...sain, hasTelLink: false, hasForm: false, hasMailLink: true }, new Date('2026-09-15'));
    expect(audit.scores.trust).toBe(100);
  });
});
