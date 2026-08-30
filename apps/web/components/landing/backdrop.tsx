/**
 * Le fond du héros : le parc, et ce qui s'y allume.
 *
 * Une grille de points fins — chaque point est un site surveillé — dont une
 * poignée pulse en corail : les défauts que le moteur trouve dedans. C'est la
 * thèse du produit rendue en décor, et c'est la seule décoration de la page
 * qui ne soit pas au service direct d'un contenu : elle a donc l'obligation
 * de dire quelque chose de vrai.
 *
 * Les positions des braises sont écrites en dur : un Math.random() au rendu
 * ferait diverger serveur et client, et un motif qui change à chaque visite
 * n'apporte rien qu'une graine fixe n'apporte déjà.
 *
 * Tout est aria-hidden : pour un lecteur d'écran, ce fond n'existe pas.
 */

const EMBERS: Array<{ x: number; y: number; delay: number }> = [
  { x: 12, y: 22, delay: 0 },
  { x: 28, y: 64, delay: 1.6 },
  { x: 45, y: 14, delay: 3.1 },
  { x: 58, y: 78, delay: 0.9 },
  { x: 67, y: 36, delay: 2.4 },
  { x: 81, y: 58, delay: 4.0 },
  { x: 90, y: 18, delay: 1.2 },
  { x: 21, y: 88, delay: 3.6 },
];

export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* La grille, fondue sur les bords : elle situe sans jamais concurrencer
          le texte qui passe dessus. */}
      <div
        className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_38%,black_35%,transparent_78%)]"
        style={{
          backgroundImage: 'radial-gradient(var(--line) 1.1px, transparent 1.1px)',
          backgroundSize: '26px 26px',
        }}
      />

      {/* Deux nappes très diluées : le bleu derrière la fenêtre produit, à
          droite ; un souffle corail à gauche. Le blanc reste blanc. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(38% 42% at 76% 30%, color-mix(in srgb, var(--brand) 7%, transparent), transparent 70%),' +
            'radial-gradient(30% 36% at 12% 70%, color-mix(in srgb, var(--finding) 4%, transparent), transparent 70%)',
        }}
      />

      {EMBERS.map((ember) => (
        <span
          key={`${ember.x}-${ember.y}`}
          className="absolute size-[5px] rounded-full bg-[var(--finding)] motion-safe:animate-[emberPulse_5.5s_ease-in-out_infinite]"
          style={{
            left: `${ember.x}%`,
            top: `${ember.y}%`,
            animationDelay: `${ember.delay}s`,
            opacity: 0.15,
          }}
        />
      ))}
    </div>
  );
}
