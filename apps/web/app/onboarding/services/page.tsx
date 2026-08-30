import { availabilityByType, getServiceClient, readPreferences } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';
import { ServicesForm } from './services-form';

export default async function ServicesStep() {
  const profile = await requireUser();
  const db = getServiceClient();

  const [initial, stock] = await Promise.all([
    readPreferences(db, profile.id),
    availabilityByType(db),
  ]);

  return (
    <ServicesForm
      selected={initial.services}
      stock={Object.fromEntries(stock.map((s) => [s.type, s.available]))}
    />
  );
}
