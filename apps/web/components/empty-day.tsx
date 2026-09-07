import { OPPORTUNITY_TYPE_LABELS, type EmptyDiagnosis } from '@prospect/core';
import { EmptyState } from '@/components/empty-state';

/**
 * Une journée vide, expliquée.
 *
 * « Le moteur repasse cette nuit » est poli et inutile : ça n'aide pas à
 * décider quoi faire, et ça laisse croire que le produit est en panne alors
 * que la cause la plus fréquente est une case décochée à l'inscription.
 *
 * Chaque cause a donc son message et sa suite. Celle qui compte vraiment est
 * la deuxième : du stock existe, mais le paramétrage l'écarte entièrement.
 * L'utilisateur peut corriger ça en dix secondes — encore faut-il qu'on le lui
 * dise.
 */
export function EmptyDay({ diagnosis }: { diagnosis: EmptyDiagnosis | null }) {
  if (diagnosis?.reason === 'servi') {
    return (
      <EmptyState
        title="Vous avez déjà tout vu aujourd’hui"
        explanation="Les cinq dossiers du jour vous ont été remis, et vous les avez traités. Les suivants arrivent demain matin."
      />
    );
  }

  if (diagnosis?.reason === 'services-non-retenus' && diagnosis.missedTypes.length > 0) {
    const families = diagnosis.missedTypes
      .map((type) => OPPORTUNITY_TYPE_LABELS[type])
      .join(', ');

    return (
      <EmptyState
        title="Du stock existe, mais pas dans vos familles"
        explanation={`${diagnosis.inStock} ${
          diagnosis.inStock === 1 ? 'opportunité est disponible' : 'opportunités sont disponibles'
        } en ce moment, toutes en ${families} — que vous n’avez pas retenu. Cocher cette famille suffirait à les débloquer.`}
        action={{ href: '/onboarding?modifier', label: 'Ajouter cette famille' }}
      />
    );
  }

  if (diagnosis?.reason === 'secteurs-exclus') {
    return (
      <EmptyState
        title="Votre paramétrage écarte tout ce qui est en stock"
        explanation={`${diagnosis.inStock} ${
          diagnosis.inStock === 1 ? 'opportunité est disponible' : 'opportunités sont disponibles'
        }, mais aucune ne passe vos filtres — secteurs exclus ou familles non retenues. Élargir d’un cran suffirait.`}
        action={{ href: '/onboarding?modifier', label: 'Revoir mes préférences' }}
      />
    );
  }

  if (diagnosis?.reason === 'inconnu') {
    return (
      <EmptyState
        title="Rien de nouveau pour vous aujourd’hui"
        explanation="Le stock correspond à votre paramétrage, mais les entreprises concernées sont déjà attribuées, en cooldown, ou sous le seuil de qualité. Le moteur repasse cette nuit."
      />
    );
  }

  return (
    <EmptyState
      title="Le stock est vide aujourd’hui"
      explanation="Mieux vaut ne rien envoyer que du remplissage : une opportunité n’est livrée que si un fait daté et vérifiable la justifie. Le moteur repasse cette nuit."
      action={{ href: '/onboarding?modifier', label: 'Élargir mes préférences' }}
    />
  );
}
