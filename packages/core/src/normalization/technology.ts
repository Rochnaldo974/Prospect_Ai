/**
 * Les technologies telles que le matching les compare.
 *
 * Le scanner nomme les choses comme les pages les nomment (« WordPress »,
 * « PrestaShop », « IONOS MyWebsite ») ; le freelance coche une case. Entre
 * les deux, une clé unique et stable : minuscule, sans espace, sans point.
 */

export const TECHNOLOGY_LABELS: Record<string, string> = {
  wordpress: 'WordPress',
  woocommerce: 'WooCommerce',
  shopify: 'Shopify',
  prestashop: 'PrestaShop',
  magento: 'Magento',
  webflow: 'Webflow',
  wix: 'Wix',
  squarespace: 'Squarespace',
  drupal: 'Drupal',
  joomla: 'Joomla',
  jimdo: 'Jimdo',
  nextjs: 'Next.js',
  react: 'React',
  vue: 'Vue',
};

/** Les clés qu'on propose à l'inscription : les plus répandues chez les clients visés. */
export const TECHNOLOGY_CHOICES = [
  'wordpress', 'woocommerce', 'shopify', 'prestashop', 'webflow', 'wix', 'squarespace', 'drupal',
] as const;

const ALIASES: Record<string, string> = {
  'ionos mywebsite': 'ionos',
  'google sites': 'googlesites',
  'e-monsite': 'emonsite',
  'next.js': 'nextjs',
};

/** « PrestaShop » → prestashop ; null pour une valeur vide. */
export function normalizeTechnology(name: string | null | undefined): string | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  return ALIASES[lower] ?? lower.replace(/[^a-z0-9]+/g, '');
}

/** WooCommerce est WordPress : un spécialiste de l'un sait travailler l'autre. */
export function technologyMatches(siteTechnology: string | null, mastered: readonly string[]): boolean {
  const key = normalizeTechnology(siteTechnology);
  if (!key || mastered.length === 0) return false;
  if (mastered.includes(key)) return true;
  return key === 'woocommerce' && mastered.includes('wordpress');
}
