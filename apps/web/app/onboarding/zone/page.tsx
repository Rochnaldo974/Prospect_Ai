import { getServiceClient, readPreferences } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { ZoneForm } from './zone-form';

export default async function ZoneStep() {
  const profile = await requireUser();
  const initial = await readPreferences(getServiceClient(), profile.id);

  return <ZoneForm initial={initial} />;
}
