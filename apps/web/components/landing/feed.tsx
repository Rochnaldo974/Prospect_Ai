import { Reveal } from '@/components/landing/reveal';

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

/**
 * La couleur porte deux informations, pas une humeur.
 *
 * La pastille de score se fonce à mesure que l'opportunité monte : le
 * classement se lit sans comparer cinq nombres. La prestation prend la
 * couleur de sa famille — bleu pour une refonte, vert pour une création —
 * de sorte qu'un lecteur voit d'un coup d'œil ce qu'il aurait à vendre.
 */
const FAMILY_COLOR: Record<string, string> = {
  'Refonte de site': 'var(--brand)',
  'Création de site': 'var(--success)',
};

export function Feed() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04),0_28px_64px_-32px_rgba(11,13,20,.2)]">
      <div className="flex items-center justify-between gap-4 border-b bg-[var(--brand)] px-5 py-4 text-white sm:px-6">
        <p className="field-label text-white">
          {ENTRIES.length} prospects · classés par opportunité
        </p>
        <p className="field-label hidden text-white/70 sm:block">Livrés à 8 h</p>
      </div>

      {/* Chaque ligne arrive séparément, comme si la liste se remplissait :
          c'est la seule animation de la section, et elle mime le produit. */}
      <div className="divide-y">
        {ENTRIES.map((entry, index) => (
          <Reveal key={entry.trade + entry.city} delay={index * 90}>
            <Row entry={entry} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function Row({ entry }: { entry: Entry }) {
  const color = FAMILY_COLOR[entry.propose] ?? 'var(--brand)';

  // De 60 à 90, l'opacité va de 0,55 à 1 : l'écart se voit sans écraser les
  // scores bas, qui restent de vraies opportunités.
  const intensity = Math.min(1, Math.max(0.55, (entry.score - 45) / 45));

  return (
    <div className="group flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition-colors hover:bg-[var(--mist)] sm:px-6">
      {/* Le score d'opportunité, le seul que le moteur produise : il monte
          quand le site va mal. */}
      <span
        className="tabular grid size-12 shrink-0 place-items-center rounded-xl font-mono text-sm font-medium text-white"
        style={{ backgroundColor: 'var(--brand)', opacity: intensity }}
      >
        {entry.score}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight">
          {entry.trade} <span className="font-normal text-muted-foreground">· {entry.city}</span>
        </p>
        <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{entry.finding}</p>
      </div>

      <span
        className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium"
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
      >
        {entry.propose}
      </span>

      <span
        aria-hidden
        className="hidden shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
      >
        →
      </span>
    </div>
  );
}
