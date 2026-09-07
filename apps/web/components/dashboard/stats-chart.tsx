'use client';

import { useState } from 'react';
import type { ActivityDay } from '@prospect/core';

/**
 * Les courbes du mois — appels et réponses, jour par jour.
 *
 * Deux courbes lissées sur la même grille : le bleu est l'effort, le vert
 * son fruit. Le tracé se dessine à l'arrivée sur la page, l'aplat monte
 * ensuite ; le survol pose un réticule et donne les valeurs exactes du
 * jour. Tout est SVG nu — pas de bibliothèque, rien à charger.
 */
const W = 640;
const H = 200;
const TOP = 16;
const BOTTOM = 18;

/**
 * Une interpolation monotone (Fritsch-Carlson) : la courbe passe PAR les
 * points et ne déborde JAMAIS entre deux — un jour à zéro reste à zéro.
 * Une Catmull-Rom classique gonfle entre les valeurs entières et invente
 * des creux et des bosses que les données n'ont pas.
 */
function smoothPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n < 2) return '';
  const h = points[1]![0] - points[0]![0];
  const delta = points.slice(0, -1).map((p, i) => (points[i + 1]![1] - p[1]) / h);
  const m = points.map((_, i) => {
    if (i === 0) return delta[0]!;
    if (i === n - 1) return delta[n - 2]!;
    const a = delta[i - 1]!;
    const b = delta[i]!;
    // Extremum local ou plat : tangente nulle, sinon moyenne harmonique.
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M ${points[0]![0]} ${points[0]![1].toFixed(1)}`;
  for (let i = 1; i < n; i += 1) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    const c1y = y1 + (m[i - 1]! * h) / 3;
    const c2y = y2 - (m[i]! * h) / 3;
    d += ` C ${(x1 + h / 3).toFixed(1)} ${c1y.toFixed(1)}, ${(x2 - h / 3).toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

export function StatsChart({ data }: { data: ActivityDay[] }) {
  const [active, setActive] = useState<number | null>(null);

  const totalCalls = data.reduce((sum, d) => sum + d.contacted, 0);
  const max = Math.max(2, ...data.map((d) => d.contacted));

  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => TOP + (1 - v / max) * (H - TOP - BOTTOM);

  const calls: Array<[number, number]> = data.map((d, i) => [x(i), y(d.contacted)]);
  const responses: Array<[number, number]> = data.map((d, i) => [x(i), y(d.responses)]);
  const floor = H - BOTTOM;
  const area = (line: Array<[number, number]>) =>
    `${smoothPath(line)} L ${W} ${floor} L 0 ${floor} Z`;

  const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const tick = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const day = active === null ? null : data[active];

  if (totalCalls === 0) {
    return (
      <p className="mt-6 pb-2 text-sm text-muted-foreground">
        Vos appels dessineront ces courbes jour après jour — l’effort en bleu, les réponses en vert.
      </p>
    );
  }

  return (
    <div className="relative mt-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label="Appels et réponses positives par jour sur trente jours"
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id="stat-calls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="stat-responses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Les repères : le plafond du mois et sa moitié, en pointillé discret. */}
        {[max, max / 2].map((v) => (
          <g key={v}>
            <line
              x1="0" x2={W} y1={y(v)} y2={y(v)}
              stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
            <text x="0" y={y(v) - 5} className="fill-[color:var(--muted-foreground,#64748b)] font-mono text-[9px] opacity-60">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={area(calls)} fill="url(#stat-calls)" className="stats-area" />
        <path d={area(responses)} fill="url(#stat-responses)" className="stats-area" style={{ animationDelay: '1.05s' }} />

        <path
          d={smoothPath(calls)} pathLength={1} fill="none"
          stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"
          vectorEffect="non-scaling-stroke" className="stats-line"
        />
        <path
          d={smoothPath(responses)} pathLength={1} fill="none"
          stroke="#10b981" strokeWidth="2" strokeLinecap="round"
          vectorEffect="non-scaling-stroke" className="stats-line" style={{ animationDelay: '0.35s' }}
        />

        {active !== null && day ? (
          <g>
            <line
              x1={x(active)} x2={x(active)} y1={TOP - 6} y2={floor}
              stroke="var(--ink, #0f172a)" strokeWidth="1" strokeOpacity="0.25"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(active)} cy={y(day.contacted)} r="4" fill="var(--brand)" stroke="var(--white)" strokeWidth="2" />
            <circle cx={x(active)} cy={y(day.responses)} r="4" fill="#10b981" stroke="var(--white)" strokeWidth="2" />
          </g>
        ) : null}

        {/* Une bande de survol par jour : large, invisible, généreuse au doigt. */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - W / (data.length - 1) / 2} y="0"
            width={W / (data.length - 1)} height={H}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>

      {day ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-[var(--white)] px-3 py-1.5 font-mono text-[11px] shadow-[0_10px_30px_-16px_rgba(15,23,42,0.35)]"
          style={{ left: `${Math.min(88, Math.max(12, ((active ?? 0) / (data.length - 1)) * 100))}%` }}
        >
          <span className="capitalize text-muted-foreground">{dayLabel.format(new Date(`${day.date}T12:00:00`))}</span>
          <span className="mx-1.5 text-[var(--line)]">·</span>
          <span className="text-[var(--brand)]">{day.contacted} {day.contacted > 1 ? 'appelées' : 'appelée'}</span>
          <span className="text-emerald-600"> · {day.responses} {day.responses > 1 ? 'réponses' : 'réponse'}</span>
        </div>
      ) : null}

      <div className="mt-1 flex justify-between border-t pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {[0, 10, 20, 29].map((i) => {
          const d = data[i];
          return d ? <span key={d.date}>{tick.format(new Date(`${d.date}T12:00:00`))}</span> : null;
        })}
      </div>
    </div>
  );
}
