'use client';

import { Button } from '@/components/ui/button';

/**
 * L'ossature commune d'une étape.
 *
 * La question est un titre, pas une étiquette de champ : elle occupe la place
 * qu'occuperait un titre de page, parce que c'est bien la seule chose qu'on
 * demande sur cet écran. La ligne d'aide dit ce que la réponse CHANGE — un
 * formulaire qui demande sans expliquer se remplit au hasard.
 */
export function Step({
  question,
  help,
  children,
  problem,
  pending,
  submitLabel,
  back,
}: {
  question: string;
  help: string;
  children: React.ReactNode;
  problem?: string | undefined;
  pending: boolean;
  submitLabel: string;
  back?: string | undefined;
}) {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl leading-[1.1] tracking-tight">{question}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {help}
        </p>
      </header>

      {children}

      {problem ? (
        <p role="alert" className="mt-6 text-sm text-destructive">{problem}</p>
      ) : null}

      <div className="mt-10 flex items-center gap-4 border-t pt-6">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? 'Enregistrement…' : submitLabel}
        </Button>
        {back ? (
          <a href={back} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Revenir
          </a>
        ) : null}
      </div>
    </>
  );
}

/**
 * Une case à cocher qui occupe toute sa ligne.
 *
 * Rectangle cliquable large, cible tactile confortable, et un filet qui passe
 * au vert de validation quand l'option est retenue : l'état se lit sans avoir
 * à chercher la petite case.
 */
export function Choice({
  name,
  value,
  type = 'checkbox',
  defaultChecked,
  checked,
  onChange,
  title,
  note,
}: {
  name: string;
  value: string;
  type?: 'checkbox' | 'radio';
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: () => void;
  title: string;
  note?: React.ReactNode;
}) {
  return (
    <label
      className="group flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 transition-colors duration-150 hover:border-[var(--brand)] has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--accent)]"
    >
      <input
        type={type}
        name={name}
        value={value}
        {...(checked !== undefined ? { checked, onChange: onChange ?? (() => {}) } : {})}
        {...(defaultChecked !== undefined ? { defaultChecked } : {})}
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug">{title}</span>
        {note ? <span className="mt-1 block text-xs leading-relaxed">{note}</span> : null}
      </span>
    </label>
  );
}
