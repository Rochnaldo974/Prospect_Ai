/**
 * La livraison du matin, telle qu'elle arrive.
 *
 * Quatre cartes détaillées puis un dossier complet racontaient deux fois la
 * même chose. La liste et le dossier disent maintenant deux choses
 * différentes : combien il y en a, et à quoi ressemble l'un d'eux. C'est
 * aussi l'ordre réel du produit — une liste de cinq, dont on ouvre une.
 *
 * Cinq lignes, pas quatre : le service en promet cinq par jour, et une
 * démonstration qui en montre quatre se contredit toute seule.
 *
 * Les défauts et les millésimes viennent de sites réellement analysés. Les
 * identités sont retirées : ces entreprises existent, n'ont rien demandé, et
 * la ville et le métier suffisent à rendre le cas concret.
 */

type Entry = {
  trade: string;
  city: string;
  finding: string;
  propose: string;
  score: number;
};

/**
 * Classées par score, comme elles arrivent dans le tableau de bord.
 *
 * Les scores sont ceux que le moteur peut réellement produire, pas des
 * chiffres flatteurs. Deux contraintes du barème s'imposent ici :
 *
 *   la famille « création de site » n'a pas de voie diagnostique — sans
 *   événement daté, elle ne crée AUCUNE opportunité. Une entreprise sans
 *   site n'apparaît donc qu'accompagnée de ce qui la date, ici sa création
 *   récente. C'était l'erreur de la version précédente : une pizzeria sans
 *   site notée 94, là où le moteur n'aurait rien produit du tout ;
 *
 *   un site lent ne pèse que 25 et ne franchit pas seul le minimum de 40.
 *   Il n'est retenu qu'accompagné.
 */
const ENTRIES: Entry[] = [
  {
    trade: 'Restaurant',
    city: 'Angers',
    finding: 'Le site ne s’ouvre plus — erreur 503',
    propose: 'Refonte de site',
    score: 89,
  },
  {
    trade: 'Pizzeria',
    city: 'Nantes',
    finding: 'Créée en juin, toujours aucun site',
    propose: 'Création de site',
    score: 76,
  },
  {
    trade: 'Menuiserie',
    city: 'Rennes',
    finding: 'Site construit en 2009, jamais repris depuis',
    propose: 'Refonte de site',
    score: 72,
  },
  {
    trade: 'Cabinet d’architectes',
    city: 'Angers',
    finding: 'Illisible sur téléphone : la page déborde de l’écran',
    propose: 'Refonte de site',
    score: 68,
  },
  {
    trade: 'Garage',
    city: 'Le Mans',
    finding: 'Huit secondes d’attente, et rien de neuf depuis 2016',
    propose: 'Refonte de site',
    score: 61,
  },
];

export function Feed() {
  return (
    <div className="mt-12 overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-4 border-b bg-[var(--white)] px-6 py-4">
        <p className="field-label">5 dossiers · classés par score</p>
        <p className="field-label hidden sm:block">Opportunité</p>
      </div>

      {ENTRIES.map((entry, i) => (
        <Row key={entry.trade + entry.city} entry={entry} index={i + 1} />
      ))}
    </div>
  );
}

function Row({ entry, index }: { entry: Entry; index: number }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b px-6 py-5 transition-colors last:border-b-0 hover:bg-[var(--mist)]">
      <span className="tabular w-6 shrink-0 font-mono text-[11px] text-muted-foreground">
        {String(index).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <p className="field-label">
          {entry.trade} · {entry.city}
        </p>
        <p className="mt-1.5 text-[15px] leading-snug">{entry.finding}</p>
      </div>

      <span className="shrink-0 text-sm font-medium text-[var(--brand)]">{entry.propose}</span>

      {/* Le score d'opportunité, le seul que le moteur produise : il monte
          quand le site va mal. Une « note du site » se lirait mieux et
          n'existerait nulle part dans le produit. */}
      <span className="tabular w-14 shrink-0 text-right font-mono text-sm">
        {entry.score}
        <span className="text-muted-foreground">/100</span>
      </span>
    </div>
  );
}
