/**
 * Datation des composants d'un site.
 *
 * « Site vieux » est un jugement ; « jQuery 1.7.2, sorti en 2011 » est un
 * fait, lisible dans le code source de la page par n'importe qui. C'est toute
 * la différence entre un argument qu'un commerçant peut contester et un
 * constat qu'il peut vérifier devant vous.
 *
 * La règle d'interprétation est délibérément prudente : l'âge du site est
 * celui de son composant le PLUS RÉCENT, jamais du plus ancien. Un site
 * refait l'an dernier peut très bien traîner une bibliothèque de 2011 pour
 * une raison légitime ; l'accuser d'être obsolète serait faux, et le
 * freelance s'en apercevrait au téléphone.
 */

export interface DatedComponent {
  name: string;
  version: string;
  /** Année de publication de cette version majeure. */
  year: number;
}

/**
 * Années de publication, par version majeure.
 *
 * Volontairement limité aux bibliothèques dont la version est lisible dans
 * l'URL d'un fichier et dont l'historique est incontestable. Une date
 * approximative vaudrait moins que pas de date du tout.
 */
const RELEASES: Record<string, Record<string, number>> = {
  jQuery: {
    '1.2': 2007, '1.3': 2009, '1.4': 2010, '1.5': 2011, '1.6': 2011, '1.7': 2011,
    '1.8': 2012, '1.9': 2013, '1.10': 2013, '1.11': 2014, '1.12': 2016,
    '2.0': 2013, '2.1': 2014, '2.2': 2016,
    '3.0': 2016, '3.1': 2016, '3.2': 2017, '3.3': 2018, '3.4': 2019,
    '3.5': 2020, '3.6': 2021, '3.7': 2023,
  },
  'jQuery UI': {
    '1.8': 2010, '1.9': 2012, '1.10': 2013, '1.11': 2014, '1.12': 2016, '1.13': 2021,
  },
  // Ces deux générations s'étalent sur plusieurs années : les dater à leur
  // première publication ferait vieillir le site à tort. Un site sous Font
  // Awesome 4.5 a été touché en 2015, pas en 2013 — et le lui reprocher se
  // retournerait contre le freelance.
  Bootstrap: {
    '2': 2012,
    '3': 2013, '3.0': 2013, '3.1': 2014, '3.2': 2014, '3.3': 2015, '3.4': 2019,
    '4': 2018, '4.0': 2018, '4.1': 2018, '4.2': 2018, '4.3': 2019, '4.4': 2019,
    '4.5': 2020, '4.6': 2021,
    '5': 2021, '5.0': 2021, '5.1': 2021, '5.2': 2022, '5.3': 2023,
  },
  'Font Awesome': {
    '4': 2013, '4.0': 2013, '4.1': 2014, '4.2': 2014, '4.3': 2015, '4.4': 2015,
    '4.5': 2015, '4.6': 2016, '4.7': 2016,
    '5': 2017, '6': 2021, '7': 2024,
  },
  Modernizr: { '2': 2011, '3': 2015 },
  'AngularJS': { '1': 2012 },
  WordPress: {
    '3': 2010, '4': 2014, '5': 2018, '6': 2022,
  },
};

/**
 * Bibliothèques dont l'existence seule date le site, sans numéro de version :
 * elles ont cessé d'être utilisées bien avant que le web moderne existe.
 */
const ABANDONED: { name: string; year: number; pattern: RegExp }[] = [
  { name: 'MooTools', year: 2010, pattern: /mootools[.-]/i },
  { name: 'Prototype.js', year: 2009, pattern: /prototype(\.min)?\.js/i },
  { name: 'script.aculo.us', year: 2008, pattern: /scriptaculous/i },
  { name: 'Flash', year: 2010, pattern: /\.swf\b|application\/x-shockwave-flash/i },
];

const VERSIONED: { name: string; pattern: RegExp }[] = [
  { name: 'jQuery UI', pattern: /jquery[-.]ui[-.](\d+\.\d+)(?:\.\d+)?(?:\.min)?\.(?:js|css)/gi },
  { name: 'jQuery', pattern: /jquery[-.](\d+\.\d+)(?:\.\d+)?(?:\.min)?\.js/gi },
  // Le mineur est capturé quand il existe : la table le préfère au majeur.
  { name: 'Bootstrap', pattern: /bootstrap[-.\/](\d+(?:\.\d+)?)(?:\.\d+)?(?:\.min)?\.(?:js|css)/gi },
  { name: 'Font Awesome', pattern: /font-?awesome[-.\/](\d+(?:\.\d+)?)(?:\.\d+)?/gi },
  { name: 'Modernizr', pattern: /modernizr[-.](\d+)(?:\.\d+){0,2}/gi },
  { name: 'AngularJS', pattern: /angular[-.](1)\.\d+(?:\.\d+)?(?:\.min)?\.js/gi },
];

/**
 * Version de WordPress, lue sur les fichiers du cœur uniquement.
 *
 * Le paramètre `ver=` est ajouté par tout fichier mis en file d'attente, thème
 * et extensions compris : un thème en version 4.5 serait lu comme un
 * WordPress de 2014. Seuls /wp-includes/ et /wp-admin/ appartiennent au cœur
 * et portent donc la vraie version du CMS.
 */
const WORDPRESS_VERSION = /\/wp-(?:includes|admin)\/[^"'\s>]*[?&]ver=(\d+)\.\d+(?:\.\d+)?/gi;

/**
 * Composants datables trouvés dans une page.
 *
 * Une version inconnue de notre table n'est pas datée plutôt que devinée : on
 * préfère ne rien dire à dire une approximation qu'on ne saurait pas défendre.
 */
export function datedComponents(source: string): DatedComponent[] {
  const found = new Map<string, DatedComponent>();

  const keep = (name: string, version: string, year: number): void => {
    const existing = found.get(name);
    // À bibliothèque égale, on retient la version la plus récente : un site
    // qui charge deux versions de jQuery est daté par la plus neuve.
    if (!existing || year > existing.year) found.set(name, { name, version, year });
  };

  for (const { name, pattern } of VERSIONED) {
    for (const match of source.matchAll(pattern)) {
      const version = match[1];
      if (!version) continue;
      // On cherche d'abord la version exacte, puis sa génération : dater au
      // plus précis qu'on sache défendre, jamais plus.
      const table = RELEASES[name];
      const year = table?.[version] ?? table?.[version.split('.')[0] ?? ''];
      if (year !== undefined) keep(name, version, year);
    }
  }

  for (const match of source.matchAll(WORDPRESS_VERSION)) {
    const major = match[1];
    if (!major) continue;
    const year = RELEASES['WordPress']?.[major];
    if (year !== undefined) keep('WordPress', major, year);
  }

  for (const { name, year, pattern } of ABANDONED) {
    if (pattern.test(source)) keep(name, 'abandonnée', year);
  }

  return [...found.values()].sort((a, b) => a.year - b.year);
}

/**
 * Année du composant le plus récent : une borne inférieure de la date de la
 * dernière refonte.
 *
 * `null` quand rien n'est datable — ce qui est fréquent et ne veut pas dire
 * que le site est neuf. L'absence de preuve n'est pas une preuve.
 */
export function technologyYear(components: DatedComponent[]): number | null {
  if (components.length === 0) return null;
  return Math.max(...components.map((c) => c.year));
}
