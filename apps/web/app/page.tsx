import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth/session';

export default async function HomePage() {
  const profile = await getSessionProfile();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6">
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Prospect AI</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Chaque jour, les 5 opportunités commerciales qui valent ton temps.
        </h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Nous analysons en continu des milliers d&apos;entreprises et te transmettons chaque
          matin les cinq qui présentent aujourd&apos;hui les meilleurs signaux. Tu ne cherches
          plus, tu contactes.
        </p>
      </div>

      <div className="flex gap-3">
        {profile ? (
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voir mes opportunités
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Créer un compte
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
            >
              Se connecter
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
