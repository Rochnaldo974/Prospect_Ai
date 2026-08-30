import { getServiceClient, readPreferences } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { SectorsForm } from './sectors-form';

export default async function SectorsStep() {
  const profile = await requireUser();
  const initial = await readPreferences(getServiceClient(), profile.id);

  return <SectorsForm excluded={initial.excludedIndustries} />;
}
