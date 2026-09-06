import 'server-only';
import { getServiceClient } from '@prospect/core';

/** L'identité d'expéditeur — ce qui fait qu'un e-mail a un visage. */
export interface EmailIdentity {
  fromName: string;
  title: string;
  company: string;
  phone: string;
  website: string;
  logoUrl: string | null;
  cvUrl: string | null;
}

export async function getIdentity(userId: string): Promise<EmailIdentity> {
  const { data } = await getServiceClient()
    .from('email_identities')
    .select('from_name, title, company, phone, website, logo_url, cv_url')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    fromName: data?.from_name ?? '',
    title: data?.title ?? '',
    company: data?.company ?? '',
    phone: data?.phone ?? '',
    website: data?.website ?? '',
    logoUrl: data?.logo_url ?? null,
    cvUrl: data?.cv_url ?? null,
  };
}

/** L'identité est-elle assez remplie pour signer un e-mail ? */
export function identityReady(identity: EmailIdentity): boolean {
  return identity.fromName.trim().length > 0;
}
