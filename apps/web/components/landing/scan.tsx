'use client';

/**
 * Le scan, joué sous les yeux du visiteur.
 *
 * C'est la chose la plus caractéristique du produit : il ouvre le site d'une
 * entreprise, lit son code, et en tire des faits datés. Le décrire en une
 * phrase serait moins convaincant que de le montrer en train de le faire.
 *
 * Les constats arrivent dans l'ordre où le moteur les établit — résolution,
 * certificat, composants — puis la conclusion s'affiche. Ce ne sont pas des
 * données inventées pour la démonstration : ce sont celles d'un vrai scan sur
 * un commerce d'Angers, et elles se vérifient encore aujourd'hui.
 *
 * L'animation est décorative au sens strict : la page est complète et lisible
 * sans elle, et prefers-reduced-motion la neutralise entièrement.
 */

/** `flag` marque un défaut relevé, par opposition à une simple observation. */
const STEPS: { at: number; label: string; value: string; flag?: boolean }[] = [
  { at: 0.0, label: 'GET', value: 'linsolent.fr — 200' },
  { at: 0.5, label: 'TLS', value: 'certificat expiré le 25 octobre 2025', flag: true },
  { at: 1.1, label: 'HTTP', value: 'servi sans chiffrement', flag: true },
  { at: 1.7, label: 'DOM', value: 'aucun formulaire de contact', flag: true },
  { at: 2.3, label: 'LEGAL', value: 'SIREN lu dans les mentions légales' },
];

export function ScanDemo() {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04),0_16px_48px_-16px_rgba(11,13,20,.16)]">
      <figcaption className="flex items-center gap-2.5 border-b px-5 py-3">
        <span
          className="size-1.5 rounded-full bg-[var(--brand)] motion-safe:animate-[pulseDot_1.4s_ease-in-out_infinite]"
          aria-hidden
        />
        <span className="field-label">Relevé</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          prêt-à-porter · Angers
        </span>
      </figcaption>

      <div className="px-5 py-1">
        {STEPS.map((step) => (
          <div
            key={step.label}
            className="flex items-baseline gap-4 border-b py-2.5 last:border-b-0 motion-safe:animate-[findingIn_.45s_cubic-bezier(.2,.7,.3,1)_both]"
            style={{ animationDelay: `${step.at + 0.3}s` }}
          >
            <span
              className={`w-12 shrink-0 font-mono text-[11px] ${
                step.flag ? 'text-[var(--finding)]' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
            <span className="text-sm leading-snug">{step.value}</span>
          </div>
        ))}
      </div>

      <div
        className="border-t bg-[var(--mist)] px-5 py-4 motion-safe:animate-[findingIn_.5s_cubic-bezier(.2,.7,.3,1)_both]"
        style={{ animationDelay: '3.1s' }}
      >
        <p className="field-label">Ce qu’on en conclut</p>
        <p className="mt-1.5 text-sm leading-relaxed">
          Trois défauts vérifiables, dont un daté. Ce que ses clients rencontrent aujourd’hui se
          contrôle en ouvrant l’adresse —{' '}
          <span className="text-muted-foreground">
            mais rien ici ne dit que l’entreprise cherche un prestataire, et le produit ne le
            prétendra pas.
          </span>
        </p>
      </div>
    </figure>
  );
}
