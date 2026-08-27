import { describe, expect, it } from 'vitest';
import { analyzePage, extractVisibleText } from '../../packages/core/src/enrichment/page-analysis';

/**
 * Analyse de page.
 *
 * Le cas décisif est l'extraction du SIREN : en France, un site professionnel
 * doit l'afficher dans ses mentions légales. C'est le seul rattachement
 * site → entreprise qui soit déterministe, tout le reste est de l'inférence.
 */
describe('extraction du texte visible', () => {
  it('retire scripts, styles et commentaires', () => {
    const html = `
      <html><head><style>.a{color:red}</style></head>
      <body><!-- caché --><script>var x = "invisible";</script>
      <p>Bonjour</p></body></html>`;
    const text = extractVisibleText(html);
    expect(text).toBe('Bonjour');
  });

  it('décode les entités courantes', () => {
    expect(extractVisibleText('<p>Caf&eacute;&nbsp;&amp;&nbsp;Th&#233;</p>')).toContain('&');
    expect(extractVisibleText('<p>a&nbsp;b</p>')).toBe('a b');
  });
});

describe('rattachement par les mentions légales', () => {
  it('extrait le SIREN d’une page de mentions légales', () => {
    const html = `
      <html><body>
        <h1>Mentions légales</h1>
        <p>RENAULT SAS, société par actions simplifiée au capital de
        533 941 113 €, immatriculée au RCS de Nanterre sous le numéro
        552 100 554. Siège social : 122-122 bis avenue du Général Leclerc.</p>
      </body></html>`;
    expect(analyzePage(html).sirens).toEqual(['552100554']);
  });

  it('trouve les liens vers les mentions légales', () => {
    const html = `
      <a href="/mentions-legales">Mentions légales</a>
      <a href="/cgv">CGV</a>
      <a href="/contact">Contact</a>
      <a href="https://autre-site.fr/mentions-legales">Ailleurs</a>`;
    const result = analyzePage(html, 'https://exemple.fr/');

    expect(result.legalPageLinks).toContain('https://exemple.fr/mentions-legales');
    expect(result.legalPageLinks).toContain('https://exemple.fr/cgv');
    // Un lien sortant n'est pas une page de ce site.
    expect(result.legalPageLinks.some((l) => l.includes('autre-site'))).toBe(false);
  });

  it('ignore les suites de neuf chiffres qui ne sont pas des SIREN', () => {
    const html = '<p>Référence produit 123456789, téléphone 012 345 678</p>';
    expect(analyzePage(html).sirens).toEqual([]);
  });
});

describe('contact', () => {
  it('privilégie les liens explicites au texte libre', () => {
    const html = `
      <a href="tel:+33241222479">Appeler</a>
      <a href="mailto:contact@exemple.fr">Écrire</a>
      <p>Ou composez le 02 41 88 83 79</p>`;
    const result = analyzePage(html);

    expect(result.phones).toContain('+33241222479');
    expect(result.phones).toContain('+33241888379');
    expect(result.emails).toEqual(['contact@exemple.fr']);
  });

  it('repère un formulaire de contact', () => {
    expect(analyzePage('<form action="/envoi"><input name="nom"></form>').hasContactForm).toBe(true);
    expect(analyzePage('<a href="/contact">Nous contacter</a>', 'https://x.fr/').hasContactForm).toBe(true);
    expect(analyzePage('<p>Rien</p>').hasContactForm).toBe(false);
  });

  it('ne prend pas un champ de recherche pour un formulaire de contact', () => {
    const html = '<form><input type="search" name="q"></form>';
    expect(analyzePage(html).hasContactForm).toBe(false);
  });
});

describe('détection des technologies', () => {
  const cases: [string, string, string][] = [
    ['WordPress', '<link href="/wp-content/themes/x/style.css">', 'cms'],
    ['Wix', '<script src="https://static.wixstatic.com/x.js"></script>', 'cms'],
    ['Jimdo', '<script src="https://assets.jimstatic.com/x.js"></script>', 'cms'],
    ['Shopify', '<script>Shopify.theme = {};</script>', 'cms'],
    ['PrestaShop', '<script src="/modules/ps_searchbar/x.js"></script>', 'cms'],
    ['Squarespace', '<script src="//static1.squarespace.com/x.js"></script>', 'cms'],
    ['Next.js', '<script id="__NEXT_DATA__">{}</script>', 'framework'],
    ['Webflow', '<div class="w-webflow-badge"></div>', 'cms'],
  ];

  it.each(cases)('reconnaît %s', (name, html, kind) => {
    const result = analyzePage(html);
    expect(result.technologies).toContain(name);
    if (kind === 'cms') expect(result.cms).toBe(name);
    if (kind === 'framework') expect(result.framework).toBe(name);
  });

  it('accumule plusieurs technologies', () => {
    const html = `
      <link href="/wp-content/plugins/woocommerce/style.css">
      <script src="/jquery.min.js"></script>
      <script src="https://www.googletagmanager.com/gtag/js"></script>`;
    const result = analyzePage(html);
    expect(result.technologies).toEqual(
      expect.arrayContaining(['WordPress', 'WooCommerce', 'jQuery', 'Google Analytics']),
    );
  });

  it('ne détecte rien sur une page nue', () => {
    expect(analyzePage('<html><body><p>Bonjour</p></body></html>').cms).toBeNull();
  });
});

describe('signaux de qualité', () => {
  it('repère l’absence de viewport et de media queries', () => {
    const ancien = analyzePage('<html><body><table></table></body></html>');
    expect(ancien.hasViewportMeta).toBe(false);
    expect(ancien.hasMediaQueries).toBe(false);

    const moderne = analyzePage(
      '<meta name="viewport" content="width=device-width"><style>@media (max-width: 600px){}</style>',
    );
    expect(moderne.hasViewportMeta).toBe(true);
    expect(moderne.hasMediaQueries).toBe(true);
  });

  it('lit l’année de copyright', () => {
    expect(analyzePage('<footer>© 2018 Boulangerie Moreau</footer>').copyrightYear).toBe(2018);
    expect(analyzePage('<footer>Copyright 2015-2024 Moreau</footer>').copyrightYear).toBe(2024);
    expect(analyzePage('<footer>© 1850 Fondée en</footer>').copyrightYear).toBeNull();
  });

  it('repère e-commerce et réservation', () => {
    expect(analyzePage('<button>Ajouter au panier</button>').ecommerceDetected).toBe(true);
    expect(analyzePage('<a href="/x">Prendre rendez-vous</a>').bookingDetected).toBe(true);
    expect(analyzePage('<p>Notre histoire</p>').ecommerceDetected).toBe(false);
  });

  describe('pages sans contenu réel', () => {
    it.each([
      'Site en construction',
      'Coming soon',
      'Ce domaine est à vendre',
      'Apache2 Ubuntu Default Page',
      'Bienvenue sur votre nouveau site',
    ])('reconnaît « %s »', (phrase) => {
      expect(analyzePage(`<html><body><h1>${phrase}</h1></body></html>`).placeholder).toBe(true);
    });

    it('ne prend pas un vrai site pour une page d’attente', () => {
      const html = `<html><body>${'<p>Notre boulangerie vous accueille depuis 1985. </p>'.repeat(60)}
        <p>Site en construction pour notre nouvelle boutique</p></body></html>`;
      // La mention existe, mais la page a du contenu : ce n'est pas un placeholder.
      expect(analyzePage(html).placeholder).toBe(false);
    });
  });
});

describe('empreinte de contenu', () => {
  it('ignore les changements de balisage', () => {
    const a = analyzePage('<div><p>Bonjour le monde</p></div>');
    const b = analyzePage('<section><span>Bonjour   le monde</span></section>');
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('change dès que le texte change', () => {
    const a = analyzePage('<p>Bonjour</p>');
    const b = analyzePage('<p>Bonsoir</p>');
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});
