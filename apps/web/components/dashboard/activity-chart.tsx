'use client';

import type { ActivityDay } from '@prospect/core';

/**
 * L'activité des trente derniers jours — l'effort et son fruit.
 *
 * Une colonne par jour : la hauteur bleue est le nombre d'appels, le pied
 * émeraude les réponses positives déclarées ce jour-là. Les deux couleurs
 * reprennent exactement la grammaire du relevé au-dessus (le bleu agit,
 * le vert gagne) : le graphique se lit sans légende, mais elle est là.
 *
 * Pas de bibliothèque : trente div empilées suffisent, et le survol porte
 * le détail exact — un graphique qui oblige à deviner les valeurs est un
 * dessin, pas un relevé.
 */
export function ActivityChart({ data }: { data: ActivityDay[] }) {
  const totalCalls = data.reduce((sum, d) => sum + d.contacted, 0);
  const totalResponses = data.reduce((sum, d) => sum + d.responses, 0);
  const max = Math.max(1, ...data.map((d) => d.contacted));

  const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const tick = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <section className="mt-8 rounded-2xl border bg-card px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-sm font-medium">Votre activité — 30 derniers jours</h2>
        <div className="flex items-center gap-5 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-[var(--brand)]" />
            {totalCalls} {totalCalls > 1 ? 'appelées' : 'appelée'}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
            {totalResponses} {totalResponses > 1 ? 'réponses' : 'réponse'}
          </span>
        </div>
      </div>

      {totalCalls === 0 ? (
        <p className="mt-6 pb-2 text-sm text-muted-foreground">
          Vos appels apparaîtront ici jour après jour, avec les réponses qu’ils obtiennent.
        </p>
      ) : (
        <div className="mt-5 flex h-32 items-end gap-[3px] sm:gap-1">
          {data.map((day, i) => {
            const callsH = (day.contacted / max) * 100;
            const responsesH = (day.responses / max) * 100;
            const parsed = new Date(`${day.date}T12:00:00`);
            return (
              <div key={day.date} className="group relative flex h-full flex-1 items-end">
                {/* Le rail : toute la hauteur est survolable, même un jour à zéro. */}
                <div className="absolute inset-x-0 inset-y-0 rounded bg-transparent transition-colors group-hover:bg-[var(--mist)]" />
                <div
                  className="chart-bar relative w-full overflow-hidden rounded-[3px] bg-[var(--brand)]/[0.28] motion-reduce:animate-none"
                  style={{
                    height: `${Math.max(callsH, day.contacted > 0 ? 6 : 0)}%`,
                    animationDelay: `${i * 18}ms`,
                  }}
                >
                  {day.responses > 0 ? (
                    <div
                      className="absolute inset-x-0 bottom-0 bg-emerald-500"
                      style={{ height: `${Math.min(100, (responsesH / Math.max(callsH, 6)) * 100)}%` }}
                    />
                  ) : null}
                </div>

                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border bg-[var(--white)] px-3 py-1.5 font-mono text-[11px] shadow-[0_10px_30px_-16px_rgba(15,23,42,0.35)] group-hover:block"
                >
                  <span className="capitalize text-muted-foreground">{dayLabel.format(parsed)}</span>
                  <span className="mx-1.5 text-[var(--line)]">·</span>
                  {day.contacted} {day.contacted > 1 ? 'appelées' : 'appelée'}
                  {day.responses > 0 ? (
                    <span className="text-emerald-600"> · {day.responses} {day.responses > 1 ? 'réponses' : 'réponse'}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalCalls > 0 ? (
        <div className="mt-2 flex justify-between border-t pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {[0, 10, 20, 29].map((i) => {
            const day = data[i];
            return day ? <span key={day.date}>{tick.format(new Date(`${day.date}T12:00:00`))}</span> : null;
          })}
        </div>
      ) : null}
    </section>
  );
}
