/**
 * Une lumière d'ambiance : un disque coloré très flouté, posé derrière le
 * contenu d'une section.
 *
 * C'est ce qui donne de la profondeur à une page claire sans toucher à sa
 * lisibilité — le blanc reste blanc, mais l'espace cesse d'être plat. La
 * section hôte doit être `relative` et `overflow-hidden` : un halo qui
 * déborde crée un défilement horizontal fantôme en mobile.
 *
 * Deux teintes seulement, celles du produit : le bleu (ce qu'il fait) et
 * le corail (ce qu'il trouve), toujours sous dix pour cent d'opacité.
 */
const TINTS = {
  brand: 'rgba(44, 75, 255, 0.14)',
  finding: 'rgba(255, 78, 58, 0.09)',
} as const;

export function Glow({
  tint = 'brand',
  className = '',
}: {
  tint?: keyof typeof TINTS;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[110px] ${className}`}
      style={{ backgroundColor: TINTS[tint] }}
    />
  );
}
