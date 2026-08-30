import { describe, expect, it } from 'vitest';
import { datedComponents, technologyYear } from '../../packages/core/src/enrichment/tech-vintage';

/**
 * Datation des composants d'un site.
 *
 * Ce module produit l'argument le plus vérifiable du produit : « votre site
 * est bâti sur jQuery 1.7.2, sorti en 2011 ». Un commerçant peut ouvrir le
 * code source et le constater. Une erreur ici ne se rattrape donc pas — elle
 * se voit, et elle discrédite tout le reste.
 */

describe('ce qu’on sait dater', () => {
  it('lit la version dans le nom du fichier', () => {
    const found = datedComponents('<script src="/js/jquery-1.7.2.min.js"></script>');
    expect(found).toEqual([{ name: 'jQuery', version: '1.7', year: 2011 }]);
  });

  it('date au mineur, et non à la première version de la génération', () => {
    // Bootstrap 3 commence en 2013 mais 3.3 sort en 2015 : dater à 2013
    // vieillirait le site de deux ans à tort, sur le seul constat que
    // l'interlocuteur peut vérifier lui-même.
    const found = datedComponents('<link href="/css/bootstrap-3.3.7.min.css">');
    expect(found[0]).toMatchObject({ name: 'Bootstrap', version: '3.3', year: 2015 });
  });

  it('retombe sur la génération quand le mineur est inconnu', () => {
    const found = datedComponents('<link href="/css/bootstrap-2.9.9.min.css">');
    expect(found[0]).toMatchObject({ name: 'Bootstrap', year: 2012 });
  });

  it('lit la version de WordPress sur les fichiers de son cœur', () => {
    const found = datedComponents('<link href="/wp-includes/css/dashicons.min.css?ver=4.9.8">');
    expect(found[0]).toMatchObject({ name: 'WordPress', year: 2014 });
  });

  it('ne confond pas la version d’un thème avec celle de WordPress', () => {
    // ver= est ajouté par tout fichier mis en file d'attente. Lire la version
    // d'un thème comme celle du CMS daterait le site de plusieurs années à
    // côté — sur le seul constat que l'interlocuteur peut vérifier lui-même.
    expect(datedComponents('<link href="/wp-content/themes/mon-theme/style.css?ver=4.5">'))
      .toEqual([]);
  });

  it('date une bibliothèque abandonnée sans numéro de version', () => {
    const found = datedComponents('<script src="/js/mootools-core.js"></script>');
    expect(found[0]).toMatchObject({ name: 'MooTools', year: 2010 });
  });

  it('retient la plus récente quand deux versions cohabitent', () => {
    // Un site qui charge deux jQuery est daté par la plus neuve : la plus
    // ancienne peut n'être qu'une compatibilité laissée en place.
    const found = datedComponents(
      '<script src="jquery-1.7.2.min.js"></script><script src="jquery-3.6.0.min.js"></script>',
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ version: '3.6', year: 2021 });
  });
});

describe('ce qu’on refuse de dater', () => {
  it('ne devine pas une version absente de la table', () => {
    // Mieux vaut ne rien dire qu'avancer une date qu'on ne saurait pas
    // défendre si le commerçant la conteste.
    expect(datedComponents('<script src="/js/jquery-9.9.9.min.js"></script>')).toEqual([]);
  });

  it('ne date pas un site sans composant reconnaissable', () => {
    expect(technologyYear(datedComponents('<html><body>Bonjour</body></html>'))).toBeNull();
  });
});

describe('l’âge retenu pour le site', () => {
  it('est celui du composant le plus récent, jamais du plus ancien', () => {
    // Un site refait l'an dernier peut traîner une vieille bibliothèque pour
    // une raison légitime. L'accuser d'être obsolète serait faux, et le
    // freelance s'en apercevrait au téléphone.
    const found = datedComponents(
      '<script src="jquery-1.4.2.min.js"></script><link href="bootstrap-5.2.0.min.css">',
    );
    expect(technologyYear(found)).toBe(2022);
  });

  it('classe les composants du plus ancien au plus récent', () => {
    const found = datedComponents(
      '<link href="bootstrap-5.0.0.css"><script src="jquery-1.7.2.min.js"></script>',
    );
    expect(found.map((c) => c.year)).toEqual([2011, 2021]);
  });
});
