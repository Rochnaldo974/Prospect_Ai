import { describe, expect, it } from 'vitest';
import { mergeFindings } from '../../packages/core/src/allocation/audit-share';

/** L'audit envoyé au prospect ne dit jamais deux fois la même chose. */
describe('constats de l’audit', () => {
  it('garde la mesure et écarte le relevé qui parle du même sujet', () => {
    const merged = mergeFindings(
      ['Servi sans HTTPS : « Non sécurisé » dans la barre d’adresse, et Google le pénalise', 'Aucun moyen de contact cliquable : ni téléphone, ni formulaire, ni e-mail'],
      ['Certificat de sécurité expiré : les navigateurs affichent un avertissement', 'Certificat expiré le 11 août 2026', 'Site servi sans HTTPS — les navigateurs affichent un avertissement', 'Site figé à 2011 d\'après sa mention de copyright'],
    );
    expect(merged).toEqual([
      'Servi sans HTTPS : « Non sécurisé » dans la barre d’adresse, et Google le pénalise',
      'Aucun moyen de contact cliquable : ni téléphone, ni formulaire, ni e-mail',
      'Site figé à 2011 d\'après sa mention de copyright',
    ]);
  });

  it('ne dépasse jamais cinq constats', () => {
    const merged = mergeFindings(['a', 'b', 'c', 'd', 'e', 'f'], ['g']);
    expect(merged).toHaveLength(5);
  });
});
