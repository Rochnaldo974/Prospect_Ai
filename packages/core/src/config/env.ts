import { z } from 'zod';

/**
 * Variables d'environnement serveur.
 *
 * Volontairement lu de façon paresseuse et mémoïsée : importer ce module ne doit
 * jamais faire planter un bundle client, et la validation ne doit se déclencher
 * qu'au premier accès réel côté serveur.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Facultative : seule l'application web s'en sert, et elle la lit
  // directement. L'exiger ici forçait le worker déployé à transporter une
  // clé du navigateur qu'il n'utilise jamais — découvert au premier
  // démarrage du conteneur, qui refusait de partir sans elle.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  WORKER_ID: z.string().default('local'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(racine)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuration d'environnement invalide :\n${issues}\n\n` +
        `Copie .env.example vers .env.local et renseigne les valeurs manquantes.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Réinitialise le cache — usage strictement réservé aux tests. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
