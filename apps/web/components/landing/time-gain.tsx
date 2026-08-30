/**
 * Le temps repris, en deux blocs.
 *
 * Une première version détaillait la semaine tâche par tâche : six lignes,
 * des durées à la minute, et un lecteur noyé. Il n'y a qu'une chose à
 * comprendre, et elle tient dans la longueur de deux barres.
 *
 * Les durées sont annoncées pour ce qu'elles sont — un ordre de grandeur,
 * pas une mesure. Ce produit vend le fait qu'on peut le vérifier ; un
 * chiffre inventé et présenté comme mesuré coûterait plus qu'il ne rapporte.
 */

const BEFORE_HOURS = 8;
const AFTER_HOURS = 1;

export function TimeGain() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Block
        eyebrow="Aujourd’hui"
        hours={BEFORE_HOURS}
        label="par semaine à chercher qui appeler, ouvrir les sites, retrouver un numéro."
        width="100%"
        tone="before"
      />
      <Block
        eyebrow="Avec Prospect AI"
        hours={AFTER_HOURS}
        label="par semaine : lire cinq dossiers le matin, et décrocher."
        width={`${(AFTER_HOURS / BEFORE_HOURS) * 100}%`}
        tone="after"
      />
    </div>
  );
}

function Block({
  eyebrow, hours, label, width, tone,
}: {
  eyebrow: string;
  hours: number;
  label: string;
  width: string;
  tone: 'before' | 'after';
}) {
  const after = tone === 'after';

  return (
    <div
      className={`rounded-2xl p-7 ${
        after
          ? 'bg-[var(--brand)] text-white'
          : 'border border-[var(--finding)]/20 bg-[var(--finding-wash)]'
      }`}
    >
      <p className={`field-label ${after ? 'text-white/70' : ''}`} style={after ? undefined : { color: 'var(--finding)' }}>
        {eyebrow}
      </p>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="tabular text-5xl font-semibold tracking-tight">{hours} h</span>
      </p>

      <p className={`mt-2 max-w-xs text-sm leading-relaxed ${after ? 'text-white/80' : 'text-muted-foreground'}`}>
        {label}
      </p>

      {/* Les deux barres partagent la même échelle : c'est le rapport entre
          elles qui porte l'argument, pas leur longueur absolue. */}
      <div
        className={`mt-6 h-2.5 overflow-hidden rounded-full ${after ? 'bg-white/25' : 'bg-[var(--finding)]/15'}`}
        aria-hidden
      >
        <div
          className={`h-full rounded-full ${after ? 'bg-white' : 'bg-[var(--finding)]'}`}
          style={{ width }}
        />
      </div>
    </div>
  );
}
