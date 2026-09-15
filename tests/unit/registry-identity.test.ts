import { describe, expect, it } from 'vitest';
import { pickRegistryMatch } from '../../packages/core/src/sources/sirene/identity';
import type { ApiResult } from '../../packages/core/src/sources/sirene/enricher';

/**
 * Le rapprochement par le nom ne doit jamais deviner : il rattache quand le
 * nom et le code postal coïncident sur un seul SIREN, et s'abstient sinon.
 */
// Des SIREN réels : la normalisation vérifie la clé de Luhn, un numéro inventé
// serait écarté avant même la comparaison des noms.
const unit = (siren: string, name: string, postal: string, enseigne?: string): ApiResult => ({
  siren,
  nom_complet: name,
  nom_raison_sociale: name,
  date_creation: '2024-03-01',
  siege: { siret: `${siren}00011`, code_postal: postal, liste_enseignes: enseigne ? [enseigne] : null },
  matching_etablissements: [
    { siret: `${siren}00011`, code_postal: postal, liste_enseignes: enseigne ? [enseigne] : null },
  ],
});

describe('pickRegistryMatch', () => {
  it('rattache un nom identique dans le bon code postal', () => {
    const match = pickRegistryMatch(
      { legal_name: "Auberge de l'Île", commercial_name: null, postal_code: '69009' },
      [unit('403599418', 'AUBERGE DE L ILE', '69009')],
    );
    expect(match?.siren).toBe('403599418');
    expect(match?.establishment?.siret).toBe('40359941800011');
  });

  it('ignore la forme juridique et la ponctuation', () => {
    const match = pickRegistryMatch(
      { legal_name: 'Boulangerie Dupont & Fils', commercial_name: null, postal_code: '33000' },
      [unit('481467090', 'SARL BOULANGERIE DUPONT ET FILS', '33000')],
    );
    expect(match?.siren).toBe('481467090');
  });

  it('reconnaît le nom du terrain dans l’enseigne de l’établissement', () => {
    const match = pickRegistryMatch(
      { legal_name: 'Le Fournil de Marie', commercial_name: null, postal_code: '44000' },
      [unit('980208458', 'SAS MARIE HOLDING', '44000', 'LE FOURNIL DE MARIE')],
    );
    expect(match?.siren).toBe('980208458');
  });

  it('refuse quand le code postal ne correspond pas', () => {
    const match = pickRegistryMatch(
      { legal_name: 'Garage Martin', commercial_name: null, postal_code: '31000' },
      [unit('108841818', 'GARAGE MARTIN', '31100')],
    );
    expect(match).toBeNull();
  });

  it('refuse quand deux SIREN sont plausibles', () => {
    const match = pickRegistryMatch(
      { legal_name: 'Pizzeria Roma', commercial_name: null, postal_code: '59000' },
      [unit('403599418', 'PIZZERIA ROMA', '59000'), unit('481467090', 'SARL PIZZERIA ROMA', '59000')],
    );
    expect(match).toBeNull();
  });

  it('refuse un nom qui ne fait que ressembler', () => {
    const match = pickRegistryMatch(
      { legal_name: 'Coiffure Élise', commercial_name: null, postal_code: '35000' },
      [unit('980208458', 'COIFFURE ELISE ET LOUISE', '35000')],
    );
    expect(match).toBeNull();
  });

  it('accepte le nom commercial connu comme second nom', () => {
    const match = pickRegistryMatch(
      { legal_name: 'Restaurant Chez Paul', commercial_name: 'Chez Paul', postal_code: '67000' },
      [unit('108841818', 'CHEZ PAUL', '67000')],
    );
    expect(match?.siren).toBe('108841818');
  });
});
