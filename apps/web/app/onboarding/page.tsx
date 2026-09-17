import { redirect } from 'next/navigation';

/** L'entrée du paramétrage mène toujours à la première question, en gardant « modifier ». */
export default async function OnboardingIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  redirect('modifier' in params ? '/onboarding/services?modifier' : '/onboarding/services');
}
