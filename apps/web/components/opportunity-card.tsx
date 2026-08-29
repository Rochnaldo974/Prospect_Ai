import type { TodayOpportunity } from '@prospect/core';
import { OPPORTUNITY_TYPE_LABELS } from '@prospect/core';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Une opportunité, telle que le freelance la reçoit.
 *
 * L'ordre de lecture est délibéré : d'abord POURQUOI cette entreprise, puis
 * POURQUOI MAINTENANT, et seulement ensuite le moyen de la joindre. Un
 * numéro de téléphone en tête ferait de cette carte un annuaire ; ce que le
 * freelance ne peut pas produire seul, c'est la raison.
 *
 * Rien n'indique ici qu'une des cinq a été tirée au hasard : la mesurer
 * suppose qu'il ne puisse pas la reconnaître.
 */
export function OpportunityCard({ opportunity }: { opportunity: TodayOpportunity }) {
  const { company, explanation: why } = opportunity;

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{company.name}</h2>
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {[company.industry, company.city].filter(Boolean).join(' · ') || '—'}
        </p>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        <Block title="Pourquoi cette entreprise">{why.why}</Block>

        {/* Vide quand rien ne date le contact. Le générateur ne fabrique
            jamais d'urgence, et cette absence est elle-même une information. */}
        {why.whyNow ? <Block title="Pourquoi maintenant">{why.whyNow}</Block> : null}

        <Block title="Par quoi commencer">{why.angle}</Block>

        {why.signals.length > 0 ? (
          <div>
            <Title>Ce qui a été constaté</Title>
            <ul className="mt-1.5 space-y-1">
              {why.signals.map((signal) => (
                <li key={signal} className="flex gap-2 text-muted-foreground">
                  <span aria-hidden className="select-none">—</span>
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {why.caveats.length > 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <Title>À savoir avant d’appeler</Title>
            <ul className="mt-1.5 space-y-1">
              {why.caveats.map((caveat) => (
                <li key={caveat} className="text-amber-800 dark:text-amber-400">{caveat}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
          {company.phone ? (
            <a href={`tel:${company.phone}`} className="font-medium hover:underline">
              {formatPhone(company.phone)}
            </a>
          ) : null}
          {company.contactFormUrl ? (
            <a
              href={company.contactFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:underline"
            >
              Formulaire de contact
            </a>
          ) : null}
          {company.websiteUrl ? (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:underline"
            >
              Voir le site
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** +33241888198 se lit mal ; 02 41 88 81 98 se compose. */
function formatPhone(phone: string): string {
  const french = phone.replace(/^\+33/, '0').replace(/\s/g, '');
  return /^0\d{9}$/.test(french)
    ? french.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
    : phone;
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <Title>{title}</Title>
      <p className="mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}
