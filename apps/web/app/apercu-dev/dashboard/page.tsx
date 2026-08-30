import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { FollowUp, OutcomeStats } from '@prospect/core';
import type { DailyOpportunity } from '@/lib/opportunities/mine';
import { DashboardNav } from '@/components/dashboard/nav';
import { OpportunityRow } from '@/components/dashboard/opportunity-row';
import { FollowUpForm } from '@/components/dashboard/follow-up-form';

/**
 * Aperçu du tableau de bord, hors session — développement uniquement.
 *
 * Vérifier un rendu ne doit dépendre ni d'un compte ni de l'état du stock :
 * cette page rend les mêmes composants que les deux écrans réels, avec des
 * données de fixture qui couvrent les cas d'affichage — dossier ouvert,
 * dossier déjà appelé, exclusivité sous douze heures, relance qui dort
 * depuis trois semaines.
 *
 * Elle n'existe pas en production : le garde renvoie 404 avant tout rendu.
 * Aucune donnée réelle ne transite ici — c'est aussi pour ça que les
 * fixtures sont des entreprises inventées, pas des extraits de la base.
 */
export default function DashboardPreview() {
  if (process.env.NODE_ENV === 'production') notFound();

  const opportunities = fixtures();
  const done = opportunities.filter((o) => o.contactedAt !== null).length;

  return (
    <div className="min-h-dvh bg-[var(--mist)]">
      <header className="sticky top-0 z-30 border-b bg-[var(--white)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-3.5">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold tracking-[-0.03em]">
              prospect<span className="text-[var(--brand)]">.ai</span>
            </span>
            <DashboardNav />
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <span>Préférences</span>
            <span>Déconnexion</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-8 rounded-lg border border-dashed bg-card px-4 py-2 font-mono text-[11px] text-muted-foreground">
          Aperçu de développement · données de fixture · /apercu-dev/dashboard
        </p>

        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Bonjour Paul</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">
              {opportunities.length} entreprises vous attendent
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {opportunities.map((o, i) => (
                <span
                  key={o.assignmentId}
                  className={`size-2.5 rounded-full ${
                    i < done ? 'bg-[var(--brand)]' : 'border border-[var(--line)] bg-[var(--white)]'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{done} sur {opportunities.length} appelées</p>
          </div>
        </header>

        <div className="mt-8 space-y-3">
          {opportunities.map((opportunity, index) => (
            <OpportunityRow
              key={opportunity.assignmentId}
              opportunity={opportunity}
              open={index === 1}
            />
          ))}
        </div>

        <Link
          href="#suivi"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-5"
        >
          <div>
            <p className="text-sm font-medium">2 entreprises attendent une relance</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Intéressées, en rendez-vous ou en attente de devis.
            </p>
          </div>
          <span aria-hidden className="text-muted-foreground">→</span>
        </Link>

        {/* ── L'écran de suivi, en dessous pour l'aperçu ── */}
        <div id="suivi" className="mt-16 border-t pt-12">
          <h2 className="text-3xl font-semibold tracking-[-0.035em]">À relancer</h2>

          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-[var(--line)] sm:grid-cols-5">
            {statCells().map(([label, value]) => (
              <div key={label} className="bg-card px-5 py-5 last:col-span-2 sm:last:col-span-1">
                <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
                <p className="field-label mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            {followUps().map((followUp) => (
              <article key={followUp.assignmentId} className="rounded-2xl border bg-card px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <span className="shrink-0 rounded-full bg-[var(--brand-wash)] px-3 py-1.5 text-[13px] font-medium text-[var(--brand)]">
                    {followUp.outcome === 'interested' ? 'Intéressé' : followUp.outcome === 'meeting' ? 'Rendez-vous' : 'Devis envoyé'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight">
                      {followUp.company.name}
                      <span className="font-normal text-muted-foreground"> · {followUp.company.city}</span>
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-[11px]"
                    style={{ color: followUp.daysSince >= 21 ? 'var(--finding)' : 'var(--ink-2)' }}
                  >
                    il y a {followUp.daysSince} j
                  </span>
                </div>
                <div className="mt-4 border-t pt-4">
                  <FollowUpForm assignmentId={followUp.assignmentId} current={followUp.outcome} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function fixtures(): DailyOpportunity[] {
  const base = {
    rank: 1,
    viewedAt: null,
    exclusiveUntil: '2026-01-01T00:00:00Z',
  };

  return [
    {
      ...base,
      assignmentId: 'fix-1',
      type: 'website_redesign',
      matchScore: 87,
      hoursLeft: 61,
      contactedAt: '2026-01-01T00:00:00Z',
      company: {
        name: 'Boulangerie du Théâtre',
        city: 'Angers',
        industry: 'Boulangerie-pâtisserie',
        phone: '+33241000001',
        contactFormUrl: null,
        websiteUrl: 'https://exemple.invalid',
      },
      explanation: {
        why: 'Le site ne répond plus depuis au moins deux passages. Un client qui cherche les horaires ne trouve rien.',
        whyNow: 'Le certificat a expiré le 25 octobre : depuis, chaque navigateur affiche un avertissement.',
        angle: 'Proposer un audit court centré sur la remise en ligne.',
        signals: ['Le site ne répond pas — erreur 503', 'Certificat expiré depuis le 25 octobre'],
        caveats: ['Nous ignorons depuis quand le site est en panne.'],
      },
    },
    {
      ...base,
      assignmentId: 'fix-2',
      type: 'website_redesign',
      matchScore: 74,
      hoursLeft: 8,
      contactedAt: null,
      company: {
        name: 'Menuiserie Blanchard',
        city: 'Rennes',
        industry: 'Menuiserie',
        phone: '+33299000002',
        contactFormUrl: null,
        websiteUrl: 'https://exemple.invalid',
      },
      explanation: {
        why: 'Les composants de la page datent de 2009 : le site annonce son âge à chaque visite.',
        whyNow: '',
        angle: 'Ouvrir sur le contraste entre l’atelier et sa vitrine en ligne.',
        signals: ['jQuery 1.7.2, publié en 2011', 'Aucune adaptation mobile détectée'],
        caveats: [],
      },
    },
    {
      ...base,
      assignmentId: 'fix-3',
      type: 'website_creation',
      matchScore: 66,
      hoursLeft: 61,
      contactedAt: null,
      company: {
        name: 'Pizzeria Fratelli',
        city: 'Nantes',
        industry: 'Restauration',
        phone: null,
        contactFormUrl: 'https://exemple.invalid/contact',
        websiteUrl: null,
      },
      explanation: {
        why: 'Créée en juin, toujours aucun site : une fiche annuaire et un numéro.',
        whyNow: 'L’immatriculation date de juin — les choix d’installation se font maintenant.',
        angle: 'Proposer une page simple avec horaires, carte et réservation.',
        signals: ['Aucun site trouvé', 'Immatriculée en juin 2026'],
        caveats: ['Le budget d’une jeune entreprise est inconnu.'],
      },
    },
  ];
}

function statCells(): Array<[string, number]> {
  const stats: OutcomeStats = { contacted: 14, interested: 4, meeting: 2, proposal: 1, client: 1 };
  return [
    ['Appelées', stats.contacted],
    ['Intéressées', stats.interested],
    ['Rendez-vous', stats.meeting],
    ['Devis', stats.proposal],
    ['Clients', stats.client],
  ];
}

function followUps(): FollowUp[] {
  return [
    {
      assignmentId: 'fix-f1',
      outcome: 'meeting',
      outcomeAt: '2026-01-01T00:00:00Z',
      daysSince: 24,
      type: 'website_redesign',
      company: { name: 'Garage Perrot', city: 'Le Mans', phone: '+33243000003', websiteUrl: null },
    },
    {
      assignmentId: 'fix-f2',
      outcome: 'interested',
      outcomeAt: '2026-01-01T00:00:00Z',
      daysSince: 3,
      type: 'website_creation',
      company: { name: 'Cabinet Riva', city: 'Angers', phone: '+33241000004', websiteUrl: null },
    },
  ];
}
