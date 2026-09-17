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
    if (!/^image\/(png|jpe?g|webp)$/.test(logo.type)) {
      return { problem: 'Le logo doit être un PNG, JPG ou WebP.' };
    }
    // Pas de SVG : un SVG peut embarquer un script, et le logo est servi
    // depuis un bucket public puis affiché sur la page d'audit, vue par des
    // tiers. Le type est vérifié sur les premiers octets, pas sur ce que le
    // navigateur déclare.
    const kind = await sniffImage(logo);
    if (!kind) return { problem: 'Le logo doit être un PNG, JPG ou WebP.' };

    const extension = kind === 'jpeg' ? 'jpg' : kind;
    const path = `${profile.id}/logo.${extension}`;
    const { error } = await db.storage.from('logos').upload(path, logo, { upsert: true, contentType: `image/${kind}` });
    if (error) return { problem: 'Le logo n’a pas pu être enregistré — réessayez.' };

    logoUrl = db.storage.from('logos').getPublicUrl(path).data.publicUrl;
  }

  let cvUrl: string | null = null;
  const cv = formData.get('cv');
  if (cv instanceof File && cv.size > 0) {
    if (cv.size > 2 * 1024 * 1024) {
      return { problem: 'Le CV dépasse 2 Mo — exportez-le en PDF allégé.' };
    }
    if (!(await isPdf(cv))) return { problem: 'Le CV doit être un PDF.' };

    const path = `${profile.id}/cv.pdf`;
    const { error: cvError } = await db.storage.from('documents').upload(path, cv, { upsert: true, contentType: 'application/pdf' });
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
    presentation: String(formData.get('presentation') ?? '').trim().slice(0, 600),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    ...(cvUrl ? { cv_url: cvUrl } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) return { problem: 'L’enregistrement a échoué — réessayez dans un instant.' };

  revalidatePath('/dashboard/signature');
  return { saved: true };
}

/** Le type réel d'une image, lu sur ses premiers octets. */
async function sniffImage(file: File): Promise<'png' | 'jpeg' | 'webp' | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45) return 'webp';
  return null;
}

async function isPdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-';
}
