/**
 * Le constat, mesuré.
 *
 * Cent carrés, cinquante-trois en corail. C'est la seule chose que cette
 * page a besoin de démontrer : un freelance ne se demande pas si la
 * prospection est pénible — il le sait — il se demande s'il reste du marché.
 * La réponse tient dans une proportion qu'on voit sans la lire.
 *
 * Les chiffres viennent des sites réellement analysés par le moteur. Ils
 * sont petits et le resteront un temps ; les gonfler serait facile et
 * ruinerait la seule chose que ce produit vend — qu'on peut le vérifier.
 */

/** Mesuré le 30 août 2026 sur les sites analysés à ce jour. */
const ANALYSED = 1572;
const ANALYSED_LABEL = '1 572';
const WITH_DEFECT = 828;
const SHARE = Math.round((WITH_DEFECT / ANALYSED) * 100);

const BREAKDOWN = [
  ['Le site ne s’ouvre pas', 31],
  ['Construit avant 2018, et ça se voit', 13],
  ['Plus de quatre secondes avant d’afficher', 9],
  ['Alerte de sécurité à l’arrivée', 8],
] as const;

export function Findings() {
  return (
    <div className="grid gap-14 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-20">
      <div>
        <p className="text-[clamp(1.75rem,3.6vw,2.875rem)] font-semibold leading-[1.1] tracking-[-0.04em]">
          Plus d’un site d’entreprise{' '}
          <span className="text-[var(--finding)]">sur deux</span> a un défaut que ses clients
          voient.
        </p>

        <div className="mt-10">
          {BREAKDOWN.map(([label, percent]) => (
            <div key={label} className="flex items-center gap-5 border-t py-3">
              <span className="flex-1 text-sm">{label}</span>
              <span className="tabular w-12 shrink-0 text-right font-mono text-sm text-muted-foreground">
                {percent} %
              </span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Mesuré sur {ANALYSED_LABEL} sites d’entreprises françaises analysés
          à ce jour, sur 4,6 millions d’adresses suivies. Un site peut cumuler plusieurs
          défauts.
        </p>
      </div>

      <Grid />
    </div>
  );
}

/**
 * Cent carrés pour cent sites.
 *
 * Le schéma dit la proportion avant que le texte ne la nomme, ce qui est
 * l'ordre dans lequel on lit une page. Décoratif au sens strict : le chiffre
 * est déjà écrit à côté, donc rien n'est perdu si l'image ne charge pas.
 */
function Grid() {
  return (
    <div className="mx-auto shrink-0" aria-hidden>
      <div className="grid w-64 grid-cols-10 gap-1.5">
        {Array.from({ length: 100 }).map((_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-[3px] ${
              i < SHARE ? 'bg-[var(--finding)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>
      <p className="mt-5 text-center font-mono text-[11px] text-muted-foreground">
        <span className="text-[var(--finding)]">{SHARE} sites sur 100</span> ont un défaut visible
      </p>
    </div>
  );
}
