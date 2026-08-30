/**
 * Quatre cas, tels qu'ils sortent du moteur.
 *
 * Un pourcentage se comprend, un cas se reconnaît. « 53 % des sites ont un
 * défaut » demande un effort de projection ; « ce restaurant n'a pas de site
 * du tout » est immédiatement une facture que le lecteur sait établir.
 *
 * Les défauts, les scores et les millésimes sont ceux de sites réellement
 * analysés. Les identités, elles, sont retirées : ces entreprises existent,
 * n'ont rien demandé, et publier « le site de untel est en panne » sur une
 * page commerciale leur nuirait sans rien ajouter à la démonstration. La
 * ville et le métier suffisent à rendre le cas concret.
 */

type Example = {
  trade: string;
  city: string;
  score: number | null;
  finding: string;
  detail: string;
  propose: string;
};

const EXAMPLES: Example[] = [
  {
    trade: 'Pizzeria',
    city: 'Nantes',
    score: null,
    finding: 'Aucun site web',
    detail:
      'Une page sur un annuaire, un numéro, et rien d’autre. Ses clients la trouvent par hasard ou pas du tout.',
    propose: 'Création de site',
  },
  {
    trade: 'Menuiserie',
    city: 'Rennes',
    score: 39,
    finding: 'Un site de 2009',
    detail:
      'Les outils qui font tourner la page datent de 2009. Seize ans d’écart avec ce que ses concurrents affichent.',
    propose: 'Refonte de site',
  },
  {
    trade: 'Cabinet d’architectes',
    city: 'Angers',
    score: 46,
    finding: 'Illisible sur téléphone',
    detail:
      'La page déborde de l’écran : il faut pincer et faire glisser pour lire une ligne. C’est là qu’arrivent ses clients.',
    propose: 'Refonte de site',
  },
  {
    trade: 'Restaurant',
    city: 'Angers',
    score: 12,
    finding: 'Le site ne s’ouvre plus',
    detail:
      'Erreur 503 à deux passages successifs. Ni carte, ni horaires, ni réservation — pour qui le cherche aujourd’hui.',
    propose: 'Remise en ligne',
  },
];

export function Examples() {
  return (
    <div className="mt-14 grid gap-5 md:grid-cols-2">
      {EXAMPLES.map((example) => (
        <Card key={example.finding} {...example} />
      ))}
    </div>
  );
}

function Card({ trade, city, score, finding, detail, propose }: Example) {
  return (
    <article className="flex flex-col rounded-2xl border bg-card p-7">
      <div className="flex items-start justify-between gap-4">
        <p className="field-label">
          {trade} · {city}
        </p>
        <Score value={score} />
      </div>

      <h3 className="mt-6 text-xl font-semibold tracking-tight">{finding}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{detail}</p>

      <div className="mt-auto flex items-center gap-3 border-t pt-5 text-sm">
        <span className="field-label">À proposer</span>
        <span className="font-medium text-[var(--brand)]">{propose}</span>
      </div>
    </article>
  );
}

/**
 * La note du site, quand il y en a un.
 *
 * Elle est basse et c'est le sujet : un site en bon état n'est pas une
 * opportunité. La couleur suit donc l'inverse de l'intuition. Le mot
 * « site » précède le nombre pour lever une confusion coûteuse — le produit
 * manipule aussi un score d'opportunité, qui monte quand celui-ci descend,
 * et un site en panne noté 89 se lirait comme un site en bonne santé.
 *
 * Sans site à noter, la case reste vide plutôt que de porter un zéro : un
 * zéro serait un jugement, l'absence est un fait.
 */
function Score({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="shrink-0 rounded-full border border-dashed px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
        pas de site
      </span>
    );
  }

  return (
    <span className="tabular shrink-0 rounded-full border border-[var(--finding)]/25 bg-[var(--finding-wash)] px-2.5 py-1 font-mono text-[11px] text-[var(--finding)]">
      site {value}/100
    </span>
  );
}
