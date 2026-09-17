/**
 * Ce qu'un dossier permet de faire, dit en deux mots.
 *
 * PHONE_READY : on peut appeler. OUTREACH_READY : on peut écrire — une
 * adresse exploitable ou un formulaire. Les deux ensemble, c'est le dossier
 * complet. Ces drapeaux sont calculés à la qualification et portés par
 * l'opportunité, pour que le stock se compte par canal sans rejoindre les
 * contacts à chaque lecture.
 */

export interface ContactState {
  phone: string | null;
  bestEmail: string | null;
  contactFormUrl: string | null;
}

export interface Readiness {
  phoneReady: boolean;
  outreachReady: boolean;
  phoneAndEmailReady: boolean;
  /** Au moins un canal : c'est le nouveau gate. */
  contactable: boolean;
}

export function contactReadiness(state: ContactState): Readiness {
  const phoneReady = state.phone !== null;
  const emailReady = state.bestEmail !== null;
  const formReady = state.contactFormUrl !== null;
  return {
    phoneReady,
    outreachReady: emailReady || formReady,
    phoneAndEmailReady: phoneReady && emailReady,
    contactable: phoneReady || emailReady || formReady,
  };
}
