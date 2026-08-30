import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';

export const metadata: Metadata = { title: 'Page introuvable' };

/**
 * L'adresse ne correspond à rien.
 *
 * Pas d'excuse, pas de « oups » : on dit ce qui s'est passé et on propose la
 * suite. Une page d'erreur qui plaisante fait perdre du temps à quelqu'un qui
 * cherche justement à en gagner.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-6">
      <div className="w-full">
        <p className="field-label">Erreur 404</p>
        <EmptyState
          title="Cette adresse ne mène nulle part"
          explanation="Le lien est peut-être ancien, ou la page a changé de nom. Tes opportunités du jour, elles, sont toujours au même endroit."
          action={{ href: '/dashboard', label: 'Aller à mes opportunités' }}
        />
      </div>
    </main>
  );
}
