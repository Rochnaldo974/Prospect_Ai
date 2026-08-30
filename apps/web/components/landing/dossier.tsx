import { Reveal } from '@/components/landing/reveal';

/**
 * Le dossier, grandeur nature.
 *
 * La capture produit est le mécanisme de preuve le plus systématique des
 * pages qui convertissent : elle montre ce qu'on achète au lieu de le décrire.
 * Celle-ci n'est pas une maquette — c'est la mise en page exacte du tableau de
 * bord, avec les données d'un scan réel sur un commerce d'Angers.
 *
 * L'ordre de lecture est celui du produit et il porte l'argument : POURQUOI
 * cette entreprise, puis POURQUOI MAINTENANT, et le téléphone seulement à la
 * fin. Un numéro en tête ferait de la page un annuaire.
 */
export function DossierPreview() {
  return (
    <Reveal>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(11,13,20,.04),0_32px_80px_-32px_rgba(11,13,20,.28)]">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b px-6 py-5 sm:px-8">
          <div>
            <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">SAKURA</h3>
            <p className="mt-1 text-sm text-muted-foreground">Restaurant · Angers</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="field-label rounded-full border px-2.5 py-1">Refonte de site</span>
            <span className="tabular rounded-full border border-[var(--brand)]/25 bg-[var(--brand-wash)] px-2.5 py-1 font-mono text-[11px] text-[var(--brand)]">
              89/100
            </span>
          </div>
        </header>

        <div className="grid gap-x-10 gap-y-8 px-6 py-7 sm:px-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-7">
            <Part title="Pourquoi cette entreprise">
              SAKURA, restaurant à Angers. Le site ne répond pas (erreur HTTP 503). Certificat
              auto-signé : les navigateurs le refusent et avertissent le visiteur. Ces éléments
              rendent une proposition de refonte pertinente. Ils ne disent pas que l’entreprise a
              formulé ce besoin.
            </Part>

            <Part title="Pourquoi maintenant">
              À deux passages successifs, l’adresse que l’entreprise donne pour site n’a pas
              répondu. Nous ne savons pas depuis quand. Ce que ses clients rencontrent
              aujourd’hui en la cherchant, en revanche, se vérifie en une minute.
            </Part>

            <Part title="Par quoi commencer">
              Proposer un audit court centré sur la remise en ligne du site. Un constat
              vérifiable ouvre mieux la conversation qu’un jugement esthétique.
            </Part>
          </div>

          <div className="space-y-6">
            <section>
              <p className="field-label">Ce qui a été constaté</p>
              <div className="mt-2">
                {[
                  'Le site ne répond pas (erreur HTTP 503)',
                  'Certificat auto-signé : refusé par les navigateurs',
                  'Nom de domaine déposé il y a 14 ans',
                ].map((fact, i) => (
                  <p key={fact} className="evidence">
                    <span className="evidence__mark" aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="evidence__fact">{fact}</span>
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-[var(--finding-wash)] p-4">
              <p className="field-label" style={{ color: 'var(--finding)' }}>
                À savoir avant d’appeler
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--finding)]">
                Informations partielles : à vérifier avant de contacter.
              </p>
            </section>

            <section className="border-t pt-5">
              <p className="font-mono text-base tracking-tight">02 41 88 81 98</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Exclusif pendant 72 h · sakura-angers.fr
              </p>
            </section>
          </div>
        </div>

        {/* La boucle de retour fait partie du produit : la montrer dit que le
            service ne s'arrête pas à la livraison du contact. */}
        <footer className="flex flex-wrap items-center gap-2 border-t bg-[var(--mist)] px-6 py-4 sm:px-8">
          <span className="field-label mr-2">Après l’appel</span>
          {['Pas de réponse', 'Pas intéressé', 'Intéressé', 'Rendez-vous', 'Devis', 'Client'].map(
            (label) => (
              <span
                key={label}
                className="rounded-full border bg-[var(--white)] px-3 py-1.5 text-xs"
              >
                {label}
              </span>
            ),
          )}
        </footer>
      </div>
    </Reveal>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="field-label">{title}</p>
      <p className="reasoning mt-2 text-[0.9375rem]">{children}</p>
    </section>
  );
}
