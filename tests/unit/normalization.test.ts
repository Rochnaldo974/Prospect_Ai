import { describe, expect, it } from 'vitest';
import {
  companyNameKey,
  departmentFromPostalCode,
  domainToUrl,
  extractSirenFromText,
  formatPhoneForDisplay,
  isGenericEmail,
  isMobile,
  isPlatformUrl,
  normalizeAddress,
  normalizeCity,
  normalizeCompanyName,
  normalizeDomain,
  normalizeDomainDetailed,
  normalizeEmailDetailed,
  normalizePhone,
  normalizePostalCode,
  normalizeSiren,
  normalizeSiret,
  sirenFromSiret,
} from '../../packages/core/src/normalization';

// SIREN réels et valides au sens de la clé de Luhn.
const VALID_SIREN = '552100554';   // Renault
const VALID_SIREN_2 = '380129866'; // Free
const VALID_SIRET = '55210055400013';

describe('identifiants', () => {
  describe('normalizeSiren', () => {
    it('accepte un SIREN valide, quel que soit son formatage', () => {
      expect(normalizeSiren(VALID_SIREN)).toBe(VALID_SIREN);
      expect(normalizeSiren('552 100 554')).toBe(VALID_SIREN);
      expect(normalizeSiren('552-100-554')).toBe(VALID_SIREN);
      expect(normalizeSiren(' 552.100.554 ')).toBe(VALID_SIREN);
    });

    it('rejette une clé de contrôle fausse', () => {
      expect(normalizeSiren('552100555')).toBeNull();
      expect(normalizeSiren('123456789')).toBeNull();
    });

    it('rejette un SIREN entièrement à zéro', () => {
      // Il passe la clé de Luhn (somme nulle) mais n'existe pas : c'est la
      // valeur de remplissage la plus courante des exports mal renseignés.
      expect(normalizeSiren('000000000')).toBeNull();
      expect(normalizeSiret('00000000000000')).toBeNull();
    });

    it('rejette les longueurs incorrectes', () => {
      expect(normalizeSiren('55210055')).toBeNull();
      expect(normalizeSiren('5521005540')).toBeNull();
      expect(normalizeSiren('')).toBeNull();
      expect(normalizeSiren(null)).toBeNull();
      expect(normalizeSiren(undefined)).toBeNull();
    });
  });

  describe('normalizeSiret', () => {
    it('accepte un SIRET valide', () => {
      expect(normalizeSiret(VALID_SIRET)).toBe(VALID_SIRET);
      expect(normalizeSiret('552 100 554 00013')).toBe(VALID_SIRET);
    });

    it('rejette un SIRET dont la clé est fausse', () => {
      expect(normalizeSiret('55210055400014')).toBeNull();
    });

    it('applique la règle particulière de La Poste', () => {
      // Les SIRET de La Poste ne suivent pas Luhn : somme des chiffres % 5 == 0.
      const laPoste = '35600000000010';
      const sum = [...laPoste].reduce((acc, c) => acc + Number(c), 0);
      expect(sum % 5).toBe(0);
      expect(normalizeSiret(laPoste)).toBe(laPoste);
    });

    it('rejette un SIRET dont le SIREN est invalide', () => {
      expect(normalizeSiret('12345678900017')).toBeNull();
    });
  });

  it('extrait le SIREN d’un SIRET', () => {
    expect(sirenFromSiret(VALID_SIRET)).toBe(VALID_SIREN);
    expect(sirenFromSiret('invalide')).toBeNull();
  });

  describe('extractSirenFromText', () => {
    it('trouve un SIREN dans des mentions légales', () => {
      const text = `Mentions légales — RENAULT SAS, société par actions simplifiée
        au capital de 533 941 113 €, immatriculée au RCS de Nanterre
        sous le numéro 552 100 554.`;
      expect(extractSirenFromText(text)).toContain(VALID_SIREN);
    });

    it('accepte les séparateurs usuels', () => {
      expect(extractSirenFromText('SIREN : 552.100.554')).toEqual([VALID_SIREN]);
      expect(extractSirenFromText('SIREN 552-100-554')).toEqual([VALID_SIREN]);
      expect(extractSirenFromText('siren552100554')).toEqual([]);
    });

    it('ignore les suites de 9 chiffres qui ne sont pas des SIREN', () => {
      expect(extractSirenFromText('Téléphone 012 345 678')).toEqual([]);
    });

    it('déduplique les occurrences multiples', () => {
      const text = `552 100 554 ... encore 552100554 ... et ${VALID_SIREN_2}`;
      const found = extractSirenFromText(text);
      expect(found).toHaveLength(2);
      expect(new Set(found).size).toBe(2);
    });
  });
});

describe('domaines', () => {
  it('ramène toutes les graphies à la même clé', () => {
    const expected = 'restaurantdupont.fr';
    for (const input of [
      'https://www.restaurantdupont.fr/',
      'http://restaurantdupont.fr',
      'www.restaurantdupont.fr',
      'RestaurantDupont.FR',
      'https://WWW.RestaurantDupont.fr/contact?utm_source=x#top',
      '  https://restaurantdupont.fr:443/menu  ',
    ]) {
      expect(normalizeDomain(input), input).toBe(expected);
    }
  });

  it('conserve les sous-domaines qui désignent un autre site', () => {
    expect(normalizeDomain('https://boutique.exemple.fr')).toBe('boutique.exemple.fr');
    expect(normalizeDomain('https://www.boutique.exemple.fr')).toBe('boutique.exemple.fr');
  });

  it('écarte les pages de plateformes', () => {
    expect(normalizeDomain('https://www.facebook.com/MaBoulangerie')).toBeNull();
    expect(normalizeDomainDetailed('https://instagram.com/x').rejectedReason).toBe('plateforme');
    expect(isPlatformUrl('https://www.pagesjaunes.fr/pros/12345')).toBe(true);
    expect(isPlatformUrl('https://exemple.fr')).toBe(false);
  });

  it('rejette les entrées malformées', () => {
    for (const input of ['', '   ', 'pas-un-domaine', 'http://', '.fr', 'exemple..fr', 'exemple.1']) {
      expect(normalizeDomain(input), input).toBeNull();
    }
    expect(normalizeDomain(null)).toBeNull();
  });

  it('rejette les domaines locaux', () => {
    expect(normalizeDomainDetailed('http://localhost:3000').rejectedReason).toBe('local');
    expect(normalizeDomainDetailed('http://api.test').rejectedReason).toBe('local');
    expect(normalizeDomainDetailed('http://serveur.local').rejectedReason).toBe('local');
  });

  it('retire les identifiants présents dans l’URL', () => {
    expect(normalizeDomain('https://user:pass@exemple.fr/page')).toBe('exemple.fr');
  });

  it('reconstruit une URL affichable', () => {
    expect(domainToUrl('exemple.fr')).toBe('https://exemple.fr');
    expect(domainToUrl(null)).toBeNull();
  });
});

describe('noms d’entreprise', () => {
  it('retire les formes juridiques', () => {
    expect(normalizeCompanyName('SARL Boulangerie DUPONT')).toBe('boulangerie dupont');
    expect(normalizeCompanyName('DUPONT SAS')).toBe('dupont');
    expect(normalizeCompanyName('Établissements Martin EURL')).toBe('martin');
  });

  it('normalise accents, ponctuation et esperluette', () => {
    expect(normalizeCompanyName('Café de l’Étoile')).toBe('cafe de l etoile');
    expect(normalizeCompanyName('DUPONT & FILS')).toBe('dupont et fils');
    expect(normalizeCompanyName('  Le   Fournil  ')).toBe('le fournil');
  });

  it('fait converger deux graphies du même commerce', () => {
    expect(normalizeCompanyName('SARL LE FOURNIL D’ANTAN')).toBe(
      normalizeCompanyName("Le Fournil d'Antan"),
    );
  });

  it('renvoie null quand il ne reste rien', () => {
    expect(normalizeCompanyName('SARL')).toBeNull();
    expect(normalizeCompanyName('...')).toBeNull();
    expect(normalizeCompanyName('')).toBeNull();
    expect(normalizeCompanyName(null)).toBeNull();
  });

  it('produit une clé compacte sans mots vides', () => {
    expect(companyNameKey('Le Fournil de la Gare')).toBe('fournilgare');
    expect(companyNameKey('SARL')).toBeNull();
  });

  it('ne réduit pas un nom entièrement composé de mots vides à rien', () => {
    expect(companyNameKey('Chez Le Le')).toBe('chezlele');
  });
});

describe('téléphones', () => {
  it('ramène les formats français en E.164', () => {
    for (const input of [
      '01 23 45 67 89',
      '01.23.45.67.89',
      '0123456789',
      '+33 1 23 45 67 89',
      '+33123456789',
      '0033123456789',
      '123456789',
    ]) {
      expect(normalizePhone(input), input).toBe('+33123456789');
    }
  });

  it('route les numéros d’outre-mer vers le bon indicatif pays', () => {
    // 0262 est un fixe de La Réunion : +262262…, surtout pas +33262…
    expect(normalizePhone('0262 12 34 56')).toBe('+262262123456');
    expect(normalizePhone('+262 262 12 34 56')).toBe('+262262123456');
    expect(normalizePhone('0692 12 34 56')).toBe('+262692123456');   // mobile Réunion
    expect(normalizePhone('0590 12 34 56')).toBe('+590590123456');   // Guadeloupe
    expect(normalizePhone('0594 12 34 56')).toBe('+594594123456');   // Guyane
    expect(normalizePhone('0596 12 34 56')).toBe('+596596123456');   // Martinique
  });

  it('accepte les territoires du Pacifique à 6 chiffres', () => {
    expect(normalizePhone('+687 12 34 56')).toBe('+687123456');
    expect(normalizePhone('+689 12 34 56')).toBe('+689123456');
    expect(normalizePhone('+687 12 34 56 78')).toBeNull();
  });

  it('rejette les numéros invalides', () => {
    for (const input of ['', '12', '012345678', '01234567890', '+44 20 7123 4567', '0023456789']) {
      expect(normalizePhone(input), input).toBeNull();
    }
    expect(normalizePhone(null)).toBeNull();
  });

  it('distingue les mobiles, outre-mer compris', () => {
    expect(isMobile(normalizePhone('06 12 34 56 78'))).toBe(true);
    expect(isMobile(normalizePhone('07 12 34 56 78'))).toBe(true);
    expect(isMobile(normalizePhone('0692 12 34 56'))).toBe(true);
    expect(isMobile(normalizePhone('01 23 45 67 89'))).toBe(false);
    expect(isMobile(normalizePhone('0262 12 34 56'))).toBe(false);
    expect(isMobile(null)).toBe(false);
  });

  it('reformate pour l’affichage', () => {
    expect(formatPhoneForDisplay('+33123456789')).toBe('01 23 45 67 89');
    expect(formatPhoneForDisplay('+262262123456')).toBe('02 62 12 34 56');
    expect(formatPhoneForDisplay(null)).toBeNull();
  });
});

describe('adresses', () => {
  it('développe les abréviations de voie', () => {
    expect(normalizeAddress('12 av. du Général Leclerc')).toBe('12 avenue du general leclerc');
    expect(normalizeAddress('5 BD Voltaire')).toBe('5 boulevard voltaire');
    expect(normalizeAddress('3 imp. des Lilas')).toBe('3 impasse des lilas');
  });

  it('fait converger deux écritures de la même adresse', () => {
    expect(normalizeAddress('12, Avenue du Général-Leclerc')).toBe(
      normalizeAddress('12 av du General Leclerc'),
    );
  });

  it('normalise les codes postaux', () => {
    expect(normalizePostalCode('75 011')).toBe('75011');
    expect(normalizePostalCode('97400')).toBe('97400');
    expect(normalizePostalCode('7501')).toBeNull();
    expect(normalizePostalCode('00123')).toBeNull();
    expect(normalizePostalCode(null)).toBeNull();
  });

  it('déduit le département, Corse et outre-mer compris', () => {
    expect(departmentFromPostalCode('75011')).toBe('75');
    expect(departmentFromPostalCode('97400')).toBe('974');
    expect(departmentFromPostalCode('20000')).toBe('2A');
    expect(departmentFromPostalCode('20200')).toBe('2B');
    expect(departmentFromPostalCode('invalide')).toBeNull();
  });

  it('normalise les villes', () => {
    expect(normalizeCity('PARIS 11')).toBe('paris');
    expect(normalizeCity('Saint-Étienne')).toBe('saint etienne');
    expect(normalizeCity('LYON CEDEX 03')).toBe('lyon');
    expect(normalizeCity('')).toBeNull();
  });
});

describe('e-mails', () => {
  it('normalise et classe les adresses', () => {
    expect(normalizeEmailDetailed('  Contact@Exemple.FR ')).toEqual({
      email: 'contact@exemple.fr',
      kind: 'generic',
    });
    expect(normalizeEmailDetailed('prenom.nom@exemple.fr')).toEqual({
      email: 'prenom.nom@exemple.fr',
      kind: 'personal',
    });
  });

  it('retire le préfixe mailto', () => {
    expect(normalizeEmailDetailed('mailto:info@exemple.fr').email).toBe('info@exemple.fr');
  });

  it('rejette les adresses malformées', () => {
    for (const input of ['', 'pas-un-email', 'a@b', '@exemple.fr', 'a@@b.fr', 'a b@exemple.fr']) {
      expect(normalizeEmailDetailed(input).email, input).toBeNull();
    }
  });

  it('distingue boîte de fonction et adresse nominative', () => {
    expect(isGenericEmail('contact@exemple.fr')).toBe(true);
    expect(isGenericEmail('service-client@exemple.fr')).toBe(true);
    expect(isGenericEmail('jean.dupont@exemple.fr')).toBe(false);
  });
});
