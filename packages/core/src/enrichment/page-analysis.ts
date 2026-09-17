import { datedComponents, technologyYear, type DatedComponent } from './tech-vintage';
import {
  extractSirenFromText,
  normalizeDomainDetailed,
  normalizeEmailDetailed,
  normalizePhone,
} from '../normalization';

/**
 * Analyse d'une page HTML.
 *
 * Volontairement sans analyseur DOM : on cherche des motifs précis dans un
 * document dont on ne maîtrise ni la validité ni la taille. Des expressions
 * régulières ciblées sur du texte tronqué coûtent quelques millisecondes là où
 * construire un arbre complet en coûterait des centaines — et à l'échelle d'un
 * scan national, c'est la différence entre faisable et non faisable.
 */

export interface PageAnalysis {
  title: string | null;
  metaDescription: string | null;
  /** SIREN trouvés dans le texte. Le rattachement le plus fiable qui existe. */
  sirens: string[];
  phones: string[];
  emails: string[];
  /** Liens vers les pages de mentions légales, à explorer ensuite. */
  legalPageLinks: string[];
  /** Liens vers la page de contact : c'est là que vivent l'e-mail et le formulaire. */
  contactPageLinks: string[];
  /** Feuilles de style externes, dans l'ordre de la page. */
  stylesheets: string[];
  contactFormUrl: string | null;
  hasContactForm: boolean;
  hasViewportMeta: boolean;
  hasMediaQueries: boolean;
  cms: string | null;
  framework: string | null;
  technologies: string[];
  ecommerceDetected: boolean;
  bookingDetected: boolean;
  copyrightYear: number | null;
  /** Composants dont la version est lisible et l'année de publication certaine. */
  datedComponents: DatedComponent[];
  /** Année du composant le plus récent : borne inférieure de la dernière refonte. */
  technologyYear: number | null;
  /** Page d'attente, domaine parké, site en construction. */
  placeholder: boolean;
  /** Hash du texte visible, pour détecter un changement réel de contenu. */
  contentHash: string;
  /** Ce qu'un moteur de recherche lit : présent ou absent, jamais une note. */
  seo: SeoFacts;
  /** Ce qu'un client verrait s'il voulait acheter. */
  commerce: CommerceFacts;
}

export interface SeoFacts {
  hasTitle: boolean;
  titleLength: number;
  hasMetaDescription: boolean;
  h1Count: number;
  hasCanonical: boolean;
  hasJsonLd: boolean;
  hasLang: boolean;
  imagesTotal: number;
  imagesWithoutAlt: number;
  wordCount: number;
}

export interface CommerceFacts {
  /** Plateforme reconnue : shopify, woocommerce, prestashop, magento, wix-stores… */
  platform: string | null;
  /** Une liste de produits avec des prix : un catalogue, même sans vente. */
  catalog: boolean;
  cart: boolean;
  checkout: boolean;
}

const PRICE_PATTERN = /\d{1,4}(?:[.,]\d{2})?\s?(?:€|euros?\b)/gi;
const CATALOG_PATTERN = /nos produits|catalogue|boutique|produit|collection|tarifs?|prix/i;
const CHECKOUT_PATTERN = /checkout|paiement s[ée]curis[ée]|commander|payer|stripe|paypal|payplug/i;
const COMMERCE_PLATFORMS: [RegExp, string][] = [
  [/cdn\.shopify\.com|shopify/i, 'shopify'],
  [/woocommerce/i, 'woocommerce'],
  [/prestashop/i, 'prestashop'],
  [/magento|mage\//i, 'magento'],
  [/wix-stores|wixstores/i, 'wix-stores'],
  [/bigcommerce/i, 'bigcommerce'],
  [/wizishop/i, 'wizishop'],
];

/** Ce qu'un moteur de recherche lit dans la page, compté et non noté. */
export function readSeoFacts(source: string, text: string, title: string | null, metaDescription: string | null): SeoFacts {
  const images = source.match(/<img\b[^>]*>/gi) ?? [];
  const withoutAlt = images.filter((tag) => !/\salt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  return {
    hasTitle: (title ?? '').trim().length > 0,
    titleLength: (title ?? '').trim().length,
    hasMetaDescription: (metaDescription ?? '').trim().length > 0,
    h1Count: (source.match(/<h1\b/gi) ?? []).length,
    hasCanonical: /<link[^>]+rel=["']canonical["']/i.test(source),
    hasJsonLd: /<script[^>]+type=["']application\/ld\+json["']/i.test(source),
    hasLang: /<html[^>]+\blang\s*=/i.test(source),
    imagesTotal: images.length,
    imagesWithoutAlt: withoutAlt,
    wordCount: text.split(/\s+/).filter((w) => w.length > 1).length,
  };
}

/** Ce qu'un client verrait s'il voulait acheter : plateforme, catalogue, panier, paiement. */
export function readCommerceFacts(source: string, text: string): CommerceFacts {
  const platform = COMMERCE_PLATFORMS.find(([re]) => re.test(source))?.[1] ?? null;
  const prices = (text.match(PRICE_PATTERN) ?? []).length;
  const cart = ECOMMERCE_PATTERNS.test(source);
  return {
    platform,
    // Un catalogue : plusieurs prix affichés et un vocabulaire de produits.
    catalog: prices >= 3 && CATALOG_PATTERN.test(text),
    cart,
    checkout: cart && CHECKOUT_PATTERN.test(source),
  };
}

/** Hash stable et rapide, suffisant pour comparer deux versions d'une page. */
function hashText(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return (
    (h1 >>> 0).toString(36).padStart(7, '0') + (h2 >>> 0).toString(36).padStart(7, '0')
  );
}

/** Texte visible : sans scripts, styles, balises ni entités. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Détection des technologies.
 *
 * Motifs maison plutôt qu'un service tiers : une cinquantaine de règles
 * couvrent l'essentiel du parc des TPE françaises, pour un coût nul et sans
 * dépendance à un fournisseur.
 */
const TECH_PATTERNS: { name: string; kind: 'cms' | 'framework' | 'tech'; pattern: RegExp }[] = [
  { name: 'WordPress', kind: 'cms', pattern: /wp-content|wp-includes|wp-json|<meta name="generator" content="WordPress/i },
  { name: 'Wix', kind: 'cms', pattern: /static\.wixstatic\.com|_wixCssImports|wix-dropdown/i },
  { name: 'Squarespace', kind: 'cms', pattern: /squarespace\.com|static1\.squarespace|Squarespace\.afterBodyLoad/i },
  { name: 'Jimdo', kind: 'cms', pattern: /jimdo\.com|assets\.jimstatic\.com/i },
  { name: 'IONOS MyWebsite', kind: 'cms', pattern: /mywebsite-editor|ionos\.|1and1\.|diy\.1and1/i },
  { name: 'Webflow', kind: 'cms', pattern: /webflow\.com|w-webflow-badge|data-wf-page/i },
  { name: 'Shopify', kind: 'cms', pattern: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i },
  { name: 'PrestaShop', kind: 'cms', pattern: /prestashop|\/modules\/ps_|presta-/i },
  { name: 'WooCommerce', kind: 'cms', pattern: /woocommerce|wc-ajax/i },
  { name: 'Magento', kind: 'cms', pattern: /Magento|mage\/cookies|static\/version\d+/i },
  { name: 'Drupal', kind: 'cms', pattern: /drupal|sites\/all\/themes|\/sites\/default\/files/i },
  { name: 'Joomla', kind: 'cms', pattern: /joomla|\/components\/com_|media\/jui/i },
  { name: 'Odoo', kind: 'cms', pattern: /odoo|web\/static\/src/i },
  { name: 'SPIP', kind: 'cms', pattern: /spip\.php|<meta name="generator" content="SPIP/i },
  { name: 'HubSpot', kind: 'cms', pattern: /hs-scripts\.com|hubspot/i },
  { name: 'Weebly', kind: 'cms', pattern: /weebly\.com|weeblycloud/i },
  { name: 'Google Sites', kind: 'cms', pattern: /sites\.google\.com|gstatic\.com\/sites/i },
  { name: 'e-monsite', kind: 'cms', pattern: /e-monsite\.com/i },

  { name: 'Next.js', kind: 'framework', pattern: /__NEXT_DATA__|\/_next\/static/i },
  { name: 'Nuxt', kind: 'framework', pattern: /__NUXT__|\/_nuxt\//i },
  { name: 'React', kind: 'framework', pattern: /react(-dom)?[.-]|data-reactroot|__REACT_DEVTOOLS/i },
  { name: 'Vue', kind: 'framework', pattern: /vue(\.min)?\.js|data-v-[0-9a-f]{8}/i },
  { name: 'Angular', kind: 'framework', pattern: /ng-version=|angular(\.min)?\.js/i },
  { name: 'Svelte', kind: 'framework', pattern: /svelte-[0-9a-z]{6}/i },
  { name: 'Astro', kind: 'framework', pattern: /astro-island|data-astro-/i },

  { name: 'jQuery', kind: 'tech', pattern: /jquery(-\d|\.min)?\.js/i },
  { name: 'Bootstrap', kind: 'tech', pattern: /bootstrap(\.min)?\.(css|js)/i },
  { name: 'Tailwind', kind: 'tech', pattern: /tailwind|tw-[a-z]+-/i },
  { name: 'Elementor', kind: 'tech', pattern: /elementor/i },
  { name: 'Divi', kind: 'tech', pattern: /et_divi|divi-/i },
  { name: 'Google Analytics', kind: 'tech', pattern: /google-analytics\.com|gtag\/js|googletagmanager/i },
  { name: 'Cloudflare', kind: 'tech', pattern: /cdn-cgi\/|cloudflare/i },
  { name: 'reCAPTCHA', kind: 'tech', pattern: /recaptcha/i },
];

const ECOMMERCE_PATTERNS = /panier|add[-_]to[-_]cart|ajouter au panier|checkout|woocommerce-cart|\/cart|commander en ligne/i;
const BOOKING_PATTERNS = /r[ée]server|prendre rendez-?vous|booking|reservation|doctolib|planity|thefork|resmio|zenchef/i;

/** Motifs de page vide, en construction ou de domaine parké. */
const PLACEHOLDER_PATTERNS = [
  /site en construction/i,
  /coming soon/i,
  /page en cours de construction/i,
  /bient[ôo]t disponible/i,
  /under construction/i,
  /ce domaine est [àa] vendre/i,
  /this domain (is for sale|may be for sale)/i,
  /domain (parking|parked)/i,
  /default (web )?page|it works!|apache2 (ubuntu|debian) default page/i,
  /bienvenue sur votre nouveau site/i,
];

/** Chemins usuels des mentions légales en France. */
const LEGAL_LINK_PATTERN =
  /href\s*=\s*["']([^"']*(?:mentions?[-_]?l[ée]gales?|legal|cgv|cgu|conditions[-_]generales|informations?[-_]legales?|impressum)[^"']*)["']/gi;

const CONTACT_LINK_PATTERN =
  /href\s*=\s*["']([^"']*(?:\/contact|contactez|nous[-_]contacter|contact\.(?:html?|php))[^"']*)["']/gi;

export function analyzePage(html: string, baseUrl?: string): PageAnalysis {
  // Bornée : certaines pages font plusieurs mégaoctets, et tout ce qui nous
  // intéresse se trouve dans les premiers 500 Ko.
  const source = html.length > 500_000 ? html.slice(0, 500_000) : html;
  const text = extractVisibleText(source);

  const title = source.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim() ?? null;
  const metaDescription =
    source.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,500})["']/i)?.[1]?.trim()
    ?? source.match(/<meta[^>]+content=["']([^"']{0,500})["'][^>]+name=["']description["']/i)?.[1]?.trim()
    ?? null;

  const technologies: string[] = [];
  let cms: string | null = null;
  let framework: string | null = null;

  const components = datedComponents(source);

  for (const entry of TECH_PATTERNS) {
    if (!entry.pattern.test(source)) continue;
    technologies.push(entry.name);
    if (entry.kind === 'cms' && !cms) cms = entry.name;
    if (entry.kind === 'framework' && !framework) framework = entry.name;
  }

  // Téléphones et e-mails : d'abord les liens explicites, plus fiables que le
  // texte libre où un numéro peut être un prix ou une référence.
  const phones = new Set<string>();
  for (const match of source.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const phone = normalizePhone(decodeURIComponent(match[1] ?? ''));
    if (phone) phones.add(phone);
  }
  for (const match of text.matchAll(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g)) {
    const phone = normalizePhone(match[0]);
    if (phone) phones.add(phone);
  }

  const emails = new Set<string>();
  for (const match of source.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)) {
    const email = normalizeEmailDetailed(decodeURIComponent(match[1] ?? '')).email;
    if (email) emails.add(email);
  }
  // Les adresses écrites dans le texte, y compris obfusquées — « contact (at)
  // domaine.fr », « info [arobase] domaine . fr » — et celles des données
  // structurées. Deux commerces sur cent mettent un lien mailto ; les autres
  // écrivent leur adresse comme ils peuvent, et c'est elle qu'on cherche.
  const deobfuscated = text
    .replace(/\s*[\[(]\s*(?:at|arobase|@)\s*[\])]\s*/gi, '@')
    .replace(/\s+(?:at|arobase)\s+/gi, '@')
    .replace(/\s*[\[(]\s*(?:dot|point)\s*[\])]\s*/gi, '.');
  for (const match of deobfuscated.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const email = normalizeEmailDetailed(match[0]).email;
    if (email && !/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) emails.add(email);
  }
  for (const match of source.matchAll(/"email"\s*:\s*"(?:mailto:)?([^"]+)"/gi)) {
    const email = normalizeEmailDetailed(match[1] ?? '').email;
    if (email) emails.add(email);
  }

  // Les feuilles externes portent presque toujours la mise en page : le HTML
  // seul ne permet pas de conclure sur l'adaptation au mobile.
  const stylesheets = new Set<string>();
  for (const match of source.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)) {
    const href = /href=["']([^"']+)["']/i.exec(match[0])?.[1];
    if (!href || href.startsWith('data:')) continue;
    try {
      stylesheets.add(new URL(href, baseUrl).toString());
    } catch { /* href non résolvable : sans intérêt */ }
  }

  const legalPageLinks = new Set<string>();
  for (const match of source.matchAll(LEGAL_LINK_PATTERN)) {
    const link = resolveLink(match[1], baseUrl);
    if (link) legalPageLinks.add(link);
  }

  const contactPageLinks = new Set<string>();
  for (const match of source.matchAll(CONTACT_LINK_PATTERN)) {
    const link = resolveLink(match[1], baseUrl);
    if (link) contactPageLinks.add(link);
  }
  const contactFormUrl: string | null = [...contactPageLinks][0] ?? null;

  const hasForm = /<form\b/i.test(source) && !/type=["']search["']/i.test(source);

  const copyrightMatch = text.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i);
  const copyrightYear = copyrightMatch?.[1] ? Number(copyrightMatch[1]) : null;

  return {
    title,
    metaDescription,
    sirens: extractSirenFromText(text),
    phones: [...phones],
    emails: [...emails],
    legalPageLinks: [...legalPageLinks],
    contactPageLinks: [...contactPageLinks],
    stylesheets: [...stylesheets],
    contactFormUrl,
    hasContactForm: hasForm || contactFormUrl !== null,
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(source),
    hasMediaQueries: /@media[^{]*\((?:max|min)-width/i.test(source),
    cms,
    framework,
    technologies,
    ecommerceDetected: ECOMMERCE_PATTERNS.test(source),
    bookingDetected: BOOKING_PATTERNS.test(text),
    datedComponents: components,
    technologyYear: technologyYear(components),
    copyrightYear:
      copyrightYear && copyrightYear >= 1995 && copyrightYear <= new Date().getFullYear() + 1
        ? copyrightYear
        : null,
    placeholder: text.length < 2500 && PLACEHOLDER_PATTERNS.some((p) => p.test(text)),
    contentHash: hashText(text),
    seo: readSeoFacts(source, text, title, metaDescription),
    commerce: readCommerceFacts(source, text),
  };
}

/** Résout un lien relatif contre l'URL de la page. */
function resolveLink(href: string | undefined, baseUrl?: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) return null;

  if (!baseUrl) return trimmed.startsWith('http') ? trimmed : null;

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    // Un lien sortant vers un autre domaine n'est pas une page de ce site.
    if (normalizeDomainDetailed(resolved.host).domain !== normalizeDomainDetailed(baseUrl).domain) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}
