import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots } from '../../packages/core/src/enrichment/fetcher';

/**
 * robots.txt.
 *
 * On visite des sites d'entreprises réelles : le respecter n'est pas une
 * option. Les erreurs d'interprétation vont toujours dans le même sens —
 * mieux vaut renoncer à une page qu'en prendre une interdite.
 */
describe('robots.txt', () => {
  it('retient les règles du groupe générique', () => {
    const rules = parseRobots(`
      User-agent: *
      Disallow: /admin
      Disallow: /panier
      Allow: /admin/public
    `);
    expect(rules.disallow).toEqual(['/admin', '/panier']);
    expect(rules.allow).toEqual(['/admin/public']);
  });

  it('ignore les groupes qui ne nous concernent pas', () => {
    const rules = parseRobots(`
      User-agent: Googlebot
      Disallow: /

      User-agent: *
      Disallow: /prive
    `);
    expect(rules.disallow).toEqual(['/prive']);
  });

  it('donne la priorité à une règle qui nous vise nommément', () => {
    const rules = parseRobots(`
      User-agent: *
      Disallow: /

      User-agent: ProspectAIBot
      Disallow: /prive
    `);
    // La règle générale interdit tout, la nôtre ne bloque que /prive.
    expect(rules.disallow).toEqual(['/prive']);
    expect(isAllowed(rules, '/mentions-legales')).toBe(true);
  });

  it('lit le délai de crawl', () => {
    expect(parseRobots('User-agent: *\nCrawl-delay: 3').crawlDelayMs).toBe(3000);
    expect(parseRobots('User-agent: *').crawlDelayMs).toBeNull();
  });

  it('ignore les commentaires et les lignes vides', () => {
    const rules = parseRobots(`
      # commentaire
      User-agent: *   # encore un
      Disallow: /admin

      Ligne sans séparateur
    `);
    expect(rules.disallow).toEqual(['/admin']);
  });

  describe('autorisation d’un chemin', () => {
    it('autorise en l’absence de règle', () => {
      expect(isAllowed({ disallow: [], allow: [], crawlDelayMs: null }, '/mentions-legales')).toBe(true);
    });

    it('applique les interdictions par préfixe', () => {
      const rules = parseRobots('User-agent: *\nDisallow: /admin');
      expect(isAllowed(rules, '/admin/config')).toBe(false);
      expect(isAllowed(rules, '/mentions-legales')).toBe(true);
    });

    it('fait primer la règle la plus spécifique', () => {
      const rules = parseRobots(`
        User-agent: *
        Disallow: /
        Allow: /mentions-legales
      `);
      expect(isAllowed(rules, '/mentions-legales')).toBe(true);
      expect(isAllowed(rules, '/panier')).toBe(false);
    });

    it('interprète « Disallow: / » comme une interdiction totale', () => {
      const rules = parseRobots('User-agent: *\nDisallow: /');
      expect(isAllowed(rules, '/')).toBe(false);
      expect(isAllowed(rules, '/nimporte-quoi')).toBe(false);
    });
  });
});
