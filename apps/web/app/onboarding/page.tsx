import { redirect } from 'next/navigation';

/** L'entrée du paramétrage mène toujours à la première question. */
export default function OnboardingIndex() {
  redirect('/onboarding/services');
}
