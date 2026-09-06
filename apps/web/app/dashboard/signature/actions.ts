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
export interface IdentityState {
  saved?: boolean;
  problem?: string;
}

export async function saveIdentity(
  _previous: IdentityState,
  formData: FormData,
): Promise<IdentityState> {
  const profile = await requireUser();
  const db = getServiceClient();

  const field = (name: string): string => String(formData.get(name) ?? '').trim().slice(0, 120);

  let logoUrl: string | null = null;
  const logo = formData.get('logo');
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 512 * 1024) {
      return { problem: 'Le logo dépasse 512 Ko — compressez-le ou choisissez-en un plus léger.' };
    }
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(logo.type)) {
      return { problem: 'Le logo doit être un PNG, JPG, WebP ou SVG.' };
    }

    // Idempotent : le bucket existe ou se crée, l'erreur « déjà là » est un état.
    await db.storage.createBucket('logos', { public: true }).catch(() => undefined);

    const extension = logo.type === 'image/svg+xml' ? 'svg' : logo.type.split('/')[1];
    const path = `${profile.id}/logo.${extension}`;
    const { error } = await db.storage.from('logos').upload(path, logo, { upsert: true });
    if (error) return { problem: 'Le logo n’a pas pu être enregistré — réessayez.' };

    logoUrl = db.storage.from('logos').getPublicUrl(path).data.publicUrl;
  }

  let cvUrl: string | null = null;
  const cv = formData.get('cv');
  if (cv instanceof File && cv.size > 0) {
    if (cv.size > 2 * 1024 * 1024) {
      return { problem: 'Le CV dépasse 2 Mo — exportez-le en PDF allégé.' };
    }
    if (cv.type !== 'application/pdf') return { problem: 'Le CV doit être un PDF.' };

    await db.storage.createBucket('documents', { public: true }).catch(() => undefined);
    const path = `${profile.id}/cv.pdf`;
    const { error: cvError } = await db.storage.from('documents').upload(path, cv, { upsert: true });
    if (cvError) return { problem: 'Le CV n’a pas pu être enregistré — réessayez.' };
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
  if (error) return { problem: 'L’enregistrement a échoué — réessayez dans un instant.' };

  revalidatePath('/dashboard/signature');
  return { saved: true };
}
