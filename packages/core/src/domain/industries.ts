/**
 * Les métiers de proximité, dits en français et montrés d'un signe.
 *
 * OpenStreetMap étiquette les commerces en anglais (« hairdresser »,
 * « estate agent ») ; le répertoire les nomme par leur code NAF, en
 * majuscules administratives. Ni l'un ni l'autre ne se lit dans une liste.
 * Ici, une étiquette lisible et une icône par métier : c'est ce que l'œil
 * attrape avant le nom, comme sur une carte.
 */

export interface IndustryPresentation {
  label: string;
  icon: string;
}

const INDUSTRIES: Record<string, IndustryPresentation> = {
  restaurant: { label: 'Restaurant', icon: '🍽️' },
  'fast food': { label: 'Restauration rapide', icon: '🍔' },
  cafe: { label: 'Café', icon: '☕' },
  bar: { label: 'Bar', icon: '🍸' },
  pub: { label: 'Pub', icon: '🍺' },
  bakery: { label: 'Boulangerie', icon: '🥖' },
  pastry: { label: 'Pâtisserie', icon: '🧁' },
  butcher: { label: 'Boucherie', icon: '🥩' },
  deli: { label: 'Épicerie fine', icon: '🧀' },
  convenience: { label: 'Épicerie', icon: '🛒' },
  supermarket: { label: 'Supermarché', icon: '🛒' },
  alcohol: { label: 'Caviste', icon: '🍷' },
  clothes: { label: 'Boutique de vêtements', icon: '👗' },
  shoes: { label: 'Chaussures', icon: '👟' },
  jewelry: { label: 'Bijouterie', icon: '💍' },
  cosmetics: { label: 'Cosmétiques', icon: '💄' },
  beauty: { label: 'Institut de beauté', icon: '💅' },
  hairdresser: { label: 'Coiffeur', icon: '✂️' },
  tattoo: { label: 'Tatoueur', icon: '🖋️' },
  pharmacy: { label: 'Pharmacie', icon: '💊' },
  optician: { label: 'Opticien', icon: '👓' },
  doctors: { label: 'Cabinet médical', icon: '🩺' },
  dentist: { label: 'Dentiste', icon: '🦷' },
  'estate agent': { label: 'Agence immobilière', icon: '🏠' },
  insurance: { label: 'Assurance', icon: '🛡️' },
  hotel: { label: 'Hôtel', icon: '🛎️' },
  'travel agency': { label: 'Agence de voyages', icon: '✈️' },
  'car repair': { label: 'Garage', icon: '🔧' },
  car: { label: 'Concession automobile', icon: '🚗' },
  bicycle: { label: 'Vélos', icon: '🚲' },
  'driving school': { label: 'Auto-école', icon: '🚘' },
  'sports centre': { label: 'Salle de sport', icon: '🏋️' },
  'fitness centre': { label: 'Salle de fitness', icon: '🏋️' },
  books: { label: 'Librairie', icon: '📚' },
  newsagent: { label: 'Presse', icon: '📰' },
  tobacco: { label: 'Tabac', icon: '🚬' },
  florist: { label: 'Fleuriste', icon: '💐' },
  'interior decoration': { label: 'Décoration', icon: '🛋️' },
  furniture: { label: 'Meubles', icon: '🛋️' },
  laundry: { label: 'Pressing', icon: '🧺' },
  'mobile phone': { label: 'Téléphonie', icon: '📱' },
  electronics: { label: 'Électronique', icon: '🔌' },
  hardware: { label: 'Quincaillerie', icon: '🔨' },
  garden_centre: { label: 'Jardinerie', icon: '🌿' },
  pet: { label: 'Animalerie', icon: '🐾' },
  veterinary: { label: 'Vétérinaire', icon: '🐾' },
  plumber: { label: 'Plombier', icon: '🚿' },
  electrician: { label: 'Électricien', icon: '💡' },
  carpenter: { label: 'Menuisier', icon: '🪚' },
  painter: { label: 'Peintre', icon: '🎨' },
  photographer: { label: 'Photographe', icon: '📷' },
  lawyer: { label: 'Cabinet d’avocats', icon: '⚖️' },
  accountant: { label: 'Cabinet comptable', icon: '🧾' },
  bank: { label: 'Banque', icon: '🏦' },
};

const DEFAULT: IndustryPresentation = { label: 'Commerce', icon: '🏪' };

/**
 * Présente un métier. Une étiquette OSM connue est traduite ; un libellé
 * déjà en français (NAF) est gardé, remis en minuscules avec majuscule
 * initiale ; l'icône vient du mot-clé reconnu, sinon de la devanture.
 */
export function describeIndustry(label: string | null | undefined): IndustryPresentation {
  if (!label) return DEFAULT;
  const key = label.trim().toLowerCase().replace(/_/g, ' ');
  const known = INDUSTRIES[key];
  if (known) return known;

  // Un libellé NAF : « Restauration traditionnelle », « Coiffure ». On
  // cherche un mot-clé pour l'icône, on garde le texte tel quel.
  const icon = Object.entries({
    restaur: '🍽️', boulang: '🥖', pâtiss: '🧁', boucher: '🥩', coiff: '✂️', 'beauté': '💅', pharma: '💊',
    optic: '👓', dent: '🦷', 'médic': '🩺', immobil: '🏠', assur: '🛡️', 'hôtel': '🛎️', 'héberg': '🛎️',
    garage: '🔧', 'automob': '🚗', 'vélo': '🚲', 'sport': '🏋️', librai: '📚', fleur: '💐',
    plomb: '🚿', 'électric': '💡', menuis: '🪚', peint: '🎨', photo: '📷', avocat: '⚖️', compta: '🧾',
    'café': '☕', 'débit de boissons': '🍸', 'épicerie': '🛒', alimentation: '🛒', 'vêtement': '👗', habillement: '👗',
  }).find(([needle]) => key.includes(needle))?.[1] ?? DEFAULT.icon;

  const pretty = label.trim().toLowerCase();
  return { label: pretty.charAt(0).toUpperCase() + pretty.slice(1), icon };
}
