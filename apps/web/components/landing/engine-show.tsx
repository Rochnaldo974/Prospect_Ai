'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * Le moteur, joué en boucle : c'est LA force du produit, montrée plutôt
 * que racontée. Trois temps, dans l'ordre réel du pipeline nocturne —
 * balayer le parc, filtrer au vérifiable, livrer le lot du matin.
 *
 * Les compteurs comptent sur le TEMPS ÉCOULÉ (leçon apprise : un compteur
 * à ticks s'arrête au premier re-rendu et affiche un chiffre faux sur la
 * seule chose que la page demande de croire). Sans animation, l'état final
 * s'affiche : c'est lui qui porte le message.
 */

const PHASES = ['scan', 'filter', 'deliver'] as const;
type Phase = (typeof PHASES)[number];

const DURATIONS: Record<Phase, number> = { scan: 2600, filter: 3200, deliver: 3400 };

/** Les nombres de la nuit type — l'échelle vraie du produit. */
const NIGHT = { scanned: 1214, defects: 631, approved: 5 };

export function EngineShow() {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState<Phase>('scan');

  const phase: Phase = reduced ? 'deliver' : step;
  const index = PHASES.indexOf(phase);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => {
      setStep(PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length] ?? 'scan');
    }, DURATIONS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.05),0_18px_50px_-18px_rgba(44,75,255,.22),0_36px_90px_-36px_rgba(11,13,20,.3)]">
      <figcaption className="flex items-center gap-2.5 border-b bg-[var(--mist)]/60 px-5 py-3.5">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-[var(--brand)] opacity-60 motion-safe:animate-ping [animation-duration:2s]" />
          <span className="relative inline-flex size-2 rounded-full bg-[var(--brand)]" />
        </span>
        <span className="field-label">
          {index === 0 ? 'Le moteur travaille' : index === 1 ? 'Il ne garde que le vérifiable' : 'Votre lot du matin'}
        </span>
        <span className="ml-auto font-mono text-[11px] tabular text-muted-foreground">
          cette nuit · 02:00 → 06:00
        </span>
      </figcaption>

      <div className="relative min-h-[21rem] p-5">
        {/* ── 1. Le balayage du parc ── */}
        <div className={index === 0 && !reduced ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}>
          <p className="field-label">Sites d’entreprises analysés</p>
          <p className="tabular mt-2 font-mono text-4xl font-semibold tracking-tight text-[var(--brand)]">
            <Counter target={NIGHT.scanned} active={phase === 'scan'} duration={2200} />
          </p>
          <div className="mt-5 space-y-2" aria-hidden>
            {['réponse du site', 'sécurité', 'âge des composants', 'lisibilité mobile', 'vitesse'].map((check, i) => (
              <div key={check} className="flex items-center gap-3">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                  <span
                    className="block h-full rounded-full bg-[var(--brand)]/60 motion-safe:animate-[sweep_1.4s_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                </span>
                <span className="w-36 font-mono text-[10px] text-muted-foreground">{check}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. L'entonnoir ── */}
        <div className={index === 1 ? 'opacity-100' : 'pointer-events-none absolute inset-5 opacity-0'}>
          <FunnelRow label="Analysés" value={NIGHT.scanned} max={NIGHT.scanned} color="var(--line)" textColor="var(--ink-2)" active={phase === 'filter'} delay={0} />
          <FunnelRow label="Défauts visibles trouvés" value={NIGHT.defects} max={NIGHT.scanned} color="var(--finding)" textColor="var(--finding)" active={phase === 'filter'} delay={500} />
          <FunnelRow label="Approuvés, pour vous" value={NIGHT.approved} max={NIGHT.scanned} color="var(--brand)" textColor="var(--brand)" active={phase === 'filter'} delay={1100} />
          <p className="mt-5 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
            Chaque dossier approuvé porte un défaut <span className="font-medium text-foreground">daté et vérifiable</span> —
            et correspond à ce que <span className="font-medium text-foreground">vous</span> savez faire.
          </p>
        </div>

        {/* ── 3. La livraison ── */}
        <div
          className={index === 2
            ? 'opacity-100 motion-safe:animate-[heroCard_.6s_cubic-bezier(.16,.84,.44,1)_both]'
            : 'pointer-events-none absolute inset-5 opacity-0'}
        >
          <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-wash)]/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tracking-tight">Restaurant · Angers</p>
              <span className="tabular grid size-10 place-items-center rounded-lg bg-[var(--brand)] font-mono text-[13px] font-medium text-white">
                91
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Le site ne répond plus — constaté cette nuit, vérifiable en une minute.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--brand)]">
                Refonte de site
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                📎 e-mail prêt à envoyer
              </span>
            </div>
          </div>

          {[2, 3].map((n) => (
            <div
              key={n}
              aria-hidden
              className="mt-2 rounded-xl border bg-card p-3 opacity-70 motion-safe:animate-[findingIn_.5s_ease-out_both]"
              style={{ animationDelay: `${(n - 1) * 0.35}s` }}
            >
              <div className="flex items-center justify-between">
                <span className="h-2 w-32 rounded-full bg-[var(--line)]" />
                <span className="tabular grid size-8 place-items-center rounded-lg bg-[var(--brand)]/25 font-mono text-[11px] text-[var(--brand)]">
                  {n === 2 ? 84 : 76}
                </span>
              </div>
            </div>
          ))}

          <p className="mt-4 text-center font-mono text-[11px] text-muted-foreground">
            + 2 autres · livrés à 8 h 00 dans votre tableau de bord
          </p>
        </div>
      </div>

      <div className="flex gap-1 px-5 pb-4" aria-hidden>
        {PHASES.map((p, i) => (
          <span
            key={p}
            className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
              i <= index ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>
    </figure>
  );
}

/** Compteur sur temps écoulé — jamais de ticks comptés. */
function Counter({ target, active, duration }: { target: number; active: boolean; duration: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - started) / duration);
      // Décélération : les derniers sites « tombent » un à un.
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return <>{(active ? value : target).toLocaleString('fr-FR')}</>;
}

function FunnelRow({
  label, value, max, color, textColor, active, delay,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  textColor: string;
  active: boolean;
  delay: number;
}) {
  const [grown, setGrown] = useState(false);

  // Toujours différé, même le retour à zéro : un setState synchrone dans un
  // effet déclenche des rendus en cascade, et le compilateur React le
  // refuse à raison.
  useEffect(() => {
    const timer = window.setTimeout(() => setGrown(active), active ? delay : 0);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  // Racine carrée : 5 sur 1 214 serait invisible en échelle linéaire, et
  // c'est justement la ligne qui compte.
  const width = Math.max(6, Math.sqrt(value / max) * 100);

  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm">{label}</span>
        <span className="tabular font-mono text-sm font-medium" style={{ color: textColor }}>
          {value.toLocaleString('fr-FR')}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--mist)]" aria-hidden>
        <div
          className="h-full origin-left rounded-full transition-transform duration-700 ease-[cubic-bezier(.22,.9,.32,1)]"
          style={{ width: `${width}%`, backgroundColor: color, transform: grown ? 'scaleX(1)' : 'scaleX(0)' }}
        />
      </div>
    </div>
  );
}
