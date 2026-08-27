import 'server-only';
import { getServiceClient, type Db } from '@prospect/core';
import { requireAdmin } from '@/lib/auth/session';

/**
 * Client base de données pour la console d'administration.
 *
 * Le contrôle du rôle est fait ICI, avant de rendre le client : il est donc
 * impossible d'obtenir un client service_role dans une page admin sans que
 * requireAdmin() se soit exécuté. C'est la seule porte d'entrée.
 *
 * `server-only` fait échouer le build si ce module est importé depuis un
 * composant client — la clé service_role ne doit jamais approcher le navigateur.
 */
export async function getAdminDb(): Promise<Db> {
  await requireAdmin();
  return getServiceClient();
}
