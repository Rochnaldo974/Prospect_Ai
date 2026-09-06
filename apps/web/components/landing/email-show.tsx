'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * L'e-mail personnalisé, joué : l'intention change, le texte suit, ça part.
 *
 * La séquence montre exactement le geste du produit — choisir ce qu'on
 * propose, relire un texte qui parle du PROSPECT, envoyer sous son propre
 * nom avec sa signature. Trois intentions puis l'envoi, en boucle.
 */

const INTENTS = [
  { label: 'Proposer un appel', line: 'Est-ce un sujet dont vous aimeriez parler dix minutes cette semaine ?' },
  { label: 'Offrir un audit', line: 'Je peux vous envoyer un court audit — trois constats vérifiables, gratuitement.' },
  { label: 'Me présenter', line: 'Je suis développeur web indépendant — mon CV est joint à ce message.' },
] as const;

export function EmailShow() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  // 0,1,2 : les intentions · 3 : envoyé.
  const step = reduced ? 3 : tick % 4;
  const intent = INTENTS[Math.min(step, 2)]!;

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setTick((t) => t + 1), step === 3 ? 2600 : 2100);
    return () => window.clearTimeout(timer);
  }, [step, reduced]);

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04),0_28px_64px_-32px_rgba(11,13,20,.22)]">
      <figcaption className="flex items-center justify-between gap-4 border-b bg-[var(--mist)]/60 px-5 py-3.5">
        <span className="field-label">E-mail à Restaurant · Angers</span>
        <span className="font-mono text-[11px] text-muted-foreground">contact@…</span>
      </figcaption>

      <div className="relative min-h-[17rem] p-5">
        {step === 3 ? (
          <div className="grid min-h-[15rem] place-items-center motion-safe:animate-[heroCard_.5s_cubic-bezier(.16,.84,.44,1)_both]">
            <div className="text-center">
              <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--brand)] text-xl text-white">
                ✓
              </span>
              <p className="mt-3 font-medium">Envoyé sous votre nom</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La réponse arrivera dans votre boîte mail.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" aria-hidden>
              {INTENTS.map(({ label }, i) => (
                <span
                  key={label}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition-all duration-300 ${
                    i === step
                      ? 'border-[var(--brand)] bg-[var(--brand-wash)] font-medium text-[var(--brand)]'
                      : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2.5 text-sm leading-relaxed">
              <p>Bonjour,</p>
              <p className="text-muted-foreground">
                En préparant une étude sur les sites d’Angers, j’ai remarqué un point concernant
                votre restaurant : <span className="text-foreground">le site ne répond plus</span>.
              </p>
              {/* La ligne qui change avec l'intention. */}
              <p
                key={step}
                className="rounded-lg bg-[var(--brand-wash)]/70 px-3 py-2 text-[var(--brand)] motion-safe:animate-[findingIn_.4s_ease-out_both]"
              >
                {intent.line}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t pt-3.5">
              <span className="flex items-center gap-2.5" aria-hidden>
                <span className="h-7 w-12 rounded bg-[var(--brand)]/85" />
                <span>
                  <span className="block text-[13px] font-semibold leading-tight">Vous</span>
                  <span className="block text-[11px] text-muted-foreground">votre métier · votre logo</span>
                </span>
              </span>
              <span className="rounded-full bg-[var(--brand)] px-4 py-2 text-[13px] font-medium text-white">
                Envoyer
              </span>
            </div>
          </>
        )}
      </div>
    </figure>
  );
}
