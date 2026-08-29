import type { Explanation } from '@prospect/core';

/**
 * L'explication, telle que le freelance la recevra.
 *
 * C'est le produit. Une liste d'entreprises ne vaut rien — il en trouve autant
 * dans un annuaire ; ce qu'il ne peut pas produire seul, c'est la raison,
 * datée et vérifiable, pour laquelle celle-ci vaut un appel aujourd'hui.
 *
 * Affichée ici à côté de la décomposition du score, qui dit COMMENT le moteur
 * a tranché là où ce bloc dit CE QU'IL A VU. Les deux servent à juger la
 * qualité d'une opportunité, et se lisent mal l'un sans l'autre.
 */
export function OpportunityExplanation({ explanation }: { explanation: Explanation }) {
  return (
    <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-4 text-sm">
      <Block title="Pourquoi cette entreprise" body={explanation.why} />
      {/* Vide lorsque rien ne date le contact : le générateur ne fabrique
          jamais d'urgence, et l'absence de cette section est une information. */}
      {explanation.whyNow ? (
        <Block title="Pourquoi maintenant" body={explanation.whyNow} />
      ) : null}
      <Block title="Angle suggéré" body={explanation.angle} />

      {explanation.signals.length > 0 ? (
        <div>
          <Title>Ce qui a été constaté</Title>
          <ul className="mt-1 space-y-0.5">
            {explanation.signals.map((signal) => (
              <li key={signal} className="text-muted-foreground">— {signal}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {explanation.caveats.length > 0 ? (
        <div>
          <Title>À savoir</Title>
          <ul className="mt-1 space-y-0.5">
            {explanation.caveats.map((caveat) => (
              <li key={caveat} className="text-amber-700 dark:text-amber-500">⚠ {caveat}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <Title>{title}</Title>
      <p className="mt-1 leading-relaxed">{body}</p>
    </div>
  );
}
