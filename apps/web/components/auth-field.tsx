/**
 * Un champ d'authentification.
 *
 * L'intitulé est en petites capitales monospace, comme les étiquettes de marge
 * du reste du produit : l'écran d'entrée doit ressembler à ce qu'il ouvre.
 */
export function Field({
  id,
  label,
  type,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="field-label block">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-11 w-full rounded-lg border bg-card px-3.5 text-sm transition-colors duration-150 focus-visible:border-[var(--brand)]"
      />
    </div>
  );
}
