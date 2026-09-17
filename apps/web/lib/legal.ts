/**
 * L'éditeur du service, tel qu'il doit apparaître dans les mentions légales
 * (LCEN, art. 6-III) et dans la politique de confidentialité.
 *
 * Un seul endroit à remplir avant la mise en ligne. Les valeurs entre
 * crochets sont des trous : la page des mentions légales les affiche tels
 * quels, pour qu'on les voie.
 */
export const LEGAL = {
  /** Dénomination : « Eliott Roche, entrepreneur individuel » ou la société. */
  publisher: '[Dénomination de l’éditeur]',
  legalForm: '[Forme juridique : entrepreneur individuel, SAS…]',
  siren: '[SIREN]',
  address: '[Adresse du siège]',
  director: 'Eliott Roche',
  /** Où écrire : affichée dans le pied de page, l'abonnement et l'opposition. */
  contactEmail: process.env['NEXT_PUBLIC_CONTACT_EMAIL'] ?? '',
  host: {
    name: 'Vercel Inc.',
    address: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    site: 'https://vercel.com',
  },
  data: {
    name: 'Supabase Inc.',
    region: 'Paris (eu-west-3), Amazon Web Services',
    site: 'https://supabase.com',
  },
} as const;

export function legalIsComplete(): boolean {
  return ![LEGAL.publisher, LEGAL.legalForm, LEGAL.siren, LEGAL.address].some((v) => v.startsWith('['))
    && LEGAL.contactEmail.length > 0;
}
