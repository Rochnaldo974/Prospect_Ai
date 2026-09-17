import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: { absolute: 'Mentions légales — Prospect AI' } };

/** Qui édite le service, qui l'héberge, où écrire. Les valeurs viennent de lib/legal.ts. */
export default function LegalPage() {
  const rows: Array<[string, string]> = [
    ['Éditeur', LEGAL.publisher],
    ['Forme juridique', LEGAL.legalForm],
    ['SIREN', LEGAL.siren],
    ['Siège', LEGAL.address],
    ['Directeur de la publication', LEGAL.director],
    ['Contact', LEGAL.contactEmail || '[adresse de contact]'],
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-mono text-sm font-medium tracking-tight">
            prospect<span className="text-[var(--brand)]">.ai</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Retour à l’accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="field-label">Mentions légales</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Qui édite Prospect AI</h1>

        <dl className="mt-10 divide-y rounded-2xl border bg-card">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-5 py-4 sm:grid-cols-[14rem_1fr]">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-14 border-t pt-8">
          <h2 className="text-lg font-semibold tracking-tight">Hébergement</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Le site est hébergé par {LEGAL.host.name}, {LEGAL.host.address} ({LEGAL.host.site}).
            Les données sont stockées par {LEGAL.data.name} dans la région {LEGAL.data.region} ({LEGAL.data.site}).
          </p>
        </section>

        <section className="mt-14 border-t pt-8">
          <h2 className="text-lg font-semibold tracking-tight">Données</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Ce que le service collecte, et ce qu’il ne collecte jamais, est décrit dans la{' '}
            <Link href="/confidentialite" className="text-[var(--brand)] underline-offset-4 hover:underline">politique de confidentialité</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
