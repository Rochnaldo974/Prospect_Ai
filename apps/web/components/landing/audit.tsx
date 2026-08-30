'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/use-reduced-motion';

/**
 * L'audit, joué en boucle sous les yeux du visiteur.
 *
 * C'est ce que le produit fait, montré plutôt que décrit : il ouvre le site
 * d'une entreprise, le note, liste ce qui cloche, et ne le retient que si les
 * défauts sont réels et l'entreprise joignable.
 *
 * Quatre temps, dans l'ordre où le moteur travaille vraiment. La boucle est
 * délibérée : personne ne regarde une animation une seule fois, et un visiteur
 * qui arrive en cours de séquence doit pouvoir la reprendre au début.
 *
 * Les chiffres sont ceux d'un vrai scan. Un score inventé serait plus flatteur
 * et vaudrait moins — tout le produit repose sur le fait qu'on peut vérifier.
 */

/**
 * Le score d'OPPORTUNITÉ, seul score que le moteur produise.
 *
 * Cette carte affichait une « note du site » sur 100. Elle se lisait bien et
 * n'existait nulle part dans le produit : un abonné ne l'aurait jamais vue.
 * Le moteur note l'opportunité, et cette note MONTE quand le site va mal —
 * d'où le bleu, alors que les défauts restent en corail.
 */
const SCORE = 84;

/**
 * Trois temps, pas quatre.
 *
 * Le score et les défauts formaient deux étapes séparées : pendant la
 * seconde et demie du score, la carte n'affichait qu'une ligne en haut d'un
 * bloc de trois cents pixels, et le vide sautait aux yeux à chaque boucle.
 * Ils tiennent en un seul temps — le score se compte pendant que les défauts
 * arrivent derrière lui, ce qui est d'ailleurs l'ordre réel : le score EST
 * la somme des défauts.
 */
const PHASES = ['scan', 'report', 'kept'] as const;
type Phase = (typeof PHASES)[number];

const DURATIONS: Record<Phase, number> = {
  scan: 2300,
  report: 3000,
  kept: 2800,
};

const CHECKS = [
  'Le site répond-il ?',
  'Est-il sécurisé ?',
  'Quel âge a-t-il ?',
  'Lisible sur téléphone ?',
  'En combien de temps s’affiche-t-il ?',
];

const ISSUES = [
  { label: 'Illisible sur téléphone', detail: 'la page dépasse de l’écran', level: 'grave' },
  { label: 'Alerte de sécurité à l’arrivée', detail: 'depuis le 25 octobre 2025', level: 'grave' },
  { label: 'Quatre secondes avant d’afficher', detail: '4,2 s mesurées', level: 'moyen' },
] as const;

export function SiteAudit() {
  const [step, setStep] = useState<Phase>('scan');
  const reduced = usePrefersReducedMotion();

  // Sans animation, on montre l'état FINAL : c'est lui qui porte le message.
  // Une séquence figée sur sa première image ne dirait rien.
  const phase: Phase = reduced ? 'kept' : step;

  useEffect(() => {
    if (reduced) return;

    const timer = window.setTimeout(() => {
      const next = PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length];
      setStep(next ?? 'scan');
    }, DURATIONS[phase]);

    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  const index = PHASES.indexOf(phase);

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.05),0_18px_50px_-18px_rgba(44,75,255,.22),0_36px_90px_-36px_rgba(11,13,20,.3)]">
      {/* Le châssis du navigateur : trois pastilles, puis l'adresse. La
          fenêtre doit se lire comme un outil ouvert, pas comme une carte. */}
      <figcaption className="flex items-center gap-2.5 border-b bg-[var(--mist)]/60 px-5 py-3.5">
        <span aria-hidden className="mr-1 flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--line)]" />
          <span className="size-2.5 rounded-full bg-[var(--line)]" />
          <span className="size-2.5 rounded-full bg-[var(--line)]" />
        </span>
        <span
          aria-hidden
          className={`size-1.5 rounded-full transition-colors duration-300 ${
            index >= 2 ? 'bg-[var(--brand)]' : 'bg-[var(--finding)]'
          } ${index === 0 && !reduced ? 'motion-safe:animate-[pulseDot_1.2s_ease-in-out_infinite]' : ''}`}
        />
        <span className="field-label">
          {index === 0 ? 'Analyse en cours' : index === 2 ? 'Prospect retenu' : 'Analyse terminée'}
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          boulangerie-••••••.fr
        </span>
      </figcaption>

      {/* Hauteur fixée sur l'état le plus haut : la carte ne doit pas
          grandir d'un temps à l'autre, sinon toute la page saute en boucle. */}
      <div className="relative min-h-[21.5rem] p-5">
        <Scan active={phase === 'scan'} />
        <Score active={index >= 1} />
        <Issues visible={index >= 1} />
        <Kept visible={index >= 2} />
      </div>

      {/* Progression de la séquence : quatre segments, un par temps. Il sert
          aussi de repère à qui arrive en cours de route. */}
      <div className="flex gap-1 px-5 pb-4" aria-hidden>
        {PHASES.map((step, i) => (
          <span
            key={step}
            className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
              i <= index ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>
    </figure>
  );
}

function Scan({ active }: { active: boolean }) {
  return (
    <div
      className={`absolute inset-5 transition-opacity duration-500 ${
        active ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {CHECKS.map((check, i) => (
        <div
          key={check}
          className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
          style={{
            opacity: active ? undefined : 0,
            animation: active
              ? `findingIn .35s cubic-bezier(.2,.7,.3,1) ${i * 0.28}s both`
              : undefined,
          }}
        >
          <span className="font-mono text-[11px] text-[var(--brand)]">OK</span>
          <span className="text-sm">{check}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Le score.
 *
 * Bas, et c'est le sujet : un site en bon état n'est pas une opportunité. La
 * couleur suit donc l'inverse de l'intuition — le corail signale un site en
 * difficulté, donc un prospect qui vaut un appel.
 */
function Score({ active }: { active: boolean }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    // Compté sur le TEMPS ÉCOULÉ, pas sur un nombre d'itérations.
    //
    // La première version incrémentait un compteur à chaque tick d'intervalle.
    // Il suffisait qu'un rendu interrompe l'effet pour que la séquence
    // reprenne à zéro et s'arrête en chemin : le score affichait 17 au lieu
    // de 42, c'est-à-dire un chiffre faux sur la seule chose que ce produit
    // demande qu'on croie. Le temps, lui, ne se réinitialise pas.
    const started = performance.now();
    let raf = 0;

    const tick = () => {
      const progress = Math.min(1, (performance.now() - started) / 600);
      setValue(Math.round(SCORE * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div
      className={`flex items-center gap-5 transition-all duration-500 ${
        active ? 'opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
      }`}
    >
      <div className="relative grid size-20 shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute size-20 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.5" fill="none"
            stroke="var(--brand)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 97.4} 97.4`}
            style={{ transition: 'stroke-dasharray .1s linear' }}
          />
        </svg>
        <span className="tabular text-2xl font-semibold tracking-tight text-[var(--brand)]">
          {value}
        </span>
      </div>

      <div>
        <p className="field-label">Opportunité</p>
        <p className="mt-1 text-sm leading-snug">
          <span className="tabular font-medium">{value}/100</span> — trois défauts visibles par
          ses clients.
        </p>
      </div>
    </div>
  );
}

function Issues({ visible }: { visible: boolean }) {
  return (
    <div
      className={`mt-5 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {ISSUES.map((issue, i) => (
        <div
          key={issue.label}
          className="flex items-start gap-3 border-t py-2.5"
          style={{
            animation: visible
              ? `findingIn .4s cubic-bezier(.2,.7,.3,1) ${0.55 + i * 0.22}s both`
              : undefined,
          }}
        >
          <span
            aria-hidden
            className={`mt-[7px] size-1.5 shrink-0 rounded-full ${
              issue.level === 'grave' ? 'bg-[var(--finding)]' : 'bg-[var(--ink-2)]'
            }`}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-snug">{issue.label}</span>
            <span className="block font-mono text-[11px] text-muted-foreground">
              {issue.detail}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Kept({ visible }: { visible: boolean }) {
  return (
    <div
      className={`mt-4 rounded-xl border border-[var(--brand)] bg-[var(--brand-wash)] p-4 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--brand)]">
        <span aria-hidden>✓</span> Retenu pour vous
      </p>
      <p className="mt-1.5 font-mono text-xs text-[var(--brand)]/80">
        02 •• •• •• •• · exclusif 72 h
      </p>
    </div>
  );
}
