import 'server-only';
import { getServiceClient, getTodayOpportunities, type TodayOpportunity } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';

/**
 * Les opportunités du jour de l'utilisateur connecté.
 *
 * La lecture doit joindre entreprises, domaines et événements, qui ne sont pas
 * exposés aux utilisateurs : elle passe donc par le client service_role. Pour
 * qu'aucun appelant ne puisse lire le lot de quelqu'un d'autre, l'identifiant
 * n'est pas un paramètre — il vient de la session, ici, et nulle part ailleurs.
 * C'est la seule porte d'entrée du chemin utilisateur.
 *
 * `server-only` fait échouer le build si ce module est importé depuis un
 * composant client : la clé service_role ne doit jamais approcher le navigateur.
 */
export async function getMyOpportunities(): Promise<{
  firstName: string;
  role: string;
  opportunities: TodayOpportunity[];
}> {
  const profile = await requireUser();

  return {
    firstName: profile.full_name?.split(' ')[0] ?? '',
    role: profile.role,
    opportunities: await getTodayOpportunities(getServiceClient(), profile.id),
  };
}
