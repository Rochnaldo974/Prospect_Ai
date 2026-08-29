import { describe, expect, it } from 'vitest';
import { normalizeTender, WEB_CPV_CODES } from '../../packages/core/src/sources/boamp/adapter';

/**
 * BOAMP — appels d'offres.
 *
 * La source la plus précieuse du produit, et celle où un faux positif coûte le
 * plus cher : un freelance qui monte un dossier pour découvrir qu'il s'agit
 * d'une chaufferie ne revient pas. Ces tests protègent la précision, jamais le
 * volume.
 */

const record = (over: Record<string, unknown> = {}) => ({
  idweb: '26-82285',
  objet: 'Refonte du site internet de la commune',
  nomacheteur: 'COMMUNE DE SAINT-EXEMPLE',
  dateparution: '2026-08-18',
  datelimitereponse: '2026-09-17T12:00:00+00:00',
  type_marche: ['SERVICES'],
  url_avis: 'https://www.boamp.fr/pages/avis/?q=idweb:26-82285',
  donnees: {
    FNSimple: {
      organisme: { nomOfficiel: 'COMMUNE DE SAINT-EXEMPLE', ville: 'Saint-Exemple', cp: '49000',
        codeIdentificationNational: '21490001200015' },
      initial: {
        communication: { urlProfilAch: 'https://marches.example.fr' },
        natureMarche: { codeCPV: { objetPrincipal: { classPrincipale: '72413000' } } },
      },
    },
  },
  ...over,
});

describe('ce qu’un avis doit être pour être retenu', () => {
  it('retient un marché de services portant sur un site', () => {
    const tender = normalizeTender(record());
    expect(tender?.siret).toBe('21490001200015');
    expect(tender?.cpvLabel).toBe(WEB_CPV_CODES['72413000']);
  });

  it('écarte les marchés de travaux', () => {
    // « Refonte » désigne une chaufferie ou des portes d'atelier aussi souvent
    // qu'un site : le type de marché est ce qui les sépare de façon fiable.
    expect(normalizeTender(record({
      type_marche: ['TRAVAUX'],
      objet: 'Refonte de la production de froid du bâtiment principal',
    }))).toBeNull();
  });

  it('écarte un marché de services sans rapport avec le web', () => {
    expect(normalizeTender(record({
      objet: 'Fourniture de vêtements de travail',
      donnees: { FNSimple: { organisme: {}, initial: {} } },
    }))).toBeNull();
  });

  it('retient sur l’intitulé quand le code CPV manque', () => {
    // Tous les acheteurs ne renseignent pas le CPV : l'exiger perdrait la
    // moitié des avis.
    const tender = normalizeTender(record({
      donnees: { FNSimple: { organisme: { codeIdentificationNational: '21490001200015' }, initial: {} } },
    }));
    expect(tender).not.toBeNull();
    expect(tender?.cpv).toBeNull();
  });
});

describe('identité de l’acheteur', () => {
  it('lit le SIRET quel que soit le schéma de publication', () => {
    // Le BOAMP publie sous deux schémas sans arborescence commune.
    const tender = normalizeTender(record({
      donnees: {
        'efac:Organization': {
          'cac:PartyIdentification': { 'cbc:ID': '13002271800014' },
        },
      },
    }));
    expect(tender?.siret).toBe('13002271800014');
  });

  it('ne tranche pas entre plusieurs établissements', () => {
    // Groupement de commandes, mandataire : on ne sait pas lequel achète, donc
    // on ne crée rien. Même discipline que pour les mentions légales d'un site.
    const tender = normalizeTender(record({
      donnees: {
        'efac:Organization': [
          { 'cac:PartyIdentification': { 'cbc:ID': '13002271800014' } },
          { 'cac:PartyIdentification': { 'cbc:ID': '21490001200015' } },
        ],
      },
    }));
    expect(tender?.siret).toBeNull();
  });

  it('ne reprend aucune donnée nominative', () => {
    // La V1 n'en collecte aucune : c'est ce qui la maintient en régime allégé.
    const tender = normalizeTender(record({
      donnees: {
        FNSimple: {
          organisme: { codeIdentificationNational: '21490001200015' },
          initial: { communication: {
            nomContact: 'Camille Durand',
            adresseMailContact: 'camille.durand@example.fr',
            telContact: '0241000000',
          } },
        },
      },
    }));
    expect(JSON.stringify(tender)).not.toMatch(/Camille|camille\.durand|0241000000/);
  });
});
