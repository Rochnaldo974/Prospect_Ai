import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServiceClient, loadAuditShare, recordAuditOpen } from '@prospect/core';

export const metadata: Metadata = { title: 'Audit de votre site' };
export const dynamic = 'force-dynamic';

/**
 * L'audit, vu par le prospect.
 *
 * Une page sans compte, sans menu, sans notre marque : c'est le freelance
 * qui parle, pas nous. Elle dit ce que le site montre à ses clients, avec
 * la capture, la note, trois à cinq constats vérifiables, et ce qu'on peut
 * y faire. Elle finit par la signature du freelance et ses coordonnées —
 * c'est là que le prospect doit vouloir cliquer.
 *
 * Chaque affichage est compté : le freelance saura que l'audit a été lu,
 * et quand. Le lien est un identifiant aléatoire ; le contenu est figé.
 */
export default async function PublicAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getServiceClient();
  const share = await loadAuditShare(db, id);
  if (!share) notFound();

  await recordAuditOpen(db, share.id);
  const s = share.snapshot;
  const tone = (v: number) => (v < 40 ? '#c0392b' : v < 70 ? '#b7791f' : '#2c4bff');
  const measured = s.measuredAt
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s.measuredAt))
    : null;
  const bars = s.scores
    ? [
      { label: 'Vitesse', value: s.scores.speed },
      { label: 'Sur téléphone', value: s.scores.mobile },
      { label: 'Référencement', value: s.scores.seo },
      { label: 'Confiance', value: s.scores.trust },
    ]
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[15px] leading-relaxed text-[#1c1f2a]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-3">
          {s.author.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo distant du freelance
            <img src={s.author.logoUrl} alt="" className="size-10 rounded-lg object-contain" />
          ) : null}
          <div>
            <p className="font-semibold">{s.author.name}</p>
            <p className="text-sm text-[#5b6070]">{[s.author.title, s.author.company].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <p className="text-sm text-[#5b6070]">Audit préparé pour {s.company.name}</p>
      </header>

      <section className="mt-8">
        <p className="text-xs uppercase tracking-[0.14em] text-[#5b6070]">Ce que votre site montre à vos clients</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{s.headline}</h1>
        {s.company.websiteUrl ? (
          <p className="mt-1 text-sm text-[#5b6070]">{s.company.websiteUrl.replace(/^https?:\/\//, '')}</p>
        ) : null}
      </section>

      {s.screenshotUrl ? (
        <figure className="mt-6 overflow-hidden rounded-2xl border">
          {/* eslint-disable-next-line @next/next/no-img-element -- capture distante */}
          <img src={s.screenshotUrl} alt={`Capture du site de ${s.company.name}`} className="w-full object-cover object-top" />
          {measured ? (
            <figcaption className="border-t px-4 py-2 text-xs text-[#5b6070]">
              Votre site tel qu’il s’affiche le {measured}, sur un ordinateur.
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_1.2fr]">
        {s.score !== null ? (
          <section className="rounded-2xl border px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-[0.14em] text-[#5b6070]">Note globale</h2>
              <span className="font-mono text-3xl font-semibold" style={{ color: tone(s.score) }}>
                {s.score}<span className="text-sm text-[#5b6070]">/100</span>
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {bars.map((bar) => (
                <li key={bar.label} className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 text-[#5b6070]">{bar.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f5]">
                    <span className="block h-full rounded-full" style={{ width: `${bar.value}%`, backgroundColor: tone(bar.value) }} />
                  </span>
                  <span className="w-7 text-right font-mono">{bar.value}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-[#5b6070]">Ce que nous avons constaté</h2>
          <ol className="mt-3 space-y-2.5">
            {s.findings.map((finding, index) => (
              <li key={finding} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#eef0f5] font-mono text-xs">{index + 1}</span>
                <span>{finding}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mt-8 rounded-2xl bg-[#eef2ff] px-5 py-4">
        <h2 className="text-xs uppercase tracking-[0.14em] text-[#2c4bff]">Ce que je vous propose</h2>
        <p className="mt-2 text-[#2c4bff]">{s.proposal}</p>
      </section>

      <footer className="mt-10 border-t pt-6">
        <p className="font-semibold">{s.author.name}</p>
        <p className="text-sm text-[#5b6070]">{[s.author.title, s.author.company].filter(Boolean).join(' · ')}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {s.author.phone ? <a href={`tel:${s.author.phone}`} className="text-[#2c4bff] underline-offset-4 hover:underline">{s.author.phone}</a> : null}
          {s.author.email ? <a href={`mailto:${s.author.email}`} className="text-[#2c4bff] underline-offset-4 hover:underline">{s.author.email}</a> : null}
          {s.author.website ? (
            <a href={s.author.website} target="_blank" rel="noopener noreferrer" className="text-[#2c4bff] underline-offset-4 hover:underline">
              {s.author.website.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
        </p>
        <p className="mt-6 text-xs text-[#8a90a3]">
          Les constats sont des mesures faites en ouvrant votre site comme le ferait un visiteur ; vous pouvez les vérifier vous-même.
          Rien dans cet audit ne présume de vos intentions.
        </p>
      </footer>
    </main>
  );
}
