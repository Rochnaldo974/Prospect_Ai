import { describe, expect, it } from 'vitest';
import { parseAfnicHeader, parseAfnicLine } from '../../packages/core/src/sources';

/**
 * Open data AFNIC.
 *
 * Le fichier fait 10,1 millions de lignes : le lecteur doit être tolérant aux
 * lignes fautives et rapide, jamais l'inverse.
 */
const HEADER =
  '"Nom de domaine";"Pays BE";"Departement BE";"Ville BE";"Nom BE";"Sous domaine";'
  + '"Type du titulaire";"Pays titulaire";"Departement titulaire";"Domaine IDN";'
  + '"Date de création";"Date de retrait du WHOIS"';

const columns = parseAfnicHeader(HEADER);

describe('lecture du fichier AFNIC', () => {
  it('reconnaît les colonnes de l’en-tête', () => {
    expect(columns['Nom de domaine']).toBe(0);
    expect(columns['Date de création']).toBe(10);
    expect(columns['Date de retrait du WHOIS']).toBe(11);
  });

  it('lit une ligne de domaine actif', () => {
    const row = parseAfnicLine(
      'boulangerie-moreau.fr;FR;49;ANGERS;OVH;fr;;;;0;15-07-2026;',
      columns,
    );
    expect(row).toMatchObject({
      domain: 'boulangerie-moreau.fr',
      withdrawnAt: null,
      registrarDepartment: '49',
    });
    expect(row?.createdAt.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('lit la date de retrait d’un domaine abandonné', () => {
    const row = parseAfnicLine(
      'ancien-site.fr;FR;75;PARIS;GANDI;fr;;;;0;30-06-2023;27-08-2024',
      columns,
    );
    expect(row?.withdrawnAt?.toISOString().slice(0, 10)).toBe('2024-08-27');
  });

  it('convertit les domaines accentués en punycode', () => {
    // Près de 1 % des domaines .fr en portent, et ce sont de vrais commerces.
    const row = parseAfnicLine('café-du-port.fr;FR;44;NANTES;OVH;fr;;;;1;01-08-2026;', columns);
    expect(row?.domain).toBe('xn--caf-du-port-dbb.fr');
  });

  it('écarte une ligne sans date exploitable', () => {
    expect(parseAfnicLine('exemple.fr;FR;75;PARIS;OVH;fr;;;;0;;', columns)).toBeNull();
    expect(parseAfnicLine('exemple.fr;FR;75;PARIS;OVH;fr;;;;0;2026-07-15;', columns)).toBeNull();
  });

  it('écarte une ligne sans domaine exploitable', () => {
    expect(parseAfnicLine(';FR;75;PARIS;OVH;fr;;;;0;15-07-2026;', columns)).toBeNull();
    expect(parseAfnicLine('pas-un-domaine;FR;75;PARIS;OVH;fr;;;;0;15-07-2026;', columns)).toBeNull();
  });

  it('ne casse pas sur une ligne tronquée', () => {
    expect(parseAfnicLine('exemple.fr;FR', columns)).toBeNull();
    expect(parseAfnicLine('', columns)).toBeNull();
  });
});
