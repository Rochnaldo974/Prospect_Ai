import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../../packages/core/src/normalization/phone';
import { classifyEmail, isGenericEmail, isUsableBusinessEmail, normalizeEmail } from '../../packages/core/src/normalization/email';
import { normalizeContactUrl, socialNetworkOf } from '../../packages/core/src/normalization/contact-url';
import { dedupeContactCandidates, prepareContact } from '../../packages/core/src/contacts/ingest';
import { selectBestContacts } from '../../packages/core/src/contacts/resolver';
import { contactReadiness } from '../../packages/core/src/contacts/readiness';
import type { StoredContact } from '../../packages/core/src/contacts/types';

/**
 * Les contacts : ce qui rend un dossier prospectable.
 *
 * Un téléphone mal normalisé, c'est un appel dans le vide ; une adresse
 * gmail prise pour la boîte de l'entreprise, c'est un e-mail à une personne
 * qui n'a rien demandé. Ces tests fixent la frontière, et vérifient que le
 * resolver choisit sans jamais rien appeler à l'extérieur.
 */

describe('téléphones', () => {
  it('ramène les formats français courants en E.164', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('0033612345678')).toBe('+33612345678');
    expect(normalizePhone('01.23.45.67.89')).toBe('+33123456789');
  });

  it('rejette ce qui n’est pas un numéro', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('00 00 00 00 00')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('+1 555 0100')).toBeNull();
  });
});

describe('e-mails', () => {
  it('normalise majuscules et espaces', () => {
    expect(normalizeEmail('  Contact@Exemple.FR ')).toBe('contact@exemple.fr');
    expect(normalizeEmail('mailto:Info@exemple.fr')).toBe('info@exemple.fr');
  });

  it('rejette une adresse invalide', () => {
    expect(normalizeEmail('pas une adresse')).toBeNull();
    expect(classifyEmail('x@y').category).toBe('INVALID');
  });

  it('classe générique, rôle, personnel, grand public et noreply', () => {
    expect(classifyEmail('contact@boulangerie-martin.fr').category).toBe('GENERIC_BUSINESS');
    expect(classifyEmail('service-client@exemple.fr').category).toBe('GENERIC_BUSINESS');
    expect(classifyEmail('rh@exemple.fr').category).toBe('ROLE_BASED');
    expect(classifyEmail('jean.dupont@exemple.fr').category).toBe('PERSONAL_BUSINESS');
    expect(classifyEmail('lecomptoir@gmail.com').category).toBe('PERSONAL_FREE_PROVIDER');
    expect(classifyEmail('noreply@exemple.fr').category).toBe('NOREPLY');
    expect(classifyEmail('ne-pas-repondre@exemple.fr').category).toBe('NOREPLY');
  });

  it('ne laisse le produit écrire qu’aux boîtes génériques ou de rôle', () => {
    expect(isUsableBusinessEmail('contact@exemple.fr')).toBe(true);
    expect(isUsableBusinessEmail('compta@exemple.fr')).toBe(true);
    expect(isUsableBusinessEmail('jean.dupont@exemple.fr')).toBe(false);
    expect(isUsableBusinessEmail('contact@gmail.com')).toBe(true);
    expect(isUsableBusinessEmail('noreply@exemple.fr')).toBe(false);
    expect(isGenericEmail('noreply@exemple.fr')).toBe(false);
  });

  it('ordonne la qualité : générique > rôle > personnel pro > grand public > noreply', () => {
    const q = (e: string) => classifyEmail(e).quality;
    expect(q('contact@a.fr')).toBeGreaterThan(q('rh@a.fr'));
    expect(q('rh@a.fr')).toBeGreaterThan(q('jean@a.fr'));
    expect(q('jean@a.fr')).toBeGreaterThan(q('jean@gmail.com'));
    expect(q('noreply@a.fr')).toBe(0);
  });
});

describe('URL de contact', () => {
  it('normalise hôte, www, ancre et paramètres de suivi', () => {
    expect(normalizeContactUrl('WWW.Exemple.fr/contact?utm_source=x#haut')).toBe('https://exemple.fr/contact');
    expect(normalizeContactUrl('https://exemple.fr/')).toBe('https://exemple.fr');
    expect(normalizeContactUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeContactUrl('pas une url')).toBeNull();
  });

  it('reconnaît les réseaux', () => {
    expect(socialNetworkOf('https://www.instagram.com/boulangerie')).toBe('instagram');
    expect(socialNetworkOf('https://linkedin.com/company/x')).toBe('linkedin');
    expect(socialNetworkOf('https://exemple.fr')).toBeNull();
  });
});

describe('ingestion des contacts', () => {
  it('prépare un candidat avec sa classification', () => {
    const phone = prepareContact({ type: 'phone', value: '06 12 34 56 78', source: 'osm' });
    expect(phone?.normalizedValue).toBe('+33612345678');
    expect(phone?.confidence).toBe(0.85);

    const email = prepareContact({ type: 'email', value: 'Jean.Dupont@exemple.fr', source: 'website' });
    expect(email?.isPersonal).toBe(true);
    expect(email?.metadata['category']).toBe('PERSONAL_BUSINESS');

    expect(prepareContact({ type: 'email', value: 'noreply@exemple.fr', source: 'website' })).toBeNull();
    expect(prepareContact({ type: 'phone', value: 'abc', source: 'osm' })).toBeNull();
  });

  it('dédoublonne le même téléphone vu sur OSM et sur le site : une ligne, la source la plus sûre', () => {
    const prepared = dedupeContactCandidates([
      { type: 'phone', value: '+33 6 12 34 56 78', source: 'website' },
      { type: 'phone', value: '06.12.34.56.78', source: 'osm' },
      { type: 'phone', value: '0612345678', source: 'legal_page' },
    ]);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.normalizedValue).toBe('+33612345678');
    expect(prepared[0]?.source).toBe('legal_page');
    expect(prepared[0]?.metadata['also_seen_in']).toEqual(expect.arrayContaining(['website', 'osm']));
  });

  it('une page LinkedIn de personne est nominative, une page d’entreprise ne l’est pas', () => {
    expect(prepareContact({ type: 'linkedin', value: 'https://linkedin.com/in/jean-dupont', source: 'website' })?.isPersonal).toBe(true);
    expect(prepareContact({ type: 'linkedin', value: 'https://linkedin.com/company/exemple', source: 'website' })?.isPersonal).toBe(false);
  });
});

const stored = (over: Partial<StoredContact>): StoredContact => ({
  id: 1, companyId: 'c1', type: 'phone', value: '', normalizedValue: '', source: 'osm', sourceUrl: null,
  isGeneric: true, isPersonal: false, confidence: 0.85, prospectingAllowed: true,
  firstSeenAt: '2026-09-17T00:00:00Z', lastSeenAt: '2026-09-17T00:00:00Z', ...over,
});

describe('ContactResolver V1', () => {
  it('choisit le meilleur téléphone et une adresse générique avant une adresse de rôle', () => {
    const r = selectBestContacts([
      stored({ id: 1, type: 'phone', normalizedValue: '+33612345678', source: 'website', confidence: 0.8 }),
      stored({ id: 2, type: 'phone', normalizedValue: '+33987654321', source: 'legal_page', confidence: 0.92 }),
      stored({ id: 3, type: 'email', normalizedValue: 'rh@exemple.fr', source: 'website' }),
      stored({ id: 4, type: 'email', normalizedValue: 'contact@exemple.fr', source: 'website' }),
      stored({ id: 5, type: 'contact_form', normalizedValue: 'https://exemple.fr/contact', source: 'contact_page' }),
    ]);
    expect(r.bestPhone).toBe('+33987654321');
    expect(r.bestEmail).toBe('contact@exemple.fr');
    expect(r.contactForm).toBe('https://exemple.fr/contact');
    expect(r.contactabilityScore).toBe(95);
    expect(r.readiness).toEqual({ phoneReady: true, outreachReady: true, phoneAndEmailReady: true, contactable: true });
  });

  it('ne retient jamais une adresse nominative ni grand public comme meilleur e-mail', () => {
    const r = selectBestContacts([
      stored({ id: 1, type: 'email', normalizedValue: 'jean.dupont@exemple.fr', isGeneric: false, isPersonal: true }),
      stored({ id: 2, type: 'email', normalizedValue: 'lecomptoir@gmail.com', isGeneric: false, isPersonal: true }),
    ]);
    expect(r.bestEmail).toBeNull();
    expect(r.readiness.outreachReady).toBe(false);
    // Une adresse personnelle existe : l'entreprise n'est pas à zéro, mais on n'écrit pas.
    expect(r.contactabilityScore).toBe(10);
  });

  it('ignore un contact dont la prospection est interdite', () => {
    const r = selectBestContacts([
      stored({ id: 1, type: 'phone', normalizedValue: '+33612345678', prospectingAllowed: false }),
    ]);
    expect(r.bestPhone).toBeNull();
    expect(r.readiness.contactable).toBe(false);
  });

  it('est une fonction pure : un contact déjà connu ne déclenche aucun appel', () => {
    // Le resolver V1 n'a pas d'accès réseau : sa signature ne prend que des lignes.
    expect(selectBestContacts.length).toBe(1);
    expect(selectBestContacts([]).contactabilityScore).toBe(0);
  });
});

describe('PHONE_READY / OUTREACH_READY', () => {
  it('sépare appeler et écrire', () => {
    expect(contactReadiness({ phone: '+33612345678', bestEmail: null, contactFormUrl: null }))
      .toEqual({ phoneReady: true, outreachReady: false, phoneAndEmailReady: false, contactable: true });
    expect(contactReadiness({ phone: null, bestEmail: 'contact@a.fr', contactFormUrl: null }))
      .toEqual({ phoneReady: false, outreachReady: true, phoneAndEmailReady: false, contactable: true });
    expect(contactReadiness({ phone: null, bestEmail: null, contactFormUrl: 'https://a.fr/contact' }).outreachReady).toBe(true);
    expect(contactReadiness({ phone: null, bestEmail: null, contactFormUrl: null }).contactable).toBe(false);
  });
});
