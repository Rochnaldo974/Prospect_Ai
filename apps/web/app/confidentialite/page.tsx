import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Confidentialité — Prospect AI',
  description:
    'Quelles données Prospect AI traite, d’où elles viennent, ce qui n’est jamais collecté, et comment demander à ne plus être contacté.',
};

/**
 * Le régime de données, écrit noir sur blanc.
 *
 * Tout ce qui suit décrit ce que le code fait réellement : les sources sont
 * celles des adaptateurs, et l'absence de données nominatives est une
 * décision tenue jusque dans le stockage — les champs de contact nominatifs
 * du BOAMP, par exemple, sont lus puis jetés sans jamais être écrits.
 *
 * L'identité de l'éditeur et l'hébergeur restent à compléter : ce sont les
 * seules mentions que ce fichier ne peut pas connaître.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-mono text-sm font-medium tracking-tight">
            prospect<span className="text-[var(--brand)]">.ai</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Retour à l’accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="field-label">Confidentialité</p>
        <h1 className="mt-5 text-[clamp(2rem,3.6vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.04em]">
          Ce que le service sait, et ce qu’il ignore
        </h1>
        <p className="reasoning mt-6 text-muted-foreground">
          Prospect AI analyse des entreprises, pas des personnes. Cette page décrit le
          traitement réellement mis en œuvre, dans les mêmes termes que le produit.
        </p>

        <Part title="Les données d’entreprises">
          <p>
            Les entreprises proposées viennent de registres publics français : SIRENE pour
            l’identité et l’activité, BODACC pour les événements datés (créations, cessions,
            procédures collectives), l’AFNIC pour les noms de domaine en .fr et leur date de
            dépôt, le BOAMP pour les marchés publics ouverts. S’y ajoutent les mesures faites
            sur le site de l’entreprise lui-même : certificat, composants, temps de réponse,
            adaptation mobile.
          </p>
          <p>
            Le moyen de contact retenu est celui que l’entreprise publie elle-même : un numéro
            professionnel ou un formulaire public.
          </p>
        </Part>

        <Part title="Ce qui n’est jamais collecté">
          <p>
            Aucune donnée nominative de personne physique n’est stockée : ni nom, ni prénom,
            ni adresse e-mail individuelle, ni numéro personnel. Lorsqu’une source en publie
            — le BOAMP fournit par exemple un nom et un e-mail de contact — ces champs sont
            ignorés à l’import et ne sont écrits nulle part.
          </p>
        </Part>

        <Part title="Opposition">
          <p>
            Une entreprise qui demande à ne plus être contactée est retirée de toute la
            chaîne : elle n’est plus analysée, plus scorée, plus attribuée. La demande se fait
            par écrit à l’adresse de contact du service et prend effet sans délai.
          </p>
        </Part>

        <Part title="Vos données de compte">
          <p>
            Le compte conserve l’adresse e-mail d’inscription, les préférences de paramétrage
            (services proposés, secteurs exclus, zone) et l’historique des issues déclarées sur
            les opportunités reçues. Ces informations servent l’attribution quotidienne et rien
            d’autre : elles ne sont ni revendues, ni transmises à des tiers.
          </p>
        </Part>

        <Part title="Éditeur et hébergement">
          <p className="rounded-lg border border-dashed bg-[var(--mist)] p-4 text-sm">
            Mentions légales à compléter avant mise en ligne : dénomination sociale, forme
            juridique, siège, SIREN, directeur de la publication, et identité de l’hébergeur.
          </p>
        </Part>
      </main>
    </div>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t pt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
