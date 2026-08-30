import 'server-only';
import {
  diagnoseEmptyDay, getServiceClient, getTodayOpportunities,
  type EmptyDiagnosis, type TodayOpportunity,
} from '@prospect/core';
import { requireOnboardedUser } from '@/lib/auth/session';

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
  /** Renseigné seulement quand la journée est vide : dire POURQUOI. */
  diagnosis: EmptyDiagnosis | null;
}> {
  const profile = await requireOnboardedUser();
  const db = getServiceClient();

  const opportunities = await getTodayOpportunities(db, profile.id);

  return {
    firstName: profile.full_name?.split(' ')[0] ?? '',
    role: profile.role,
    opportunities,
    // Le diagnostic n'est calculé que s'il sert : trois requêtes de plus pour
    // expliquer une page pleine seraient du gaspillage.
    diagnosis: opportunities.length === 0 ? await diagnoseEmptyDay(db, profile.id) : null,
  };
}
