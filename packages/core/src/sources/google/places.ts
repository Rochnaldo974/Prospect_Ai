import type { Db } from '../../db/client';
import type { Logger } from '../../logger';
import { companyNameKey, normalizePostalCode } from '../../normalization';

/**
 * La présence Google d'un commerce, par l'API Places (New).
 *
 * Ce que le freelance veut savoir avant d'appeler : est-ce que ce commerce
 * marche ? La note et le nombre d'avis répondent mieux que n'importe quel
 * registre. Et c'est l'argument qui ouvre l'appel : « vos clients vous
 * mettent 4,7, votre site ne le montre pas ».
 *
 * Un appel payant : on ne l'engage que sur un dossier livré, une fois par
 * mois au plus, jamais sur le stock. Le rapprochement est strict — même
 * nom, ou même adresse à moins de 150 mètres — parce qu'attribuer à une
 * boulangerie les avis de sa voisine ferait perdre l'appel en dix
 * secondes.
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.rating', 'places.userRatingCount', 'places.photos', 'places.googleMapsUri',
].join(',');

const RECHECK_AFTER_DAYS = 30;

export interface PlaceCandidate {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  rating: number | null;
  reviewCount: number | null;
  photoCount: number;
  mapsUrl: string | null;
}

export interface PlaceTarget {
  legal_name: string;
  commercial_name: string | null;
  postal_code: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

/**
 * Choisit la fiche Google qui correspond, ou rien.
 *
 * Deux preuves acceptées : la clé de nom identique, ou une fiche à moins de
 * 150 m des coordonnées connues quand le nom se ressemble. Un code postal
 * connu doit se retrouver dans l'adresse. Fonction pure, testée sans réseau.
 */
export function pickPlace(target: PlaceTarget, candidates: PlaceCandidate[]): PlaceCandidate | null {
  const keys = new Set(
    [target.legal_name, target.commercial_name].map((n) => companyNameKey(n)).filter((k): k is string => k !== null),
  );
  const postal = normalizePostalCode(target.postal_code);

  for (const candidate of candidates) {
    if (postal && candidate.address && !candidate.address.includes(postal)) continue;
    const key = companyNameKey(candidate.name);
    const sameName = key !== null && keys.has(key);
    const near = target.lat !== null && target.lon !== null && candidate.lat !== null && candidate.lon !== null
      && distanceMeters(target.lat, target.lon, candidate.lat, candidate.lon) <= 150;
    const similar = key !== null && [...keys].some((k) => k.length >= 5 && (k.includes(key) || key.includes(k)));
    if (sameName || (near && similar)) return candidate;
  }
  return null;
}

interface ApiPlace {
  id?: string;
  displayName?: { text?: string } | null;
  formattedAddress?: string | null;
  location?: { latitude?: number; longitude?: number } | null;
  rating?: number | null;
  userRatingCount?: number | null;
  photos?: unknown[] | null;
  googleMapsUri?: string | null;
}

export interface PlacesOptions {
  apiKey?: string;
  logger?: Logger;
  signal?: AbortSignal;
  /** Injectable pour les tests : renvoie les candidats d'une recherche. */
  search?: (target: PlaceTarget) => Promise<PlaceCandidate[]>;
}

export function placesAvailable(): boolean {
  return Boolean(process.env['GOOGLE_PLACES_API_KEY']);
}

/** La recherche réelle : texte + biais géographique quand on a des coordonnées. */
export async function searchPlaces(target: PlaceTarget, options: PlacesOptions = {}): Promise<PlaceCandidate[]> {
  const apiKey = options.apiKey ?? process.env['GOOGLE_PLACES_API_KEY'];
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY absente');

  const where = [target.postal_code, target.city].filter(Boolean).join(' ');
  const body: Record<string, unknown> = {
    textQuery: `${target.commercial_name ?? target.legal_name} ${where}`.trim(),
    languageCode: 'fr',
    regionCode: 'FR',
    maxResultCount: 5,
  };
  if (target.lat !== null && target.lon !== null) {
    body['locationBias'] = { circle: { center: { latitude: target.lat, longitude: target.lon }, radius: 500 } };
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(body),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok) throw new Error(`Google Places : HTTP ${response.status}`);
  const data = (await response.json()) as { places?: ApiPlace[] };

  return (data.places ?? []).flatMap((p) => (p.id && p.displayName?.text ? [{
    id: p.id,
    name: p.displayName.text,
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
    mapsUrl: p.googleMapsUri ?? null,
  }] : []));
}

export interface PresenceReport {
  examined: number;
  found: number;
  notFound: number;
  skipped: number;
  errors: number;
}

/**
 * Relève la présence Google d'une entreprise, si elle n'a pas été relevée
 * depuis un mois. Une fiche introuvable est datée aussi : on ne repaie pas
 * la même question chaque nuit.
 */
export async function enrichGooglePresence(
  db: Db,
  companyId: string,
  options: PlacesOptions = {},
): Promise<PresenceReport> {
  const report: PresenceReport = { examined: 0, found: 0, notFound: 0, skipped: 0, errors: 0 };
  const log = options.logger;
  if (!options.search && !options.apiKey && !placesAvailable()) { report.skipped += 1; return report; }

  const { data: company, error } = await db
    .from('companies')
    .select('id, legal_name, commercial_name, postal_code, city, lat, lon, google_checked_at')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(`enrichGooglePresence : ${error.message}`);
  if (!company) return report;

  const recheckBefore = Date.now() - RECHECK_AFTER_DAYS * 86_400_000;
  if (company.google_checked_at && new Date(company.google_checked_at).getTime() > recheckBefore) {
    report.skipped += 1;
    return report;
  }

  report.examined += 1;
  const now = new Date().toISOString();
  try {
    const search = options.search ?? ((t: PlaceTarget) => searchPlaces(t, options));
    const candidates = await search(company);
    const place = pickPlace(company, candidates);

    const { error: updateError } = await db.from('companies').update({
      google_checked_at: now,
      ...(place ? {
        google_place_id: place.id,
        google_rating: place.rating,
        google_review_count: place.reviewCount,
        google_photo_count: place.photoCount,
        google_maps_url: place.mapsUrl,
      } : {}),
    }).eq('id', company.id);
    if (updateError) throw new Error(updateError.message);

    if (place) report.found += 1; else report.notFound += 1;
  } catch (cause: unknown) {
    report.errors += 1;
    log?.warn('Présence Google non relevée', {
      company_id: company.id, error: cause instanceof Error ? cause.message : String(cause),
    });
  }
  return report;
}
