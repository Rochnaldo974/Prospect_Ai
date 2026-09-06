'use server';

import { revalidatePath } from 'next/cache';
import { getServiceClient } from '@prospect/core';
import { requireUser } from '@/lib/auth/session';

/**
 * L'identité d'expéditeur : ce que le destinataire verra en bas de l'e-mail.
 *
 * Le logo passe par le Storage local de Supabase, dans un bucket public :
 * une image de signature doit être servie par une URL stable, pas incrustée
 * en base64 — les clients mail coupent les pièces trop lourdes.
 */
export async function saveIdentity(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const db = getServiceClient();

  const field = (name: string): string => String(formData.get(name) ?? '').trim().slice(0, 120);

  let logoUrl: string | null = null;
  const logo = formData.get('logo');
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 512 * 1024) throw new Error('Logo trop lourd (512 Ko maximum).');
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(logo.type)) {
      throw new Error('Format de logo non pris en charge.');
    }

    // Idempotent : le bucket existe ou se crée, l'erreur « déjà là » est un état.
    await db.storage.createBucket('logos', { public: true }).catch(() => undefined);

    const extension = logo.type === 'image/svg+xml' ? 'svg' : logo.type.split('/')[1];
    const path = `${profile.id}/logo.${extension}`;
    const { error } = await db.storage.from('logos').upload(path, logo, { upsert: true });
    if (error) throw new Error(`Téléversement du logo : ${error.message}`);

    logoUrl = db.storage.from('logos').getPublicUrl(path).data.publicUrl;
  }

  let cvUrl: string | null = null;
  const cv = formData.get('cv');
  if (cv instanceof File && cv.size > 0) {
    if (cv.size > 2 * 1024 * 1024) throw new Error('CV trop lourd (2 Mo maximum).');
    if (cv.type !== 'application/pdf') throw new Error('Le CV doit être un PDF.');

    await db.storage.createBucket('documents', { public: true }).catch(() => undefined);
    const path = `${profile.id}/cv.pdf`;
    const { error: cvError } = await db.storage.from('documents').upload(path, cv, { upsert: true });
    if (cvError) throw new Error(`Téléversement du CV : ${cvError.message}`);
    cvUrl = db.storage.from('documents').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await db.from('email_identities').upsert({
    user_id: profile.id,
    from_name: field('from_name'),
    title: field('title'),
    company: field('company'),
    phone: field('phone'),
    website: field('website'),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    ...(cvUrl ? { cv_url: cvUrl } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Enregistrement : ${error.message}`);

  revalidatePath('/dashboard/signature');
}
