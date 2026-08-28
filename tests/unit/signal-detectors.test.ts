import { describe, expect, it } from 'vitest';
import {
  ALL_DETECTORS,
  activeBusinessDetector,
  bodaccEventDetector,
  brokenSiteDetector,
  datedPlatformDetector,
  noContactFormDetector,
  noEcommerceDetector,
  noSslDetector,
  noWebsiteDetector,
  placeholderSiteDetector,
  recentCompanyDetector,
  sharedDomainDetector,
  slowSiteDetector,
  staleContentDetector,
  weakIdentityDetector,
  websiteChangedDetector,
  websiteDownDetector,
} from '../../packages/core/src/signals/detectors';
import type {
  CompanyContext,
  ContextEvent,
  DomainSnapshot,
} from '../../packages/core/src/signals/types';
import type { Company } from '../../packages/core/src/domain/types';

/**
 * Détecteurs de signaux.
 *
 * Le partage entre DÉCLENCHEUR et MODIFICATEUR est ce qui sépare une
 * prospection ciblée d'une prospection au hasard. Un état — site lent, site
 * moche — est vrai en permanence pour une large part du parc : il ne peut pas
 * justifier un appel. Seul un fait daté le peut.
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const company = (over: Partial<Company> = {}): Company => ({
  id: 'c1',
  siren: '552100554',
  siret: '55210055400013',
  legal_name: 'BOULANGERIE MOREAU',
  commercial_name: null,
  domain: null,
  website_url: null,
  website_confidence: null,
  website_resolution_attempts: 0,
  website_last_resolved_at: null,
  phone: '+33241222479',
  contact_form_url: null,
  has_contact: true,
  address: null,
  postal_code: '49000',
  city: 'Angers',
  region: null,
  country: 'FR',
  lat: null,
  lon: null,
  industry_code: '10.71C',
  industry_label: 'Boulangerie',
  segment: 'local_commerce',
  employee_min: null,
  employee_max: null,
  creation_date: null,
  company_status: 'active',
  identity_confidence: 0.95,
  data_quality_score: 60,
  prospecting_allowed: true,
  suppression_global: false,
  suppression_reason: null,
  last_seen_at: daysAgo(2),
  last_scanned_at: null,
  next_scan_at: null,
  scan_priority: 50,
  active_signal_count: 0,
  trigger_signal_count: 0,
  opportunity_count: 0,
  best_opportunity_score: null,
  best_opportunity_type: null,
  has_live_assignment: false,
  cooldown_until: null,
  name_key: 'boulangerie moreau',
  created_at: daysAgo(10),
  updated_at: daysAgo(1),
  ...over,
});

const domain = (over: Partial<DomainSnapshot> = {}): DomainSnapshot => ({
  domain: 'moreau.fr',
  status: 'reachable',
  http_status: 200,
  cms: null,
  framework: null,
  technologies: [],
  has_ssl: true,
  has_viewport_meta: true,
  has_media_queries: true,
  ttfb_ms: 300,
  html_bytes: 50_000,
  ecommerce_detected: false,
  booking_detected: false,
  contact_form_detected: true,
  copyright_year: new Date().getFullYear(),
  sirens_found: [],
  last_checked_at: daysAgo(1),
  first_seen_at: daysAgo(30),
  ...over,
});

const context = (over: Partial<CompanyContext> = {}): CompanyContext => ({
  company: company(),
  domain: null,
  domainCompanyCount: 0,
  events: [],
  ...over,
});

const event = (over: Partial<ContextEvent> = {}): ContextEvent => ({
  id: 'e1',
  event_type: 'bodacc_cession',
  importance: 90,
  confidence: 0.99,
  occurred_at: daysAgo(10),
  detected_at: daysAgo(9),
  ...over,
});

describe('discipline déclencheur / modificateur', () => {
  it('tout déclencheur porte un événement daté', () => {
    // Sans date, le moteur ne peut pas répondre « pourquoi maintenant ».
    const withEverything = context({
      company: company({ creation_date: daysAgo(30) }),
      domain: domain({ status: 'broken' }),
      domainCompanyCount: 1,
      events: [
        event(),
        event({ id: 'e2', event_type: 'website_went_down' }),
        event({ id: 'e3', event_type: 'company_created', occurred_at: daysAgo(30) }),
      ],
    });

    for (const detector of ALL_DETECTORS) {
      for (const signal of detector.detect(withEverything)) {
        if (signal.kind === 'trigger') {
          expect(signal.triggerEventId, `${detector.id} / ${signal.signalType}`).toBeTruthy();
        }
      }
    }
  });

  it('aucun modificateur ne se présente en déclencheur', () => {
    const ctx = context({ domain: domain({ status: 'placeholder' }), domainCompanyCount: 1 });
    for (const detector of ALL_DETECTORS) {
      for (const signal of detector.detect(ctx)) {
        if (signal.signalType.startsWith('website_placeholder')) {
          expect(signal.kind).toBe('modifier');
        }
      }
    }
  });

  it('produit des empreintes stables entre deux passages', () => {
    const ctx = context({
      company: company({ creation_date: daysAgo(30) }),
      domain: domain({ cms: 'Wix' }),
      domainCompanyCount: 1,
      events: [event(), event({ id: 'created', event_type: 'company_created', occurred_at: daysAgo(30) })],
    });

    const first = ALL_DETECTORS.flatMap((d) => d.detect(ctx)).map((s) => s.fingerprint);
    const second = ALL_DETECTORS.flatMap((d) => d.detect(ctx)).map((s) => s.fingerprint);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe('déclencheurs', () => {
  describe('entreprise récemment créée', () => {
    const created = (days: number) => context({
      company: company({ creation_date: daysAgo(days) }),
      events: [event({ id: 'created', event_type: 'company_created', occurred_at: daysAgo(days) })],
    });

    it('exige que le fait existe comme événement daté', () => {
      // Sans événement, le détecteur ne peut pas dater son déclencheur : la
      // chaîne fait → événement → signal n'est pas court-circuitable.
      expect(recentCompanyDetector.detect(
        context({ company: company({ creation_date: daysAgo(30) }) }),
      )).toHaveLength(0);
    });

    it('se déclenche dans la fenêtre utile', () => {
      const signals = recentCompanyDetector.detect(created(30));
      expect(signals).toHaveLength(1);
      expect(signals[0]!.kind).toBe('trigger');
      expect(signals[0]!.category).toBe('timing');
    });

    it('ignore les sept premiers jours', () => {
      // L'immatriculation précède souvent l'ouverture.
      expect(recentCompanyDetector.detect(created(3))).toHaveLength(0);
    });

    it('s’éteint passé quatre mois', () => {
      expect(recentCompanyDetector.detect(created(200))).toHaveLength(0);
    });

    it('décroît avec l’âge', () => {
      expect(recentCompanyDetector.detect(created(15))[0]!.strength)
        .toBeGreaterThan(recentCompanyDetector.detect(created(100))[0]!.strength);
    });

    it('gagne en confiance quand le BODACC confirme', () => {
      const sans = recentCompanyDetector.detect(created(30));
      const avec = recentCompanyDetector.detect(context({
        company: company({ creation_date: daysAgo(30) }),
        events: [event({ event_type: 'bodacc_creation', occurred_at: daysAgo(30) })],
      }));
      expect(avec[0]!.confidence).toBeGreaterThan(sans[0]!.confidence);
    });
  });

  describe('annonces légales', () => {
    it('classe la cession au-dessus de la modification', () => {
      const cession = bodaccEventDetector.detect(context({ events: [event({ event_type: 'bodacc_cession' })] }));
      const modif = bodaccEventDetector.detect(context({
        events: [event({ id: 'e9', event_type: 'bodacc_modification' })],
      }));
      expect(cession[0]!.strength).toBeGreaterThan(modif[0]!.strength);
    });

    it('ne produit aucun signal pour une procédure collective', () => {
      // L'entreprise est retirée de la prospection en amont : on ne démarche
      // pas une entreprise en redressement.
      const signals = bodaccEventDetector.detect(context({
        events: [event({ event_type: 'bodacc_procedure_collective' })],
      }));
      expect(signals).toHaveLength(0);
    });

    it('ignore un événement trop ancien', () => {
      expect(bodaccEventDetector.detect(context({
        events: [event({ occurred_at: daysAgo(300) })],
      }))).toHaveLength(0);
    });

    it('ne retient qu’un signal par type d’événement', () => {
      const signals = bodaccEventDetector.detect(context({
        events: [
          event({ id: 'a', occurred_at: daysAgo(5) }),
          event({ id: 'b', occurred_at: daysAgo(20) }),
        ],
      }));
      expect(signals).toHaveLength(1);
    });
  });

  describe('site tombé', () => {
    it('exige un événement daté', () => {
      // Sans date, on ne sait pas quand : c'est un état, pas un déclencheur.
      const sansEvenement = websiteDownDetector.detect(
        context({ company: company({ domain: 'moreau.fr' }), domain: domain({ status: 'broken' }) }),
      );
      expect(sansEvenement).toHaveLength(0);

      const avecEvenement = websiteDownDetector.detect(context({
        company: company({ domain: 'moreau.fr' }),
        domain: domain({ status: 'broken' }),
        events: [event({ event_type: 'website_went_down', occurred_at: daysAgo(3) })],
      }));
      expect(avecEvenement).toHaveLength(1);
      expect(avecEvenement[0]!.strength).toBeGreaterThan(0.9);
    });
  });

  it('signale une modification récente du site', () => {
    const signals = websiteChangedDetector.detect(context({
      domain: domain(),
      events: [event({ event_type: 'website_changed', occurred_at: daysAgo(5) })],
    }));
    expect(signals).toHaveLength(1);
    expect(signals[0]!.kind).toBe('trigger');
  });
});

describe('modificateurs', () => {
  describe('absence de site', () => {
    it('exige une preuve positive d’absence', () => {
      // Ne pas avoir trouvé n'est pas constater qu'il n'y en a pas.
      expect(noWebsiteDetector.detect(context({
        company: company({ domain: null, website_resolution_attempts: 0 }),
      }))).toHaveLength(0);

      expect(noWebsiteDetector.detect(context({
        company: company({ domain: null, website_resolution_attempts: 2 }),
      }))).toHaveLength(1);
    });

    it('ne se prononce pas sur une entreprise injoignable', () => {
      expect(noWebsiteDetector.detect(context({
        company: company({ domain: null, phone: null, has_contact: false, website_resolution_attempts: 3 }),
      }))).toHaveLength(0);
    });

    it('gagne en confiance à chaque recherche infructueuse', () => {
      const une = noWebsiteDetector.detect(context({ company: company({ website_resolution_attempts: 1 }) }));
      const trois = noWebsiteDetector.detect(context({ company: company({ website_resolution_attempts: 3 }) }));
      expect(trois[0]!.confidence).toBeGreaterThan(une[0]!.confidence);
    });
  });

  it('repère une page d’attente', () => {
    expect(placeholderSiteDetector.detect(context({ domain: domain({ status: 'placeholder' }) }))).toHaveLength(1);
    expect(placeholderSiteDetector.detect(context({ domain: domain() }))).toHaveLength(0);
  });

  it('repère un site en erreur', () => {
    const signals = brokenSiteDetector.detect(context({ domain: domain({ status: 'broken', http_status: 503 }) }));
    expect(signals).toHaveLength(1);
    expect(signals[0]!.confidence).toBe(0.95);
  });

  it('repère les solutions de bricolage', () => {
    for (const cms of ['Wix', 'Jimdo', 'IONOS MyWebsite', 'e-monsite']) {
      expect(datedPlatformDetector.detect(context({ domain: domain({ cms }) })), cms).toHaveLength(1);
    }
    // WordPress est massivement utilisé, y compris pour de bons sites.
    expect(datedPlatformDetector.detect(context({ domain: domain({ cms: 'WordPress' }) }))).toHaveLength(0);
  });

  it('mesure l’ancienneté du contenu sans en faire une preuve', () => {
    const year = new Date().getFullYear();
    const recent = staleContentDetector.detect(context({ domain: domain({ copyright_year: year }) }));
    const ancien = staleContentDetector.detect(context({ domain: domain({ copyright_year: year - 5 }) }));

    expect(recent).toHaveLength(0);
    expect(ancien).toHaveLength(1);
    // Un pied de page figé n'est qu'un indice : la confiance reste basse.
    expect(ancien[0]!.confidence).toBeLessThan(0.7);
  });

  it('gradue la lenteur', () => {
    expect(slowSiteDetector.detect(context({ domain: domain({ ttfb_ms: 300 }) }))).toHaveLength(0);
    const lent = slowSiteDetector.detect(context({ domain: domain({ ttfb_ms: 2500 }) }));
    const tresLent = slowSiteDetector.detect(context({ domain: domain({ ttfb_ms: 4000 }) }));
    expect(tresLent[0]!.strength).toBeGreaterThan(lent[0]!.strength);
  });

  it('signale l’absence de HTTPS sur un site joignable', () => {
    expect(noSslDetector.detect(context({ domain: domain({ has_ssl: false }) }))).toHaveLength(1);
    // Sur un site en erreur, l'information n'a pas de sens.
    expect(noSslDetector.detect(context({ domain: domain({ has_ssl: false, status: 'broken' }) }))).toHaveLength(0);
  });

  it('propose l’e-commerce au commerce de détail seulement', () => {
    expect(noEcommerceDetector.detect(context({
      company: company({ industry_code: '47.11B' }), domain: domain(),
    }))).toHaveLength(1);
    expect(noEcommerceDetector.detect(context({
      company: company({ industry_code: '69.10Z' }), domain: domain(),
    }))).toHaveLength(0);
    expect(noEcommerceDetector.detect(context({
      company: company({ industry_code: '47.11B' }), domain: domain({ ecommerce_detected: true }),
    }))).toHaveLength(0);
  });

  it('signale un site sans moyen de contact', () => {
    expect(noContactFormDetector.detect(context({
      domain: domain({ contact_form_detected: false }),
    }))).toHaveLength(1);
  });

  describe('risques', () => {
    it('signale une identité mal établie', () => {
      expect(weakIdentityDetector.detect(context({
        company: company({ identity_confidence: 0.95 }),
      }))).toHaveLength(0);

      const faible = weakIdentityDetector.detect(context({
        company: company({ identity_confidence: 0.4 }),
      }));
      expect(faible).toHaveLength(1);
      expect(faible[0]!.category).toBe('risk');
    });

    it('signale un site partagé par un réseau', () => {
      expect(sharedDomainDetector.detect(context({ domain: domain(), domainCompanyCount: 1 }))).toHaveLength(0);

      const partage = sharedDomainDetector.detect(context({ domain: domain(), domainCompanyCount: 5 }));
      expect(partage).toHaveLength(1);
      // Risque et non besoin : le gérant n'a aucune prise sur le site du réseau.
      expect(partage[0]!.category).toBe('risk');
    });
  });

  it('confirme l’activité d’une entreprise vue récemment', () => {
    expect(activeBusinessDetector.detect(context({ company: company({ last_seen_at: daysAgo(2) }) }))).toHaveLength(1);
    expect(activeBusinessDetector.detect(context({ company: company({ last_seen_at: daysAgo(200) }) }))).toHaveLength(0);
    expect(activeBusinessDetector.detect(context({
      company: company({ last_seen_at: daysAgo(2), company_status: 'closed' }),
    }))).toHaveLength(0);
  });
});
